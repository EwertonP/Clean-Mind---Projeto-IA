/**
 * Mock Data & LocalStorage Management Engine for CleanMind React Application.
 * Synchronizes patients, appointments, billing, diary entries, and medical records.
 */

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
  clinic_description?: string;
  custom_signature?: string;
  clinic_rooms?: string[];
  business_hours?: {
    start: string;
    end: string;
    days: string;
  };
  created_at?: string;
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
}

export interface Billing {
  id: string;
  patient_id: string;
  doctor_id: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'canceled';
  nfe_status: 'not_issued' | 'issued' | 'failed' | 'processing';
  created_at: string;
  auto_emit_nfe: boolean;
}

export interface DiaryEntry {
  id: string;
  patient_id: string;
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
const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc_983',
    email: 'ewertonphillipe18@gmail.com',
    name: 'Dr. Ewerton Phillipe',
    crp_crm: 'CRM-SP 123456',
    rqe: 'RQE 1234',
    cpf: '123.456.789-00',
    phone: '+55 11 98888-7777',
    specialty: 'Psiquiatra e especialista em TCC',
    plan_type: 'pro',
    clinic_name: 'Clínica One',
    clinic_rooms: ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5'],
    business_hours: {
      start: '08:00',
      end: '18:00',
      days: 'Segunda a Sábado'
    }
  }
];

// Initial Patients
const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat_1',
    doctor_id: 'doc_983',
    name: 'Bruno Alencar',
    email: 'bruno.alencar@email.com',
    phone: '+55 (11) 98822-1111',
    health_insurance: 'Particular',
    status: 'active',
    created_at: '2026-01-15T10:00:00Z'
  },
  {
    id: 'pat_2',
    doctor_id: 'doc_983',
    name: 'Elisa Souza',
    email: 'elisa.souza@email.com',
    phone: '+55 (21) 99344-2222',
    health_insurance: 'Unimed',
    status: 'active',
    created_at: '2026-02-10T14:30:00Z'
  },
  {
    id: 'pat_3',
    doctor_id: 'doc_983',
    name: 'Ana Costa',
    email: 'ana.costa@email.com',
    phone: '+55 (11) 97711-3333',
    health_insurance: 'Bradesco Saúde',
    status: 'active',
    created_at: '2026-03-01T09:15:00Z'
  },
  {
    id: 'pat_4',
    doctor_id: 'doc_983',
    name: 'Daniel Rocha',
    email: 'daniel.rocha@email.com',
    phone: '+55 (31) 98455-4444',
    health_insurance: 'Amil',
    status: 'active',
    created_at: '2026-04-12T11:00:00Z'
  },
  {
    id: 'pat_5',
    doctor_id: 'doc_983',
    name: 'Clara Mendes',
    email: 'clara.mendes@email.com',
    phone: '+55 (11) 99111-5555',
    health_insurance: 'Particular',
    status: 'active',
    created_at: '2026-05-20T16:00:00Z'
  }
];

// Initial Appointments
const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app_1',
    patient_id: 'pat_3', // Ana Costa
    doctor_id: 'doc_983',
    date: '2026-06-09', // Today
    start_time: '09:00',
    duration: 50,
    type: 'online',
    status: 'completed'
  },
  {
    id: 'app_2',
    patient_id: 'pat_4', // Daniel Rocha
    doctor_id: 'doc_983',
    date: '2026-06-09', // Today
    start_time: '14:00',
    duration: 50,
    type: 'presencial',
    room: 'Sala 1',
    status: 'confirmed'
  },
  {
    id: 'app_3',
    patient_id: 'pat_2', // Elisa Souza
    doctor_id: 'doc_983',
    date: '2026-06-09', // Today
    start_time: '16:30',
    duration: 50,
    type: 'online',
    status: 'pending'
  },
  {
    id: 'app_4',
    patient_id: 'pat_1', // Bruno Alencar
    doctor_id: 'doc_983',
    date: '2026-06-10', // Tomorrow
    start_time: '10:00',
    duration: 50,
    type: 'online',
    status: 'confirmed'
  },
  {
    id: 'app_5',
    patient_id: 'pat_5', // Clara Mendes
    doctor_id: 'doc_983',
    date: '2026-06-12',
    start_time: '11:00',
    duration: 50,
    type: 'presencial',
    room: 'Sala 2',
    status: 'confirmed'
  }
];

// Initial Billing
const INITIAL_BILLING: Billing[] = [
  {
    id: 'bill_1',
    patient_id: 'pat_1', // Bruno Alencar
    doctor_id: 'doc_983',
    amount: 350.00,
    due_date: '2026-06-15',
    status: 'pending',
    nfe_status: 'not_issued',
    created_at: '2026-06-01T10:00:00Z',
    auto_emit_nfe: true
  },
  {
    id: 'bill_2',
    patient_id: 'pat_3', // Ana Costa
    doctor_id: 'doc_983',
    amount: 350.00,
    due_date: '2026-06-05',
    status: 'paid',
    nfe_status: 'issued',
    created_at: '2026-05-28T09:00:00Z',
    auto_emit_nfe: true
  },
  {
    id: 'bill_3',
    patient_id: 'pat_5', // Clara Mendes
    doctor_id: 'doc_983',
    amount: 400.00,
    due_date: '2026-05-30',
    status: 'paid',
    nfe_status: 'issued',
    created_at: '2026-05-20T11:00:00Z',
    auto_emit_nfe: false
  },
  {
    id: 'bill_4',
    patient_id: 'pat_4', // Daniel Rocha
    doctor_id: 'doc_983',
    amount: 350.00,
    due_date: '2026-06-25',
    status: 'pending',
    nfe_status: 'not_issued',
    created_at: '2026-06-05T14:00:00Z',
    auto_emit_nfe: true
  }
];

// Initial Diary Entries (WhatsApp inputs)
const INITIAL_DIARY: DiaryEntry[] = [
  {
    id: 'diary_1',
    patient_id: 'pat_1', // Bruno Alencar (CRISIS ALERT)
    content: 'Voltei a sentir aquela pressão imensa no peito. Sinto que não vou aguentar mais, tudo parece pesado demais e simplesmente não vejo saída útil para mim... Quero sumir de vez deste plano, cansei de lutar contra os demônios.',
    sentiment_score: -0.95,
    crisis_flag: true,
    created_at: '2026-06-09T08:12:00Z'
  },
  {
    id: 'diary_2',
    patient_id: 'pat_2', // Elisa Souza (CRISIS ALERT)
    content: 'Não prego o olho há duas noites seguidas. Minha mente está fervendo de paranoia e estou ouvindo sussurros estranhos no corredor. Acho que vou tomar todos os comprimidos da caixa para ver se isso cala a boca de uma vez por todas.',
    sentiment_score: -0.92,
    crisis_flag: true,
    created_at: '2026-06-09T09:44:00Z'
  },
  {
    id: 'diary_3',
    patient_id: 'pat_3', // Ana Costa (Stable/CBT positive)
    content: 'Hoje acordei angustiada, mas apliquei o RPD (Registro de Pensamentos Disfuncionais) que combinamos. Descobri que o medo da reunião era irracional e meu dia foi muito melhor depois. Consegui fazer caminhada.',
    sentiment_score: 0.70,
    crisis_flag: false,
    created_at: '2026-06-09T17:30:00Z'
  },
  {
    id: 'diary_4',
    patient_id: 'pat_4', // Daniel Rocha (Stable/Improving)
    content: 'Tive uma conversa civilizada com meu irmão hoje, sem estourar. Usei a barreira de 5 segundos antes de responder. Senti que mantive as rédeas da minha agressividade. Um pequeno triunfo.',
    sentiment_score: 0.65,
    crisis_flag: false,
    created_at: '2026-06-08T19:15:00Z'
  }
];

// Initial Medical Records
const INITIAL_MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: 'rec_1',
    patient_id: 'pat_3', // Ana Costa
    doctor_id: 'doc_983',
    evolution_text: 'Paciente compareceu à consulta e relatou melhora significativa nos episódios agudos de ansiedade social pós-implementação de técnicas cognição-narrativa e Registro de Pensamentos Disfuncionais (RPD).\n\nAnálise de crença central revela necessidade de aprofundamento na autoexpectativa de desempenho para a próxima sessão.',
    ai_summary: 'Adesão positiva à TCC e aplicação de RPD. Redução de ansiedade social reportada. Foco na reestruturação cognitiva de crenças de autoexpectativa de rendimento na próxima consulta clínica.',
    signature_status: 'signed_icp',
    signed_at: '2026-06-09T10:00:00Z',
    created_at: '2026-06-09T09:00:00Z'
  }
];

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
  },

  getPatients: (): Patient[] => getOrInit('cm_patients', INITIAL_PATIENTS),
  savePatients: (pats: Patient[]) => save('cm_patients', pats),
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
    return newPat;
  },

  getAppointments: (): Appointment[] => getOrInit('cm_appointments', INITIAL_APPOINTMENTS),
  saveAppointments: (apps: Appointment[]) => save('cm_appointments', apps),
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
    return newApp;
  },
  updateAppointment: (id: string, appData: Partial<Appointment>): Appointment | null => {
    const list = dataManager.getAppointments();
    const idx = list.findIndex(app => app.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...appData };
    dataManager.saveAppointments(list);
    return list[idx];
  },

  getBilling: (): Billing[] => getOrInit('cm_billing', INITIAL_BILLING),
  saveBilling: (bill: Billing[]) => save('cm_billing', bill),
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
    return newBill;
  },

  getDiaryEntries: (): DiaryEntry[] => getOrInit('cm_diary', INITIAL_DIARY),
  saveDiaryEntries: (entries: DiaryEntry[]) => save('cm_diary', entries),
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

    const newEntry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      patient_id,
      content,
      sentiment_score: parseFloat(score.toFixed(2)),
      crisis_flag: isCrisis,
      created_at: new Date().toISOString()
    };
    
    list.unshift(newEntry); // Prepend to show immediately in summaries or alerts
    dataManager.saveDiaryEntries(list);
    return newEntry;
  },

  getMedicalRecords: (): MedicalRecord[] => getOrInit('cm_medical_records', INITIAL_MEDICAL_RECORDS),
  saveMedicalRecords: (recs: MedicalRecord[]) => save('cm_medical_records', recs),
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
    return newRec;
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
