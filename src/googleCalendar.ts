import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Appointment } from './data';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let cachedAccessToken: string | null = null;

export const connectGoogleCalendar = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  }
};

export const getGoogleAccessToken = () => cachedAccessToken;

export const isGoogleCalendarConnected = () => !!cachedAccessToken;

export const addToGoogleCalendar = async (appStatus: Partial<Appointment>, patientName: string) => {
  if (!cachedAccessToken) {
    console.warn("Google Calendar not connected");
    return;
  }
  
  const startTime = new Date(`${appStatus.date}T${appStatus.start_time}:00`);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

  const event = {
    summary: `Consulta: ${patientName}`,
    description: `Consulta agendada pelo sistema CleanMind.`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });
    const data = await res.json();
    console.log("Calendar event created:", data);
  } catch (e) {
    console.error("Failed to sync to calendar:", e);
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
