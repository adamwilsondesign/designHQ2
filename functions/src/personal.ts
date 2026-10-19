import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { bucket, db, PERSONAL, requireRole } from './admin.js';
import { GEMINI_API_KEY, generateGroundedText, generateJson, Type } from './ai.js';
import { markdownToDocx } from './docx/simpleDoc.js';
import { downloadFile, extractTextFromStorage } from './text.js';
import { fetchPageText } from './web.js';

// Personal modules (Super Admin only). Everything reads the profile hub at
// personal/{uid}/profile/main, so a bio or tone change shows up in the next draft.

const opts = { secrets: [GEMINI_API_KEY], timeoutSeconds: 300, memory: '1GiB' as const };

export const DEFAULT_TONE =
  'Casual but knowledgeable. Storytelling with a bit of philosophy, in the spirit of Anthony Bourdain: curious, candid, wry, ' +
  'unpretentious, specific about people and places. No kitchen, food, restaurant or cooking references or metaphors.';

interface Profile {
  fullName?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  bio?: string;
  toneOfVoice?: string;
  resume?: { path: string; name: string } | null;
  targets?: { roles?: string[]; companies?: string[]; industries?: string[] };
}

async function loadProfile(uid: string): Promise<Profile> {
  return ((await db.doc(`personal/${uid}/profile/main`).get()).data() as Profile) || {};
}

async function resumeText(uid: string, p: Profile): Promise<string> {
  if (!p.resume?.path) return '';
  if (!p.resume.path.startsWith(`personal/${uid}/`)) throw new HttpsError('permission-denied', 'Resume path is outside your folder.');
  return (await extractTextFromStorage(p.resume.path)).slice(0, 30000);
}

function profileBlock(p: Profile) {
  const t = p.targets || {};
  return [
    `Name: ${p.fullName || '[not set]'}`,
    `LinkedIn: ${p.linkedinUrl || '[not set]'}`,
    `Portfolio: ${p.portfolioUrl || '[not set]'}`,
    `Target roles: ${(t.roles || []).join(', ') || '[not set]'}`,
    `Target companies: ${(t.companies || []).join(', ') || '[not set]'}`,
    `Target industries: ${(t.industries || []).join(', ') || '[not set]'}`,
    '',
    'Professional bio:',
    p.bio || '[not written yet]',
  ].join('\n');
}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

// Recent Lazer work as raw material for posts. Client names are passed so the
// model understands context, but it is told never to name clients. One-on-one
// notes are deliberately excluded (they are about individual employees).
async function workContext(): Promise<string> {
  const since = daysAgo(30);
  const [projects, proposals, meetings] = await Promise.all([
    db.collection('projects').get(),
    db.collection('proposals').where('createdAt', '>=', since).get(),
    db.collection('meetings').where('date', '>=', since).get(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const active = projects.docs.map(d => d.data()).filter(p => !p.finishDate || p.finishDate >= today);
  return [
    `Active projects (${active.length}): ${active.map(p => `${p.lob} / ${p.type}`).join('; ') || 'none'}`,
    '',
    'Recent proposal notes:',
    ...proposals.docs.map(d => `- ${(d.get('notes') || '').slice(0, 600)}`),
    '',
    'Recent team meeting summaries (town halls, critiques, design team):',
    ...meetings.docs.filter(d => d.get('kind') !== 'oneOnOne' && d.get('summary')).map(d => `- ${d.get('summary').slice(0, 600)}`),
  ].join('\n');
}

export const socialGenerateWeek = onCall(opts, async request => {
  const { uid } = await requireRole(request, PERSONAL);
  const weekOf = String(request.data?.weekOf || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) throw new HttpsError('invalid-argument', 'weekOf must be YYYY-MM-DD.');
  const count = Math.min(6, Math.max(5, Number(request.data?.count) || 6));
  const profile = await loadProfile(uid);
  const resume = await resumeText(uid, profile);

  // Current platform guidance via search grounding; empty if unavailable.
  const trends = await generateGroundedText(
    'You are a social media strategist. Be concise and factual; cite what is current.',
    `Today is ${new Date().toDateString()}. Summarise, in under 250 words, current best practices and format trends for (1) LinkedIn and (2) X posts by senior design leaders: ideal length, hooks, line breaks, hashtags, image vs text performance, posting cadence. Only include guidance you can support from current sources.`,
  );

  const result = await generateJson<{
    themes: { title: string; why: string }[];
    posts: { platform: 'linkedin' | 'x'; kind: 'text' | 'visual'; theme: string; body: string; visualBrief: string }[];
  }>({
    system: [
      `You ghost-write social posts for ${profile.fullName || 'Adam'}, a design director at Lazer Technologies, a digital product agency.`,
      `Voice: ${profile.toneOfVoice || DEFAULT_TONE}`,
      'Never name Lazer clients or reveal confidential project details, budgets or people; generalise ("a commerce brand", "a retail client").',
      'Never invent achievements, numbers or events. Stay within what the profile and work context support.',
      'Posts should position him for the roles, companies and industries he is targeting without sounding like a job hunt.',
      'Drafts only: he edits and posts them himself.',
    ].join('\n'),
    prompt: [
      'PROFILE', profileBlock(profile), '',
      'RESUME (for background only)', resume || '[no resume uploaded]', '',
      'RECENT WORK (raw material)', await workContext(), '',
      'PLATFORM GUIDANCE', trends || '[unavailable; use established best practice: LinkedIn 120-250 words with a strong first line and short paragraphs; X under 280 characters or a short thread]', '',
      `Write ${count} posts for the week of ${weekOf}: about half LinkedIn, half X. Most are text posts about what he is learning as a design professional; include 2 "visual" posts`,
      'where he would attach a screenshot of work in progress or finished work. For visual posts, write the copy and a one-line visualBrief describing what to capture (no client-identifying details).',
      'For text posts leave visualBrief empty. Also return 3-4 themes for the week, each with a one-line why.',
    ].join('\n'),
    schema: {
      type: Type.OBJECT,
      properties: {
        themes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, why: { type: Type.STRING } }, required: ['title', 'why'] } },
        posts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING, enum: ['linkedin', 'x'] },
              kind: { type: Type.STRING, enum: ['text', 'visual'] },
              theme: { type: Type.STRING },
              body: { type: Type.STRING },
              visualBrief: { type: Type.STRING },
            },
            required: ['platform', 'kind', 'theme', 'body', 'visualBrief'],
          },
        },
      },
      required: ['themes', 'posts'],
    },
  });

  const base = db.collection(`personal/${uid}/socialDrafts`);
  const batch = db.batch();
  batch.set(db.doc(`personal/${uid}/socialWeeks/${weekOf}`), {
    weekOf,
    themes: result.themes,
    trendsNotes: trends,
    generatedAt: FieldValue.serverTimestamp(),
  });
  for (const p of result.posts) {
    batch.set(base.doc(), {
      weekOf,
      platform: p.platform,
      kind: p.kind,
      theme: p.theme,
      body: p.body,
      visualBrief: p.visualBrief || '',
      imagePath: null,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return { posts: result.posts.length };
});

// Copy for a screenshot or exported piece of work Adam uploads.
export const socialCaptionImage = onCall(opts, async request => {
  const { uid } = await requireRole(request, PERSONAL);
  const draftId = String(request.data?.draftId || '');
  const ref = db.doc(`personal/${uid}/socialDrafts/${draftId}`);
  const draft = (await ref.get()).data();
  if (!draft?.imagePath?.startsWith(`personal/${uid}/`)) throw new HttpsError('failed-precondition', 'Upload an image first.');
  const profile = await loadProfile(uid);
  const [meta] = await bucket().file(draft.imagePath).getMetadata();
  const image = await downloadFile(draft.imagePath);

  const result = await generateJson<{ body: string; altText: string }>({
    system: [
      `You write social copy for ${profile.fullName || 'Adam'}, a design director. Voice: ${profile.toneOfVoice || DEFAULT_TONE}`,
      'Describe the work and the thinking behind it. Never name or identify clients, even if a logo or name is visible in the image. Do not invent results.',
    ].join('\n'),
    prompt: [
      `Platform: ${draft.platform === 'x' ? 'X (under 280 characters)' : 'LinkedIn (120-250 words, strong first line, short paragraphs)'}`,
      `Status of the work: ${request.data?.stage === 'finished' ? 'finished' : 'work in progress'}`,
      `Adam's context: ${request.data?.context || draft.visualBrief || '(none)'}`,
      `Existing draft to improve, if useful: ${draft.body || '(none)'}`,
      'Write the post copy and a short alt text for the image.',
    ].join('\n'),
    schema: { type: Type.OBJECT, properties: { body: { type: Type.STRING }, altText: { type: Type.STRING } }, required: ['body', 'altText'] },
    images: [{ mimeType: meta.contentType || 'image/png', data: image.toString('base64') }],
  });
  await ref.update({ body: result.body, altText: result.altText, updatedAt: new Date().toISOString() });
  return result;
});

// Tailored resume + cover letter for one job posting, in one shot.
// personal/{uid}/tailoredDocs/{id}: { jobUrl, postingText?, notes?, draft?, history? }
export const jobTailor = onCall(opts, async request => {
  const { uid } = await requireRole(request, PERSONAL);
  const ref = db.doc(`personal/${uid}/tailoredDocs/${String(request.data?.docId || '')}`);
  const doc = (await ref.get()).data();
  if (!doc) throw new HttpsError('not-found', 'Not found.');

  let posting = String(doc.postingText || '').trim();
  let postingTitle = '';
  if (!posting) {
    try {
      const page = await fetchPageText(doc.jobUrl);
      posting = page.text;
      postingTitle = page.title;
    } catch (err) {
      await ref.update({ fetchError: err instanceof Error ? err.message : String(err) });
      throw new HttpsError('failed-precondition', `Couldn't read the posting (${err instanceof Error ? err.message : err}). Paste the posting text and try again.`);
    }
    if (posting.length < 400) {
      await ref.update({ fetchError: 'The page had almost no text (it may need a login).' });
      throw new HttpsError('failed-precondition', 'The page had almost no readable text; it may require a login. Paste the posting text instead.');
    }
  }

  const profile = await loadProfile(uid);
  const resume = await resumeText(uid, profile);
  if (!resume) throw new HttpsError('failed-precondition', 'Upload your resume in Profile first.');

  const previous = doc.draft as { resume: string; coverLetter: string } | undefined;
  const result = await generateJson<{ company: string; role: string; resume: string; coverLetter: string; gaps: string[] }>({
    system: [
      'You tailor a design leader\'s resume and write a matching cover letter for one job posting.',
      'Resume rules: keep it truthful. Never invent employers, titles, dates, degrees, metrics or skills. You may reorder, re-emphasise, tighten and re-word what is in the source resume and bio to fit the role. Use markdown: "# Name", contact line, "## Section" headings, "- " bullets.',
      `Cover letter voice: ${profile.toneOfVoice || DEFAULT_TONE}`,
      'Cover letter: 250-400 words, addressed to the hiring team, specific to the company and role, grounded only in real experience. Markdown paragraphs, no headings.',
      'List in "gaps" any requirement in the posting that the resume does not support, so he can decide how to handle it.',
    ].join('\n'),
    prompt: [
      'PROFILE', profileBlock(profile), '',
      'SOURCE RESUME', resume, '',
      `JOB POSTING${postingTitle ? ` (${postingTitle})` : ''} — ${doc.jobUrl}`, posting.slice(0, 30000), '',
      ...(previous ? ['PREVIOUS VERSION', '--- resume ---', previous.resume, '--- cover letter ---', previous.coverLetter, '', "ADAM'S NOTES FOR THIS REVISION", doc.notes || '(none)'] : doc.notes ? ["ADAM'S NOTES", doc.notes] : []),
    ].join('\n'),
    schema: {
      type: Type.OBJECT,
      properties: {
        company: { type: Type.STRING },
        role: { type: Type.STRING },
        resume: { type: Type.STRING },
        coverLetter: { type: Type.STRING },
        gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['company', 'role', 'resume', 'coverLetter', 'gaps'],
    },
  });

  const version = (doc.draft?.version || 0) + 1;
  await ref.update({
    company: doc.company || result.company,
    role: doc.role || result.role,
    postingExcerpt: posting.slice(0, 4000),
    fetchError: null,
    draft: { version, resume: result.resume, coverLetter: result.coverLetter, gaps: result.gaps, generatedAt: new Date().toISOString() },
    ...(doc.draft ? { history: FieldValue.arrayUnion({ version: doc.draft.version, resume: doc.draft.resume, coverLetter: doc.draft.coverLetter, notes: doc.notes || '' }) } : {}),
  });
  return { version };
});

export const jobRenderDocs = onCall({ timeoutSeconds: 60 }, async request => {
  const { uid } = await requireRole(request, PERSONAL);
  const id = String(request.data?.docId || '');
  const doc = (await db.doc(`personal/${uid}/tailoredDocs/${id}`).get()).data();
  if (!doc?.draft) throw new HttpsError('failed-precondition', 'Generate a draft first.');
  const profile = await loadProfile(uid);
  const slug = (s: string) => String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'role';
  const name = slug(profile.fullName || 'Resume');
  const stem = `${slug(doc.company)}-${slug(doc.role)}-v${doc.draft.version}`;
  const resumePath = `personal/${uid}/tailored/${id}/${name}-Resume-${stem}.docx`;
  const letterPath = `personal/${uid}/tailored/${id}/${name}-Cover-Letter-${stem}.docx`;
  const type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await Promise.all([
    bucket().file(resumePath).save(await markdownToDocx(doc.draft.resume, `${profile.fullName || ''} resume`), { contentType: type }),
    bucket().file(letterPath).save(await markdownToDocx(`# ${profile.fullName || ''}\n\n${doc.draft.coverLetter}`, 'Cover letter'), { contentType: type }),
  ]);
  return { resumePath, letterPath };
});
