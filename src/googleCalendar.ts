import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Appointment } from './data';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        localStorage.removeItem('google_access_token');
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const connectGoogleCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = () => cachedAccessToken;

export const isGoogleCalendarConnected = () => !!cachedAccessToken;

export const disconnectGoogleCalendar = () => {
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
};

export const checkGoogleCalendarAvailability = async (
  startTime: Date,
  endTime: Date,
  doctorToken?: string,
  excludeEventId?: string
): Promise<boolean> => {
  const tokenToUse = doctorToken || cachedAccessToken;
  if (!tokenToUse) return true; // If not connected, assume available (or we could throw, but let's assume true so we don't break the app)

  try {
    const timeMin = startTime.toISOString();
    const timeMax = endTime.toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenToUse}`,
      }
    });

    if (!res.ok) {
      console.error("Failed to fetch calendar events:", await res.text());
      return true; // assume available on error so we don't block
    }

    const data = await res.json();
    const events = data.items || [];
    
    // Check if there's any event overlapping
    // Google Calendar might return events that exactly border the time limits, 
    // but timeMin/timeMax are strict (exclusive or inclusive depending on exact matching).
    // Usually, overlapping means an event exists in this window.
    const conflictingEvents = events.filter((e: any) => {
      // Exclude self if updating
      if (excludeEventId && e.id === excludeEventId) return false;
      // Also maybe exclude entirely transparent events (like "free" time).
      if (e.transparency === 'transparent') return false;
      return true;
    });

    return conflictingEvents.length === 0;
  } catch (e) {
    console.error("Failed to check calendar availability:", e);
    return true; // assume available on error
  }
};

export const syncGoogleCalendarEvent = async (appStatus: Partial<Appointment>, patientName: string, doctorName: string, room?: string, doctorToken?: string, patientEmail?: string): Promise<{ eventId: string, meetLink?: string } | undefined> => {
  const tokenToUse = doctorToken || cachedAccessToken;
  
  if (!tokenToUse) {
    console.warn("Google Calendar not connected for this doctor");
    return;
  }
  
  const startTime = new Date(`${appStatus.date}T${appStatus.start_time}:00`);
  const durationInMinutes = appStatus.duration || 60;
  const endTime = new Date(startTime.getTime() + durationInMinutes * 60 * 1000);

  const prefix = appStatus.type === 'online' ? 'Online' : 'Presencial';
  
  const displayDoctorName = doctorName.toLowerCase().startsWith('dr') ? doctorName : `Dr(a). ${doctorName}`;
  const event: any = {
    summary: `${displayDoctorName} | ${prefix} | ${patientName}`,
    description: `Consulta agendada pelo sistema CleanMind.\n\nPaciente: ${patientName}\nData: ${appStatus.date?.split('-').reverse().join('/')}\nHorário: ${appStatus.start_time}\n${room ? `Sala: ${room}\n` : ''}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  if (patientEmail) {
    event.attendees = [{ email: patientEmail }];
  }

  if (appStatus.type === 'online') {
    event.conferenceData = {
      createRequest: {
        requestId: `cleanmind-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" }
      }
    };
  }

  try {
    const isUpdate = !!appStatus.google_event_id;
    const url = isUpdate 
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appStatus.google_event_id}?conferenceDataVersion=1`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
    const method = isUpdate ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${tokenToUse}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error("Failed to sync to calendar:", errText);
      if (res.status === 401) {
        if (!doctorToken) {
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
        }
        alert("Sua conexão com o Google Calendar expirou ou é inválida. Por favor, autentique novamente nas configurações / perfil do médico.");
      }
      return;
    }
    const data = await res.json();
    console.log("Calendar event synced:", data);
    
    let meetLink = undefined;
    if (data.conferenceData && data.conferenceData.entryPoints) {
      const videoEntry = data.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
      if (videoEntry) meetLink = videoEntry.uri;
    }

    return { eventId: data.id, meetLink };
  } catch (e) {
    console.error("Failed to sync to calendar:", e);
  }
};

export const deleteGoogleCalendarEvent = async (eventId: string, doctorToken?: string) => {
  const tokenToUse = doctorToken || cachedAccessToken;
  if (!tokenToUse) return;
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (!doctorToken) {
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
        }
      }
      if (res.status === 410) {
        console.log("Calendar event already deleted");
        return;
      }
      console.error("Failed to delete from calendar:", await res.text());
    } else {
      console.log("Calendar event deleted");
    }
  } catch (e) {
    console.error("Failed to delete from calendar:", e);
  }
};

export const sendAppointmentEmail = async (
  emailTo: string, 
  patientName: string, 
  date: string, 
  time: string,
  type: string,
  meetLink?: string,
  address?: string,
  doctorName?: string
) => {
  try {
    const res = await fetch('/api/send-appointment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailTo,
        patientName,
        date,
        time,
        type,
        meetLink,
        address,
        doctorName
      })
    });
    if (!res.ok) {
      console.error("Failed to send appointment email from server");
    }
  } catch (e) {
    console.error("Failed to send appointment email:", e);
  }
};
