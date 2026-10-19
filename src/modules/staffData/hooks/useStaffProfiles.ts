import { useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCollection } from '../../../common/hooks/useCollection';
import { nowIso } from '../../../common/firebaseHelpers';
import { emptyStaffProfile, StaffProfile } from '../types';

export function useStaffProfiles() {
  const result = useCollection<StaffProfile>('staffProfiles');
  const byId = useMemo(() => new Map(result.data.map(p => [p.id, { ...emptyStaffProfile(p.id), ...p }])), [result.data]);
  return { ...result, byId, get: (id: string) => byId.get(id) || emptyStaffProfile(id) };
}

export async function saveStaffProfile(staffId: string, patch: Partial<Omit<StaffProfile, 'id'>>) {
  await setDoc(doc(db, 'staffProfiles', staffId), { ...patch, updatedAt: nowIso() }, { merge: true });
}
