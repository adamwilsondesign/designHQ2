import { addDoc, arrayUnion, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCollection } from '../../../common/hooks/useCollection';
import { nowIso } from '../../../common/firebaseHelpers';
import { Reminder } from '../types';

export const useReminders = (uid: string) => useCollection<Reminder>(`personal/${uid}/reminders`);

export const saveReminder = (uid: string, r: Omit<Reminder, 'id' | 'createdAt' | 'handled'> & { id?: string }) => {
  const { id, ...data } = r;
  return id
    ? updateDoc(doc(db, `personal/${uid}/reminders/${id}`), data)
    : addDoc(collection(db, `personal/${uid}/reminders`), { ...data, handled: [], createdAt: nowIso() });
};

export const markHandled = (uid: string, id: string, occurrenceKey: string) =>
  updateDoc(doc(db, `personal/${uid}/reminders/${id}`), { handled: arrayUnion(occurrenceKey) });

export const deleteReminder = (uid: string, id: string) => deleteDoc(doc(db, `personal/${uid}/reminders/${id}`));
