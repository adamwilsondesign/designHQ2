import React, { useMemo } from 'react';
import { Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { mondayOf, ymd } from '../../../common/week';
import { useJobSettings } from '../../jobSearch/hooks/useJobSearch';
import { usePersonalActivity } from '../hooks/usePersonalActivity';
import { momentum } from '../lib/activity';

// Compact personal summary for Adam's dashboard. Rendered only for Super Admin.
export default function PersonalMomentum({ uid, onNavigate }: { uid: string; onNavigate: (view: string) => void }) {
  const a = usePersonalActivity(uid);
  const { settings } = useJobSettings(uid);
  const weekOf = ymd(mondayOf(new Date()));
  const m = useMemo(() => momentum(a, weekOf), [a.drafts, a.applications, a.reminders, weekOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const Stat = ({ label, value, view }: { label: string; value: React.ReactNode; view: string }) => (
    <Box>
      <Typography variant="overline" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>{a.loading ? '—' : value}</Typography>
      <Button size="small" sx={{ ml: -1 }} onClick={() => onNavigate(view)}>Open</Button>
    </Box>
  );

  return (
    <Card variant="outlined"><CardContent>
      <Typography variant="h6" component="h2" gutterBottom>Personal this week</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><Stat label="Social drafts" value={`${m.postedThisWeek} posted / ${m.draftsThisWeek}`} view="social" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Stat label="Applications" value={`${m.applicationsThisWeek} of ${settings.weeklyMin}–${settings.weeklyMax}`} view="jobSearch" /></Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="overline" color="text.secondary" component="div">Next 30 days</Typography>
          {m.upcomingReminders.length === 0 ? <Typography variant="body2" color="text.secondary">No reminders coming up.</Typography> : (
            <Stack spacing={0.25}>
              {m.upcomingReminders.slice(0, 3).map((r, i) => (
                <Typography key={i} variant="body2">{r.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {r.title}</Typography>
              ))}
            </Stack>
          )}
          <Button size="small" sx={{ ml: -1 }} onClick={() => onNavigate('calendar')}>Open</Button>
        </Grid>
      </Grid>
    </CardContent></Card>
  );
}
