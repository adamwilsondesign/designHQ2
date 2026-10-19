import React, { useState } from 'react';
import { User, Project, StaffMember } from '../../lib/mockData';
import { Plus, Edit2, FolderOpen, List, Calendar as CalendarIcon, MapPin, Briefcase, Trash2 } from 'lucide-react';
import AddProjectWizard from '../wizards/AddProjectWizard';
import { formatUSD } from '../../lib/utils';
import { motion } from 'motion/react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Avatar, 
  Chip, 
  IconButton, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TableSortLabel,
  Paper,
  useTheme,
  useMediaQuery,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Tooltip,
  Divider
} from '@mui/material';

export default function Projects({ user, projectsList, setProjectsList, staffList }: { user: User, projectsList: Project[], setProjectsList: any, staffList: StaffMember[] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const canEdit = user.role === 'Super Admin' || user.role === 'Admin';
  const canViewFinancials = user.role === 'Super Admin' || user.role === 'Admin';

  const [sortColumn, setSortColumn] = useState<string>('Client');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    const isAsc = sortColumn === column && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortColumn(column);
  };

  const getProjectCost = (project: Project) => {
    if (!project.assignedStaffIds || project.assignedStaffIds.length === 0) return 0;
    const assignedStaff = staffList.filter(s => project.assignedStaffIds.includes(s.id));
    if (assignedStaff.length === 0) return 0;
    
    let totalCost = 0;

    if (project.totalHours > 0) {
      // Distribute totalHours based on staff allocations
      const totalAllocation = assignedStaff.reduce((sum, s) => sum + (project.staffAllocations?.[s.id] ?? 100), 0);
      
      if (totalAllocation > 0) {
        assignedStaff.forEach(s => {
          const allocation = project.staffAllocations?.[s.id] ?? 100;
          const proportion = allocation / totalAllocation;
          const hoursWorked = project.totalHours * proportion;
          totalCost += hoursWorked * s.hourlyCost;
        });
        return totalCost;
      }
    }

    if (!project.startDate || !project.finishDate) {
      const avgHourlyRate = assignedStaff.reduce((sum, s) => sum + s.hourlyCost, 0) / assignedStaff.length;
      return avgHourlyRate * project.totalHours;
    }

    const pStart = new Date(project.startDate);
    const pEnd = new Date(project.finishDate);
    const durationWeeks = Math.max(1, (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

    assignedStaff.forEach(s => {
      const allocation = project.staffAllocations?.[s.id] ?? 100;
      const hoursPerWeek = (allocation / 100) * 40;
      totalCost += hoursPerWeek * durationWeeks * s.hourlyCost;
    });

    return totalCost;
  };

  const sortedProjects = React.useMemo(() => {
    return [...projectsList].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      
      switch (sortColumn) {
        case 'Client':
          valA = a.client.toLowerCase();
          valB = b.client.toLowerCase();
          break;
        case 'LOB / Type':
          valA = a.lob.toLowerCase() + a.type.toLowerCase();
          valB = b.lob.toLowerCase() + b.type.toLowerCase();
          break;
        case 'Team':
          valA = a.assignedStaffIds?.length || 0;
          valB = b.assignedStaffIds?.length || 0;
          break;
        case 'Total Value':
          valA = a.totalValue;
          valB = b.totalValue;
          break;
        case 'Est. Profit':
          valA = a.totalValue - getProjectCost(a);
          valB = b.totalValue - getProjectCost(b);
          break;
      }
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projectsList, sortColumn, sortDirection, staffList]);

  const handleSaveProject = (savedProject: Project) => {
    if (editingProject) {
      setProjectsList(projectsList.map(p => p.id === savedProject.id ? savedProject : p));
    } else {
      setProjectsList([...projectsList, savedProject]);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setTimeout(() => setEditingProject(null), 300);
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      setProjectsList(projectsList.filter(p => p.id !== projectId));
    }
  };

  const getMonths = () => {
    if (projectsList.length === 0) return [];
    
    let minDate = new Date();
    let maxDate = new Date();
    
    projectsList.forEach(p => {
      if (p.startDate) {
        const d = new Date(p.startDate);
        if (d < minDate) minDate = d;
      }
      if (p.finishDate) {
        const d = new Date(p.finishDate);
        if (d > maxDate) maxDate = d;
      }
    });

    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 2);

    const months = [];
    let current = new Date(minDate);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'success';
      case 'Closed': return 'primary';
      case 'On Hold': return 'warning';
      default: return 'default';
    }
  };

  const now = new Date();
  
  const activeProjects: Project[] = [];
  const inactiveProjects: Project[] = [];
  
  projectsList.forEach(p => {
    const pEnd = p.finishDate ? new Date(p.finishDate) : new Date();
    pEnd.setHours(23, 59, 59, 999);
    if (pEnd < now) {
      inactiveProjects.push(p);
    } else {
      activeProjects.push(p);
    }
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} spacing={2} sx={{ mb: 4 }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Active Projects</Typography>
            <Typography variant="body2" color="text.secondary">Track progress and profitability</Typography>
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            size="small"
            sx={{ 
              bgcolor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.900',
              borderRadius: 3,
              p: 0.5,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: 2.5,
                px: 2,
                '&.Mui-selected': {
                  bgcolor: 'background.paper',
                  boxShadow: theme.shadows[1],
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'background.paper' }
                }
              }
            }}
          >
            <ToggleButton value="list">
              <List size={18} />
            </ToggleButton>
            <ToggleButton value="timeline">
              <CalendarIcon size={18} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {canEdit && (
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => setIsWizardOpen(true)}
            sx={{ px: 3, py: 1 }}
          >
            New Project
          </Button>
        )}
      </Stack>

      {projectsList.length === 0 ? (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: { xs: 4, md: 8 }, 
            textAlign: 'center', 
            borderRadius: 4, 
            bgcolor: 'background.paper',
            border: '1px dashed', 
            borderColor: 'divider',
          }}
        >
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.container', color: 'primary.main', mx: 'auto', mb: 3 }}>
            <FolderOpen size={32} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>No projects yet</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Create your first project to start tracking revenue, allocating staff, and monitoring profitability.
          </Typography>
          {canEdit && (
            <Button variant="contained" startIcon={<Plus size={20} />} onClick={() => setIsWizardOpen(true)} sx={{ px: 4, py: 1.5 }}>
              Create First Project
            </Button>
          )}
        </Paper>
      ) : viewMode === 'list' ? (
        <>
          {isMobile ? (
            <Grid container spacing={2}>
              {projectsList.map((project) => {
                const totalCost = getProjectCost(project);
                const profit = project.totalValue - totalCost;
                const profitMargin = project.totalValue > 0 ? (profit / project.totalValue) * 100 : 0;
                const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));

                return (
                  <Grid size={{ xs: 12 }} key={project.id}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        borderRadius: 4,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: theme.palette.mode === 'light' ? '0 12px 24px -10px rgba(15, 23, 42, 0.1)' : '0 12px 24px -10px rgba(0, 0, 0, 0.5)',
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{project.client}</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                              <Briefcase size={12} />
                              <Typography variant="caption">{project.lob} • {project.type}</Typography>
                            </Stack>
                          </Box>
                          {canEdit && (
                            <Stack direction="row" spacing={1}>
                              <IconButton size="small" sx={{ borderRadius: 2, bgcolor: 'action.hover' }} onClick={() => handleEditClick(project)}>
                                <Edit2 size={16} />
                              </IconButton>
                              <IconButton size="small" sx={{ borderRadius: 2, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }} onClick={() => handleDeleteProject(project.id)}>
                                <Trash2 size={16} />
                              </IconButton>
                            </Stack>
                          )}
                        </Stack>
                        
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          {assignedStaff.length > 0 ? (
                            <Typography variant="caption" color="text.secondary">
                              {assignedStaff.map(s => {
                                const allocation = project.staffAllocations?.[s.id] ?? 100;
                                return allocation < 100 ? `${s.name} (${allocation}%)` : s.name;
                              }).join(', ')}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.disabled">No team assigned</Typography>
                          )}
                        </Stack>

                        {canViewFinancials && (
                          <>
                            <Divider sx={{ my: 2, opacity: 0.6 }} />
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                                  Total Value
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatUSD(project.totalValue)}</Typography>
                              </Grid>
                              <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                                  Est. Profit
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: profit >= 0 ? 'success.main' : 'error.main' }}>
                                  {formatUSD(profit)} ({profitMargin.toFixed(0)}%)
                                </Typography>
                              </Grid>
                            </Grid>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel active={sortColumn === 'Client'} direction={sortColumn === 'Client' ? sortDirection : 'asc'} onClick={() => handleSort('Client')}>
                          Client
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel active={sortColumn === 'LOB / Type'} direction={sortColumn === 'LOB / Type' ? sortDirection : 'asc'} onClick={() => handleSort('LOB / Type')}>
                          LOB / Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel active={sortColumn === 'Team'} direction={sortColumn === 'Team' ? sortDirection : 'asc'} onClick={() => handleSort('Team')}>
                          Team
                        </TableSortLabel>
                      </TableCell>
                      {canViewFinancials && (
                        <>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            <TableSortLabel active={sortColumn === 'Total Value'} direction={sortColumn === 'Total Value' ? sortDirection : 'asc'} onClick={() => handleSort('Total Value')}>
                              Total Value
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            <TableSortLabel active={sortColumn === 'Est. Profit'} direction={sortColumn === 'Est. Profit' ? sortDirection : 'asc'} onClick={() => handleSort('Est. Profit')}>
                              Est. Profit
                            </TableSortLabel>
                          </TableCell>
                        </>
                      )}
                      {canEdit && <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedProjects.map((project) => {
                      const totalCost = getProjectCost(project);
                      const profit = project.totalValue - totalCost;
                      const profitMargin = project.totalValue > 0 ? (profit / project.totalValue) * 100 : 0;
                      const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));
                      
                      return (
                        <TableRow key={project.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{project.client}</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                              <MapPin size={12} />
                              <Typography variant="caption">{project.clientLocation}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{project.lob}</Typography>
                            <Typography variant="caption" color="text.secondary">{project.type}</Typography>
                          </TableCell>
                          <TableCell>
                            {assignedStaff.length > 0 ? (
                              <Typography variant="body2">
                                {assignedStaff.map(s => {
                                  const allocation = project.staffAllocations?.[s.id] ?? 100;
                                  return allocation < 100 ? `${s.name} (${allocation}%)` : s.name;
                                }).join(', ')}
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.disabled">Unassigned</Typography>
                            )}
                          </TableCell>
                          {canViewFinancials && (
                            <>
                              <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatUSD(project.totalValue)}</Typography></TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700, color: profit >= 0 ? 'success.main' : 'error.main' }}>
                                  {formatUSD(profit)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{profitMargin.toFixed(1)}% margin</Typography>
                              </TableCell>
                            </>
                          )}
                          {canEdit && (
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <IconButton size="small" sx={{ borderRadius: 2 }} onClick={() => handleEditClick(project)}>
                                  <Edit2 size={16} />
                                </IconButton>
                                <IconButton size="small" sx={{ borderRadius: 2, color: 'error.main' }} onClick={() => handleDeleteProject(project.id)}>
                                  <Trash2 size={16} />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      ) : (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, overflowX: 'auto' }}>
          <Box sx={{ minWidth: 800 }}>
            <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', pb: 2, mb: 2 }}>
              <Box sx={{ width: 200, flexShrink: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>Project / Staff</Typography>
              </Box>
              <Box sx={{ flexGrow: 1, display: 'flex' }}>
                {months.map((month, i) => (
                  <Box key={i} sx={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      {month.toLocaleString('default', { month: 'short', year: 'numeric' })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Stack spacing={3}>
              {activeProjects.length > 0 && (
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>Active Projects</Typography>
                  <Stack spacing={3}>
                    {activeProjects.map((project) => {
                      const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));
                      const style = getProjectStyle(project);
                      
                      return (
                        <Box key={project.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Box sx={{ width: 200, flexShrink: 0, pr: 2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{project.client}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{project.type}</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, position: 'relative', height: 32, bgcolor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.900', borderRadius: 2 }}>
                              <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
                                {months.map((_, i) => (
                                  <Box key={i} sx={{ flex: 1, borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider', opacity: 0.2 }} />
                                ))}
                              </Box>
                              {project.startDate && project.finishDate && (
                                <Tooltip title={`${project.startDate} to ${project.finishDate}`}>
                                  <Box 
                                    sx={{ 
                                      position: 'absolute', 
                                      top: 4, 
                                      bottom: 4, 
                                      bgcolor: theme.palette[getStatusColor(project.status)].main,
                                      opacity: 0.9,
                                      borderRadius: 1.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      px: 1.5,
                                      color: 'white',
                                      overflow: 'hidden',
                                      boxShadow: theme.shadows[1],
                                      ...style
                                    }}
                                  >
                                    <Typography variant="caption" noWrap sx={{ fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase' }}>
                                      {project.client}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                          
                          {assignedStaff.map(staff => {
                            const allocation = project.staffAllocations?.[staff.id] ?? 100;
                            return (
                              <Box key={staff.id} sx={{ display: 'flex', alignItems: 'center', mt: 0.75 }}>
                                <Box sx={{ width: 200, flexShrink: 0, pl: 2, pr: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 500 }}>
                                    {allocation < 100 ? `${staff.name} (${allocation}%)` : staff.name}
                                  </Typography>
                                </Box>
                                <Box sx={{ flexGrow: 1, position: 'relative', height: 6 }}>
                                  {project.startDate && project.finishDate && (
                                    <Box 
                                      sx={{ 
                                        position: 'absolute', 
                                        top: 0, 
                                        bottom: 0, 
                                        bgcolor: 'divider',
                                        borderRadius: 1,
                                        opacity: 0.5,
                                        ...style
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {inactiveProjects.length > 0 && (
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, mb: 1, display: 'block' }}>Inactive Projects</Typography>
                  <Stack spacing={3}>
                    {inactiveProjects.map((project) => {
                      const assignedStaff = staffList.filter(s => (project.assignedStaffIds || []).includes(s.id));
                      const style = getProjectStyle(project);
                      
                      return (
                        <Box key={project.id} sx={{ opacity: 0.6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Box sx={{ width: 200, flexShrink: 0, pr: 2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{project.client}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{project.type}</Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, position: 'relative', height: 32, bgcolor: theme.palette.mode === 'light' ? 'grey.100' : 'grey.900', borderRadius: 2 }}>
                              <Box sx={{ position: 'absolute', inset: 0, display: 'flex' }}>
                                {months.map((_, i) => (
                                  <Box key={i} sx={{ flex: 1, borderLeft: i > 0 ? '1px solid' : 'none', borderColor: 'divider', opacity: 0.2 }} />
                                ))}
                              </Box>
                              {project.startDate && project.finishDate && (
                                <Tooltip title={`${project.startDate} to ${project.finishDate}`}>
                                  <Box 
                                    sx={{ 
                                      position: 'absolute', 
                                      top: 4, 
                                      bottom: 4, 
                                      bgcolor: 'grey.500',
                                      opacity: 0.5,
                                      borderRadius: 1.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      px: 1.5,
                                      color: 'white',
                                      overflow: 'hidden',
                                      ...style
                                    }}
                                  >
                                    <Typography variant="caption" noWrap sx={{ fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase' }}>
                                      {project.client}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                          
                          {assignedStaff.map(staff => {
                            const allocation = project.staffAllocations?.[staff.id] ?? 100;
                            return (
                              <Box key={staff.id} sx={{ display: 'flex', alignItems: 'center', mt: 0.75 }}>
                                <Box sx={{ width: 200, flexShrink: 0, pl: 2, pr: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 500 }}>
                                    {allocation < 100 ? `${staff.name} (${allocation}%)` : staff.name}
                                  </Typography>
                                </Box>
                                <Box sx={{ flexGrow: 1, position: 'relative', height: 6 }}>
                                  {project.startDate && project.finishDate && (
                                    <Box 
                                      sx={{ 
                                        position: 'absolute', 
                                        top: 0, 
                                        bottom: 0, 
                                        bgcolor: 'divider',
                                        borderRadius: 1,
                                        opacity: 0.5,
                                        ...style
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>
        </Paper>
      )}

      <AddProjectWizard 
        isOpen={isWizardOpen} 
        onClose={handleCloseWizard} 
        onSave={handleSaveProject} 
        staffList={staffList}
        projectsList={projectsList}
        initialData={editingProject || undefined}
      />
    </Box>
  );
}
