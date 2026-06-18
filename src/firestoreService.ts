import { collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Data fetching helper
export const fetchCollection = async <T>(collectionName: string, doctorId: string): Promise<T[]> => {
  try {
    const q = query(collection(db, collectionName), where('doctor_id', '==', doctorId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, collectionName) as never;
  }
};

// Create helper
export const createDocument = async <T extends { id?: string }>(collectionName: string, data: T): Promise<void> => {
  try {
    const docRef = doc(collection(db, collectionName));
    const dataWithId = { ...data, id: docRef.id };
    await setDoc(docRef, dataWithId);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
};

export const updateDocument = async <T>(collectionName: string, id: string, data: Partial<T>): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data as any);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
  }
};

// Example subscription
export const subscribeToCollection = <T>(
    collectionName: string, 
    doctorId: string, 
    onUpdate: (data: T[]) => void
  ) => {
  const q = query(collection(db, collectionName), where('doctor_id', '==', doctorId));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    onUpdate(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  });
  return unsubscribe;
};
