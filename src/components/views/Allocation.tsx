import React, { useState } from 'react';
import { User, StaffMember, Project } from '../../lib/mockData';
import { Users as UsersIcon, MapPin, Clock } from 'lucide-react';
import { formatUSD } from '../../lib/utils';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Avatar, 
  Chip, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  useTheme,
  useMediaQuery,
  Grid,
  Stack,
  Divider,
  TableSortLabel
} from '@mui/material';

type SortField = 'name' | 'hourlyCost' | 'allocated' | 'startDate' | 'endDate' | 'available';
type SortOrder = 'asc' | 'desc';

export default function Allocation({ user, staffList, projectsList }: { user: User, staffList: StaffMember[], projectsList: Project[] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const canViewCost = user.role === 'Super Admin' || user.role === 'Admin';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getNextMonday = (date: Date) => {
    const nextMonday = new Date(date);
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    return nextMonday;
  };

  const getStaffAllocationData = (staff: StaffMember) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const assignedProjects = projectsList.filter(p => {
      if (!(p.assignedStaffIds || []).includes(staff.id)) return false;
      if (!p.startDate || !p.finishDate) return false;
      
      const finishDate = new Date(p.finishDate);
      finishDate.setHours(23, 59, 59, 999);
      
      return finishDate >= now;
    });

    let activeProject = null;
    let startDate = '';
    let endDate = '';
    let availableDate = new Date();

    if (assignedProjects.length > 0) {
      // Find the project that ends the latest
      activeProject = assignedProjects.reduce((latest, current) => {
        if (!latest.finishDate) return current;
        if (!current.finishDate) return latest;
        return new Date(current.finishDate) > new Date(latest.finishDate) ? current : latest;
      });

      startDate = activeProject.startDate;
      endDate = activeProject.finishDate;
      availableDate = getNextMonday(new Date(endDate));
    }

    return {
      ...staff,
      allocated: assignedProjects.length > 0,
      startDate,
      endDate,
      availableDate
    };
  };

  const staffData = staffList.map(getStaffAllocationData);

  const sortedStaff = [...staffData].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a];
    let valB: any = b[sortField as keyof typeof b];
    
    if (sortField === 'available') {
      valA = a.availableDate.getTime();
      valB = b.availableDate.getTime();
    }
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Allocation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View team member availability and project assignments
          </Typography>
        </Box>
      </Stack>

      {staffList.length === 0 ? (
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
            <UsersIcon size={32} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, letterSpacing: '-0.02em' }}>No staff members yet</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Add team members to view their allocations.
          </Typography>
        </Paper>
      ) : (
        <>
          {isMobile ? (
            <Grid container spacing={2}>
              {sortedStaff.map((staff) => (
                <Grid size={{ xs: 12 }} key={staff.id}>
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
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{staff.name}</Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary" sx={{ mt: 0.5 }}>
                              <MapPin size={12} />
                              <Typography variant="caption">{staff.location}</Typography>
                            </Stack>
                          </Box>
                        </Stack>
                        <Chip 
                          label={staff.allocated ? 'Yes' : 'No'} 
                          size="small" 
                          color={staff.allocated ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ borderRadius: 1.5, fontWeight: 600 }} 
                        />
                      </Stack>

                      <Divider sx={{ my: 2, opacity: 0.6 }} />

                      <Grid container spacing={2}>
                        {canViewCost && (
                          <Grid size={{ xs: 6 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                              Rate
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {formatUSD(staff.hourlyCost)}/hr
                            </Typography>
                          </Grid>
                        )}
                        <Grid size={{ xs: 6 }} sx={{ textAlign: canViewCost ? 'right' : 'left' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                            Available
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatDate(staff.availableDate)}
                          </Typography>
                        </Grid>
                        {staff.allocated && (
                          <>
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                                Start Date
                              </Typography>
                              <Typography variant="body2">
                                {formatDate(staff.startDate)}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                                End Date
                              </Typography>
                              <Typography variant="body2">
                                {formatDate(staff.endDate)}
                              </Typography>
                            </Grid>
                          </>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: theme.palette.mode === 'light' ? 'grey.50' : 'grey.900' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'name'}
                          direction={sortField === 'name' ? sortOrder : 'asc'}
                          onClick={() => handleSort('name')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      {canViewCost && (
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          <TableSortLabel
                            active={sortField === 'hourlyCost'}
                            direction={sortField === 'hourlyCost' ? sortOrder : 'asc'}
                            onClick={() => handleSort('hourlyCost')}
                          >
                            Rate
                          </TableSortLabel>
                        </TableCell>
                      )}
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'allocated'}
                          direction={sortField === 'allocated' ? sortOrder : 'asc'}
                          onClick={() => handleSort('allocated')}
                        >
                          Allocated
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'startDate'}
                          direction={sortField === 'startDate' ? sortOrder : 'asc'}
                          onClick={() => handleSort('startDate')}
                        >
                          Start Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'endDate'}
                          direction={sortField === 'endDate' ? sortOrder : 'asc'}
                          onClick={() => handleSort('endDate')}
                        >
                          End Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'available'}
                          direction={sortField === 'available' ? sortOrder : 'asc'}
                          onClick={() => handleSort('available')}
                        >
                          Available
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedStaff.map((staff) => (
                      <TableRow key={staff.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{staff.name}</Typography>
                        </TableCell>
                        {canViewCost && (
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatUSD(staff.hourlyCost)}/hr
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Chip 
                            label={staff.allocated ? 'Yes' : 'No'} 
                            size="small" 
                            color={staff.allocated ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ borderRadius: 1.5, fontWeight: 600 }} 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatDate(staff.startDate)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatDate(staff.endDate)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(staff.availableDate)}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
