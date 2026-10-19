import React, { useState } from 'react';
import { User, StaffMember } from '../../lib/mockData';
import { Plus, Edit2, Users as UsersIcon, MapPin, Clock, ArrowUpDown, ArrowUp, ArrowDown, Trash2, IdCard } from 'lucide-react';
import StaffDetailsPanel from '../../modules/staffData/components/StaffDetailsPanel';
import { useStaffProfiles } from '../../modules/staffData/hooks/useStaffProfiles';
import AddStaffWizard from '../wizards/AddStaffWizard';
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
  Paper,
  useTheme,
  useMediaQuery,
  Grid,
  Stack,
  Divider,
  TableSortLabel
} from '@mui/material';

type SortField = 'name' | 'location' | 'timezone' | 'hourlyCost' | 'hourlyCostCAD' | 'employmentType' | 'lazerEmail';
type SortOrder = 'asc' | 'desc';

export default function Staff({ user, staffList, setStaffList }: { user: User, staffList: StaffMember[], setStaffList: any }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [detailsStaff, setDetailsStaff] = useState<StaffMember | null>(null);
  const staffProfiles = useStaffProfiles();

  const canEdit = user.role === 'Super Admin' || user.role === 'Admin';
  const canViewCost = user.role === 'Super Admin' || user.role === 'Admin';

  const handleSaveStaff = (savedStaff: StaffMember) => {
    if (editingStaff) {
      setStaffList(staffList.map(s => s.id === savedStaff.id ? savedStaff : s));
    } else {
      setStaffList([...staffList, savedStaff]);
    }
  };

  const handleEditClick = (staff: StaffMember) => {
    setEditingStaff(staff);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setTimeout(() => setEditingStaff(null), 300);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      setStaffList(staffList.filter(s => s.id !== staffId));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedStaff = [...staffList].sort((a, b) => {
    let valA: any = a[sortField as keyof StaffMember];
    let valB: any = b[sortField as keyof StaffMember];
    
    if (sortField === 'hourlyCostCAD') {
      valA = a.hourlyCost * 1.35;
      valB = b.hourlyCost * 1.35;
    }
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const formatCAD = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getLocalTime = (timezone: string) => {
    if (!timezone) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (e) {
      return '';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Team Members
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your design team and resources
          </Typography>
        </Box>
        {canEdit && (
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />}
            onClick={() => setIsWizardOpen(true)}
            sx={{ 
              px: 3,
              py: 1,
              boxShadow: theme.shadows[2]
            }}
          >
            {isMobile ? 'Add' : 'Add Staff'}
          </Button>
        )}
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
            Add your first team member to start allocating them to projects and tracking costs.
          </Typography>
          {canEdit && (
            <Button 
              variant="contained" 
              startIcon={<Plus size={20} />} 
              onClick={() => setIsWizardOpen(true)} 
              sx={{ px: 4, py: 1.5 }}
            >
              Add First Team Member
            </Button>
          )}
        </Paper>
      ) : (
        <>
          {isMobile ? (
            <Grid container spacing={2}>
              {staffList.map((staff) => (
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
                            {staff.lazerEmail && <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2, mb: 0.5 }}>{staff.lazerEmail.length > 10 ? staff.lazerEmail.substring(0, 10) + '...' : staff.lazerEmail}</Typography>}
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary" sx={{ mt: 0.5 }}>
                              <MapPin size={12} />
                              <Typography variant="caption">{staff.location}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary" sx={{ mt: 0.5 }}>
                              <Clock size={12} />
                              <Typography variant="caption">{getLocalTime(staff.timezone) || staff.timezone}</Typography>
                            </Stack>
                          </Box>
                        </Stack>
                        {canEdit && (
                          <Stack direction="row" spacing={1}>
                            <IconButton size="small" aria-label="Staff details" sx={{ borderRadius: 2, bgcolor: 'action.hover' }} onClick={() => setDetailsStaff(staff)}>
                              <IdCard size={16} />
                            </IconButton>
                            <IconButton size="small" sx={{ borderRadius: 2, bgcolor: 'action.hover' }} onClick={() => handleEditClick(staff)}>
                              <Edit2 size={16} />
                            </IconButton>
                            <IconButton size="small" sx={{ borderRadius: 2, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }} onClick={() => handleDeleteStaff(staff.id)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Stack>
                        )}
                      </Stack>

                      <Divider sx={{ my: 2, opacity: 0.6 }} />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                            Type
                          </Typography>
                          <Chip 
                            label={staff.employmentType} 
                            size="small" 
                            variant="outlined"
                            color="secondary"
                            sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: '0.7rem' }} 
                          />
                        </Grid>
                        {canViewCost && (
                          <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                              Cost
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {formatUSD(staff.hourlyCost)}/hr
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {formatCAD(staff.hourlyCost * 1.35)}/hr CAD
                            </Typography>
                          </Grid>
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
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'location'}
                          direction={sortField === 'location' ? sortOrder : 'asc'}
                          onClick={() => handleSort('location')}
                        >
                          Place
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'timezone'}
                          direction={sortField === 'timezone' ? sortOrder : 'asc'}
                          onClick={() => handleSort('timezone')}
                        >
                          Time
                        </TableSortLabel>
                      </TableCell>
                      {canViewCost && (
                        <>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            <TableSortLabel
                              active={sortField === 'hourlyCost'}
                              direction={sortField === 'hourlyCost' ? sortOrder : 'asc'}
                              onClick={() => handleSort('hourlyCost')}
                            >
                              Rate USD
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            <TableSortLabel
                              active={sortField === 'hourlyCostCAD'}
                              direction={sortField === 'hourlyCostCAD' ? sortOrder : 'asc'}
                              onClick={() => handleSort('hourlyCostCAD')}
                            >
                              Rate CAD
                            </TableSortLabel>
                          </TableCell>
                        </>
                      )}
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'employmentType'}
                          direction={sortField === 'employmentType' ? sortOrder : 'asc'}
                          onClick={() => handleSort('employmentType')}
                        >
                          Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <TableSortLabel
                          active={sortField === 'lazerEmail'}
                          direction={sortField === 'lazerEmail' ? sortOrder : 'asc'}
                          onClick={() => handleSort('lazerEmail')}
                        >
                          Email
                        </TableSortLabel>
                      </TableCell>
                      {canEdit && <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedStaff.map((staff) => (
                      <TableRow key={staff.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{staff.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{staff.location}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{getLocalTime(staff.timezone) || staff.timezone}</Typography>
                        </TableCell>
                        {canViewCost && (
                          <>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatUSD(staff.hourlyCost)}/hr
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {formatCAD(staff.hourlyCost * 1.35)}/hr
                              </Typography>
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <Chip 
                            label={staff.employmentType} 
                            size="small" 
                            variant="outlined"
                            color="secondary"
                            sx={{ borderRadius: 1.5, fontWeight: 600 }} 
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {staff.lazerEmail ? (staff.lazerEmail.length > 10 ? staff.lazerEmail.substring(0, 10) + '...' : staff.lazerEmail) : '-'}
                          </Typography>
                        </TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <IconButton size="small" aria-label="Staff details" title="Birthday, join date, PTO, holidays, 1:1 cadence" sx={{ borderRadius: 2 }} onClick={() => setDetailsStaff(staff)}>
                                <IdCard size={16} />
                              </IconButton>
                              <IconButton size="small" sx={{ borderRadius: 2 }} onClick={() => handleEditClick(staff)}>
                                <Edit2 size={16} />
                              </IconButton>
                              <IconButton size="small" sx={{ borderRadius: 2, color: 'error.main' }} onClick={() => handleDeleteStaff(staff.id)}>
                                <Trash2 size={16} />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      <AddStaffWizard 
        isOpen={isWizardOpen} 
        onClose={handleCloseWizard} 
        onSave={handleSaveStaff}
        initialData={editingStaff}
      />

      <StaffDetailsPanel
        open={!!detailsStaff}
        onClose={() => setDetailsStaff(null)}
        staff={detailsStaff}
        profile={detailsStaff ? staffProfiles.get(detailsStaff.id) : null}
      />
    </Box>
  );
}
