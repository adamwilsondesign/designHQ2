import { addDoc, collection, doc, limit, orderBy, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { useCollection } from '../../../common/hooks/useCollection';
import { nowIso } from '../../../common/firebaseHelpers';
import { ExecUpdateRecord, HealthStatus, ProjectMeta } from '../types';

export const useProjectMeta = () => useCollection<ProjectMeta>('projectMeta');
export const useRecentExecUpdates = () => useCollection<ExecUpdateRecord>('execUpdates', [orderBy('createdAt', 'desc'), limit(10)], 'recent10');

export const saveProjectHealth = (projectId: string, patch: { healthStatus?: HealthStatus | null; healthNote?: string }) =>
  setDoc(doc(db, 'projectMeta', projectId), { ...patch, updatedAt: nowIso() }, { merge: true });

export const saveExecUpdate = (record: Omit<ExecUpdateRecord, 'id' | 'createdAt' | 'createdBy'>) =>
  addDoc(collection(db, 'execUpdates'), { ...record, createdAt: nowIso(), createdBy: auth.currentUser?.uid || '' });
