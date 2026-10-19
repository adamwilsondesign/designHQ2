import { addDoc, collection, doc, orderBy, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { useCollection } from '../../../common/hooks/useCollection';
import { callFunction, nowIso, safeFileName, uploadFile } from '../../../common/firebaseHelpers';
import { Meeting, MeetingSeries } from '../types';
import { toYmd } from '../lib/schedule';

export const useMeetings = () => useCollection<Meeting>('meetings', [orderBy('date', 'desc')], 'date-desc');
export const useMeetingSeries = () => useCollection<MeetingSeries>('meetingSeries');

export async function saveSeries(series: Omit<MeetingSeries, 'id'> & { id?: string }) {
  const { id, ...data } = series;
  if (id) await setDoc(doc(db, 'meetingSeries', id), data, { merge: true });
  else await addDoc(collection(db, 'meetingSeries'), data);
}

export async function createMeeting(m: Omit<Meeting, 'id' | 'createdAt' | 'createdBy'>): Promise<string> {
  const ref = await addDoc(collection(db, 'meetings'), { ...m, createdAt: nowIso(), createdBy: auth.currentUser?.uid || '' });
  return ref.id;
}

export const updateMeeting = (id: string, patch: Partial<Meeting>) => updateDoc(doc(db, 'meetings', id), patch as Record<string, unknown>);

// Creates the event on the signed-in user's connected Lazer Google calendar.
export async function addToCalendar(meetingId: string, m: Pick<Meeting, 'title' | 'date' | 'durationMinutes' | 'agenda'>, attendees: string[]) {
  const start = new Date(m.date);
  const end = new Date(start.getTime() + m.durationMinutes * 60000);
  const res = await callFunction<object, { eventId: string; htmlLink: string }>('calendarCreateEvent', {
    account: 'lazer',
    summary: m.title,
    description: m.agenda || '',
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    attendees,
    withMeet: true,
  });
  await updateMeeting(meetingId, { calendarEventId: res.eventId, calendarLink: res.htmlLink });
  return res;
}

// Marking a meeting held feeds the schedulers: last one-on-one date, the
// series' last held date, and presenters' last show-and-tell date. Dates only
// move forward.
export async function markHeld(m: Meeting, profileDates: (staffId: string) => { lastOneOnOneDate: string | null; lastShowAndTellDate: string | null }, series?: MeetingSeries | null) {
  const day = toYmd(new Date(m.date));
  const batch = writeBatch(db);
  batch.update(doc(db, 'meetings', m.id), { status: 'held' });
  if (m.kind === 'oneOnOne' && m.staffId) {
    const last = profileDates(m.staffId).lastOneOnOneDate;
    if (!last || last < day) batch.set(doc(db, 'staffProfiles', m.staffId), { lastOneOnOneDate: day, updatedAt: nowIso() }, { merge: true });
  }
  if (series && (!series.lastHeldDate || series.lastHeldDate < day)) {
    batch.set(doc(db, 'meetingSeries', series.id), { lastHeldDate: day }, { merge: true });
  }
  for (const staffId of m.presenters || []) {
    const last = profileDates(staffId).lastShowAndTellDate;
    if (!last || last < day) batch.set(doc(db, 'staffProfiles', staffId), { lastShowAndTellDate: day, updatedAt: nowIso() }, { merge: true });
  }
  await batch.commit();
}

export async function uploadAndProcessTranscript(meetingId: string, file: File, onProgress?: (p: number) => void) {
  const path = `professional/meetings/${meetingId}/${Date.now()}-${safeFileName(file.name)}`;
  await uploadFile(path, file, onProgress);
  await updateMeeting(meetingId, { transcriptPath: path, transcriptName: file.name });
  await callFunction('meetingProcessTranscript', { meetingId });
}
