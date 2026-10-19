import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import SidePanel from '../../../common/components/SidePanel';
import { StaffMember } from '../../../lib/mockData';
import { saveStaffProfile } from '../hooks/useStaffProfiles';
import { CADENCE_LABEL, DateRange, Holiday, OneOnOneCadence, StaffProfile } from '../types';

// Manual entry of the Rippling fields plus one-on-one cadence for one person.
export default function StaffDetailsPanel({
  open,
  onClose,
  staff,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  profile: StaffProfile | null;
}) {
  const [form, setForm] = useState<StaffProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form when a different person is opened, not on every live update.
  useEffect(() => {
    setForm(profile);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, open]);

  if (!staff || !form) return null;

  const set = <K extends keyof StaffProfile>(k: K, v: StaffProfile[K]) => setForm({ ...form, [k]: v });

  const invalidPto = form.ptoDates.findIndex(r => !r.start || !r.end || r.end < r.start);
  const invalidHoliday = form.holidays.findIndex(h => !h.date || !h.name.trim());

  const save = async () => {
    if (invalidPto >= 0 || invalidHoliday >= 0) return;
    setSaving(true);
    setError(null);
    try {
      const { id, updatedAt, ...rest } = form;
      await saveStaffProfile(staff.id, rest);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const updatePto = (i: number, patch: Partial<DateRange>) =>
    set('ptoDates', form.ptoDates.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const updateHoliday = (i: number, patch: Partial<Holiday>) =>
    set('holidays', form.holidays.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={staff.name}
      subtitle="Staff details · entered from Rippling"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || invalidPto >= 0 || invalidHoliday >= 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Dates</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Birthday" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={form.birthday || ''} onChange={e => set('birthday', e.target.value || null)} />
            <TextField label="Company join date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={form.companyJoinDate || ''} onChange={e => set('companyJoinDate', e.target.value || null)} />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>One-on-ones</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Cadence" fullWidth size="small" value={form.oneOnOneCadence || ''}
              onChange={e => set('oneOnOneCadence', (e.target.value || null) as OneOnOneCadence | null)}
              helperText="Leave empty to not track">
              <MenuItem value=""><em>Not tracked</em></MenuItem>
              {(Object.keys(CADENCE_LABEL) as OneOnOneCadence[]).map(c => <MenuItem key={c} value={c}>{CADENCE_LABEL[c]}</MenuItem>)}
            </TextField>
            <TextField label="Last one-on-one" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={form.lastOneOnOneDate || ''} onChange={e => set('lastOneOnOneDate', e.target.value || null)} />
          </Stack>
        </Box>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">PTO</Typography>
            <Button size="small" startIcon={<Plus size={14} />} onClick={() => set('ptoDates', [...form.ptoDates, { start: '', end: '', note: '' }])}>Add PTO</Button>
          </Stack>
          {form.ptoDates.length === 0 && <Typography variant="body2" color="text.secondary">No PTO recorded.</Typography>}
          <Stack spacing={1.5}>
            {form.ptoDates.map((r, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                <TextField label="Start" type="date" size="small" InputLabelProps={{ shrink: true }} value={r.start}
                  onChange={e => updatePto(i, { start: e.target.value })} error={invalidPto === i && !r.start} />
                <TextField label="End" type="date" size="small" InputLabelProps={{ shrink: true }} value={r.end}
                  onChange={e => updatePto(i, { end: e.target.value })} error={invalidPto === i}
                  helperText={invalidPto === i && r.start && r.end && r.end < r.start ? 'Ends before it starts' : undefined} />
                <TextField label="Note" size="small" value={r.note || ''} onChange={e => updatePto(i, { note: e.target.value })} sx={{ flex: 1 }} />
                <IconButton aria-label="Remove PTO" onClick={() => set('ptoDates', form.ptoDates.filter((_, j) => j !== i))}><Trash2 size={16} /></IconButton>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Holiday time</Typography>
            <Button size="small" startIcon={<Plus size={14} />} onClick={() => set('holidays', [...form.holidays, { date: '', name: '' }])}>Add holiday</Button>
          </Stack>
          {form.holidays.length === 0 && <Typography variant="body2" color="text.secondary">No holidays recorded.</Typography>}
          <Stack spacing={1.5}>
            {form.holidays.map((h, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                <TextField label="Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={h.date}
                  onChange={e => updateHoliday(i, { date: e.target.value })} error={invalidHoliday === i && !h.date} />
                <TextField label="Holiday" size="small" value={h.name} onChange={e => updateHoliday(i, { name: e.target.value })}
                  error={invalidHoliday === i && !h.name.trim()} sx={{ flex: 1 }} />
                <IconButton aria-label="Remove holiday" onClick={() => set('holidays', form.holidays.filter((_, j) => j !== i))}><Trash2 size={16} /></IconButton>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>
    </SidePanel>
  );
}
