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

export const connectGoogleCalendar = async (doctorId?: string): Promise<boolean> => {
  const dId = doctorId || localStorage.getItem('cm_doctor_session');
  if (!dId) {
    alert('Erro: Sessão do médico não encontrada.');
    return false;
  }
  return new Promise((resolve) => {
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      `/api/auth/google/url?doctorId=${dId}`,
      'Google Auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      alert('Por favor, permita popups para conectar com o Google Calendar.');
      resolve(false);
      return;
    }

    const messageListener = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.doctorId === dId) {
        window.removeEventListener('message', messageListener);
        resolve(true);
      }
    };

    window.addEventListener('message', messageListener);

    // Detect if popup is closed
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setTimeout(() => {
          window.removeEventListener('message', messageListener);
          resolve(false);
        }, 1000);
      }
    }, 500);
  });
};

export const getGoogleAccessToken = () => cachedAccessToken;

export const isGoogleCalendarConnected = (doctor?: any) => {
  const d = doctor || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cm_doctors') || '[]').find((doc: any) => doc.id === localStorage.getItem('cm_doctor_session')) : null);
  return !!(d?.google_refresh_token || d?.google_access_token);
};

export const disconnectGoogleCalendar = async (doctorId?: string) => {
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  
  const dId = doctorId || localStorage.getItem('cm_doctor_session');
  if (dId) {
    try {
      const doctors = JSON.parse(localStorage.getItem('cm_doctors') || '[]');
      const idx = doctors.findIndex((d: any) => d.id === dId);
      if (idx >= 0) {
        doctors[idx].google_access_token = undefined;
        doctors[idx].google_refresh_token = undefined;
        doctors[idx].google_token_expiry = undefined;
        doctors[idx].google_connected_email = undefined;
        localStorage.setItem('cm_doctors', JSON.stringify(doctors));
      }
    } catch (e) {
      console.error(e);
    }
    
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await updateDoc(doc(db, 'doctors', dId), {
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_connected_email: null
      });
    } catch (err) {
      console.error("Failed to disconnect in firestore:", err);
    }
  }
};

export const getValidTokenForDoctor = async (doctorId: string): Promise<string | undefined> => {
  try {
    const res = await fetch('/api/auth/google/get-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doctorId })
    });
    if (!res.ok) {
      console.warn(`Failed to get valid Google token for doctor ${doctorId}: ${res.status}`);
      return undefined;
    }
    const data = await res.json();
    return data.accessToken;
  } catch (err) {
    console.error("Error fetching valid Google token:", err);
    return undefined;
  }
};

export const checkGoogleCalendarAvailability = async (
  startTime: Date,
  endTime: Date,
  doctorToken?: string,
  excludeEventId?: string,
  doctorId?: string
): Promise<boolean> => {
  const dId = doctorId || localStorage.getItem('cm_doctor_session');
  let tokenToUse = doctorToken;
  
  if (dId) {
    const freshToken = await getValidTokenForDoctor(dId);
    if (freshToken) {
      tokenToUse = freshToken;
    }
  }
  
  if (!tokenToUse) {
    tokenToUse = cachedAccessToken;
  }
  
  if (!tokenToUse) return true;

  if (tokenToUse.startsWith('mock_')) {
    console.log("Mock Google Calendar: Checking availability (always available)");
    return true;
  }

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
    const conflictingEvents = events.filter((e: any) => {
      // Exclude self if updating
      if (excludeEventId && e.id === excludeEventId) return false;
      // Exclude transparent events
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
  const doctorId = appStatus.doctor_id || localStorage.getItem('cm_doctor_session');
  let tokenToUse = doctorToken;
  
  if (doctorId) {
    const freshToken = await getValidTokenForDoctor(doctorId);
    if (freshToken) {
      tokenToUse = freshToken;
    }
  }
  
  if (!tokenToUse) {
    tokenToUse = cachedAccessToken;
  }
  
  if (!tokenToUse) {
    console.warn("Google Calendar not connected for this doctor");
    return;
  }
  
  if (tokenToUse.startsWith('mock_')) {
    console.log("Mock Google Calendar: Syncing event");
    return { eventId: `mock_event_${Date.now()}`, meetLink: "https://meet.google.com/mock-meet-link" };
  }
  
  if (!appStatus.date || !appStatus.start_time) {
    console.warn("Invalid date or start_time for calendar sync");
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

  if (patientEmail && patientEmail.includes('@') && patientEmail.trim().length > 3) {
    event.attendees = [{ email: patientEmail.trim() }];
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
        if (!doctorToken && doctorId) {
          disconnectGoogleCalendar(doctorId);
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

export const deleteGoogleCalendarEvent = async (eventId: string, doctorToken?: string, doctorId?: string) => {
  const dId = doctorId || localStorage.getItem('cm_doctor_session');
  let tokenToUse = doctorToken;
  
  if (dId) {
    const freshToken = await getValidTokenForDoctor(dId);
    if (freshToken) {
      tokenToUse = freshToken;
    }
  }
  
  if (!tokenToUse) {
    tokenToUse = cachedAccessToken;
  }
  
  if (!tokenToUse) return;

  if (tokenToUse.startsWith('mock_')) {
    console.log("Mock Google Calendar: Deleting event");
    return;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenToUse}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (!doctorToken && dId) {
          disconnectGoogleCalendar(dId);
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
