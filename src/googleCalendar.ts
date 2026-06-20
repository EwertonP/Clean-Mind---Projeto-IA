import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Appointment } from './data';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

export const connectGoogleCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  }
};

export const getGoogleAccessToken = () => cachedAccessToken;

export const isGoogleCalendarConnected = () => !!cachedAccessToken;

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

export const syncGoogleCalendarEvent = async (appStatus: Partial<Appointment>, patientName: string, doctorName: string, room?: string, doctorToken?: string): Promise<string | undefined> => {
  const tokenToUse = doctorToken || cachedAccessToken;
  
  if (!tokenToUse) {
    console.warn("Google Calendar not connected for this doctor");
    return;
  }
  
  const startTime = new Date(`${appStatus.date}T${appStatus.start_time}:00`);
  const durationInMinutes = appStatus.duration || 60;
  const endTime = new Date(startTime.getTime() + durationInMinutes * 60 * 1000); // dynamic duration

  const prefix = appStatus.is_return ? 'Retorno' : 'Novo Atendimento';
  const event = {
    summary: `${doctorName} / ${prefix} / ${patientName}`,
    description: `Consulta agendada pelo sistema CleanMind.\n\nPaciente: ${patientName}\nData: ${appStatus.date?.split('-').reverse().join('/')}\nHorário: ${appStatus.start_time}\n${room ? `Sala: ${room}\n` : ''}`,
    start: {
      dateTime: startTime.toISOString(),
    },
    end: {
      dateTime: endTime.toISOString(),
    },
  };

  try {
    const isUpdate = !!appStatus.google_event_id;
    const url = isUpdate 
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appStatus.google_event_id}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
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
      if (res.status === 401 && !doctorToken) {
        localStorage.removeItem('google_access_token');
        alert("Sua conexão com o Google Calendar expirou. Por favor, autentique novamente nas configurações.");
      }
      return;
    }
    const data = await res.json();
    console.log("Calendar event synced:", data);
    return data.id;
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
      if (res.status === 401 && !doctorToken) localStorage.removeItem('google_access_token');
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
  time: string
) => {
  if (!cachedAccessToken) {
    console.warn("Google Workspace not connected (missing token)");
    return;
  }

  const subject = `Agendamento Confirmado - CleanMind`;
  const message = `Olá, ${patientName},\n\nSua consulta foi agendada para o dia ${date} às ${time}.\n\nPara alterações, por favor entre em contato com seu profissional.\n\nAtenciosamente,\nEquipe CleanMind`;
  
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${emailTo}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    message
  ];
  
  const emailRaw = btoa(unescape(encodeURIComponent(messageParts.join('\n')))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: emailRaw })
    });
    
    if (!res.ok) {
      console.error("Failed to send email:", await res.text());
    } else {
      console.log("Email sent successfully!");
    }
  } catch (e) {
    console.error("Failed to send email:", e);
  }
};
