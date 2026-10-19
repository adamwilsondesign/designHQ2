import React, { useMemo } from 'react';
import { Box, Button, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import MetricCard from '../../../common/components/MetricCard';
import { Project, Sale, StaffMember, User } from '../../../lib/mockData';
import { computeDashboardMetrics, computeMonthOverMonth } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { GroupMeetingsDueList, OneOnOneDueList } from '../../meetings/components/DueLists';
import TodayTasks from './TodayTasks';
import PersonalMomentum from '../../profile/components/PersonalMomentum';
import { canAccess } from '../../../lib/roles';

function Direction({ changePct }: { changePct: number | null }) {
  if (changePct === null) return <span>No revenue last month to compare</span>;
  const up = changePct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: up ? 'success.main' : 'error.main', fontWeight: 500 }}>
      <Icon size={16} aria-hidden /> {Math.abs(changePct).toFixed(0)}% vs last month
    </Box>
  );
}

// Daily home for Adam and Louie. Every number comes from lib/metrics, the same
// code the Overview (original dashboard) uses.
export default function DailyDashboard({
  user, userId, staffList, projectsList, salesList, onNavigate,
}: {
  user: User; userId: string | null; staffList: StaffMember[]; projectsList: Project[]; salesList: Sale[]; onNavigate: (view: string) => void;
}) {
  const m = useMemo(() => computeDashboardMetrics(projectsList, salesList, staffList), [projectsList, salesList, staffList]);
  const mom = useMemo(() => computeMonthOverMonth(m), [m]);
  const remaining = Math.max(0, m.revenueGoal - m.totalValue);
  const onPace = m.monthlyPacePercentage >= 100;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} spacing={1} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.name.split(' ')[0]}</Typography>
          <Typography variant="body2" color="text.secondary">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · fiscal year Feb 1 – Jan 31</Typography>
        </Box>
        <Button endIcon={<ArrowRight size={16} />} onClick={() => onNavigate('overview')}>Charts & allocation schedule</Button>
      </Stack>

      {/* Revenue hero */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard size="hero" label="Department revenue since Feb 1" value={formatUSD(m.totalValue)}
            detail={mom ? <Direction changePct={mom.changePct} /> : 'Not enough history for month-over-month'} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard size="hero" label="Pipeline value" value={formatUSD(m.pipelineValue)}
            detail={`${m.projectsProjectedToCloseThisMonth} projected to close this month · ${formatUSD(m.optimisticCloseValue)} at 33%`} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard size="hero" label="Distance to $5M" value={formatUSD(remaining)}
            detail={<Box component="span" sx={{ color: onPace ? 'success.main' : 'warning.main', fontWeight: 500 }}>{m.monthlyPacePercentage.toFixed(0)}% of required monthly pace</Box>}>
            <Box sx={{ mt: 2 }} aria-label={`${m.goalProgress.toFixed(1)}% of goal, ${m.timeProgress.toFixed(0)}% of the year elapsed`}>
              <Box sx={{ position: 'relative' }}>
                <LinearProgress variant="determinate" value={Math.min(100, m.goalProgress)} sx={{ height: 8, borderRadius: 4 }} />
                <Box title="Time elapsed" sx={{ position: 'absolute', top: -3, left: `${m.timeProgress}%`, width: 2, height: 14, bgcolor: 'text.primary' }} />
              </Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{m.goalProgress.toFixed(1)}% of goal</Typography>
                <Typography variant="caption" color="text.secondary">{m.timeProgress.toFixed(0)}% of year elapsed</Typography>
              </Stack>
            </Box>
          </MetricCard>
        </Grid>
      </Grid>

      {/* Supporting metrics */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Avg profitability" value={`${m.avgProfitability.toFixed(1)}%`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="FTE utilization" value={`${m.trends?.currentUtilFte ?? 0}%`} detail="This week" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Contractor utilization" value={`${m.trends?.currentUtilContractor ?? 0}%`} detail="This week" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Active projects" value={m.activeProjectsCount} detail={`${m.projectsKickedOffThisMonth} kicked off this month`} /></Grid>
      </Grid>

      {/* Actionable lists */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}><CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" component="h2">One-on-ones due</Typography>
              <Button size="small" onClick={() => onNavigate('meetings')}>All</Button>
            </Stack>
            <OneOnOneDueList staffList={staffList} />
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}><CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" component="h2">Town halls & critiques</Typography>
              <Button size="small" onClick={() => onNavigate('meetings')}>All</Button>
            </Stack>
            <GroupMeetingsDueList onPlanDesignTeam={() => onNavigate('meetings')} />
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ height: '100%' }}><CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>Today's tasks</Typography>
            <TodayTasks uid={userId} />
          </CardContent></Card>
        </Grid>
        {canAccess(user.role, 'profile') && userId && (
          <Grid size={12}>
            <PersonalMomentum uid={userId} onNavigate={onNavigate} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
