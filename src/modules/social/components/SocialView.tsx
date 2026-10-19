import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, LinearProgress, MenuItem, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, ImagePlus, Sparkles } from 'lucide-react';
import PageHeader from '../../../common/components/PageHeader';
import CopyButton from '../../../common/components/CopyButton';
import FileDrop from '../../../common/components/FileDrop';
import StatusChip from '../../../common/components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { downloadUrl } from '../../../common/firebaseHelpers';
import TagInput from '../../profile/components/TagInput';
import { saveProfile, useProfile } from '../../profile/hooks/useProfile';
import { addVisualDraft, attachImage, generateWeek, updateDraft, useSocialWeek, useWeekDrafts } from '../hooks/useSocial';
import { mondayOf, shiftWeek, weekLabel, ymd } from '../../../common/week';
import { Platform, PLATFORM_LABEL, SocialDraft, X_LIMIT } from '../types';

export default function SocialView({ uid }: { uid: string }) {
  const [weekOf, setWeekOf] = useState(ymd(mondayOf(new Date())));
  const drafts = useWeekDrafts(uid, weekOf);
  const week = useSocialWeek(uid, weekOf);
  const { profile, loading: profileLoading } = useProfile(uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualOpen, setVisualOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | Platform>('all');

  const visible = drafts.data
    .filter(d => d.status !== 'discarded' && (filter === 'all' || d.platform === filter))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const missing = [!profile.bio && 'bio', !profile.resume && 'resume', !profile.targets.roles.length && 'target roles'].filter(Boolean);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try { await generateWeek(weekOf); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Social" subtitle="Weekly LinkedIn and X drafts from your profile and your Lazer work. Drafts only — you edit and post."
        actions={<>
          <Button startIcon={<ImagePlus size={16} />} onClick={() => setVisualOpen(true)}>Post from an image</Button>
          <Button variant="contained" startIcon={<Sparkles size={16} />} onClick={generate} disabled={busy}>
            {drafts.data.length ? 'Draft more for this week' : 'Draft this week'}
          </Button>
        </>} />

      <TargetsCard uid={uid} loading={profileLoading} targets={profile.targets} />

      {missing.length > 0 && !profileLoading && (
        <Alert severity="info" sx={{ my: 2 }}>Drafts get better with your {missing.join(', ')}. Add {missing.length > 1 ? 'them' : 'it'} in Profile.</Alert>
      )}

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 3, mb: 2 }}>
        <IconButton aria-label="Previous week" onClick={() => setWeekOf(shiftWeek(weekOf, -1))}><ChevronLeft size={18} /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 180, textAlign: 'center' }}>{weekLabel(weekOf)}</Typography>
        <IconButton aria-label="Next week" onClick={() => setWeekOf(shiftWeek(weekOf, 1))}><ChevronRight size={18} /></IconButton>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="linkedin">LinkedIn</ToggleButton>
          <ToggleButton value="x">X</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {busy && <Box sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary" gutterBottom>Reading your profile, recent work and current platform guidance…</Typography><LinearProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {week.data?.themes?.length ? (
        <Card variant="outlined" sx={{ mb: 2 }}><CardContent>
          <Typography variant="subtitle2" gutterBottom>Themes this week</Typography>
          <Stack spacing={0.5}>
            {week.data.themes.map((t, i) => <Typography key={i} variant="body2"><strong>{t.title}</strong> <Typography component="span" variant="body2" color="text.secondary">— {t.why}</Typography></Typography>)}
          </Stack>
        </CardContent></Card>
      ) : null}

      {drafts.loading ? <LoadingState /> : drafts.error ? <ErrorState message={drafts.error} /> : visible.length === 0 ? (
        <EmptyState title="No drafts for this week" description="Draft the week to get five or six posts split between LinkedIn and X, or start from a screenshot of your work." />
      ) : (
        <Grid container spacing={2}>
          {visible.map(d => <Grid key={d.id} size={{ xs: 12, md: 6 }}><DraftCard uid={uid} draft={d} /></Grid>)}
        </Grid>
      )}

      <VisualDialog uid={uid} weekOf={weekOf} open={visualOpen} onClose={() => setVisualOpen(false)} />
    </Box>
  );
}

function TargetsCard({ uid, targets, loading }: { uid: string; targets: { roles: string[]; companies: string[]; industries: string[] }; loading: boolean }) {
  const [form, setForm] = useState(targets);
  const [saved, setSaved] = useState(true);
  useEffect(() => { if (!loading) { setForm(targets); setSaved(true); } }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof form, v: string[]) => { setForm({ ...form, [k]: v }); setSaved(false); };
  return (
    <Card variant="outlined"><CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h6">What you're targeting this year</Typography>
          <Typography variant="body2" color="text.secondary">Saved to your Profile; social drafts and resume tailoring both read it.</Typography>
        </Box>
        <Button variant="outlined" size="small" disabled={saved} onClick={() => saveProfile(uid, { targets: form }).then(() => setSaved(true))}>{saved ? 'Saved' : 'Save targets'}</Button>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><TagInput label="Role titles" value={form.roles} onChange={v => set('roles', v)} placeholder="e.g. VP Design" /></Grid>
        <Grid size={{ xs: 12, md: 4 }}><TagInput label="Companies" value={form.companies} onChange={v => set('companies', v)} /></Grid>
        <Grid size={{ xs: 12, md: 4 }}><TagInput label="Industries" value={form.industries} onChange={v => set('industries', v)} /></Grid>
      </Grid>
    </CardContent></Card>
  );
}

function DraftCard({ uid, draft }: { uid: string; draft: SocialDraft }) {
  const [body, setBody] = useState(draft.body);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setBody(draft.body), [draft.body]);
  useEffect(() => { if (draft.imagePath) downloadUrl(draft.imagePath).then(setImg).catch(() => setImg(null)); }, [draft.imagePath]);
  const over = draft.platform === 'x' && body.length > X_LIMIT;

  return (
    <Card variant="outlined" sx={{ height: '100%', opacity: draft.status === 'posted' ? 0.7 : 1 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip size="small" label={PLATFORM_LABEL[draft.platform]} variant="outlined" />
          <Chip size="small" label={draft.kind === 'visual' ? 'Visual' : 'Text'} variant="outlined" />
          {draft.status === 'posted' && <StatusChip label="Posted" tone="success" />}
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>{draft.theme}</Typography>
        </Stack>
        {draft.kind === 'visual' && (
          img ? <Box component="img" src={img} alt={draft.altText || ''} sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 1, mb: 1 }} />
            : <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>Capture: {draft.visualBrief || 'a screenshot of the work'}</Alert>
        )}
        <TextField value={body} onChange={e => setBody(e.target.value)} multiline minRows={5} fullWidth inputProps={{ 'aria-label': 'Post copy' }}
          error={over} helperText={draft.platform === 'x' ? `${body.length}/${X_LIMIT}${over ? ' — too long for one post' : ''}` : `${body.split(/\s+/).filter(Boolean).length} words`} />
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <CopyButton text={body} />
          {body !== draft.body && <Button size="small" onClick={() => updateDraft(uid, draft.id, { body })}>Save edit</Button>}
          {draft.kind === 'visual' && (
            <Button size="small" component="label" disabled={busy}>
              {draft.imagePath ? 'Replace image' : 'Add image'}
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                setBusy(true); setError(null);
                try { await attachImage(uid, draft, f, 'wip'); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
              }} />
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {draft.status !== 'posted'
            ? <Button size="small" onClick={() => updateDraft(uid, draft.id, { status: 'posted', body })}>Mark posted</Button>
            : <Button size="small" onClick={() => updateDraft(uid, draft.id, { status: 'draft' })}>Undo posted</Button>}
          <Button size="small" color="inherit" onClick={() => updateDraft(uid, draft.id, { status: 'discarded' })}>Discard</Button>
        </Stack>
        {busy && <LinearProgress sx={{ mt: 1 }} />}
      </CardContent>
    </Card>
  );
}

function VisualDialog({ uid, weekOf, open, onClose }: { uid: string; weekOf: string; open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState<Platform>('linkedin');
  const [stage, setStage] = useState<'wip' | 'finished'>('wip');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setFile(null); setContext(''); setError(null); } }, [open]);

  const submit = async () => {
    if (!file) { setError('Choose an image.'); return; }
    setBusy(true); setError(null);
    try { await addVisualDraft(uid, weekOf, platform, file, context, stage); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Post from an image</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FileDrop label="Screenshot or export" accept={['.png', '.jpg', '.jpeg', '.webp']} fileName={file?.name} onFile={setFile} disabled={busy} />
          <Stack direction="row" spacing={2}>
            <TextField select label="Platform" value={platform} onChange={e => setPlatform(e.target.value as Platform)} fullWidth>
              <MenuItem value="linkedin">LinkedIn</MenuItem>
              <MenuItem value="x">X</MenuItem>
            </TextField>
            <TextField select label="Stage" value={stage} onChange={e => setStage(e.target.value as 'wip' | 'finished')} fullWidth>
              <MenuItem value="wip">Work in progress</MenuItem>
              <MenuItem value="finished">Finished work</MenuItem>
            </TextField>
          </Stack>
          <TextField label="What's going on here?" value={context} onChange={e => setContext(e.target.value)} multiline minRows={3}
            helperText="Optional. The problem, the decision, what you learned. Client names are never used." />
          {busy && <LinearProgress />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>Write copy</Button>
      </DialogActions>
    </Dialog>
  );
}
