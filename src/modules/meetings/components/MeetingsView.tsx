import React, { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, InputAdornment, MenuItem, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { Pencil, Plus, Search } from 'lucide-react';
import PageHeader from '../../../common/components/PageHeader';
import StatusChip from '../../../common/components/StatusChip';
import CopyButton from '../../../common/components/CopyButton';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { StaffMember } from '../../../lib/mockData';
import StaffDetailsPanel from '../../staffData/components/StaffDetailsPanel';
import { useStaffProfiles } from '../../staffData/hooks/useStaffProfiles';
import { CADENCE_LABEL } from '../../staffData/types';
import { saveSeries, useMeetings, useMeetingSeries } from '../hooks/useMeetings';
import { designTeamAgenda, nextOneOnOneDate, parseYmd, showAndTellRotation } from '../lib/schedule';
import { GroupMeetingKind, KIND_LABEL, Meeting, MeetingSeries, SERIES_DEFAULTS } from '../types';
import BookMeetingDialog, { BookingDraft } from './BookMeetingDialog';
import { GroupMeetingsDueList, OneOnOneDueList } from './DueLists';
import LazerCalendarStatus from './GoogleConnect';
import MeetingDetailPanel from './MeetingDetailPanel';

type TabId = 'oneOnOnes' | 'group' | 'designTeam' | 'history';
const fmtDate = (s: string | null | undefined) => (s ? parseYmd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function MeetingsView({ staffList, initialTab = 'oneOnOnes' }: { staffList: StaffMember[]; initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const meetings = useMeetings();
  // Keep the open panel in sync with live updates (e.g. after AI processing).
  const liveOpen = openMeeting ? meetings.data.find(m => m.id === openMeeting.id) || openMeeting : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Meetings" subtitle="One-on-ones, town halls, critiques and design team meetings" actions={<LazerCalendarStatus />} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="oneOnOnes" label="One-on-ones" />
        <Tab value="group" label="Group meetings" />
        <Tab value="designTeam" label="Design team" />
        <Tab value="history" label="Notes & history" />
      </Tabs>
      {meetings.error && <ErrorState message={meetings.error} />}
      {tab === 'oneOnOnes' && <OneOnOnesTab staffList={staffList} onOpen={setOpenMeeting} />}
      {tab === 'group' && <GroupTab onOpen={setOpenMeeting} onPlanDesignTeam={() => setTab('designTeam')} />}
      {tab === 'designTeam' && <DesignTeamTab staffList={staffList} onOpen={setOpenMeeting} />}
      {tab === 'history' && <HistoryTab staffList={staffList} onOpen={setOpenMeeting} />}
      <MeetingDetailPanel meeting={liveOpen} onClose={() => setOpenMeeting(null)} />
    </Box>
  );
}

function MeetingsTable({ rows, onOpen, showPerson = true, empty }: { rows: Meeting[]; onOpen: (m: Meeting) => void; showPerson?: boolean; empty: React.ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <TableContainer component={Card} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Meeting</TableCell>
            {showPerson && <TableCell>Type</TableCell>}
            <TableCell>Status</TableCell>
            <TableCell align="right">Action items</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(m => (
            <TableRow key={m.id} hover onClick={() => onOpen(m)} sx={{ cursor: 'pointer' }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
              <TableCell>{m.title}</TableCell>
              {showPerson && <TableCell>{KIND_LABEL[m.kind]}</TableCell>}
              <TableCell>
                <StatusChip label={m.status === 'held' ? (m.summary ? 'Notes ready' : 'Held') : m.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}
                  tone={m.status === 'held' ? 'success' : 'default'} />
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {m.actionItems?.length ? `${m.actionItems.filter(a => a.done).length}/${m.actionItems.length}` : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function OneOnOnesTab({ staffList, onOpen }: { staffList: StaffMember[]; onOpen: (m: Meeting) => void }) {
  const profiles = useStaffProfiles();
  const meetings = useMeetings();
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>Due in the next two weeks</Typography>
            <OneOnOneDueList staffList={staffList} />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 7 }}>
        {profiles.loading ? <LoadingState /> : sorted.length === 0 ? (
          <EmptyState title="No staff yet" description="Add people in Staff first." />
        ) : (
          <TableContainer component={Card} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Person</TableCell>
                  <TableCell>Cadence</TableCell>
                  <TableCell>Last 1:1</TableCell>
                  <TableCell>Next due</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map(s => {
                  const p = profiles.get(s.id);
                  const next = p.oneOnOneCadence && p.lastOneOnOneDate ? nextOneOnOneDate(p.lastOneOnOneDate, p.oneOnOneCadence) : null;
                  const last = meetings.data.find(m => m.kind === 'oneOnOne' && m.staffId === s.id && m.status === 'held');
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{p.oneOnOneCadence ? CADENCE_LABEL[p.oneOnOneCadence] : <Typography variant="body2" color="text.secondary">Not tracked</Typography>}</TableCell>
                      <TableCell>{fmtDate(p.lastOneOnOneDate)}</TableCell>
                      <TableCell>{next ? next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : p.oneOnOneCadence ? 'Now' : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {last && <Button size="small" onClick={() => onOpen(last)}>Last notes</Button>}
                        <Button size="small" onClick={() => setDraft({ kind: 'oneOnOne', title: `1:1 Adam / ${s.name.split(' ')[0]}`, staffId: s.id, staffName: s.name, attendees: s.lazerEmail || '', durationMinutes: 30, suggestedDate: next })}>Book</Button>
                        <IconButton size="small" aria-label={`Edit cadence for ${s.name}`} onClick={() => setEditing(s)}><Pencil size={16} /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Grid>
      <Grid size={12}>
        <Typography variant="h6" gutterBottom>Recent one-on-ones</Typography>
        <MeetingsTable rows={meetings.data.filter(m => m.kind === 'oneOnOne').slice(0, 20)} onOpen={onOpen} showPerson={false}
          empty={<EmptyState title="No one-on-ones yet" description="Book one from the list above. After the meeting, open it and upload the transcript." />} />
      </Grid>
      <StaffDetailsPanel open={!!editing} onClose={() => setEditing(null)} staff={editing} profile={editing ? profiles.get(editing.id) : null} />
      <BookMeetingDialog draft={draft} onClose={() => setDraft(null)} />
    </Grid>
  );
}

function SeriesDialog({ value, onClose }: { value: (Partial<MeetingSeries> & { kind: GroupMeetingKind }) | null; onClose: () => void }) {
  const [form, setForm] = useState(value);
  const [error, setError] = useState<string | null>(null);
  React.useEffect(() => { setForm(value); setError(null); }, [value]);
  if (!form) return null;
  const invalid = !form.name?.trim() || !form.cadenceWeeks || form.cadenceWeeks < 1 || form.leadTimeDays == null || form.leadTimeDays < 0;
  const save = async () => {
    if (invalid) return;
    try {
      await saveSeries({
        id: form.id,
        kind: form.kind,
        name: form.name!.trim(),
        cadenceWeeks: Number(form.cadenceWeeks),
        leadTimeDays: Number(form.leadTimeDays),
        durationMinutes: Number(form.durationMinutes || 60),
        attendees: form.attendees || '',
        lastHeldDate: form.lastHeldDate || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{form.id ? 'Edit series' : 'New recurring meeting'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Type" value={form.kind} disabled={!!form.id}
            onChange={e => { const kind = e.target.value as GroupMeetingKind; setForm({ ...form, ...SERIES_DEFAULTS[kind], kind }); }}>
            {(['townHall', 'critique', 'designTeam'] as GroupMeetingKind[]).map(k => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
          </TextField>
          <TextField label="Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} error={!form.name?.trim()} helperText={!form.name?.trim() ? 'Required' : ' '} />
          <Stack direction="row" spacing={2}>
            <TextField label="Every (weeks)" type="number" value={form.cadenceWeeks ?? ''} onChange={e => setForm({ ...form, cadenceWeeks: Number(e.target.value) })} fullWidth inputProps={{ min: 1 }} />
            <TextField label="Lead time (days)" type="number" value={form.leadTimeDays ?? ''} onChange={e => setForm({ ...form, leadTimeDays: Number(e.target.value) })} fullWidth helperText="When it starts showing as due" />
            <TextField label="Minutes" type="number" value={form.durationMinutes ?? 60} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} fullWidth />
          </Stack>
          <TextField label="Last held" type="date" InputLabelProps={{ shrink: true }} value={form.lastHeldDate || ''} onChange={e => setForm({ ...form, lastHeldDate: e.target.value || null })} />
          <TextField label="Invitees" value={form.attendees || ''} onChange={e => setForm({ ...form, attendees: e.target.value })} helperText="Comma-separated emails or a group address" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={invalid}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function GroupTab({ onOpen, onPlanDesignTeam }: { onOpen: (m: Meeting) => void; onPlanDesignTeam: () => void }) {
  const series = useMeetingSeries();
  const meetings = useMeetings();
  const [editing, setEditing] = useState<(Partial<MeetingSeries> & { kind: GroupMeetingKind }) | null>(null);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>Coming up (two-month lead time)</Typography>
            <GroupMeetingsDueList onPlanDesignTeam={onPlanDesignTeam} />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Recurring series</Typography>
          <Button startIcon={<Plus size={16} />} variant="contained" size="small"
            onClick={() => setEditing({ ...SERIES_DEFAULTS.townHall, name: 'Design town hall' })}>Add series</Button>
        </Stack>
        {series.loading ? <LoadingState /> : series.data.length === 0 ? (
          <EmptyState title="No recurring meetings" description="Add a town hall, group critique or design team series. Set how often it runs; it shows up as due two months ahead." />
        ) : (
          <TableContainer component={Card} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Series</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Every</TableCell>
                  <TableCell>Last held</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {series.data.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{KIND_LABEL[s.kind]}</TableCell>
                    <TableCell align="right">{s.cadenceWeeks} wk</TableCell>
                    <TableCell>{fmtDate(s.lastHeldDate)}</TableCell>
                    <TableCell align="right"><IconButton size="small" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={16} /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Grid>
      <Grid size={12}>
        <Typography variant="h6" gutterBottom>Recent group meetings</Typography>
        <MeetingsTable rows={meetings.data.filter(m => m.kind !== 'oneOnOne').slice(0, 20)} onOpen={onOpen}
          empty={<EmptyState title="No group meetings yet" description="Book one from the list above, then upload its transcript afterwards." />} />
      </Grid>
      <SeriesDialog value={editing} onClose={() => setEditing(null)} />
    </Grid>
  );
}

function DesignTeamTab({ staffList, onOpen }: { staffList: StaffMember[]; onOpen: (m: Meeting) => void }) {
  const profiles = useStaffProfiles();
  const series = useMeetingSeries();
  const meetings = useMeetings();
  const designTeam = series.data.find(s => s.kind === 'designTeam');
  const rotation = useMemo(
    () => showAndTellRotation(staffList, profiles.get),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffList, profiles.byId],
  );
  const [picked, setPicked] = useState<string[] | null>(null);
  const presenters = picked ?? rotation.slice(0, 4).map(p => p.id);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [newSeries, setNewSeries] = useState<(Partial<MeetingSeries> & { kind: GroupMeetingKind }) | null>(null);
  const names = presenters.map(id => staffList.find(s => s.id === id)?.name || id);
  const agenda = designTeamAgenda(names);
  const toggle = (id: string) => setPicked(presenters.includes(id) ? presenters.filter(x => x !== id) : [...presenters, id]);

  if (series.loading || profiles.loading) return <LoadingState />;
  if (!designTeam) {
    return (
      <>
        <EmptyState title="Set up the design team meeting" description="It runs every eight weeks with a standing agenda. Create the series once and the rotation is tracked from here."
          action={<Button variant="contained" onClick={() => setNewSeries({ ...SERIES_DEFAULTS.designTeam, name: 'Design team meeting' })}>Create series</Button>} />
        <SeriesDialog value={newSeries} onClose={() => setNewSeries(null)} />
      </>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Typography variant="h6" gutterBottom>Show-and-tell rotation</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Sorted by who presented longest ago; people who have never presented come first. The top four are pre-selected.
        </Typography>
        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Person</TableCell>
                <TableCell>Last show-and-tell</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rotation.map(p => (
                <TableRow key={p.id} hover onClick={() => toggle(p.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={presenters.includes(p.id)} /></TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.lastShowAndTellDate ? fmtDate(p.lastShowAndTellDate) : <StatusChip label="Never" tone="warning" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Next meeting agenda</Typography>
              <CopyButton text={agenda} />
            </Stack>
            {(presenters.length < 3 || presenters.length > 4) && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>Pick three or four presenters ({presenters.length} selected).</Alert>
            )}
            <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>{agenda}</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
              Every {designTeam.cadenceWeeks} weeks · last held {fmtDate(designTeam.lastHeldDate)}. Presenters' rotation dates update when the meeting is marked held.
            </Typography>
            <Button variant="contained" sx={{ mt: 2 }} fullWidth
              onClick={() => setDraft({
                kind: 'designTeam',
                title: designTeam.name,
                seriesId: designTeam.id,
                presenters,
                agenda,
                attendees: designTeam.attendees,
                durationMinutes: designTeam.durationMinutes,
                suggestedDate: designTeam.lastHeldDate ? new Date(parseYmd(designTeam.lastHeldDate).getTime() + designTeam.cadenceWeeks * 7 * 864e5) : null,
              })}>Book with this agenda</Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={12}>
        <Typography variant="h6" gutterBottom>Past design team meetings</Typography>
        <MeetingsTable rows={meetings.data.filter(m => m.kind === 'designTeam')} onOpen={onOpen} showPerson={false}
          empty={<EmptyState title="None yet" description="Book the next one above." />} />
      </Grid>
      <BookMeetingDialog draft={draft} onClose={id => { setDraft(null); if (id) setPicked(null); }} />
    </Grid>
  );
}

// Cross-meeting lookup: everything recorded for a person, searchable.
function HistoryTab({ staffList, onOpen }: { staffList: StaffMember[]; onOpen: (m: Meeting) => void }) {
  const meetings = useMeetings();
  const [person, setPerson] = useState('');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const rows = meetings.data.filter(m => {
    if (person && m.staffId !== person && !(m.presenters || []).includes(person)) return false;
    if (!needle) return true;
    const hay = [m.title, m.summary, m.adamNotes, ...(m.notes || []), ...(m.decisions || []), ...(m.actionItems || []).map(a => `${a.task} ${a.owner}`)]
      .join(' ').toLowerCase();
    return hay.includes(needle);
  });

  const openItems = rows.flatMap(m => (m.actionItems || []).filter(a => !a.done).map(a => ({ m, a })));

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select label="Person" value={person} onChange={e => setPerson(e.target.value)} sx={{ minWidth: 240 }} size="small">
          <MenuItem value="">Everyone</MenuItem>
          {[...staffList].sort((a, b) => a.name.localeCompare(b.name)).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
        <TextField size="small" placeholder="Search notes, decisions and action items" value={q} onChange={e => setQ(e.target.value)} sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }} />
      </Stack>
      {person && openItems.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>Open action items</Typography>
            <Box component="ul" sx={{ pl: 2.5, m: 0, typography: 'body2' }}>
              {openItems.map(({ m, a }, i) => (
                <li key={i}>{a.task}{a.owner ? ` — ${a.owner}` : ''} <Typography component="span" variant="caption" color="text.secondary">({new Date(m.date).toLocaleDateString()})</Typography></li>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
      {meetings.loading ? <LoadingState /> : (
        <MeetingsTable rows={rows} onOpen={onOpen}
          empty={<EmptyState title="Nothing found" description={needle || person ? 'Try a different person or search term.' : 'Meeting notes appear here once transcripts are uploaded.'} />} />
      )}
    </Stack>
  );
}
