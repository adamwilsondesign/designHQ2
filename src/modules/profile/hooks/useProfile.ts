import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useDocument } from '../../../common/hooks/useCollection';
import { nowIso, safeFileName, uploadFile } from '../../../common/firebaseHelpers';
import { emptyProfile, PersonalProfile } from '../types';

export const profilePath = (uid: string) => `personal/${uid}/profile/main`;

export function useProfile(uid: string | null) {
  const res = useDocument<PersonalProfile>(uid ? profilePath(uid) : null);
  const profile: PersonalProfile = { ...emptyProfile(), ...(res.data || {}), targets: { ...emptyProfile().targets, ...(res.data?.targets || {}) } };
  return { profile, exists: !!res.data, loading: res.loading, error: res.error };
}

export const saveProfile = (uid: string, patch: Partial<PersonalProfile>) =>
  setDoc(doc(db, profilePath(uid)), { ...patch, updatedAt: nowIso() }, { merge: true });

export async function uploadResume(uid: string, file: File, onProgress?: (p: number) => void) {
  const path = `personal/${uid}/resume/${Date.now()}-${safeFileName(file.name)}`;
  await uploadFile(path, file, onProgress);
  await saveProfile(uid, { resume: { path, name: file.name, uploadedAt: nowIso() } });
}
