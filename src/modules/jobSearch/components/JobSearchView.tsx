import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, LinearProgress, Link, MenuItem, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import PageHeader from '../../../common/components/PageHeader';
import StatusChip from '../../../common/components/StatusChip';
import CopyButton from '../../../common/components/CopyButton';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { todayIso } from '../../../common/firebaseHelpers';
import { mondayOf, shiftWeek, weekLabel, ymd } from '../../../common/week';
import { useProfile } from '../../profile/hooks/useProfile';
import {
  deleteApplication, downloadTailored, regenerateTailored, saveApplication, saveJobSettings, startTailoring, updateTailored, useApplications, useJobSettings, useTailoredDoc,
  useTailoredDocs,
} from '../hooks/useJobSearch';
import { applicationsInWeek, weekState } from '../lib/progress';
import { ApplicationStatus, JobApplication, JobSearchSettings, STATUS_LABEL } from '../types';

type TabId = 'week' | 'tracker' | 'tailor' | 'boards';
const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim());

export default function JobSearchView({ uid }: { uid: string }) {
  const [tab, setTab] = useState<TabId>('week');
  const [editing, setEditing] = useState<Partial<JobApplication> | null>(null);
  const { settings } = useJobSettings(uid);
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Job search" subtitle={`Goal: ${settings.weeklyMin}–${settings.weeklyMax} applications a week. Log each one with its posting URL.`}
        actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setEditing({ appliedDate: todayIso(), status: 'applied', source: settings.boards[0]?.name || '' })}>Log application</Button>} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="week" label="This week" />
        <Tab value="tracker" label="All applications" />
        <Tab value="tailor" label="Resume & cover letter" />
        <Tab value="boards" label="Boards" />
      </Tabs>
      {tab === 'week' && <WeekTab uid={uid} settings={settings} onEdit={setEditing} />}
      {tab === 'tracker' && <TrackerTab uid={uid} onEdit={setEditing} />}
      {tab === 'tailor' && <TailorTab uid={uid} onLog={setEditing} />}
      {tab === 'boards' && <BoardsTab uid={uid} settings={settings} />}
      <ApplicationDialog uid={uid} value={editing} boards={settings.boards.map(b => b.name)} onClose={() => setEditing(null)} />
    </Box>
  );
}

function AppTable({ uid, rows, onEdit }: { uid: string; rows: JobApplication[]; onEdit: (a: JobApplication) => void }) {
  return (
    <TableContainer component={Card} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Posting</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(a => (
            <TableRow key={a.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.appliedDate}</TableCell>
              <TableCell sx={{ fontWeight: 500 }}>{a.company}</TableCell>
              <TableCell>{a.role}</TableCell>
              <TableCell>{a.source || '—'}</TableCell>
              <TableCell>
                <TextField select size="small" variant="standard" value={a.status} onChange={e => saveApplication(uid, { ...a, status: e.target.value as ApplicationStatus })}
                  InputProps={{ disableUnderline: true }} inputProps={{ 'aria-label': `Status for ${a.company}` }}>
                  {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map(s => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
                </TextField>
              </TableCell>
              <TableCell><Link href={a.url} target="_blank" rel="noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>Open <ExternalLink size={12} /></Link></TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <IconButton size="small" aria-label={`Edit ${a.company}`} onClick={() => onEdit(a)}><Pencil size={16} /></IconButton>
                <IconButton size="small" aria-label={`Delete ${a.company}`} onClick={() => window.confirm(`Delete the ${a.company} application?`) && deleteApplication(uid, a.id)}><Trash2 size={16} /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function WeekTab({ uid, settings, onEdit }: { uid: string; settings: JobSearchSettings; onEdit: (a: Partial<JobApplication>) => void }) {
  const apps = useApplications(uid);
  const [weekOf, setWeekOf] = useState(ymd(mondayOf(new Date())));
  const rows = useMemo(() => applicationsInWeek(apps.data, weekOf), [apps.data, weekOf]);
  const state = weekState(rows.length, settings.weeklyMin, settings.weeklyMax);
  if (apps.loading) return <LoadingState />;
  if (apps.error) return <ErrorState message={apps.error} />;
  return (
    <Stack spacing={2}>
      <Card variant="outlined"><CardContent>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton aria-label="Previous week" onClick={() => setWeekOf(shiftWeek(weekOf, -1))}><ChevronLeft size={18} /></IconButton>
          <Typography variant="h6" sx={{ minWidth: 170, textAlign: 'center' }}>{weekLabel(weekOf)}</Typography>
          <IconButton aria-label="Next week" onClick={() => setWeekOf(shiftWeek(weekOf, 1))}><ChevronRight size={18} /></IconButton>
          <Box sx={{ flex: 1 }} />
          <StatusChip label={state === 'stretch' ? 'Stretch goal hit' : state === 'met' ? 'Goal met' : `${settings.weeklyMin - rows.length} to go`} tone={state === 'below' ? 'warning' : 'success'} />
        </Stack>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 2 }}>
          <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums' }}>{rows.length}</Typography>
          <Typography variant="body1" color="text.secondary">of {settings.weeklyMin}–{settings.weeklyMax} applications</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={Math.min(100, (rows.length / settings.weeklyMax) * 100)} color={state === 'below' ? 'warning' : 'success'} sx={{ mt: 1.5, height: 8, borderRadius: 4 }} />
      </CardContent></Card>
      {rows.length === 0 ? (
        <EmptyState title="Nothing logged this week" description="Each application you log with its posting URL counts toward the week." action={<Button variant="outlined" onClick={() => onEdit({ appliedDate: todayIso(), status: 'applied', source: settings.boards[0]?.name || '' })}>Log application</Button>} />
      ) : <AppTable uid={uid} rows={rows} onEdit={onEdit} />}
    </Stack>
  );
}

function TrackerTab({ uid, onEdit }: { uid: string; onEdit: (a: Partial<JobApplication>) => void }) {
  const apps = useApplications(uid);
  const [status, setStatus] = useState<'' | ApplicationStatus>('');
  if (apps.loading) return <LoadingState />;
  if (apps.error) return <ErrorState message={apps.error} />;
  const rows = apps.data.filter(a => !status || a.status === status);
  return (
    <Stack spacing={2}>
      <TextField select size="small" label="Status" value={status} onChange={e => setStatus(e.target.value as '' | ApplicationStatus)} sx={{ width: 200 }}>
        <MenuItem value="">All ({apps.data.length})</MenuItem>
        {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map(s => <MenuItem key={s} value={s}>{STATUS_LABEL[s]} ({apps.data.filter(a => a.status === s).length})</MenuItem>)}
      </TextField>
      {rows.length === 0 ? <EmptyState title="No applications" description="Log applications with the button above." /> : <AppTable uid={uid} rows={rows} onEdit={onEdit} />}
    </Stack>
  );
}

function ApplicationDialog({ uid, value, boards, onClose }: { uid: string; value: Partial<JobApplication> | null; boards: string[]; onClose: () => void }) {
  const [form, setForm] = useState<Partial<JobApplication> | null>(value);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setForm(value); setTouched(false); setError(null); }, [value]);
  if (!form) return null;
  const errors = {
    url: !form.url || !isUrl(form.url) ? 'Paste the posting URL (proof of the application)' : '',
    company: !form.company?.trim() ? 'Required' : '',
    role: !form.role?.trim() ? 'Required' : '',
    appliedDate: !form.appliedDate ? 'Required' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const save = async () => {
    setTouched(true);
    if (invalid) return;
    try {
      await saveApplication(uid, {
        id: form.id, url: form.url!.trim(), company: form.company!.trim(), role: form.role!.trim(), appliedDate: form.appliedDate!,
        status: form.status || 'applied', source: form.source || '', notes: form.notes || '', tailoredDocId: form.tailoredDocId || null,
      });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const field = (k: keyof typeof errors) => ({ error: touched && !!errors[k], helperText: touched ? errors[k] || ' ' : ' ' });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{form.id ? 'Edit application' : 'Log application'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Posting URL" value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} {...field('url')} />
          <Stack direction="row" spacing={2}>
            <TextField label="Company" value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })} fullWidth {...field('company')} />
            <TextField label="Role" value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} fullWidth {...field('role')} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Date applied" type="date" value={form.appliedDate || ''} onChange={e => setForm({ ...form, appliedDate: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth {...field('appliedDate')} />
            <TextField select label="Status" value={form.status || 'applied'} onChange={e => setForm({ ...form, status: e.target.value as ApplicationStatus })} fullWidth helperText=" ">
              {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map(s => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
            </TextField>
            <TextField select label="Source" value={form.source || ''} onChange={e => setForm({ ...form, source: e.target.value })} fullWidth helperText=" ">
              {[...boards, 'Referral', 'Company site', 'Other'].map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function BoardsTab({ uid, settings }: { uid: string; settings: JobSearchSettings }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(true);
  useEffect(() => { setForm(settings); setSaved(true); }, [JSON.stringify(settings)]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (s: JobSearchSettings) => { setForm(s); setSaved(false); };
  const bad = form.boards.some(b => !b.name.trim() || (b.url && !isUrl(b.url))) || form.weeklyMin < 1 || form.weeklyMax < form.weeklyMin;
  return (
    <Card variant="outlined"><CardContent>
      <Stack spacing={2}>
        <Typography variant="h6">Boards to watch</Typography>
        {form.boards.map((b, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            <TextField size="small" label="Board" value={b.name} onChange={e => set({ ...form, boards: form.boards.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} sx={{ width: 220 }} />
            <TextField size="small" label="URL" value={b.url} onChange={e => set({ ...form, boards: form.boards.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} sx={{ flex: 1 }}
              error={!!b.url && !isUrl(b.url)} helperText={!b.url ? 'Add the link' : !isUrl(b.url) ? 'Enter a full URL' : ' '} />
            {b.url && isUrl(b.url) && <Button size="small" href={b.url} target="_blank" rel="noreferrer" endIcon={<ExternalLink size={14} />} sx={{ mt: 0.5 }}>Open</Button>}
            <IconButton aria-label={`Remove ${b.name}`} onClick={() => set({ ...form, boards: form.boards.filter((_, j) => j !== i) })}><Trash2 size={16} /></IconButton>
          </Stack>
        ))}
        <Box><Button size="small" startIcon={<Plus size={14} />} onClick={() => set({ ...form, boards: [...form.boards, { name: '', url: '' }] })}>Add board</Button></Box>
        <Typography variant="h6" sx={{ pt: 1 }}>Weekly goal</Typography>
        <Stack direction="row" spacing={2}>
          <TextField size="small" type="number" label="Minimum" value={form.weeklyMin} onChange={e => set({ ...form, weeklyMin: Number(e.target.value) })} inputProps={{ min: 1 }} />
          <TextField size="small" type="number" label="Stretch" value={form.weeklyMax} onChange={e => set({ ...form, weeklyMax: Number(e.target.value) })}
            error={form.weeklyMax < form.weeklyMin} helperText={form.weeklyMax < form.weeklyMin ? 'Must be at least the minimum' : ' '} />
        </Stack>
        <Box><Button variant="contained" disabled={saved || bad} onClick={() => saveJobSettings(uid, form).then(() => setSaved(true))}>{saved ? 'Saved' : 'Save'}</Button></Box>
      </Stack>
    </CardContent></Card>
  );
}

function TailorTab({ uid, onLog }: { uid: string; onLog: (a: Partial<JobApplication>) => void }) {
  const docs = useTailoredDocs(uid);
  const { profile } = useProfile(uid);
  const [openId, setOpenId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [posting, setPosting] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  if (openId) return <TailoredDetail uid={uid} id={openId} onBack={() => setOpenId(null)} onLog={onLog} />;

  const start = async () => {
    setTouched(true);
    if (!isUrl(url)) return;
    setBusy(true); setError(null);
    try { setOpenId(await startTailoring(uid, url.trim(), posting, notes)); setUrl(''); setPosting(''); setNotes(''); setTouched(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined"><CardContent>
          <Typography variant="h6" gutterBottom>Tailor for a posting</Typography>
          {!profile.resume && <Alert severity="warning" sx={{ mb: 2 }}>Upload your resume in Profile first; the tailored version is rewritten from it.</Alert>}
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Job posting URL" value={url} onChange={e => setUrl(e.target.value)} error={touched && !isUrl(url)} helperText={touched && !isUrl(url) ? 'Paste the full posting URL' : ' '} />
            <TextField label="Posting text (optional)" value={posting} onChange={e => setPosting(e.target.value)} multiline minRows={4}
              helperText="Only needed if the page can't be read (e.g. it requires a login, as LinkedIn often does)." />
            <TextField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} multiline minRows={2} helperText="Anything to emphasise or avoid." />
            {busy && <Box><Typography variant="body2" color="text.secondary" gutterBottom>Reading the posting and writing both documents…</Typography><LinearProgress /></Box>}
            <Box><Button variant="contained" onClick={start} disabled={busy || !profile.resume}>Write resume & cover letter</Button></Box>
          </Stack>
        </CardContent></Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="h6" gutterBottom>Previous</Typography>
        {docs.loading ? <LoadingState /> : docs.data.length === 0 ? <EmptyState title="Nothing yet" description="Tailored resumes and cover letters appear here." /> : (
          <Stack spacing={1}>
            {docs.data.map(d => (
              <Card key={d.id} variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => setOpenId(d.id)}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.company || 'Unknown company'} — {d.role || 'Role'}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(d.createdAt).toLocaleDateString()} · {d.draft ? `v${d.draft.version}` : d.fetchError ? 'Needs posting text' : 'Not generated'}</Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}

function TailoredDetail({ uid, id, onBack, onLog }: { uid: string; id: string; onBack: () => void; onLog: (a: Partial<JobApplication>) => void }) {
  const { data: d, loading, error } = useTailoredDoc(uid, id);
  const [resume, setResume] = useState('');
  const [letter, setLetter] = useState('');
  const [notes, setNotes] = useState('');
  const [posting, setPosting] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (!d) return;
    setResume(d.draft?.resume || '');
    setLetter(d.draft?.coverLetter || '');
    setNotes(d.notes || '');
    setPosting(d.postingText || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.draft?.version, d?.id]);

  if (loading) return <LoadingState />;
  if (error || !d) return <ErrorState message={error || 'Not found.'} />;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setActionError(null);
    try { await fn(); } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const persistEdits = () => d.draft && (resume !== d.draft.resume || letter !== d.draft.coverLetter)
    ? updateTailored(uid, id, { draft: { ...d.draft, resume, coverLetter: letter } })
    : Promise.resolve();

  return (
    <Stack spacing={2}>
      <Box><Button startIcon={<ArrowLeft size={16} />} onClick={onBack}>All tailored documents</Button></Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="h5">{d.company || 'Company'} — {d.role || 'Role'}</Typography>
          <Link href={d.jobUrl} target="_blank" rel="noreferrer" variant="body2">{d.jobUrl}</Link>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => onLog({ url: d.jobUrl, company: d.company, role: d.role, appliedDate: todayIso(), status: 'applied', tailoredDocId: d.id })}>Log as applied</Button>
          <Button startIcon={<RefreshCw size={16} />} disabled={!!busy}
            onClick={() => run('regen', async () => { await persistEdits(); await updateTailored(uid, id, { notes, postingText: posting }); await regenerateTailored(id); })}>
            {d.draft ? 'Regenerate with notes' : 'Generate'}
          </Button>
          <Button variant="contained" startIcon={<Download size={16} />} disabled={!d.draft || !!busy} onClick={() => run('docx', async () => { await persistEdits(); await downloadTailored(id); })}>Download both</Button>
        </Stack>
      </Stack>
      {busy && <LinearProgress />}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {d.fetchError && !d.draft && (
        <Alert severity="warning">{d.fetchError} Paste the posting text below and generate again.</Alert>
      )}
      {(d.fetchError || !d.draft) && (
        <TextField label="Posting text" value={posting} onChange={e => setPosting(e.target.value)} multiline minRows={6} />
      )}
      {d.draft?.gaps?.length ? (
        <Alert severity="info"><Typography variant="subtitle2">Requirements your resume doesn't cover</Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>{d.draft.gaps.map((g, i) => <li key={i}>{g}</li>)}</Box>
        </Alert>
      ) : null}
      <TextField label="Notes for the next version" value={notes} onChange={e => setNotes(e.target.value)} multiline minRows={2} />
      {d.draft && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Resume <Typography component="span" variant="caption" color="text.secondary">v{d.draft.version}</Typography></Typography>
                <CopyButton text={resume} />
              </Stack>
              <TextField value={resume} onChange={e => setResume(e.target.value)} multiline minRows={20} fullWidth inputProps={{ 'aria-label': 'Resume', style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 } }} />
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Cover letter</Typography>
                <CopyButton text={letter} />
              </Stack>
              <TextField value={letter} onChange={e => setLetter(e.target.value)} multiline minRows={20} fullWidth inputProps={{ 'aria-label': 'Cover letter' }} />
            </CardContent></Card>
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
