import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { ArrowLeft, Download, Plus, RefreshCw, X } from 'lucide-react';
import PageHeader from '../../../common/components/PageHeader';
import FileDrop from '../../../common/components/FileDrop';
import StatusChip from '../../../common/components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { createProposal, downloadProposalDocx, regenerateProposal, updateProposal, useProposal, useProposalList, useTemplates } from '../hooks/useProposals';
import { Proposal, TEMPLATE_VARIANTS, TemplateVariant } from '../types';
import TemplateLibrary from './TemplateLibrary';

export default function ProposalsView() {
  const [tab, setTab] = useState<'proposals' | 'templates'>('proposals');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (openId) return <ProposalDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Proposals" subtitle="Draft client proposals from a meeting transcript and your notes"
        actions={tab === 'proposals' && <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreating(true)}>New proposal</Button>} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="proposals" label="Proposals" />
        <Tab value="templates" label="Templates" />
      </Tabs>
      {tab === 'proposals' ? <ProposalList onOpen={setOpenId} onNew={() => setCreating(true)} /> : <TemplateLibrary />}
      <NewProposalDialog open={creating} onClose={id => { setCreating(false); if (id) setOpenId(id); }} />
    </Box>
  );
}

function ProposalList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const list = useProposalList();
  if (list.loading) return <LoadingState />;
  if (list.error) return <ErrorState message={list.error} />;
  if (list.data.length === 0) {
    return <EmptyState title="No proposals yet" description="Upload the four templates first, then start a proposal from a client meeting transcript and your notes."
      action={<Button variant="contained" onClick={onNew}>New proposal</Button>} />;
  }
  return (
    <TableContainer component={Card} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Client</TableCell>
            <TableCell>Template</TableCell>
            <TableCell align="right">Draft</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.data.map(p => (
            <TableRow key={p.id} hover onClick={() => onOpen(p.id)} sx={{ cursor: 'pointer' }}>
              <TableCell sx={{ fontWeight: 500 }}>{p.clientName}</TableCell>
              <TableCell>{TEMPLATE_VARIANTS.find(v => v.id === p.templateId)?.label}</TableCell>
              <TableCell align="right">{p.draft ? `v${p.draft.version}` : <StatusChip label="Not generated" />}</TableCell>
              <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function NewProposalDialog({ open, onClose }: { open: boolean; onClose: (createdId?: string) => void }) {
  const templates = useTemplates();
  const ready = templates.data.filter(t => t.parseStatus === 'parsed' && (t.sections || []).every(s => s.confirmed));
  const [clientName, setClientName] = useState('');
  const [templateId, setTemplateId] = useState<TemplateVariant | ''>('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setClientName(''); setTemplateId(''); setNotes(''); setFiles([]); setError(null); setTouched(false); setProgress(null); }
  }, [open]);

  const invalid = !clientName.trim() || !templateId || (files.length === 0 && !notes.trim());

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    setError(null);
    try {
      const id = await createProposal({ clientName: clientName.trim(), templateId: templateId as TemplateVariant, notes, files }, setProgress);
      onClose(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onClose={() => !progress && onClose()} fullWidth maxWidth="md">
      <DialogTitle>New proposal</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!templates.loading && ready.length === 0 && (
            <Alert severity="warning">No template is ready yet. Upload and confirm templates in the Templates tab first.</Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Client" value={clientName} onChange={e => setClientName(e.target.value)} fullWidth
              error={touched && !clientName.trim()} helperText={touched && !clientName.trim() ? 'Required' : ' '} />
            <TextField select label="Template" value={templateId} onChange={e => setTemplateId(e.target.value as TemplateVariant)} fullWidth
              error={touched && !templateId} helperText={touched && !templateId ? 'Pick a template' : ' '}>
              {TEMPLATE_VARIANTS.map(v => (
                <MenuItem key={v.id} value={v.id} disabled={!ready.some(t => t.id === v.id)}>
                  {v.label}{!ready.some(t => t.id === v.id) ? ' (not ready)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box>
            <FileDrop label="Client meeting transcript" accept={['.pdf', '.docx', '.txt']} hint="PDF, DOCX or TXT. Add more than one if needed."
              onFile={f => setFiles([...files, f])} disabled={!!progress} />
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {files.map((f, i) => <Chip key={i} label={f.name} onDelete={() => setFiles(files.filter((_, j) => j !== i))} size="small" />)}
            </Stack>
          </Box>
          <TextField label="Engagement notes" value={notes} onChange={e => setNotes(e.target.value)} multiline minRows={6}
            placeholder="Service type, estimated hours, duration, budget range, team, anything else. Ramble — it all gets merged with the transcript."
            error={touched && files.length === 0 && !notes.trim()}
            helperText={touched && files.length === 0 && !notes.trim() ? 'Add a transcript or notes' : ' '} />
          {progress && <Box><Typography variant="body2" color="text.secondary" gutterBottom>{progress}</Typography><LinearProgress /></Box>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose()} disabled={!!progress}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!!progress}>Generate draft</Button>
      </DialogActions>
    </Dialog>
  );
}

function ProposalDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: p, loading, error } = useProposal(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fieldsDirty, setFieldsDirty] = useState(false);

  useEffect(() => {
    if (!p) return;
    setReviewNotes(p.reviewNotes || '');
    setSectionNotes(p.sectionNotes || {});
    setEdits({});
    setFields(p.draft?.fields || {});
    setFieldsDirty(false);
    // Reset local edits whenever a new version lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.draft?.version]);

  if (loading) return <LoadingState />;
  if (error || !p) return <Box sx={{ p: 3 }}><ErrorState message={error || 'Proposal not found.'} /></Box>;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setActionError(null);
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const saveEdits = () => {
    if (!p.draft) return Promise.resolve();
    return updateProposal(p.id, {
      draft: { ...p.draft, fields, sections: p.draft.sections.map(s => (edits[s.index] != null ? { ...s, content: edits[s.index] } : s)) },
    } as Partial<Proposal>);
  };
  const dirty = Object.keys(edits).length > 0 || fieldsDirty;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowLeft size={16} />} onClick={onBack} sx={{ mb: 1 }}>All proposals</Button>
      <PageHeader title={p.clientName} subtitle={`${TEMPLATE_VARIANTS.find(v => v.id === p.templateId)?.label}${p.draft ? ` · draft v${p.draft.version}` : ''}`}
        actions={<>
          <Button startIcon={<RefreshCw size={16} />} disabled={!!busy}
            onClick={() => run('regen', async () => { if (dirty) await saveEdits(); await updateProposal(p.id, { reviewNotes, sectionNotes }); await regenerateProposal(p.id); })}>
            {p.draft ? 'Regenerate with notes' : 'Generate'}
          </Button>
          <Button variant="contained" startIcon={<Download size={16} />} disabled={!p.draft || !!busy}
            onClick={() => run('docx', async () => { if (dirty) await saveEdits(); await downloadProposalDocx(p.id); })}>Download .docx</Button>
        </>} />
      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {busy === 'regen' && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Regenerating — this can take a minute.</Typography>}
      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

      {!p.draft ? (
        <EmptyState title="No draft yet" description="Generate a draft from the transcript and notes." />
      ) : (
        <Stack spacing={3}>
          {p.draft.openQuestions?.length > 0 && (
            <Alert severity="warning">
              <Typography variant="subtitle2">Open questions</Typography>
              <Box component="ul" sx={{ pl: 2.5, m: 0 }}>{p.draft.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</Box>
            </Alert>
          )}
          {Object.keys(fields).length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">Document fields</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Filled into the template's fields wherever they appear. The client name fills CLIENT. Your edits here are kept when you regenerate.
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                  {Object.keys(fields).map(name => (
                    <TextField key={name} size="small" label={name} value={fields[name]} sx={{ minWidth: 220 }}
                      placeholder="Not set" onChange={e => { setFields({ ...fields, [name]: e.target.value }); setFieldsDirty(true); }} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
          <Card variant="outlined">
            <CardContent>
              <TextField label="Notes for the next draft" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} multiline minRows={3} fullWidth
                helperText="Overall direction for regeneration. Section-specific notes go under each section." />
            </CardContent>
          </Card>
          {p.draft.sections.map(s => (
            <Card variant="outlined" key={s.index}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6">{s.heading}</Typography>
                  {edits[s.index] != null && (
                    <IconButton size="small" aria-label="Discard edit" onClick={() => { const { [s.index]: _, ...rest } = edits; setEdits(rest); }}><X size={16} /></IconButton>
                  )}
                </Stack>
                <TextField value={edits[s.index] ?? s.content} onChange={e => setEdits({ ...edits, [s.index]: e.target.value })} multiline minRows={4} fullWidth
                  inputProps={{ 'aria-label': `${s.heading} content` }} />
                <TextField size="small" label="Note for this section" value={sectionNotes[s.index] || ''} sx={{ mt: 1.5 }} fullWidth
                  onChange={e => setSectionNotes({ ...sectionNotes, [s.index]: e.target.value })} />
              </CardContent>
            </Card>
          ))}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button disabled={!dirty || !!busy} onClick={() => run('save', saveEdits)}>Save edits</Button>
            <Button disabled={!!busy} onClick={() => run('notes', () => updateProposal(p.id, { reviewNotes, sectionNotes }))}>Save notes</Button>
          </Stack>
          {!!p.history?.length && (
            <Typography variant="caption" color="text.secondary">Previous versions kept: {p.history.map(h => `v${h.version}`).join(', ')}</Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}
