import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { bucket, db, PROFESSIONAL, requireRole } from './admin.js';
import { GEMINI_API_KEY, generateJson, Type } from './ai.js';
import { parseTemplate, renderWithSections } from './docx/sections.js';
import { downloadFile, extractTextFromStorage } from './text.js';

// Firestore shapes are documented in firebase-blueprint.json (ProposalTemplate, Proposal).

interface StoredSection {
  index: number;
  heading: string;
  kind: 'static' | 'variable';
  key: string | null;
  needsReview: boolean;
  confirmed: boolean;
  reason: string;
  text: string;
  hasTable: boolean;
}

const opts = { secrets: [GEMINI_API_KEY], timeoutSeconds: 300, memory: '1GiB' as const };

export const proposalParseTemplate = onCall({ memory: '1GiB', timeoutSeconds: 120 }, async request => {
  await requireRole(request, PROFESSIONAL);
  const templateId = String(request.data?.templateId || '');
  const ref = db.doc(`proposalTemplates/${templateId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Template not found.');
  const storagePath = snap.get('storagePath') as string;
  if (!storagePath?.startsWith('professional/')) throw new HttpsError('failed-precondition', 'Template has no file.');

  try {
    const { sections, preamble } = await parseTemplate(await downloadFile(storagePath));
    const stored: StoredSection[] = sections.map(s => ({
      index: s.index,
      heading: s.heading,
      kind: s.classification.kind,
      key: s.classification.key,
      needsReview: s.classification.needsReview,
      confirmed: !s.classification.needsReview,
      reason: s.classification.reason,
      text: s.text.slice(0, 20000),
      hasTable: s.hasTable,
    }));
    await ref.update({
      sections: stored,
      preamble: preamble.slice(0, 2000),
      parseStatus: stored.length ? 'parsed' : 'error',
      parseError: stored.length ? null : 'No heading-styled sections were found. The parser splits on Word heading styles (Heading 1, Heading 2…); tell Adam how this template marks its sections.',
      parsedAt: FieldValue.serverTimestamp(),
    });
    return { sections: stored.length, needsReview: stored.filter(s => s.needsReview).length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ref.update({ parseStatus: 'error', parseError: message });
    throw new HttpsError('internal', message);
  }
});

const SYSTEM = `You write the variable sections of Lazer Technologies client proposals.
Lazer is a digital product agency (design and engineering; Shopify partner).
Rules:
- Use only facts from the meeting transcript and Adam's notes. Never invent client facts, numbers, hours, dates, prices or names.
- When something a section needs is missing, write "[TBD: what is needed]" inline rather than guessing.
- Match the structure, length and tone of the template's own example text for each section.
- Write in confident, plain, client-facing English. No filler.
- Formatting: blank line between paragraphs, "- " for bullets, "### " for a sub-heading, and markdown pipe tables ("| a | b |") for tabular content such as phases, hours and budget. "**bold**" is allowed.
- Do not write the section heading itself.
- Never rewrite or summarise the static sections; they are context only.`;

export const proposalGenerate = onCall(opts, async request => {
  const { uid } = await requireRole(request, PROFESSIONAL);
  const proposalId = String(request.data?.proposalId || '');
  const ref = db.doc(`proposals/${proposalId}`);
  const proposal = await ref.get();
  if (!proposal.exists) throw new HttpsError('not-found', 'Proposal not found.');
  const p = proposal.data()!;

  const template = await db.doc(`proposalTemplates/${p.templateId}`).get();
  if (!template.exists || template.get('parseStatus') !== 'parsed') {
    throw new HttpsError('failed-precondition', 'The selected template has not been parsed yet.');
  }
  const sections = (template.get('sections') as StoredSection[]) || [];
  const variable = sections.filter(s => s.kind === 'variable');
  if (variable.length === 0) throw new HttpsError('failed-precondition', 'The template has no sections marked variable.');
  const unconfirmed = sections.filter(s => !s.confirmed);
  if (unconfirmed.length) {
    throw new HttpsError('failed-precondition', `Confirm the classification of: ${unconfirmed.map(s => s.heading).join(', ')}.`);
  }

  const transcripts: string[] = [];
  for (const t of (p.transcripts || []) as { path: string; name: string }[]) {
    if (!t.path.startsWith('professional/')) continue;
    transcripts.push(`--- ${t.name} ---\n${(await extractTextFromStorage(t.path)).slice(0, 120000)}`);
  }

  const previous = p.draft?.sections as { index: number; content: string }[] | undefined;
  const prompt = [
    `Template variant: ${template.get('label')}`,
    `Client: ${p.clientName || '[not given]'}`,
    '',
    "ADAM'S ENGAGEMENT NOTES (service type, hours, duration, budget, anything else):",
    p.notes || '(none)',
    '',
    'MEETING TRANSCRIPT(S):',
    transcripts.join('\n\n') || '(none uploaded)',
    '',
    'STATIC SECTIONS (context only, do not rewrite):',
    sections.filter(s => s.kind === 'static').map(s => `## ${s.heading}\n${s.text.slice(0, 1500)}`).join('\n\n'),
    '',
    'VARIABLE SECTIONS TO WRITE (template example text shown for structure and length):',
    variable.map(s => `## [${s.index}] ${s.heading}${s.hasTable ? ' (the template uses a table here)' : ''}\n${s.text.slice(0, 4000)}`).join('\n\n'),
    ...(previous
      ? [
          '',
          'PREVIOUS DRAFT (revise it; keep what Adam did not ask to change):',
          previous.map(s => `## [${s.index}]\n${s.content}`).join('\n\n'),
          '',
          "ADAM'S REVIEW NOTES ON THE PREVIOUS DRAFT:",
          p.reviewNotes || '(none)',
          ...(p.sectionNotes
            ? Object.entries(p.sectionNotes as Record<string, string>).filter(([, v]) => v).map(([k, v]) => `Section [${k}]: ${v}`)
            : []),
        ]
      : []),
  ].join('\n');

  const result = await generateJson<{ sections: { index: number; content: string }[]; openQuestions: string[] }>({
    system: SYSTEM,
    prompt,
    schema: {
      type: Type.OBJECT,
      properties: {
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { index: { type: Type.INTEGER }, content: { type: Type.STRING } },
            required: ['index', 'content'],
          },
        },
        openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['sections', 'openQuestions'],
    },
  });

  const allowed = new Set(variable.map(s => s.index));
  const draftSections = variable.map(s => ({
    index: s.index,
    heading: s.heading,
    content: result.sections.find(r => r.index === s.index)?.content?.trim() || '[TBD: the model returned nothing for this section]',
  }));
  const version = (p.draft?.version || 0) + 1;
  await ref.update({
    draft: {
      version,
      sections: draftSections.filter(s => allowed.has(s.index)),
      openQuestions: result.openQuestions || [],
      generatedAt: FieldValue.serverTimestamp(),
      generatedBy: uid,
    },
    ...(p.draft ? { history: FieldValue.arrayUnion({ version: p.draft.version, sections: p.draft.sections, reviewNotes: p.reviewNotes || '' }) } : {}),
    status: 'draft',
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { version };
});

export const proposalRenderDocx = onCall({ memory: '1GiB', timeoutSeconds: 120 }, async request => {
  await requireRole(request, PROFESSIONAL);
  const proposalId = String(request.data?.proposalId || '');
  const ref = db.doc(`proposals/${proposalId}`);
  const p = (await ref.get()).data();
  if (!p?.draft) throw new HttpsError('failed-precondition', 'Generate a draft first.');
  const template = (await db.doc(`proposalTemplates/${p.templateId}`).get()).data();
  if (!template?.storagePath) throw new HttpsError('failed-precondition', 'Template file missing.');

  const replacements: Record<number, string> = {};
  for (const s of p.draft.sections as { index: number; content: string }[]) replacements[s.index] = s.content;
  const out = await renderWithSections(await downloadFile(template.storagePath), replacements);

  const safeClient = String(p.clientName || 'client').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'client';
  const path = `professional/proposals/${proposalId}/Lazer-Proposal-${safeClient}-v${p.draft.version}.docx`;
  await bucket().file(path).save(out, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  await ref.update({ docxPath: path, docxVersion: p.draft.version, updatedAt: FieldValue.serverTimestamp() });
  return { path };
});
