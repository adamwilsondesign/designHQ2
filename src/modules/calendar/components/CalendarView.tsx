import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Link, MenuItem, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../../common/components/PageHeader';
import StatusChip from '../../../common/components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import {
  CalendarEvent, connectGoogle, createCalendarEvent, disconnectGoogle, GOOGLE_ACCOUNT_LABEL, GoogleAccountKey, listCalendarEvents, useGoogleAccounts,
} from '../../../common/google';
import { deleteReminder, markHandled, saveReminder, useReminders } from '../hooks/useReminders';
import { reminderSuggestions, ReminderSuggestion, upcoming } from '../lib/reminders';
import { KIND_LABEL, Reminder, REMINDER_DEFAULTS, ReminderKind } from '../types';

const LANES: GoogleAccountKey[] = ['lazer', 'polyform', 'personal'];
const DAY = 864e5;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function CalendarView({ uid }: { uid: string }) {
  const [tab, setTab] = useState<'calendar' | 'reminders'>('calendar');
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Calendar" subtitle="Lazer, Polyform and personal calendars side by side, plus personal reminders" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="calendar" label="Combined calendar" />
        <Tab value="reminders" label="Reminders" />
      </Tabs>
      <ReminderSuggestions uid={uid} />
      {tab === 'calendar' ? <CombinedCalendar /> : <RemindersTab uid={uid} />}
    </Box>
  );
}

function eventLabel(e: CalendarEvent): { label: string; tone: 'info' | 'warning' | 'default' } | null {
  if (e.eventType === 'focusTime') return { label: 'Focus', tone: 'info' };
  if (e.eventType === 'outOfOffice') return { label: 'Out of office', tone: 'warning' };
  if (e.isTravel) return { label: 'Travel', tone: 'warning' };
  return null;
}

function CombinedCalendar() {
  const { accounts, error: statusError, refresh } = useGoogleAccounts();
  const [start, setStart] = useState(() => startOfDay(new Date()));
  const days = 14;
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [laneErrors, setLaneErrors] = useState<Partial<Record<GoogleAccountKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const connected = accounts?.filter(a => a.connected).map(a => a.account) || [];

  const load = useCallback(async () => {
    if (!connected.length) { setEvents([]); return; }
    setEvents(null);
    setError(null);
    try {
      const res = await listCalendarEvents(start.toISOString(), new Date(start.getTime() + days * DAY).toISOString(), connected);
      setEvents(res.results.flatMap(r => r.events));
      setLaneErrors(Object.fromEntries(res.results.filter(r => r.error).map(r => [r.account, r.error])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.getTime(), connected.join()]);
  useEffect(() => { if (accounts) load(); }, [accounts, load]);

  const byDayLane = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events || []) {
      // All-day and multi-day events show on every day they cover.
      const s = startOfDay(new Date(e.allDay ? `${e.start}T00:00:00` : e.start));
      const endRaw = new Date(e.allDay ? `${e.end}T00:00:00` : e.end);
      const last = e.allDay ? new Date(endRaw.getTime() - DAY) : endRaw;
      for (let d = s; d <= last; d = new Date(d.getTime() + DAY)) {
        const key = `${ymd(d)}|${e.account}`;
        map.set(key, [...(map.get(key) || []), e]);
      }
    }
    return map;
  }, [events]);

  const dayList = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY));

  return (
    <Stack spacing={2}>
      {statusError && <ErrorState message={statusError} />}
      <Grid container spacing={2}>
        {LANES.map(a => {
          const s = accounts?.find(x => x.account === a);
          return (
            <Grid key={a} size={{ xs: 12, md: 4 }}>
              <Card variant="outlined"><CardContent sx={{ '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{GOOGLE_ACCOUNT_LABEL[a]}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{s?.connected ? s.email : 'Not connected'}</Typography>
                  </Box>
                  {s?.connected
                    ? <Button size="small" color="inherit" onClick={() => disconnectGoogle(a).then(refresh)}>Disconnect</Button>
                    : <Button size="small" variant="outlined" disabled={!accounts} onClick={() => connectGoogle(a)}>Connect</Button>}
                </Stack>
              </CardContent></Card>
            </Grid>
          );
        })}
      </Grid>

      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton aria-label="Previous two weeks" onClick={() => setStart(new Date(start.getTime() - days * DAY))}><ChevronLeft size={18} /></IconButton>
        <Typography variant="h6">{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(start.getTime() + (days - 1) * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Typography>
        <IconButton aria-label="Next two weeks" onClick={() => setStart(new Date(start.getTime() + days * DAY))}><ChevronRight size={18} /></IconButton>
        <Button size="small" onClick={() => setStart(startOfDay(new Date()))}>Today</Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">Focus time and out-of-office come from Google; travel is detected from event titles.</Typography>
      </Stack>
      {error && <ErrorState message={error} onRetry={load} />}

      {statusError ? null : !accounts || events === null ? <LoadingState label="Loading calendars…" /> : connected.length === 0 ? (
        <EmptyState title="No calendars connected" description="Connect your Lazer, Polyform and personal Google accounts above to see them side by side." />
      ) : (
        <TableContainer component={Card} variant="outlined">
          <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 120 }}>Day</TableCell>
                {LANES.map(a => (
                  <TableCell key={a}>
                    {GOOGLE_ACCOUNT_LABEL[a]}
                    {laneErrors[a] && laneErrors[a] !== 'not connected' && <Typography variant="caption" color="error" display="block">{laneErrors[a]}</Typography>}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dayList.map(d => {
                const isToday = ymd(d) === ymd(new Date());
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <TableRow key={ymd(d)} sx={{ bgcolor: isToday ? 'action.selected' : weekend ? 'action.hover' : undefined, verticalAlign: 'top' }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: isToday ? 600 : 400 }}>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Typography>
                    </TableCell>
                    {LANES.map(a => (
                      <TableCell key={a}>
                        {!connected.includes(a) ? <Typography variant="caption" color="text.disabled">—</Typography> : (
                          <Stack spacing={0.5}>
                            {(byDayLane.get(`${ymd(d)}|${a}`) || []).map(e => {
                              const tag = eventLabel(e);
                              return (
                                <Box key={e.id + ymd(d)} sx={{ borderLeft: 3, borderColor: tag ? `${tag.tone === 'info' ? 'info' : 'warning'}.main` : 'divider', pl: 1 }}>
                                  <Link href={e.htmlLink} target="_blank" rel="noreferrer" underline="hover" color="inherit" variant="body2" sx={{ display: 'block' }}>
                                    {!e.allDay && <Typography component="span" variant="caption" color="text.secondary">{new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} </Typography>}
                                    {e.title}
                                  </Link>
                                  {tag && <StatusChip label={tag.label} tone={tag.tone} />}
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

function ReminderSuggestions({ uid }: { uid: string }) {
  const reminders = useReminders(uid);
  const suggestions = useMemo(() => reminderSuggestions(reminders.data), [reminders.data]);
  const [booking, setBooking] = useState<ReminderSuggestion | null>(null);
  if (suggestions.length === 0) return null;
  return (
    <Card variant="outlined" sx={{ mb: 3 }}><CardContent>
      <Typography variant="h6" gutterBottom>Suggested blocks</Typography>
      {suggestions.map(s => (
        <Stack key={s.reminder.id + s.occurrenceKey} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{s.reminder.title} — {s.occurrence.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Typography>
            <Typography variant="caption" color="text.secondary">{s.reminder.blockMinutes}-minute block: {s.reminder.action} · in {s.daysUntil} days</Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={() => setBooking(s)}>Add block</Button>
          <Button size="small" color="inherit" onClick={() => markHandled(uid, s.reminder.id, s.occurrenceKey)}>Dismiss</Button>
        </Stack>
      ))}
      <BlockDialog uid={uid} suggestion={booking} onClose={() => setBooking(null)} />
    </CardContent></Card>
  );
}

function BlockDialog({ uid, suggestion, onClose }: { uid: string; suggestion: ReminderSuggestion | null; onClose: () => void }) {
  const { accounts } = useGoogleAccounts();
  const connected = accounts?.filter(a => a.connected).map(a => a.account) || [];
  const [account, setAccount] = useState<GoogleAccountKey>('personal');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!suggestion) return;
    setDate(ymd(suggestion.suggestedDate));
    setError(null);
  }, [suggestion]);
  useEffect(() => { if (connected.length && !connected.includes(account)) setAccount(connected.includes('personal') ? 'personal' : connected[0]); }, [connected.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!suggestion) return null;

  const book = async () => {
    const start = new Date(`${date}T${time}`);
    if (isNaN(start.getTime())) { setError('Pick a date and time.'); return; }
    setBusy(true); setError(null);
    try {
      await createCalendarEvent({
        account,
        summary: `${suggestion.reminder.action} — ${suggestion.reminder.title}`,
        description: `${KIND_LABEL[suggestion.reminder.kind]} on ${suggestion.occurrence.toDateString()}. Added by DesignHQ.`,
        start: start.toISOString(),
        end: new Date(start.getTime() + suggestion.reminder.blockMinutes * 60000).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await markHandled(uid, suggestion.reminder.id, suggestion.occurrenceKey);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add {suggestion.reminder.blockMinutes}-minute block</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {connected.length === 0 && <Alert severity="warning">Connect a Google account on the Combined calendar tab first.</Alert>}
          <TextField select label="Calendar" value={account} onChange={e => setAccount(e.target.value as GoogleAccountKey)} disabled={!connected.length}>
            {connected.map(a => <MenuItem key={a} value={a}>{GOOGLE_ACCOUNT_LABEL[a]}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Time" type="time" value={time} onChange={e => setTime(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={book} disabled={busy || !connected.length}>{busy ? 'Adding…' : 'Add to calendar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function RemindersTab({ uid }: { uid: string }) {
  const reminders = useReminders(uid);
  const [editing, setEditing] = useState<Partial<Reminder> | null>(null);
  const next = useMemo(() => upcoming(reminders.data, 400), [reminders.data]);

  if (reminders.loading) return <LoadingState />;
  if (reminders.error) return <ErrorState message={reminders.error} />;
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">Family birthdays, anniversaries and trips. A block is suggested ahead of each one.</Typography>
        <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={() => setEditing({ kind: 'birthday', ...REMINDER_DEFAULTS.birthday })}>Add reminder</Button>
      </Stack>
      {reminders.data.length === 0 ? (
        <EmptyState title="No reminders yet" description="Add a birthday and you'll get a 20-minute block suggestion about a month before to buy and ship a gift." />
      ) : (
        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reminder</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Next</TableCell>
                <TableCell align="right">Lead time</TableCell>
                <TableCell>Block</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {reminders.data.map(r => {
                const n = next.find(x => x.reminder.id === r.id)?.occurrence;
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.title}</TableCell>
                    <TableCell>{KIND_LABEL[r.kind]}{r.recurrence === 'yearly' ? ' · yearly' : ''}</TableCell>
                    <TableCell>{n ? n.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Past'}</TableCell>
                    <TableCell align="right">{r.leadDays} days</TableCell>
                    <TableCell>{r.blockMinutes} min · {r.action}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)}><Pencil size={16} /></IconButton>
                      <IconButton size="small" aria-label={`Delete ${r.title}`} onClick={() => window.confirm(`Delete ${r.title}?`) && deleteReminder(uid, r.id)}><Trash2 size={16} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ReminderDialog uid={uid} value={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}

function ReminderDialog({ uid, value, onClose }: { uid: string; value: Partial<Reminder> | null; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Reminder> | null>(value);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => { setForm(value); setError(null); setTouched(false); }, [value]);
  if (!form) return null;
  const invalid = !form.title?.trim() || !form.date || !form.leadDays || form.leadDays < 0 || !form.blockMinutes;

  const save = async () => {
    setTouched(true);
    if (invalid) return;
    try {
      await saveReminder(uid, {
        id: form.id,
        kind: form.kind as ReminderKind,
        title: form.title!.trim(),
        date: form.date!,
        recurrence: form.recurrence || 'yearly',
        leadDays: Number(form.leadDays),
        blockMinutes: Number(form.blockMinutes),
        action: form.action || '',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{form.id ? 'Edit reminder' : 'New reminder'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Type" value={form.kind} onChange={e => { const kind = e.target.value as ReminderKind; setForm({ ...form, kind, ...REMINDER_DEFAULTS[kind] }); }}>
            {(Object.keys(KIND_LABEL) as ReminderKind[]).map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
          </TextField>
          <TextField label="Title" placeholder="e.g. Mom's birthday" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })}
            error={touched && !form.title?.trim()} helperText={touched && !form.title?.trim() ? 'Required' : ' '} />
          <Stack direction="row" spacing={2}>
            <TextField label="Date" type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} fullWidth
              error={touched && !form.date} helperText={form.recurrence === 'yearly' ? 'Only month and day are used' : ' '} />
            <TextField select label="Repeats" value={form.recurrence || 'yearly'} onChange={e => setForm({ ...form, recurrence: e.target.value as Reminder['recurrence'] })} fullWidth>
              <MenuItem value="yearly">Every year</MenuItem>
              <MenuItem value="once">Once</MenuItem>
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Suggest block (days before)" type="number" value={form.leadDays ?? ''} onChange={e => setForm({ ...form, leadDays: Number(e.target.value) })} fullWidth inputProps={{ min: 0 }} />
            <TextField label="Block length (min)" type="number" value={form.blockMinutes ?? ''} onChange={e => setForm({ ...form, blockMinutes: Number(e.target.value) })} fullWidth inputProps={{ min: 5, step: 5 }} />
          </Stack>
          <TextField label="What the block is for" value={form.action || ''} onChange={e => setForm({ ...form, action: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
