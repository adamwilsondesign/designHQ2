import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db, PROFESSIONAL, requireRole } from './admin.js';
import { GEMINI_API_KEY, generateJson, Type } from './ai.js';
import { extractTextFromStorage } from './text.js';

// Turns an uploaded meeting transcript into notes, action items and decisions
// stored on the meeting document (meetings/{id}).
export const meetingProcessTranscript = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 300, memory: '1GiB' }, async request => {
  await requireRole(request, PROFESSIONAL);
  const meetingId = String(request.data?.meetingId || '');
  const ref = db.doc(`meetings/${meetingId}`);
  const m = (await ref.get()).data();
  if (!m) throw new HttpsError('not-found', 'Meeting not found.');
  if (!m.transcriptPath?.startsWith('professional/')) throw new HttpsError('failed-precondition', 'Upload a transcript first.');

  const transcript = (await extractTextFromStorage(m.transcriptPath)).slice(0, 150000);
  const kindLabel: Record<string, string> = {
    oneOnOne: `one-on-one between Adam (design director) and ${m.staffName || 'a team member'}`,
    townHall: 'design department town hall',
    critique: 'group design critique',
    designTeam: 'design team meeting',
  };

  const result = await generateJson<{ summary: string; notes: string[]; actionItems: { owner: string; task: string; due: string }[]; decisions: string[] }>({
    system: `You take meeting notes for Adam, Lazer's design director. Be accurate and concise. Only record what was actually said. Owners and due dates must come from the transcript; use "" when not stated.`,
    prompt: `Meeting: ${kindLabel[m.kind] || m.kind}\nTitle: ${m.title || ''}\nDate: ${m.date || ''}\n\nTRANSCRIPT:\n${transcript}`,
    schema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        notes: { type: Type.ARRAY, items: { type: Type.STRING } },
        actionItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { owner: { type: Type.STRING }, task: { type: Type.STRING }, due: { type: Type.STRING } },
            required: ['owner', 'task', 'due'],
          },
        },
        decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['summary', 'notes', 'actionItems', 'decisions'],
    },
  });

  await ref.update({
    summary: result.summary,
    notes: result.notes,
    actionItems: result.actionItems.map(a => ({ ...a, done: false })),
    decisions: result.decisions,
    processedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
