import React, { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import StatusChip from '../../../common/components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '../../../common/components/States';
import { StaffMember } from '../../../lib/mockData';
import { useStaffProfiles } from '../../staffData/hooks/useStaffProfiles';
import { useMeetings, useMeetingSeries } from '../hooks/useMeetings';
import { oneOnOnesDue, seriesDue } from '../lib/schedule';
import { KIND_LABEL } from '../types';
import BookMeetingDialog, { BookingDraft } from './BookMeetingDialog';

// One row: text on the left, a single action on the right. Plain flex so long
// names wrap instead of running under the action.
function Row({ primary, secondary, action }: { primary: React.ReactNode; secondary: React.ReactNode; action: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{primary}</Typography>
        <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>{secondary}</Box>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Stack>
  );
}

const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function dueChip(daysUntil: number, never: boolean) {
  if (never) return <StatusChip label="No 1:1 on record" tone="warning" />;
  if (daysUntil < 0) return <StatusChip label={`Overdue ${-daysUntil}d`} tone="error" />;
  if (daysUntil === 0) return <StatusChip label="Due today" tone="warning" />;
  return <StatusChip label={`Due in ${daysUntil}d`} tone={daysUntil <= 7 ? 'warning' : 'default'} />;
}

// Dashboard widget: one-on-ones due within two weeks, bookable in place.
export function OneOnOneDueList({ staffList }: { staffList: StaffMember[] }) {
  const profiles = useStaffProfiles();
  const meetings = useMeetings();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const due = useMemo(
    () => oneOnOnesDue(staffList.map(s => s.id), profiles.get, meetings.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffList, profiles.byId, meetings.data],
  );

  if (profiles.loading || meetings.loading) return <LoadingState />;
  if (profiles.error || meetings.error) return <ErrorState message={profiles.error || meetings.error!} />;
  if (due.length === 0) {
    return (
      <EmptyState
        title="No one-on-ones due in the next two weeks"
        description="Set a cadence for each person in Staff → Details (monthly or every six weeks) and they'll appear here when due."
      />
    );
  }

  return (
    <>
      <Box>
        {due.map(d => {
          const s = staffList.find(x => x.id === d.staffId)!;
          const cadence = profiles.get(d.staffId).oneOnOneCadence;
          return (
            <Row key={d.staffId}
              primary={s.name}
              secondary={<>
                {d.booked ? <StatusChip label={`Booked ${fmt(new Date(d.booked.date))}`} tone="success" /> : dueChip(d.daysUntil, !d.dueDate)}
                <Typography component="span" variant="caption" color="text.secondary">
                  {cadence === 'sixWeeks' ? 'Every 6 weeks' : 'Monthly'}{d.dueDate ? ` · due ${fmt(d.dueDate)}` : ''}
                </Typography>
              </>}
              action={!d.booked && (
                <Button size="small" variant="outlined" onClick={() => setDraft({
                  kind: 'oneOnOne',
                  title: `1:1 Adam / ${s.name.split(' ')[0]}`,
                  staffId: s.id,
                  staffName: s.name,
                  attendees: s.lazerEmail || '',
                  durationMinutes: 30,
                  suggestedDate: d.dueDate,
                })}>Book</Button>
              )}
            />
          );
        })}
      </Box>
      <BookMeetingDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

// Dashboard widget: town halls, critiques and design team meetings inside their lead time.
export function GroupMeetingsDueList({ onPlanDesignTeam }: { onPlanDesignTeam?: () => void }) {
  const series = useMeetingSeries();
  const meetings = useMeetings();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const due = useMemo(() => seriesDue(series.data, meetings.data), [series.data, meetings.data]);

  if (series.loading || meetings.loading) return <LoadingState />;
  if (series.error || meetings.error) return <ErrorState message={series.error || meetings.error!} />;
  if (series.data.length === 0) {
    return <EmptyState title="No recurring group meetings set up" description="Add your town hall, critique and design team series in Meetings → Group meetings." />;
  }
  if (due.length === 0) return <EmptyState title="Nothing to schedule yet" description="Group meetings appear here once they're inside their two-month lead time." />;

  return (
    <>
      <Box>
        {due.map(d => (
          <Row key={d.series.id}
            primary={d.series.name}
            secondary={<>
              {d.booked ? <StatusChip label={`Booked ${fmt(new Date(d.booked.date))}`} tone="success" />
                : !d.dueDate ? <StatusChip label="Never held" tone="warning" />
                : d.daysUntil < 0 ? <StatusChip label={`Overdue ${-d.daysUntil}d`} tone="error" />
                : <StatusChip label={`Due ${fmt(d.dueDate)}`} />}
              <Typography component="span" variant="caption" color="text.secondary">{KIND_LABEL[d.series.kind]}</Typography>
            </>}
            action={!d.booked && (d.series.kind === 'designTeam' && onPlanDesignTeam ? (
              <Button size="small" variant="outlined" onClick={onPlanDesignTeam}>Plan</Button>
            ) : (
              <Button size="small" variant="outlined" onClick={() => setDraft({
                kind: d.series.kind,
                title: d.series.name,
                seriesId: d.series.id,
                attendees: d.series.attendees,
                durationMinutes: d.series.durationMinutes,
                suggestedDate: d.dueDate,
              })}>Book</Button>
            ))}
          />
        ))}
      </Box>
      <BookMeetingDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
