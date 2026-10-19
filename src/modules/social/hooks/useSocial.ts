import { addDoc, collection, doc, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCollection, useDocument } from '../../../common/hooks/useCollection';
import { callFunction, nowIso, safeFileName, uploadFile } from '../../../common/firebaseHelpers';
import { Platform, SocialDraft, SocialWeek } from '../types';

export const useWeekDrafts = (uid: string, weekOf: string) =>
  useCollection<SocialDraft>(`personal/${uid}/socialDrafts`, [where('weekOf', '==', weekOf)], weekOf);
export const useSocialWeek = (uid: string, weekOf: string) => useDocument<SocialWeek>(`personal/${uid}/socialWeeks/${weekOf}`);

export const generateWeek = (weekOf: string) => callFunction('socialGenerateWeek', { weekOf });

export const updateDraft = (uid: string, id: string, patch: Partial<SocialDraft>) =>
  updateDoc(doc(db, `personal/${uid}/socialDrafts/${id}`), { ...patch, updatedAt: nowIso() });

export async function addVisualDraft(uid: string, weekOf: string, platform: Platform, file: File, context: string, stage: 'wip' | 'finished') {
  const ref = await addDoc(collection(db, `personal/${uid}/socialDrafts`), {
    weekOf, platform, kind: 'visual', theme: 'Work in progress', body: '', visualBrief: context, imagePath: null, status: 'draft', createdAt: nowIso(),
  });
  const path = `personal/${uid}/social/${ref.id}/${Date.now()}-${safeFileName(file.name)}`;
  await uploadFile(path, file);
  await setDoc(ref, { imagePath: path }, { merge: true });
  await callFunction('socialCaptionImage', { draftId: ref.id, context, stage });
  return ref.id;
}

export async function attachImage(uid: string, draft: SocialDraft, file: File, stage: 'wip' | 'finished') {
  const path = `personal/${uid}/social/${draft.id}/${Date.now()}-${safeFileName(file.name)}`;
  await uploadFile(path, file);
  await updateDraft(uid, draft.id, { imagePath: path });
  await callFunction('socialCaptionImage', { draftId: draft.id, context: draft.visualBrief, stage });
}
