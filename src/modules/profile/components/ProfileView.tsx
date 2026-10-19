import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, Link, Stack, TextField, Typography } from '@mui/material';
import PageHeader from '../../../common/components/PageHeader';
import FileDrop from '../../../common/components/FileDrop';
import { ErrorState, LoadingState } from '../../../common/components/States';
import { downloadUrl } from '../../../common/firebaseHelpers';
import { saveProfile, uploadResume, useProfile } from '../hooks/useProfile';
import { DEFAULT_TONE, PersonalProfile } from '../types';

const isUrl = (s: string) => !s || /^https?:\/\/\S+\.\S+/.test(s.trim());

export default function ProfileView({ uid }: { uid: string }) {
  const { profile, loading, error } = useProfile(uid);
  const [form, setForm] = useState<PersonalProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Load once the document arrives; don't clobber typing on later snapshots.
  const loadedAt = profile.updatedAt;
  useEffect(() => {
    if (!loading) setForm(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  useEffect(() => {
    setForm(f => ({ ...f, resume: profile.resume }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.resume?.path]);

  if (loading) return <LoadingState />;
  if (error) return <Box sx={{ p: 3 }}><ErrorState message={error} /></Box>;

  const set = <K extends keyof PersonalProfile>(k: K, v: PersonalProfile[K]) => { setForm({ ...form, [k]: v }); setSaved(false); };
  const invalid = !isUrl(form.linkedinUrl) || !isUrl(form.portfolioUrl);

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Resume is saved by its own upload; targets are edited in Social.
      const { resume, updatedAt, targets, ...rest } = form;
      await saveProfile(uid, rest);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Profile" subtitle="The single source every personal generator reads: social drafts, resumes and cover letters."
        actions={<Button variant="contained" onClick={save} disabled={saving || invalid}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}</Button>} />
      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
      {loadedAt && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>Last saved {new Date(loadedAt).toLocaleString()}</Typography>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined"><CardContent>
            <Typography variant="h6" gutterBottom>About you</Typography>
            <Stack spacing={2}>
              <TextField label="Full name" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              <TextField label="LinkedIn URL" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)}
                error={!isUrl(form.linkedinUrl)} helperText={!isUrl(form.linkedinUrl) ? 'Enter a full URL starting with https://' : ' '} />
              <TextField label="Portfolio URL" value={form.portfolioUrl} onChange={e => set('portfolioUrl', e.target.value)}
                error={!isUrl(form.portfolioUrl)} helperText={!isUrl(form.portfolioUrl) ? 'Enter a full URL starting with https://' : ' '} />
              <TextField label="Professional bio" value={form.bio} onChange={e => set('bio', e.target.value)} multiline minRows={8}
                helperText="Written in your words. Used as background for posts, resumes and cover letters." />
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Resume</Typography>
              {form.resume && (
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Current: <Link component="button" onClick={async () => window.open(await downloadUrl(form.resume!.path), '_blank', 'noopener')}>{form.resume.name}</Link>
                  <Typography component="span" variant="caption" color="text.secondary"> · {new Date(form.resume.uploadedAt).toLocaleDateString()}</Typography>
                </Typography>
              )}
              <FileDrop label={form.resume ? 'Replace resume' : 'Upload resume'} accept={['.pdf', '.docx', '.txt']} progress={progress}
                onFile={f => uploadResume(uid, f, setProgress).catch(e => setSaveError(e.message)).finally(() => setProgress(null))} />
            </CardContent></Card>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Tone of voice</Typography>
                <Button size="small" disabled={form.toneOfVoice === DEFAULT_TONE} onClick={() => set('toneOfVoice', DEFAULT_TONE)}>Reset</Button>
              </Stack>
              <TextField value={form.toneOfVoice} onChange={e => set('toneOfVoice', e.target.value)} multiline minRows={5} fullWidth sx={{ mt: 1 }}
                inputProps={{ 'aria-label': 'Tone of voice' }}
                helperText="The canonical voice. Every content generator reads this text." />
            </CardContent></Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
