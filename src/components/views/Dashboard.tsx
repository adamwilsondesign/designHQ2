import React, { useMemo, useState } from 'react';
import { User, Project, StaffMember, Sale } from '../../lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatUSD } from '../../lib/utils';
import { motion } from 'motion/react';
import { computeDashboardMetrics, getFiscalYearStart, getProjectCost as getProjectCostForStaff, parseLocalDate } from '../../lib/metrics';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  useTheme,
  Paper,
  Divider,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';
import { TrendingUp, Users, Clock, Briefcase, DollarSign, Percent, Activity, ChevronUp, ChevronDown, X } from 'lucide-react';

export default function Dashboard({ user, staffList, projectsList, salesList }: { user: User, staffList: StaffMember[], projectsList: Project[], salesList: Sale[] }) {
  const theme = useTheme();
  const canViewFinancials = user.role === 'Super Admin' || user.role === 'Admin';

  const fiscalYearStart = getFiscalYearStart();
  const now = new Date();

  // All department numbers come from lib/metrics so every view stays identical.
  const {
    fyProjectsList,
    fySalesList,
    totalValue,
    totalProfit,
    avgProfitability,
    activeProjectsCount,
    totalDesigners,
    pipelineValue,
    projectsKickedOffThisMonth,
    projectsProjectedToCloseThisMonth,
    optimisticCloseValue,
    trends,
    benchBurn,
    netProfit,
    goalProgress,
    timeProgress,
    monthlyPacePercentage,
    ftesOnBench,
  } = computeDashboardMetrics(projectsList, salesList, staffList, now);

  const getProjectCost = (project: Project) => getProjectCostForStaff(project, staffList);

  const [activeModal, setActiveModal] = useState<string | null>(null);

  const getMonths = () => {
    if (fyProjectsList.length === 0) return [];
    
    let minDate = new Date();
    let maxDate = new Date();
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    
    fyProjectsList.forEach(p => {
      if (p.startDate) {
        const d = parseLocalDate(p.startDate);
        if (d < minDate) minDate = d;
      }
      if (p.finishDate) {
        const d = parseLocalDate(p.finishDate);
        if (d > maxDate) maxDate = d;
      }
    });

    if (maxDate > oneMonthFromNow) {
      maxDate = new Date(oneMonthFromNow);
    }

    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);

    // Enforce fiscal year start
    if (minDate < fiscalYearStart) {
      minDate = new Date(fiscalYearStart);
    }

    const months = [];
    let current = new Date(minDate);
    current.setDate(1); // Start at the beginning of the month
    current.setHours(0, 0, 0, 0);
    
    while (current <= maxDate) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const months = getMonths();
  const totalDays = months.length > 0 ? Math.round((months[months.length - 1].getTime() - months[0].getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const getProjectStyle = (project: Project) => {
    if (!project.startDate || !project.finishDate || months.length === 0) return { display: 'none' };
    
    const start = new Date(project.startDate);
    const end = new Date(project.finishDate);
    const timelineStart = months[0];
    
    const leftPercent = ((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
    const widthPercent = ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
    
    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(2, widthPercent)}%`,
    };
  };

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { activeProjects, inactiveProjects } = useMemo(() => {
    const active: Project[] = [];
    const inactive: Project[] = [];
    
    fyProjectsList.forEach(p => {
      const pEnd = p.finishDate ? new Date(p.finishDate) : new Date();
      pEnd.setHours(23, 59, 59, 999);
      if (pEnd < now) {
        inactive.push(p);
      } else {
        active.push(p);
      }
    });

    const sortFn = (a: Project, b: Project) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      
      if (sortOrder === 'asc') {
        return dateB - dateA; // Most recent on top
      } else {
        return dateA - dateB;
      }
    };

    return {
      activeProjects: active.sort(sortFn),
      inactiveProjects: inactive.sort(sortFn)
    };
  }, [fyProjectsList, sortOrder, now]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 5, mt: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', mb: 1, color: 'text.primary' }}>
          Welcome back, {user.name.split(' ')[0]}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
          Here's what's happening with your agency today. You have {activeProjectsCount} active projects and {formatUSD(pipelineValue)} in the pipeline.
          <br />
          <Typography component="span" variant="caption" sx={{ fontStyle: 'italic' }}>
            (Note: Metrics reflect the current fiscal year starting Feb 2026)
          </Typography>
        </Typography>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {canViewFinancials ? (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Total Project Value" 
                value={formatUSD(totalValue)} 
                subtext={`${projectsKickedOffThisMonth} new project${projectsKickedOffThisMonth === 1 ? '' : 's'} kicked off this month`}
                icon={<DollarSign size={20} />} 
                color="primary" 
                onClick={() => setActiveModal('Total Project Value')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Avg Profitability" 
                value={`${avgProfitability.toFixed(1)}%`} 
                icon={<Percent size={20} />} 
                color="success" 
                onClick={() => setActiveModal('Avg Profitability')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Bench Burn" 
                value={formatUSD(benchBurn)} 
                subtext={`${ftesOnBench.toFixed(1)} FTEs on bench`}
                icon={<Clock size={20} />} 
                color="warning" 
                onClick={() => setActiveModal('Bench Burn')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Total Est. Profit" 
                value={formatUSD(totalProfit)} 
                subtext={`Net Profit: ${formatUSD(netProfit)}`}
                icon={<Activity size={20} />} 
                color="info" 
                onClick={() => setActiveModal('Total Est. Profit')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Pipeline Value" 
                value={formatUSD(pipelineValue)} 
                subtext={
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {projectsProjectedToCloseThisMonth} project{projectsProjectedToCloseThisMonth === 1 ? '' : 's'} projected to close this month
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'success.main', fontWeight: 600, mt: 0.5 }}>
                      {formatUSD(optimisticCloseValue)} optimistic close value (33%)
                    </Typography>
                  </Box>
                }
                icon={<TrendingUp size={20} />} 
                color="secondary" 
                onClick={() => setActiveModal('Pipeline Value')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Average Utilization" 
                value={`${trends?.avgUtil || 0}%`} 
                icon={<Users size={20} />} 
                color="success" 
                onClick={() => setActiveModal('Average Utilization')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Current Utilization" 
                value={`${trends?.currentUtilFte || 0}%`} 
                subtext={`FTE: ${trends?.currentUtilFte || 0}% | Cont: ${trends?.currentUtilContractor || 0}% | All: ${trends?.currentUtilAll || 0}%`}
                icon={<Activity size={20} />} 
                color="primary" 
                onClick={() => setActiveModal('Current Utilization')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Revenue Goal" 
                value={`${goalProgress.toFixed(1)}%`} 
                subtext={
                  <Box sx={{ mt: 0.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        of $5.0M goal
                      </Typography>
                      <Typography variant="caption" sx={{ color: monthlyPacePercentage >= 100 ? 'success.main' : 'warning.main', fontWeight: 600 }}>
                        {monthlyPacePercentage.toFixed(0)}% monthly pace
                      </Typography>
                    </Stack>
                    <Box sx={{ position: 'relative', height: 6, bgcolor: 'action.hover', borderRadius: 3, mt: 1.5, mb: 0.5 }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(goalProgress, 100)}%`, bgcolor: 'info.main', borderRadius: 3 }} />
                      <Box sx={{ position: 'absolute', top: '50%', left: `${Math.min(goalProgress, 100)}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12, bgcolor: 'info.main', border: '2px solid', borderColor: 'background.paper', borderRadius: '50%', zIndex: 2 }} title="Financial Progress" />
                      <Box sx={{ position: 'absolute', top: '50%', left: `${timeProgress}%`, transform: 'translate(-50%, -50%)', width: 4, height: 16, bgcolor: 'text.primary', borderRadius: 1, zIndex: 1 }} title="Time Elapsed" />
                    </Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>Feb 1</Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>Jan 31</Typography>
                    </Stack>
                  </Box>
                }
                icon={<TrendingUp size={20} />} 
                color="info" 
                onClick={() => setActiveModal('Revenue Goal')}
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Active Projects" 
                value={activeProjectsCount.toString()} 
                icon={<Briefcase size={20} />} 
                color="primary" 
                onClick={() => setActiveModal('Active Projects')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Total Designers" 
                value={totalDesigners.toString()} 
                icon={<Users size={20} />} 
                color="success" 
                onClick={() => setActiveModal('Total Designers')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Current Month Burn" 
                value="1,240 hrs" 
                icon={<Clock size={20} />} 
                color="warning" 
                onClick={() => setActiveModal('Current Month Burn')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard 
                title="Avg Utilization" 
                value="85%" 
                icon={<Percent size={20} />} 
                color="info" 
                onClick={() => setActiveModal('Avg Utilization')}
              />
            </Grid>
          </>
        )}
      </Grid>

      {/* Charts */}
      {trends && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {canViewFinancials && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 700 }}>Weekly Revenue Trend</Typography>
                  <Box sx={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trends.revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke={theme.palette.text.secondary} 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                          tick={false}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary} 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `$${value/1000}k`} 
                        />
                        <Tooltip 
                          cursor={{ fill: theme.palette.action.hover }}
                          contentStyle={{ 
                            backgroundColor: theme.palette.background.paper, 
                            borderColor: theme.palette.divider,
                            borderRadius: 12,
                            boxShadow: theme.shadows[3],
                            border: 'none'
                          }}
                        />
                        <Bar dataKey="revenue" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid size={{ xs: 12, lg: canViewFinancials ? 6 : 12 }}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 700 }}>Weekly Team Utilization</Typography>
                <Box sx={{ height: 300, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.utilizationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke={theme.palette.text.secondary} 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                        tick={false}
                      />
                      <YAxis 
                        stroke={theme.palette.text.secondary} 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `${value}%`} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: theme.palette.background.paper, 
                          borderColor: theme.palette.divider,
                          borderRadius: 12,
                          boxShadow: theme.shadows[3],
                          border: 'none'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="util" 
                        name="Full-Time"
                        stroke={theme.palette.primary.main} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="utilContractor" 
                        name="Contractors"
                        stroke={theme.palette.secondary.main} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: theme.palette.secondary.main, strokeWidth: 0 }} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="utilAll" 
                        name="Total Staff"
                        stroke={theme.palette.success.main} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: theme.palette.success.main, strokeWidth: 0 }} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Gantt Chart */}
      {projectsList.length > 0 && (
        <Card variant="outlined" sx={{ mb: 4, borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 700 }}>Project & Staff Allocation Schedule</Typography>
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
              <Box sx={{ minWidth: 800 }}>
                {/* Timeline Header */}
                <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', pb: 2, mb: 2, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                  <Box 
                    sx={{ width: 200, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>PROJECT / STAFF</Typography>
                    {sortOrder === 'asc' ? <ChevronUp size={14} color={theme.palette.text.secondary} /> : <ChevronDown size={14} color={theme.palette.text.secondary} />}
                  </Box>
                  <Box sx={{ flexGrow: 1, display: 'flex' }}>
                    {months.map((month, i) => (
                      <Box key={i} sx={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider', opacity: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {month.toLocaleString('default', { month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Timeline Body */}
                <Stack spacing={2}>
                  {activeProjects.length > 0 && (
                    <Box>
                      <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>Active Projects</Typography>
                      <Stack spacing={0.5}>
                        {activeProjects.map((project) => {
                          const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));
                          const style = getProjectStyle(project);
                          
                          const pEnd = project.finishDate ? new Date(project.finishDate) : new Date();
                          pEnd.setHours(23, 59, 59, 999);
                          const isPast = pEnd < now;
                          const pStart = project.startDate ? new Date(project.startDate) : new Date();
                          const isActive = pStart <= now && pEnd >= now;
                          
                          return (
                            <Box key={project.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0, opacity: isPast ? 0.6 : 1 }}>
                                <Box sx={{ width: 200, flexShrink: 0, pr: 2 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isPast ? 'text.secondary' : 'text.primary' }} noWrap>
                                    {project.client}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                    {assignedStaff.length > 0 ? assignedStaff.map(s => {
                                      const allocation = project.staffAllocations?.[s.id] ?? 100;
                                      return allocation < 100 ? `${s.name} (${allocation}%)` : s.name;
                                    }).join(', ') : 'Unassigned'}
                                  </Typography>
                                </Box>
                                <Box sx={{ flexGrow: 1, position: 'relative', height: 24, bgcolor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.900', borderRadius: 2 }}>
                                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
                                    {months.map((_, i) => (
                                      <Box key={i} sx={{ flex: 1, borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider', opacity: 0.2 }} />
                                    ))}
                                  </Box>
                                  {project.startDate && project.finishDate && (
                                    <Box 
                                      sx={{
                                        position: 'absolute',
                                        top: 2,
                                        bottom: 2,
                                        bgcolor: isActive ? 'primary.main' : (isPast ? 'grey.500' : 'info.main'),
                                        opacity: isActive ? 0.9 : 0.5,
                                        borderRadius: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 1.5,
                                        overflow: 'hidden',
                                        boxShadow: isActive ? theme.shadows[1] : 'none',
                                        ...style
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  {inactiveProjects.length > 0 && (
                    <Box>
                      <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>Inactive Projects</Typography>
                      <Stack spacing={0.5}>
                        {inactiveProjects.map((project) => {
                          const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));
                          const style = getProjectStyle(project);
                          
                          const pEnd = project.finishDate ? new Date(project.finishDate) : new Date();
                          pEnd.setHours(23, 59, 59, 999);
                          const isPast = pEnd < now;
                          const pStart = project.startDate ? new Date(project.startDate) : new Date();
                          const isActive = pStart <= now && pEnd >= now;
                          
                          return (
                            <Box key={project.id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0, opacity: isPast ? 0.6 : 1 }}>
                                <Box sx={{ width: 200, flexShrink: 0, pr: 2 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isPast ? 'text.secondary' : 'text.primary' }} noWrap>
                                    {project.client}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                    {assignedStaff.length > 0 ? assignedStaff.map(s => {
                                      const allocation = project.staffAllocations?.[s.id] ?? 100;
                                      return allocation < 100 ? `${s.name} (${allocation}%)` : s.name;
                                    }).join(', ') : 'Unassigned'}
                                    {isPast && ' (Inactive)'}
                                  </Typography>
                                </Box>
                                <Box sx={{ flexGrow: 1, position: 'relative', height: 24, bgcolor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.900', borderRadius: 2 }}>
                                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
                                    {months.map((_, i) => (
                                      <Box key={i} sx={{ flex: 1, borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider', opacity: 0.2 }} />
                                    ))}
                                  </Box>
                                  {project.startDate && project.finishDate && (
                                    <Box 
                                      sx={{
                                        position: 'absolute',
                                        top: 2,
                                        bottom: 2,
                                        bgcolor: isActive ? 'primary.main' : (isPast ? 'grey.500' : 'info.main'),
                                        opacity: isActive ? 0.9 : 0.5,
                                        borderRadius: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        px: 1.5,
                                        overflow: 'hidden',
                                        boxShadow: isActive ? theme.shadows[1] : 'none',
                                        ...style
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* KPI Detail Modal */}
      <Dialog 
        open={!!activeModal} 
        onClose={() => setActiveModal(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeModal} Details</Typography>
          <IconButton onClick={() => setActiveModal(null)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeModal === 'Total Project Value' && fyProjectsList.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.client} - {p.lob}</TableCell>
                  <TableCell align="right">{formatUSD(p.totalValue)}</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Avg Profitability' && fyProjectsList.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.client} - {p.lob}</TableCell>
                  <TableCell align="right">{p.totalValue > 0 ? ((p.totalValue - getProjectCost(p)) / p.totalValue * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Total Est. Profit' && fyProjectsList.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.client} - {p.lob}</TableCell>
                  <TableCell align="right">{formatUSD(p.totalValue - getProjectCost(p))}</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Pipeline Value' && fySalesList.filter(s => s.status === 'Open' || s.status === 'In Negotiation').map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.client} - {s.lob}</TableCell>
                  <TableCell align="right">{formatUSD(s.projectedValue)}</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Revenue Goal' && fyProjectsList.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.client} - {p.lob}</TableCell>
                  <TableCell align="right">{formatUSD(p.totalValue)}</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Average Utilization' && trends?.utilizationData.filter(d => d.isHistoricalOrCurrent).map(d => (
                <TableRow key={d.name}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell align="right">{d.util}%</TableCell>
                </TableRow>
              ))}
              {activeModal === 'Current Utilization' && (
                <>
                  <TableRow>
                    <TableCell>Full-Time Employees</TableCell>
                    <TableCell align="right">{trends?.currentUtilFte || 0}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Contractors</TableCell>
                    <TableCell align="right">{trends?.currentUtilContractor || 0}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>All Staff</TableCell>
                    <TableCell align="right">{trends?.currentUtilAll || 0}%</TableCell>
                  </TableRow>
                </>
              )}
              {activeModal === 'Bench Burn' && staffList.filter(s => s.employmentType === 'Full-Time').map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.name} ({s.employmentType})</TableCell>
                  <TableCell align="right">{formatUSD(s.hourlyCost)} / hr</TableCell>
                </TableRow>
              ))}
              {['Active Projects', 'Total Designers', 'Current Month Burn', 'Avg Utilization'].includes(activeModal || '') && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Detailed breakdown not available for this metric.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function KpiCard({ title, value, icon, color, subtext, onClick }: { title: string, value: string, icon: React.ReactNode, color: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error', subtext?: React.ReactNode, onClick?: () => void }) {
  const theme = useTheme();
  
  return (
    <Card 
      variant="outlined" 
      onClick={onClick}
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.palette.mode === 'light' ? '0 10px 15px -3px rgba(0, 0, 0, 0.05)' : '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
          borderColor: onClick ? 'primary.main' : 'divider'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </Typography>
          <Box 
            sx={{ 
              p: 1, 
              borderRadius: 2, 
              bgcolor: `${color}.container`, 
              color: `${color}.onContainer`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, letterSpacing: '-0.02em' }}>
          {value}
        </Typography>
        {subtext && (
          <Box sx={{ mt: 1 }}>
            {typeof subtext === 'string' ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {subtext}
              </Typography>
            ) : (
              subtext
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
