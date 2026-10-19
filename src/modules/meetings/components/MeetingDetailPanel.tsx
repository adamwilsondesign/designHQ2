import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Divider, FormControlLabel, Link, Stack, TextField, Typography } from '@mui/material';
import SidePanel from '../../../common/components/SidePanel';
import FileDrop from '../../../common/components/FileDrop';
import StatusChip from '../../../common/components/StatusChip';
import { useStaffProfiles } from '../../staffData/hooks/useStaffProfiles';
import { markHeld, updateMeeting, uploadAndProcessTranscript, useMeetingSeries } from '../hooks/useMeetings';
import { KIND_LABEL, Meeting } from '../types';

// Detail of one meeting: transcript upload, AI notes, action items, decisions.
export default function MeetingDetailPanel({ meeting, onClose }: { meeting: Meeting | null; onClose: () => void }) {
  const profiles = useStaffProfiles();
  const series = useMeetingSeries();
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adamNotes, setAdamNotes] = useState('');

  useEffect(() => {
    setAdamNotes(meeting?.adamNotes || '');
    setError(null);
    setProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  if (!meeting) return null;
  const m = meeting;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onTranscript = (file: File) =>
    run('transcript', async () => {
      await uploadAndProcessTranscript(m.id, file, setProgress);
      if (m.status === 'scheduled') await markHeld(m, id => profiles.get(id), series.data.find(s => s.id === m.seriesId));
    });

  const toggleAction = (i: number) =>
    updateMeeting(m.id, { actionItems: (m.actionItems || []).map((a, j) => (j === i ? { ...a, done: !a.done } : a)) });

  return (
    <SidePanel open onClose={onClose} title={m.title} width={600}
      subtitle={`${KIND_LABEL[m.kind]} · ${new Date(m.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip label={m.status === 'held' ? 'Held' : m.status === 'cancelled' ? 'Cancelled' : 'Scheduled'} tone={m.status === 'held' ? 'success' : 'default'} />
          {m.calendarLink && <Link href={m.calendarLink} target="_blank" rel="noreferrer" variant="body2">Open in Google Calendar</Link>}
          <Box sx={{ flex: 1 }} />
          {m.status === 'scheduled' && (
            <>
              <Button size="small" onClick={() => run('cancel', () => updateMeeting(m.id, { status: 'cancelled' }))}>Cancel meeting</Button>
              <Button size="small" variant="outlined" disabled={!!busy}
                onClick={() => run('held', () => markHeld(m, id => profiles.get(id), series.data.find(s => s.id === m.seriesId)))}>Mark as held</Button>
            </>
          )}
        </Stack>

        {m.agenda && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>Agenda</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.agenda}</Typography>
          </Box>
        )}

        <FileDrop
          label="Transcript"
          accept={['.pdf', '.docx', '.txt']}
          hint="PDF, DOCX or TXT. Notes, action items and decisions are extracted automatically."
          fileName={m.transcriptName}
          progress={progress}
          disabled={!!busy}
          onFile={onTranscript}
        />
        {busy === 'transcript' && <Typography variant="body2" color="text.secondary">Uploading and extracting notes…</Typography>}

        {m.summary && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Summary</Typography>
              <Typography variant="body2">{m.summary}</Typography>
            </Box>
          </>
        )}
        {!!m.notes?.length && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>Notes</Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0, typography: 'body2' }}>{m.notes.map((n, i) => <li key={i}>{n}</li>)}</Box>
          </Box>
        )}
        {!!m.actionItems?.length && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>Action items</Typography>
            {m.actionItems.map((a, i) => (
              <FormControlLabel key={i} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}
                control={<Checkbox size="small" checked={a.done} onChange={() => toggleAction(i)} sx={{ pt: 0.25 }} />}
                label={<Typography variant="body2" sx={{ textDecoration: a.done ? 'line-through' : 'none' }}>
                  {a.task}{a.owner ? ` — ${a.owner}` : ''}{a.due ? ` (due ${a.due})` : ''}
                </Typography>}
              />
            ))}
          </Box>
        )}
        {!!m.decisions?.length && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>Decisions</Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0, typography: 'body2' }}>{m.decisions.map((n, i) => <li key={i}>{n}</li>)}</Box>
          </Box>
        )}

        <Box>
          <TextField label="Your notes" value={adamNotes} onChange={e => setAdamNotes(e.target.value)} multiline minRows={3} fullWidth />
          <Button size="small" sx={{ mt: 1 }} disabled={adamNotes === (m.adamNotes || '') || !!busy}
            onClick={() => run('notes', () => updateMeeting(m.id, { adamNotes }))}>Save notes</Button>
        </Box>
      </Stack>
    </SidePanel>
  );
}
