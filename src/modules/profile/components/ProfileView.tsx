import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, Link, Stack, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import PageHeader from '../../../common/components/PageHeader';
import FileDrop from '../../../common/components/FileDrop';
import { ErrorState, LoadingState } from '../../../common/components/States';
import { downloadUrl } from '../../../common/firebaseHelpers';
import { saveProfile, uploadResume, useProfile } from '../hooks/useProfile';
import { DEFAULT_TONE, PersonalProfile } from '../types';
import ActivityLog from './ActivityLog';
import TagInput from './TagInput';

const isUrl = (s: string) => !s || /^https?:\/\/\S+\.\S+/.test(s.trim());

// Which generators read which fields. Shown so it's obvious there is one source.
const USED_BY: [string, string][] = [
  ['Name, LinkedIn, portfolio', 'Social drafts, resume, cover letter'],
  ['Resume', 'Resume tailoring (source), social drafts (background)'],
  ['Bio', 'Social drafts, resume, cover letter'],
  ['Targets', 'Social drafts, resume, cover letter'],
  ['Tone of voice', 'Social drafts, image captions, cover letter'],
];

// The personal profile hub: one place for everything the personal modules
// read, plus a log of recent personal activity.
export default function ProfileView({ uid }: { uid: string }) {
  const { profile, loading, error } = useProfile(uid);
  const [form, setForm] = useState<PersonalProfile>(profile);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Load once when the document arrives; later snapshots (e.g. targets saved
  // from Social) refresh the form only when there are no unsaved edits here.
  useEffect(() => {
    if (!loading && !dirty) setForm(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile.updatedAt, profile.resume?.path]);

  if (loading) return <LoadingState />;
  if (error) return <Box sx={{ p: 3 }}><ErrorState message={error} /></Box>;

  const set = <K extends keyof PersonalProfile>(k: K, v: PersonalProfile[K]) => { setForm({ ...form, [k]: v }); setDirty(true); };
  const setTarget = (k: keyof PersonalProfile['targets'], v: string[]) => set('targets', { ...form.targets, [k]: v });
  const invalid = !isUrl(form.linkedinUrl) || !isUrl(form.portfolioUrl);

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    setSaveError(null);
    try {
      // The resume is saved by its own upload.
      const { resume, updatedAt, ...rest } = form;
      await saveProfile(uid, rest);
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Profile" subtitle="Everything personal in one place. Social, job search and the resume generator all read from here."
        actions={<Button variant="contained" onClick={save} disabled={saving || invalid || !dirty}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Button>} />
      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>About you</Typography>
              <Stack spacing={1}>
                <TextField label="Full name" value={form.fullName} onChange={e => set('fullName', e.target.value)} helperText=" " />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="LinkedIn URL" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} fullWidth
                    error={!isUrl(form.linkedinUrl)} helperText={!isUrl(form.linkedinUrl) ? 'Enter a full URL starting with https://' : ' '} />
                  <TextField label="Portfolio URL" value={form.portfolioUrl} onChange={e => set('portfolioUrl', e.target.value)} fullWidth
                    error={!isUrl(form.portfolioUrl)} helperText={!isUrl(form.portfolioUrl) ? 'Enter a full URL starting with https://' : ' '} />
                </Stack>
                <TextField label="Professional bio" value={form.bio} onChange={e => set('bio', e.target.value)} multiline minRows={8}
                  helperText="In your words. Changes here show up in the next draft everywhere." />
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6">Targets</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>The roles, companies and industries you're aiming for this year. Also editable from Social.</Typography>
              <Stack spacing={2}>
                <TagInput label="Target roles" value={form.targets.roles} onChange={v => setTarget('roles', v)} placeholder="e.g. VP Design" />
                <TagInput label="Companies" value={form.targets.companies} onChange={v => setTarget('companies', v)} />
                <TagInput label="Industries" value={form.targets.industries} onChange={v => setTarget('industries', v)} />
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Tone of voice</Typography>
                <Button size="small" disabled={form.toneOfVoice === DEFAULT_TONE} onClick={() => set('toneOfVoice', DEFAULT_TONE)}>Reset to default</Button>
              </Stack>
              <TextField value={form.toneOfVoice} onChange={e => set('toneOfVoice', e.target.value)} multiline minRows={4} fullWidth sx={{ mt: 1 }}
                inputProps={{ 'aria-label': 'Tone of voice' }} helperText="The canonical reference every content generator reads." />
            </CardContent></Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Resume</Typography>
              {form.resume ? (
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <Link component="button" onClick={async () => window.open(await downloadUrl(form.resume!.path), '_blank', 'noopener')}>{form.resume.name}</Link>
                  <Typography component="span" variant="caption" color="text.secondary"> · uploaded {new Date(form.resume.uploadedAt).toLocaleDateString()}</Typography>
                </Typography>
              ) : <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>No resume yet. Tailored resumes are rewritten from this file.</Typography>}
              <FileDrop label={form.resume ? 'Replace resume' : 'Upload resume'} accept={['.pdf', '.docx', '.txt']} progress={progress}
                onFile={f => uploadResume(uid, f, setProgress).catch(e => setSaveError(e.message)).finally(() => setProgress(null))} />
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Recent activity</Typography>
              <ActivityLog uid={uid} />
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Where this is used</Typography>
              <Table size="small">
                <TableBody>
                  {USED_BY.map(([field, by]) => (
                    <TableRow key={field}>
                      <TableCell sx={{ pl: 0, fontWeight: 500, verticalAlign: 'top' }}>{field}</TableCell>
                      <TableCell sx={{ pr: 0, color: 'text.secondary' }}>{by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
