/**
 * Mock Data & LocalStorage Management Engine for CleanMind React Application.
 * Synchronizes patients, appointments, billing, diary entries, and medical records.
 */

import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';

export interface Doctor {

  id: string;
  email: string;
  name: string;
  crp_crm: string;
  is_configured?: boolean;
  rqe?: string;
  cpf?: string;
  phone?: string;
  specialty: string;
  admin_id?: string;
  role?: 'admin' | 'doctor';
  plan_type?: 'free' | 'premium' | 'pro';
  clinic_name?: string;
  clinic_address?: string;
  clinic_cnpj?: string;
  clinic_founded?: string;
  clinic_street?: string;
  clinic_neighborhood?: string;
  clinic_zip?: string;
  clinic_city?: string;
  clinic_state?: string;
  clinic_website?: string;
  clinic_logo?: string;
  clinic_description?: string;
  custom_signature?: string;
  clinic_rooms?: string[];
  business_hours?: {
    start: string;
    end: string;
    days: string;
  };
  consultation_price?: number;
  created_at?: string;
  photo_url?: string;
  google_access_token?: string;
  google_connected_email?: string;
}

export interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email: string;
  phone: string;
  health_insurance?: string;
  medical_history?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  tags?: string[];
  photo_url?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  duration: number; // minutes
  type: 'online' | 'presencial';
  room?: string; // e.g. "Sala 1", "Sala 2"
  status: 'pending' | 'confirmed' | 'completed' | 'canceled';
  is_return?: boolean;
  price?: number;
  billing_id?: string;
  google_event_id?: string;
}

export interface Billing {
  id: string;
  patient_id: string;
  doctor_id: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'canceled';
  nfe_status: 'not_issued' | 'issued' | 'failed' | 'processing';
  payment_method?: 'pix' | 'cartao' | 'dinheiro';
  created_at: string;
  auto_emit_nfe: boolean;
  appointment_id?: string;
}

export interface DiaryEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  content: string;
  sentiment_score: number; // -1.00 to 1.00
  crisis_flag: boolean;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  evolution_text: string;
  prontuario_text?: string;
  ai_summary: string;
  signature_status: 'unsigned' | 'signed_icp';
  signed_at?: string;
  created_at: string;
}

// Initial Doctors List
const INITIAL_DOCTORS: Doctor[] = [];

// Initial Patients
const INITIAL_PATIENTS: Patient[] = [];

// Initial Appointments
const INITIAL_APPOINTMENTS: Appointment[] = [];

// Initial Billing
const INITIAL_BILLING: Billing[] = [];

// Initial Diary Entries (WhatsApp inputs)
const INITIAL_DIARY: DiaryEntry[] = [];

// Initial Medical Records
const INITIAL_MEDICAL_RECORDS: MedicalRecord[] = [];

// LocalStorage Helper Getters / Setters
function getOrInit<T>(key: string, initial: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return initial;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Helper for Firestore
function cleanForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    // Prevent Firestore 1MB document limit errors for large base64 images
    if (typeof obj === 'string' && obj.length > 900000) {
      return null;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanForFirestore).filter(v => v !== undefined);
  }
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      newObj[key] = cleanForFirestore(obj[key]);
    }
  }
  return newObj;
}

async function persistToFirestore(collectionName: string, id: string, docData: any) {
  try {
    if (auth.currentUser) {
      const cleanData = cleanForFirestore(docData);
      await setDoc(doc(db, collectionName, id), cleanData, { merge: true });
    }
  } catch (err) {
    console.error('Failed to sync to Firestore: ', err);
  }
}

async function removeFirestoreDoc(collectionName: string, id: string) {
  try {
    if (auth.currentUser) {
      await deleteDoc(doc(db, collectionName, id));
    }
  } catch (err) {
    console.error('Failed to delete from Firestore: ', err);
  }
}

export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      } else if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str); // Fallback
  });
};

export const dataManager = {
  getDoctors: (): Doctor[] => getOrInit('cm_doctors', INITIAL_DOCTORS),
  saveDoctors: (docs: Doctor[]) => save('cm_doctors', docs),
  getDoctor: (): Doctor => {
    const sessionId = localStorage.getItem('cm_doctor_session');
    const doctors = dataManager.getDoctors();
    if (sessionId) {
      const doc = doctors.find(d => d.id === sessionId);
      if (doc) return doc;
    }
    return doctors[0] || INITIAL_DOCTORS[0];
  },
  saveDoctor: (doc: Doctor) => {
    const docs = dataManager.getDoctors();
    const idx = docs.findIndex(d => d.id === doc.id);
    if(idx >= 0) { docs[idx] = doc; } else { docs.push(doc); }
    dataManager.saveDoctors(docs);
    persistToFirestore('doctors', doc.id, doc);
  },
  deleteDoctor: (id: string) => {
    const docs = dataManager.getDoctors();
    const filteredDocs = docs.filter(d => d.id !== id);
    dataManager.saveDoctors(filteredDocs);
    removeFirestoreDoc('doctors', id);
  },

  addAuditLog: (action: string, details: string, patient_id?: string) => {
    const docId = dataManager.getDoctor().id;
    if (!docId) return;
    const log = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      doctor_id: docId,
      patient_id: patient_id || '',
      action,
      details,
      created_at: new Date().toISOString()
    };
    // Salva localmente se quiser, mas prioritário no firestore
    const localLogs = getOrInit<any[]>('cm_audit_logs', []);
    localLogs.unshift(log);
    save('cm_audit_logs', localLogs);
    persistToFirestore('audit_logs', log.id, log);
  },

  getPatients: (): Patient[] => {
    const docId = dataManager.getDoctor().id;
    return getOrInit<Patient[]>('cm_patients', INITIAL_PATIENTS).filter(p => p.doctor_id === docId);
  },
  savePatients: (pats: Patient[]) => {
    // Save only patients from the current doctor, merge with existing
    const docId = dataManager.getDoctor().id;
    const allPats = getOrInit<Patient[]>('cm_patients', INITIAL_PATIENTS).filter(p => p.doctor_id !== docId);
    save('cm_patients', [...allPats, ...pats]);
    // Optionally firestore batch save, but we'll do individual items elsewhere
  },
  updatePatient: (id: string, patData: Partial<Patient>): Patient | null => {
    const list = dataManager.getPatients();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patData };
    dataManager.savePatients(list);
    persistToFirestore('patients', id, list[idx]);
    return list[idx];
  },
  addPatient: (pat: Omit<Patient, 'id' | 'doctor_id' | 'created_at'>): Patient => {
    const list = dataManager.getPatients();
    const newPat: Patient = {
      ...pat,
      id: `pat_${Date.now()}`,
      doctor_id: dataManager.getDoctor().id,
      created_at: new Date().toISOString()
    };
    list.push(newPat);
    dataManager.savePatients(list);
    persistToFirestore('patients', newPat.id, newPat);
    return newPat;
  },

  deletePatient: (id: string) => {
    const list = dataManager.getPatients();
    const filteredList = list.filter(p => p.id !== id);
    dataManager.savePatients(filteredList);
    removeFirestoreDoc('patients', id);
  },

  getAppointments: (): Appointment[] => {
    const docId = dataManager.getDoctor().id;
    return getOrInit<Appointment[]>('cm_appointments', INITIAL_APPOINTMENTS).filter(a => a.doctor_id === docId);
  },
  saveAppointments: (apps: Appointment[]) => {
    const docId = dataManager.getDoctor().id;
    const allApps = getOrInit<Appointment[]>('cm_appointments', INITIAL_APPOINTMENTS).filter(a => a.doctor_id !== docId);
    save('cm_appointments', [...allApps, ...apps]);
  },
  addAppointment: (app: Omit<Appointment, 'id' | 'doctor_id'>): Appointment => {
    const list = dataManager.getAppointments();
    const patient = dataManager.getPatients().find(p => p.id === app.patient_id);
    const newApp: Appointment = {
      ...app,
      id: `app_${Date.now()}`,
      doctor_id: patient?.doctor_id || dataManager.getDoctor().id
    };
    list.push(newApp);
    dataManager.saveAppointments(list);
    persistToFirestore('appointments', newApp.id, newApp);
    return newApp;
  },
  updateAppointment: (id: string, appData: Partial<Appointment>): Appointment | null => {
    const list = dataManager.getAppointments();
    const idx = list.findIndex(app => app.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...appData };
    dataManager.saveAppointments(list);
    persistToFirestore('appointments', id, list[idx]);
    return list[idx];
  },
  deleteAppointment: (id: string) => {
    let list = dataManager.getAppointments();
    list = list.filter(app => app.id !== id);
    dataManager.saveAppointments(list);
    removeFirestoreDoc('appointments', id);
  },

  getBilling: (): Billing[] => {
    const docId = dataManager.getDoctor().id;
    return getOrInit<Billing[]>('cm_billing', INITIAL_BILLING).filter(b => b.doctor_id === docId);
  },
  saveBilling: (bill: Billing[]) => {
    const docId = dataManager.getDoctor().id;
    const allBills = getOrInit<Billing[]>('cm_billing', INITIAL_BILLING).filter(b => b.doctor_id !== docId);
    save('cm_billing', [...allBills, ...bill]);
  },
  updateBilling: (id: string, billData: Partial<Billing>): Billing | null => {
    const list = dataManager.getBilling();
    const idx = list.findIndex(b => b.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...billData };
    dataManager.saveBilling(list);
    persistToFirestore('billing', id, list[idx]);
    return list[idx];
  },
  addBilling: (entry: Omit<Billing, 'id' | 'doctor_id' | 'created_at' | 'nfe_status'>): Billing => {
    const list = dataManager.getBilling();
    const patient = dataManager.getPatients().find(p => p.id === entry.patient_id);
    const newBill: Billing = {
      ...entry,
      id: `bill_${Date.now()}`,
      doctor_id: patient?.doctor_id || dataManager.getDoctor().id,
      nfe_status: entry.auto_emit_nfe ? 'processing' : 'not_issued',
      created_at: new Date().toISOString()
    };
    list.push(newBill);
    dataManager.saveBilling(list);
    persistToFirestore('billing', newBill.id, newBill);
    return newBill;
  },

  getDiaryEntries: (): DiaryEntry[] => {
    // Diary entries don't have doctor_id directly, they map through patient
    const patientIds = dataManager.getPatients().map(p => p.id);
    return getOrInit<DiaryEntry[]>('cm_diary', INITIAL_DIARY).filter(d => patientIds.includes(d.patient_id));
  },
  saveDiaryEntries: (entries: DiaryEntry[]) => {
    const patientIds = dataManager.getPatients().map(p => p.id);
    const allEntries = getOrInit<DiaryEntry[]>('cm_diary', INITIAL_DIARY).filter(d => !patientIds.includes(d.patient_id));
    save('cm_diary', [...allEntries, ...entries]);
  },
  updateDiaryEntry: (id: string, updates: Partial<DiaryEntry>): DiaryEntry | null => {
    const list = dataManager.getDiaryEntries();
    const idx = list.findIndex(e => e.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...updates };
    dataManager.saveDiaryEntries(list);
    persistToFirestore('diary', id, list[idx]);
    return list[idx];
  },
  addDiaryEntry: (patient_id: string, content: string): DiaryEntry => {
    const list = dataManager.getDiaryEntries();
    
    // Quick heuristic analyzer simulating AWS/OpenAI/Gemini clinical mood triage
    // Search for keywords that match extreme warning flags under LGPD/ANVISA
    const contentLower = content.toLowerCase();
    const suicidalKeywords = [
      'suicidio', 'suicídio', 'me matar', 'acabar com a vida', 'acabar com tudo', 
      'quero sumir', 'quero morrer', 'tomar todos os comprimidos', 'nao aguento mais',
      'não aguento mais', 'morte', 'desistir', 'não vejo saída', 'desespero imenso', 'dar fim'
    ];
    const isCrisis = suicidalKeywords.some(keyword => contentLower.includes(keyword));
    
    // Sentiment heuristic calculation (-1.0 to +1.0)
    let score = 0.0;
    if (isCrisis) {
      score = -0.90 - Math.random() * 0.08;
    } else {
      const positiveWords = ['bem', 'ótimo', 'melhor', 'consegui', 'fácil', 'feliz', 'calmo', 'tranquilo', 'triunfo', 'positivo', 'respiração', 'excelente'];
      const negativeWords = ['ansioso', 'pressão', 'medo', 'angústia', 'angustiada', 'triste', 'chorei', 'paranoia', 'mal', 'difícil', 'ruim', 'pesado'];
      
      let posCount = 0;
      let negCount = 0;
      positiveWords.forEach(w => { if (contentLower.includes(w)) posCount++; });
      negativeWords.forEach(w => { if (contentLower.includes(w)) negCount++; });
      
      if (posCount > negCount) {
        score = Math.min(0.95, 0.2 + (posCount - negCount) * 0.15);
      } else if (negCount > posCount) {
        score = Math.max(-0.85, -0.2 - (negCount - posCount) * 0.15);
      } else {
        score = 0.0;
      }
    }

    const patient = dataManager.getPatients().find(p => p.id === patient_id);
    const newEntry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      patient_id,
      doctor_id: patient?.doctor_id || dataManager.getDoctor().id,
      content,
      sentiment_score: parseFloat(score.toFixed(2)),
      crisis_flag: isCrisis,
      created_at: new Date().toISOString()
    };
    
    list.unshift(newEntry); // Prepend to show immediately in summaries or alerts
    dataManager.saveDiaryEntries(list);
    persistToFirestore('diary', newEntry.id, newEntry);
    return newEntry;
  },

  getMedicalRecords: (): MedicalRecord[] => {
    const docId = dataManager.getDoctor().id;
    return getOrInit<MedicalRecord[]>('cm_medical_records', INITIAL_MEDICAL_RECORDS).filter(r => r.doctor_id === docId);
  },
  saveMedicalRecords: (recs: MedicalRecord[]) => {
    const docId = dataManager.getDoctor().id;
    const allRecs = getOrInit<MedicalRecord[]>('cm_medical_records', INITIAL_MEDICAL_RECORDS).filter(r => r.doctor_id !== docId);
    save('cm_medical_records', [...allRecs, ...recs]);
  },
  addMedicalRecord: (rec: Omit<MedicalRecord, 'id' | 'doctor_id' | 'created_at'>): MedicalRecord => {
    const list = dataManager.getMedicalRecords();
    const patient = dataManager.getPatients().find(p => p.id === rec.patient_id);
    const newRec: MedicalRecord = {
      ...rec,
      id: `rec_${Date.now()}`,
      doctor_id: patient?.doctor_id || dataManager.getDoctor().id,
      created_at: new Date().toISOString()
    };
    list.push(newRec);
    dataManager.saveMedicalRecords(list);
    persistToFirestore('medical_records', newRec.id, newRec);
    return newRec;
  },
  updateMedicalRecord: (id: string, recData: Partial<MedicalRecord>): MedicalRecord | null => {
    const list = dataManager.getMedicalRecords();
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...recData };
    dataManager.saveMedicalRecords(list);
    persistToFirestore('medical_records', id, list[idx]);
    return list[idx];
  },
  deleteMedicalRecord: (id: string): void => {
    const list = dataManager.getMedicalRecords();
    const filtered = list.filter(r => r.id !== id);
    dataManager.saveMedicalRecords(filtered);
    removeFirestoreDoc('medical_records', id);
  },
  
  // Pulls all data for a doctor from Firestore and overwrites localStorage
  pullFromFirestore: async (doctorId: string): Promise<void> => {
    if (!auth.currentUser) return;
    
    try {
      const pats = await getDocs(query(collection(db, 'patients'), where('doctor_id', '==', doctorId)));
      const apps = await getDocs(query(collection(db, 'appointments'), where('doctor_id', '==', doctorId)));
      const bills = await getDocs(query(collection(db, 'billing'), where('doctor_id', '==', doctorId)));
      const medical = await getDocs(query(collection(db, 'medical_records'), where('doctor_id', '==', doctorId)));
      const diaryDocs = await getDocs(query(collection(db, 'diary'), where('doctor_id', '==', doctorId)));
      
      const diaries = diaryDocs.docs.map(d => d.data() as DiaryEntry);

      dataManager.savePatients(pats.docs.map(d => d.data() as Patient));
      dataManager.saveAppointments(apps.docs.map(d => d.data() as Appointment));
      dataManager.saveBilling(bills.docs.map(d => d.data() as Billing));
      dataManager.saveMedicalRecords(medical.docs.map(d => d.data() as MedicalRecord));
      dataManager.saveDiaryEntries(diaries);

      // We should also pull the doctor doc itself and any created doctors
      let pulledDoctors: Doctor[] = [];
      const docSnap = await getDoc(doc(db, 'doctors', doctorId));
      if (docSnap.exists()) {
        const docInfo = docSnap.data() as Doctor;
        pulledDoctors.push(docInfo);
      }
      
      const adminDocsSnap = await getDocs(query(collection(db, 'doctors'), where('admin_id', '==', doctorId)));
      adminDocsSnap.docs.forEach(d => {
        const docData = d.data() as Doctor;
        if (docData.id !== doctorId) pulledDoctors.push(docData);
      });
      
      dataManager.saveDoctors(pulledDoctors);
    } catch (error) {
      console.warn("Error pulling from Firestore:", error);
    }
  },

  // Resets the system variables
  resetAll: (): void => {
    localStorage.removeItem('cm_doctors');
    localStorage.removeItem('cm_patients');
    localStorage.removeItem('cm_appointments');
    localStorage.removeItem('cm_billing');
    localStorage.removeItem('cm_diary');
    localStorage.removeItem('cm_medical_records');
    window.location.reload();
  }
};
