import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material';
import { addToCalendar, createMeeting } from '../hooks/useMeetings';
import { Meeting, MeetingKind } from '../types';
import { toYmd } from '../lib/schedule';

export interface BookingDraft {
  kind: MeetingKind;
  title: string;
  staffId?: string | null;
  staffName?: string | null;
  seriesId?: string | null;
  presenters?: string[];
  agenda?: string;
  attendees: string; // comma-separated emails
  durationMinutes: number;
  suggestedDate?: Date | null;
}

export default function BookMeetingDialog({ draft, onClose }: { draft: BookingDraft | null; onClose: (createdId?: string) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(30);
  const [attendees, setAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [toCalendar, setToCalendar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!draft) return;
    const suggested = draft.suggestedDate && draft.suggestedDate > new Date() ? draft.suggestedDate : new Date(Date.now() + 864e5);
    setTitle(draft.title);
    setDate(toYmd(suggested));
    setTime('10:00');
    setDuration(draft.durationMinutes);
    setAttendees(draft.attendees);
    setAgenda(draft.agenda || '');
    setToCalendar(true);
    setError(null);
    setTouched(false);
  }, [draft]);

  const start = date && time ? new Date(`${date}T${time}`) : null;
  const invalid = !title.trim() || !start || isNaN(start.getTime()) || duration < 5;

  const submit = async () => {
    setTouched(true);
    if (invalid || !draft) return;
    setSaving(true);
    setError(null);
    let id: string | undefined;
    try {
      const meeting: Omit<Meeting, 'id' | 'createdAt' | 'createdBy'> = {
        kind: draft.kind,
        title: title.trim(),
        date: start!.toISOString(),
        durationMinutes: duration,
        status: 'scheduled',
        staffId: draft.staffId ?? null,
        staffName: draft.staffName ?? null,
        seriesId: draft.seriesId ?? null,
        presenters: draft.presenters || [],
        agenda,
      };
      id = await createMeeting(meeting);
      if (toCalendar) {
        const emails = attendees.split(',').map(s => s.trim()).filter(Boolean);
        await addToCalendar(id, meeting, emails);
      }
      onClose(id);
    } catch (e) {
      setError(`${id ? 'Meeting saved, but the calendar event failed: ' : ''}${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!draft} onClose={() => onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Book meeting</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} error={touched && !title.trim()} helperText={touched && !title.trim() ? 'Required' : ' '} />
          <Stack direction="row" spacing={2}>
            <TextField label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth error={touched && !date} />
            <TextField label="Start time" type="time" value={time} onChange={e => setTime(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Minutes" type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} inputProps={{ min: 5, step: 5 }} sx={{ width: 140 }} error={duration < 5} />
          </Stack>
          <TextField label="Invitees" value={attendees} onChange={e => setAttendees(e.target.value)} helperText="Comma-separated emails" />
          <TextField label="Agenda / description" value={agenda} onChange={e => setAgenda(e.target.value)} multiline minRows={3} />
          <FormControlLabel control={<Checkbox checked={toCalendar} onChange={e => setToCalendar(e.target.checked)} />} label="Create the event on my Lazer Google Calendar and invite attendees" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Booking…' : 'Book'}</Button>
      </DialogActions>
    </Dialog>
  );
}
