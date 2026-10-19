import { addDoc, collection, doc, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { useCollection, useDocument } from '../../../common/hooks/useCollection';
import { callFunction, downloadUrl, nowIso, safeFileName, triggerDownload, uploadFile } from '../../../common/firebaseHelpers';
import { Proposal, ProposalTemplate, TemplateSection, TEMPLATE_VARIANTS, TemplateVariant } from '../types';

export const useTemplates = () => useCollection<ProposalTemplate>('proposalTemplates');
export const useProposalList = () => useCollection<Proposal>('proposals', [orderBy('createdAt', 'desc')], 'created-desc');
export const useProposal = (id: string | null) => useDocument<Proposal>(id ? `proposals/${id}` : null);

export async function uploadTemplate(variant: TemplateVariant, file: File, onProgress?: (p: number) => void) {
  const path = `professional/templates/${variant}/${Date.now()}-${safeFileName(file.name)}`;
  await uploadFile(path, file, onProgress);
  await setDoc(doc(db, 'proposalTemplates', variant), {
    label: TEMPLATE_VARIANTS.find(v => v.id === variant)!.label,
    storagePath: path,
    fileName: file.name,
    uploadedAt: nowIso(),
    parseStatus: 'pending',
    parseError: null,
    sections: [],
  });
  await callFunction('proposalParseTemplate', { templateId: variant });
}

// Fills variants that have no file yet with this one (same file, same section
// settings). Each variant can still be replaced on its own later.
export async function copyTemplateToEmptyVariants(source: ProposalTemplate, existing: ProposalTemplate[]) {
  const empty = TEMPLATE_VARIANTS.filter(v => v.id !== source.id && !existing.some(t => t.id === v.id));
  const { id, label, ...rest } = source;
  for (const v of empty) {
    await setDoc(doc(db, 'proposalTemplates', v.id), { ...rest, label: v.label, copiedFrom: source.id });
  }
  return empty.length;
}

export const reparseTemplate = (variant: TemplateVariant) => callFunction('proposalParseTemplate', { templateId: variant });

export async function saveTemplateSections(variant: TemplateVariant, sections: TemplateSection[]) {
  await updateDoc(doc(db, 'proposalTemplates', variant), { sections });
}

export async function createProposal(input: { clientName: string; templateId: TemplateVariant; notes: string; files: File[] }, onProgress?: (msg: string) => void) {
  const ref = await addDoc(collection(db, 'proposals'), {
    clientName: input.clientName,
    templateId: input.templateId,
    notes: input.notes,
    transcripts: [],
    status: 'new',
    createdAt: nowIso(),
    createdBy: auth.currentUser?.uid || '',
  });
  const transcripts: { path: string; name: string }[] = [];
  for (const f of input.files) {
    onProgress?.(`Uploading ${f.name}…`);
    const path = `professional/proposals/${ref.id}/transcripts/${Date.now()}-${safeFileName(f.name)}`;
    await uploadFile(path, f);
    transcripts.push({ path, name: f.name });
  }
  await updateDoc(ref, { transcripts });
  onProgress?.('Drafting the proposal…');
  await callFunction('proposalGenerate', { proposalId: ref.id });
  return ref.id;
}

export const updateProposal = (id: string, patch: Partial<Proposal>) =>
  updateDoc(doc(db, 'proposals', id), { ...patch, updatedAt: nowIso() } as Record<string, unknown>);

export const regenerateProposal = (id: string) => callFunction('proposalGenerate', { proposalId: id });

export async function downloadProposalDocx(id: string) {
  const { path } = await callFunction<object, { path: string }>('proposalRenderDocx', { proposalId: id });
  triggerDownload(await downloadUrl(path), path.split('/').pop());
}
