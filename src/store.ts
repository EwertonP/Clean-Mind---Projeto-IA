import { create } from 'zustand';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Patient, Appointment, Billing, DiaryEntry, MedicalRecord, Doctor, Assessment, Expense } from './data';

interface AppState {
  patients: Patient[];
  appointments: Appointment[];
  doctors: Doctor[];
  billing: Billing[];
  diary: DiaryEntry[];
  medicalRecords: MedicalRecord[];
  assessments: Assessment[];
  expenses: Expense[];
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
  assessments: [],
  expenses: [],
  isLoading: true,

  initSync: (doctorId: string) => {
    if (!doctorId) return () => {};
    
    set({ isLoading: true, patients: [], appointments: [], billing: [], diary: [], medicalRecords: [], assessments: [], expenses: [], doctors: [] });

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 5) {
        set({ isLoading: false });
      }
    };

    const activeListeners: Record<string, (() => void)[]> = {};

    const startListenersForDoc = (dId: string) => {
      if (activeListeners[dId]) return;
      activeListeners[dId] = [
        onSnapshot(query(collection(db, 'patients'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.patients.filter(p => p && p.doctor_id !== dId);
            return { patients: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)).filter(Boolean)] };
          });
          checkLoaded();
        }),
        onSnapshot(query(collection(db, 'appointments'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.appointments.filter(a => a && a.doctor_id !== dId);
            return { appointments: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)).filter(Boolean)] };
          });
          checkLoaded();
        }),
        onSnapshot(query(collection(db, 'billing'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.billing.filter(b => b && b.doctor_id !== dId);
            return { billing: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Billing)).filter(Boolean)] };
          });
          checkLoaded();
        }),
        onSnapshot(query(collection(db, 'diary'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.diary.filter(d => d && d.doctor_id !== dId);
            return { diary: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DiaryEntry)).filter(Boolean)] };
          });
          checkLoaded();
        }),
        onSnapshot(query(collection(db, 'medical_records'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.medicalRecords.filter(m => m && m.doctor_id !== dId);
            return { medicalRecords: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord)).filter(Boolean)] };
          });
          checkLoaded();
        }),
        onSnapshot(query(collection(db, 'assessments'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.assessments.filter(a => a && a.doctor_id !== dId);
            return { assessments: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Assessment)).filter(Boolean)] };
          });
        }),
        onSnapshot(query(collection(db, 'expenses'), where('doctor_id', '==', dId)), (snapshot) => {
          set(state => {
            const others = state.expenses.filter(e => e && e.doctor_id !== dId);
            return { expenses: [...others, ...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)).filter(Boolean)] };
          });
        })
      ];
    };

    const stopListenersForDoc = (dId: string) => {
      if (activeListeners[dId]) {
        activeListeners[dId].forEach(unsub => unsub());
        delete activeListeners[dId];
      }
    };

    // Start listeners for the logged-in user
    startListenersForDoc(doctorId);

    const unsubDoctorsAdmin = onSnapshot(query(collection(db, 'doctors'), where('admin_id', '==', doctorId)), (snapshot) => {
      set((state) => {
        const others = snapshot.docs.map(d => d.data() as Doctor);
        const myDoc = state.doctors.find(d => d.id === doctorId);
        const newDocs = [...others];
        if (myDoc && !newDocs.find(d => d.id === myDoc.id)) {
           newDocs.push(myDoc);
        }
        
        // Start listeners for any new managed doctors
        others.forEach(doc => {
          startListenersForDoc(doc.id);
        });
        
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
      // Unsubscribe all active listeners
      Object.keys(activeListeners).forEach(dId => stopListenersForDoc(dId));
      unsubDoctorsAdmin();
      unsubMyDoc();
    };
  }
}));
