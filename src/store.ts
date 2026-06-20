import { create } from 'zustand';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Patient, Appointment, Billing, DiaryEntry, MedicalRecord, Doctor } from './data';

interface AppState {
  patients: Patient[];
  appointments: Appointment[];
  doctors: Doctor[];
  billing: Billing[];
  diary: DiaryEntry[];
  medicalRecords: MedicalRecord[];
  isLoading: boolean;
  
  initSync: (doctorId: string) => () => void;
}

export const useStore = create<AppState>((set) => ({
  patients: [],
  appointments: [],
  doctors: [],
  billing: [],
  diary: [],
  medicalRecords: [],
  isLoading: true,

  initSync: (doctorId: string) => {
    if (!doctorId) return () => {};
    
    set({ isLoading: true });

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 5) {
        set({ isLoading: false });
      }
    };

    const unsubPatients = onSnapshot(query(collection(db, 'patients'), where('doctor_id', '==', doctorId)), (snapshot) => {
      set({ patients: snapshot.docs.map(d => d.data() as Patient) });
      checkLoaded();
    });

    const unsubAppointments = onSnapshot(query(collection(db, 'appointments'), where('doctor_id', '==', doctorId)), (snapshot) => {
      set({ appointments: snapshot.docs.map(d => d.data() as Appointment) });
      checkLoaded();
    });

    const unsubBilling = onSnapshot(query(collection(db, 'billing'), where('doctor_id', '==', doctorId)), (snapshot) => {
      set({ billing: snapshot.docs.map(d => d.data() as Billing) });
      checkLoaded();
    });

    const unsubDiary = onSnapshot(query(collection(db, 'diary'), where('doctor_id', '==', doctorId)), (snapshot) => {
      set({ diary: snapshot.docs.map(d => d.data() as DiaryEntry) });
      checkLoaded();
    });

    const unsubMedicalRecords = onSnapshot(query(collection(db, 'medical_records'), where('doctor_id', '==', doctorId)), (snapshot) => {
      set({ medicalRecords: snapshot.docs.map(d => d.data() as MedicalRecord) });
      checkLoaded();
    });

    const unsubDoctorsAdmin = onSnapshot(query(collection(db, 'doctors'), where('admin_id', '==', doctorId)), (snapshot) => {
      set((state) => {
        const others = snapshot.docs.map(d => d.data() as Doctor);
        const myDoc = state.doctors.find(d => d.id === doctorId);
        const newDocs = [...others];
        if (myDoc && !newDocs.find(d => d.id === myDoc.id)) {
           newDocs.push(myDoc);
        }
        return { doctors: newDocs };
      });
    });

    const unsubMyDoc = onSnapshot(doc(db, 'doctors', doctorId), (snapshot) => {
      if (snapshot.exists()) {
        const myDoc = snapshot.data() as Doctor;
        set((state) => {
          const others = state.doctors.filter(d => d.id !== doctorId);
          return { doctors: [...others, myDoc] };
        });
      }
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubBilling();
      unsubDiary();
      unsubMedicalRecords();
      unsubDoctorsAdmin();
      unsubMyDoc();
    };
  }
}));
