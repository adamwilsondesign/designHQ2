import { addDoc, collection, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCollection } from '../../../common/hooks/useCollection';
import { nowIso } from '../../../common/firebaseHelpers';
import { Task } from '../types';

// Rules only allow reading your own tasks, so the query must filter on ownerUid.
export const useTasks = (uid: string | null) =>
  useCollection<Task>(uid ? 'tasks' : null, uid ? [where('ownerUid', '==', uid)] : [], uid || '');

export const addTask = (uid: string, title: string, dueDate: string) =>
  addDoc(collection(db, 'tasks'), { ownerUid: uid, title, dueDate, done: false, createdAt: nowIso() });
export const setTaskDone = (id: string, done: boolean) => updateDoc(doc(db, 'tasks', id), { done });
export const removeTask = (id: string) => deleteDoc(doc(db, 'tasks', id));
