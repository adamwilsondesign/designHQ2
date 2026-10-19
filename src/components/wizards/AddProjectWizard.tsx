import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Calendar as CalendarIcon } from 'lucide-react';
import { Project, StaffMember } from '../../lib/mockData';
import { guessTimezone } from '../../lib/utils';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Typography, 
  Button, 
  Box, 
  IconButton, 
  TextField, 
  Grid, 
  MenuItem,
  Paper,
  useTheme,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Chip,
  Alert,
  LinearProgress,
  Stack,
  Fade
} from '@mui/material';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  staffList: StaffMember[];
  projectsList: Project[];
  initialData?: Project;
}

const LOB_OPTIONS = ['Design', 'Core', 'Fintech', 'Commerce'];
const TYPE_OPTIONS = ['Product', 'Staff Aug', 'Branding', 'Website'];

export default function AddProjectWizard({ isOpen, onClose, onSave, staffList, projectsList, initialData }: Props) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Partial<Project>>({
    lob: 'Design',
    type: 'Product',
    status: 'Closed',
    clientLocation: guessTimezone(''),
    assignedStaffIds: [],
    staffAllocations: {}
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...initialData,
          staffAllocations: initialData.staffAllocations || {}
        });
      } else {
        setFormData({
          lob: 'Design',
          type: 'Product',
          status: 'Closed',
          clientLocation: guessTimezone(''),
          assignedStaffIds: [],
          staffAllocations: {}
        });
      }
      setActiveStep(0);
    }
  }, [isOpen, initialData]);

  const steps = ['Details', 'Categorization', 'Location', 'Financials', 'Timeline', 'Staff', 'Design Sourced', 'Design Closed'];
  const progress = ((activeStep + 1) / steps.length) * 100;

  // Auto calculate total value
  useEffect(() => {
    if (formData.totalHours && formData.billedRate) {
      setFormData(prev => ({ ...prev, totalValue: Number(prev.totalHours) * Number(prev.billedRate) }));
    }
  }, [formData.totalHours, formData.billedRate]);

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSave = () => {
    onSave({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      client: formData.client || 'Unknown Client',
      lob: formData.lob || 'Design',
      type: formData.type || 'Product',
      clientLocation: formData.clientLocation || 'Unknown Location',
      status: formData.status || 'Closed',
      totalHours: Number(formData.totalHours) || 0,
      billedRate: Number(formData.billedRate) || 0,
      totalValue: Number(formData.totalValue) || 0,
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      finishDate: formData.finishDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      assignedStaffIds: formData.assignedStaffIds || [],
      staffAllocations: formData.staffAllocations || {},
      designSourced: formData.designSourced ?? false,
      designClosed: formData.designClosed ?? false
    });
    onClose();
    if (!initialData) {
      setTimeout(() => {
        setActiveStep(0);
        setFormData({ lob: 'Design', type: 'Product', status: 'Closed', clientLocation: guessTimezone(''), assignedStaffIds: [], designSourced: false, designClosed: false });
      }, 300);
    }
  };

  const toggleStaff = (id: string) => {
    const current = formData.assignedStaffIds || [];
    const currentAllocations = formData.staffAllocations || {};
    if (current.includes(id)) {
      const newAllocations = { ...currentAllocations };
      delete newAllocations[id];
      setFormData({ ...formData, assignedStaffIds: current.filter(s => s !== id), staffAllocations: newAllocations });
    } else {
      setFormData({ ...formData, assignedStaffIds: [...current, id], staffAllocations: { ...currentAllocations, [id]: 100 } });
    }
  };

  const updateStaffAllocation = (id: string, allocation: number) => {
    const currentAllocations = formData.staffAllocations || {};
    setFormData({ ...formData, staffAllocations: { ...currentAllocations, [id]: allocation } });
  };

  const isStaffBooked = (staffId: string) => {
    if (!formData.startDate || !formData.finishDate) return false;
    const pStart = new Date(formData.startDate).getTime();
    const pEnd = new Date(formData.finishDate).getTime();

    return projectsList.some(p => {
      if (!p.assignedStaffIds?.includes(staffId)) return false;
      if (p.id === initialData?.id) return false; // Don't block against the project being edited
      const sStart = new Date(p.startDate).getTime();
      const sEnd = new Date(p.finishDate).getTime();
      return pStart <= sEnd && pEnd >= sStart;
    });
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 4, p: 1, overflow: 'hidden' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontFamily: '"Outfit", sans-serif' }}>
            {initialData ? 'Edit Project' : 'Add New Project'}
          </Typography>
          <Typography variant="caption" color="text.secondary">Step {activeStep + 1} of {steps.length}: {steps[activeStep]}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'action.hover' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mx: 3, height: 4, borderRadius: 2, bgcolor: 'action.hover' }} 
      />

      <DialogContent sx={{ mt: 2, minHeight: 350 }}>
        <Fade in={true} key={activeStep}>
          <Box>
            {activeStep === 0 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  What is the name of the project or the client?
                </Typography>
                <TextField 
                  fullWidth 
                  label="Name / Client" 
                  variant="filled"
                  value={formData.client || ''}
                  onChange={e => setFormData({ ...formData, client: e.target.value })}
                  autoFocus
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
              </Stack>
            )}

            {activeStep === 1 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Categorize the project to help with reporting.
                </Typography>
                <TextField
                  select
                  fullWidth
                  label="Line of Business"
                  variant="filled"
                  value={formData.lob || 'Design'}
                  onChange={e => setFormData({ ...formData, lob: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  {LOB_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Type of Project"
                  variant="filled"
                  value={formData.type || 'Product'}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  {TYPE_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                </TextField>
              </Stack>
            )}

            {activeStep === 2 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Where is the client located?
                </Typography>
                <TextField 
                  fullWidth 
                  label="Timezone" 
                  variant="filled"
                  value={formData.clientLocation || ''}
                  onChange={e => setFormData({ ...formData, clientLocation: e.target.value })}
                  autoFocus
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                  helperText="Used to coordinate meetings and deliverables."
                />
              </Stack>
            )}

            {activeStep === 3 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Define the financial scope of the project.
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Total Hours" 
                      variant="filled"
                      type="number"
                      value={formData.totalHours || ''}
                      onChange={e => setFormData({ ...formData, totalHours: Number(e.target.value) })}
                      autoFocus
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Billed Rate ($ USD)" 
                      variant="filled"
                      type="number"
                      value={formData.billedRate || ''}
                      onChange={e => setFormData({ ...formData, billedRate: Number(e.target.value) })}
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                </Grid>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.container', color: 'primary.onContainer', borderRadius: 3, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>Total Project Value:</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    ${(Number(formData.totalValue) || 0).toLocaleString()}
                  </Typography>
                </Paper>
              </Stack>
            )}

            {activeStep === 4 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  When does the project start and finish?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Start Date" 
                      variant="filled"
                      type="date"
                      value={formData.startDate || ''}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Finish Date" 
                      variant="filled"
                      type="date"
                      value={formData.finishDate || ''}
                      onChange={e => setFormData({ ...formData, finishDate: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                </Grid>
              </Stack>
            )}

            {activeStep === 5 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Assign designers to this project. Availability is shown for the selected dates.
                </Typography>
                
                {(!formData.startDate || !formData.finishDate) ? (
                  <Alert severity="warning" sx={{ borderRadius: 3 }}>
                    Please go back and select Start and Finish dates to see staff availability.
                  </Alert>
                ) : (
                  <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                    <List disablePadding>
                      {staffList.map(staff => {
                        const isSelected = (formData.assignedStaffIds || []).includes(staff.id);
                        const isBooked = isStaffBooked(staff.id);
                        return (
                          <ListItem
                            key={staff.id}
                            disablePadding
                            divider
                            sx={{ flexDirection: 'column', alignItems: 'stretch' }}
                          >
                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                              <ListItemButton onClick={() => toggleStaff(staff.id)} sx={{ py: 1, flexGrow: 1 }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  <Checkbox
                                    edge="start"
                                    checked={isSelected}
                                    tabIndex={-1}
                                    disableRipple
                                    size="small"
                                  />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={staff.name} 
                                  secondary={staff.skills.slice(0, 2).join(', ')}
                                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                                  secondaryTypographyProps={{ variant: 'caption' }}
                                />
                              </ListItemButton>
                              <Box sx={{ pr: 2 }}>
                                <Chip 
                                  label={isBooked ? 'Booked' : 'Free'} 
                                  size="small" 
                                  color={isBooked ? 'error' : 'success'} 
                                  variant={isBooked ? 'filled' : 'outlined'}
                                  sx={{ borderRadius: 1.5, fontSize: '0.65rem', height: 20 }}
                                />
                              </Box>
                            </Box>
                            {isSelected && (
                              <Box sx={{ px: 2, pb: 2, pt: 1, width: '100%' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  Allocation (%)
                                </Typography>
                                <TextField
                                  type="number"
                                  size="small"
                                  variant="outlined"
                                  fullWidth
                                  value={formData.staffAllocations?.[staff.id] ?? 100}
                                  onChange={(e) => updateStaffAllocation(staff.id, Number(e.target.value))}
                                  inputProps={{ min: 0, max: 100 }}
                                />
                              </Box>
                            )}
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                )}
              </Stack>
            )}

            {activeStep === 6 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Was this deal sourced by design?
                </Typography>
                <TextField
                  select
                  fullWidth
                  label="Design Sourced"
                  variant="filled"
                  value={formData.designSourced ? 'Yes' : 'No'}
                  onChange={e => setFormData({ ...formData, designSourced: e.target.value === 'Yes' })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  <MenuItem value="Yes">Yes</MenuItem>
                  <MenuItem value="No">No</MenuItem>
                </TextField>
              </Stack>
            )}

            {activeStep === 7 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Was this deal closed by design?
                </Typography>
                <TextField
                  select
                  fullWidth
                  label="Design Closed"
                  variant="filled"
                  value={formData.designClosed ? 'Yes' : 'No'}
                  onChange={e => setFormData({ ...formData, designClosed: e.target.value === 'Yes' })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  <MenuItem value="Yes">Yes</MenuItem>
                  <MenuItem value="No">No</MenuItem>
                </TextField>
              </Stack>
            )}
          </Box>
        </Fade>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button 
          onClick={handleBack} 
          disabled={activeStep === 0}
          startIcon={<ChevronLeft size={18} />}
          sx={{ borderRadius: 10, color: 'text.secondary' }}
        >
          Back
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {activeStep < steps.length - 1 ? (
          <Button 
            variant="contained" 
            onClick={handleNext}
            endIcon={<ChevronRight size={18} />}
            sx={{ borderRadius: 10, px: 4, py: 1.2 }}
          >
            Next
          </Button>
        ) : (
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleSave}
            endIcon={<Check size={18} />}
            sx={{ borderRadius: 10, px: 4, py: 1.2 }}
          >
            Complete
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
