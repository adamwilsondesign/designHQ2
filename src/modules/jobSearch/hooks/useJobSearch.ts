import { addDoc, collection, deleteDoc, doc, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCollection, useDocument } from '../../../common/hooks/useCollection';
import { callFunction, downloadUrl, nowIso, triggerDownload } from '../../../common/firebaseHelpers';
import { DEFAULT_SETTINGS, JobApplication, JobSearchSettings, TailoredDoc } from '../types';

export const useApplications = (uid: string) =>
  useCollection<JobApplication>(`personal/${uid}/jobApplications`, [orderBy('appliedDate', 'desc')], 'applied-desc');

export function useJobSettings(uid: string) {
  const res = useDocument<JobSearchSettings>(`personal/${uid}/settings/jobSearch`);
  return { ...res, settings: { ...DEFAULT_SETTINGS, ...(res.data || {}) } as JobSearchSettings };
}

export const saveJobSettings = (uid: string, s: JobSearchSettings) => setDoc(doc(db, `personal/${uid}/settings/jobSearch`), s);

export const saveApplication = (uid: string, a: Omit<JobApplication, 'id' | 'createdAt'> & { id?: string }) => {
  const { id, ...data } = a;
  return id
    ? updateDoc(doc(db, `personal/${uid}/jobApplications/${id}`), data)
    : addDoc(collection(db, `personal/${uid}/jobApplications`), { ...data, createdAt: nowIso() });
};
export const deleteApplication = (uid: string, id: string) => deleteDoc(doc(db, `personal/${uid}/jobApplications/${id}`));

export const useTailoredDocs = (uid: string) => useCollection<TailoredDoc>(`personal/${uid}/tailoredDocs`, [orderBy('createdAt', 'desc')], 'created-desc');
export const useTailoredDoc = (uid: string, id: string | null) => useDocument<TailoredDoc>(id ? `personal/${uid}/tailoredDocs/${id}` : null);

export async function startTailoring(uid: string, jobUrl: string, postingText: string, notes: string) {
  const ref = await addDoc(collection(db, `personal/${uid}/tailoredDocs`), { jobUrl, postingText, notes, company: '', role: '', createdAt: nowIso() });
  await callFunction('jobTailor', { docId: ref.id });
  return ref.id;
}

export const updateTailored = (uid: string, id: string, patch: Partial<TailoredDoc>) => updateDoc(doc(db, `personal/${uid}/tailoredDocs/${id}`), patch);
export const regenerateTailored = (id: string) => callFunction('jobTailor', { docId: id });

export async function downloadTailored(id: string) {
  const { resumePath, letterPath } = await callFunction<object, { resumePath: string; letterPath: string }>('jobRenderDocs', { docId: id });
  triggerDownload(await downloadUrl(resumePath), resumePath.split('/').pop());
  setTimeout(async () => triggerDownload(await downloadUrl(letterPath), letterPath.split('/').pop()), 600);
}
