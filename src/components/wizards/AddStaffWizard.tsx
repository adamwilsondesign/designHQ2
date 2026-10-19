import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { StaffMember } from '../../lib/mockData';
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
  ToggleButton, 
  ToggleButtonGroup, 
  Chip,
  useTheme,
  LinearProgress,
  Stack,
  Paper,
  Fade
} from '@mui/material';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (staff: StaffMember) => void;
  initialData?: StaffMember | null;
}

const SKILL_OPTIONS = ['UI', 'UX', 'Motion', 'Brand', 'Design Systems', 'Enterprise', 'Commerce', 'Crypto', 'Fintech', 'AI'];

export default function AddStaffWizard({ isOpen, onClose, onSave, initialData }: Props) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    employmentType: 'Full-Time',
    skills: [],
    timezone: guessTimezone('')
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          employmentType: 'Full-Time',
          skills: [],
          timezone: guessTimezone('')
        });
      }
      setActiveStep(0);
    }
  }, [isOpen, initialData]);

  const steps = ['Basic Details', 'Location', 'Employment', 'Skills'];
  const progress = ((activeStep + 1) / steps.length) * 100;

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSave = () => {
    onSave({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      name: formData.name || 'Unknown Name',
      personalEmail: formData.personalEmail || '',
      lazerEmail: formData.lazerEmail || '',
      location: formData.location || 'Unknown Location',
      timezone: formData.timezone || guessTimezone(''),
      employmentType: formData.employmentType || 'Full-Time',
      hourlyCost: Number(formData.hourlyCost) || 0,
      skills: formData.skills || []
    });
    onClose();
  };

  const toggleSkill = (skill: string) => {
    const current = formData.skills || [];
    if (current.includes(skill)) {
      setFormData({ ...formData, skills: current.filter(s => s !== skill) });
    } else {
      setFormData({ ...formData, skills: [...current, skill] });
    }
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
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            {initialData ? 'Edit Team Member' : 'Add Team Member'}
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

      <DialogContent sx={{ mt: 2, minHeight: 300 }}>
        <Fade in={true} key={activeStep}>
          <Box>
            {activeStep === 0 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Enter the basic information for the new team member.
                </Typography>
                <TextField 
                  fullWidth 
                  label="Full Name" 
                  variant="filled"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
                <TextField 
                  fullWidth 
                  label="Personal Email" 
                  variant="filled"
                  type="email"
                  value={formData.personalEmail || ''}
                  onChange={e => setFormData({ ...formData, personalEmail: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
                <TextField 
                  fullWidth 
                  label="Lazer Email" 
                  variant="filled"
                  type="email"
                  value={formData.lazerEmail || ''}
                  onChange={e => setFormData({ ...formData, lazerEmail: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
              </Stack>
            )}

            {activeStep === 1 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Where is this team member located?
                </Typography>
                <TextField 
                  fullWidth 
                  label="Location (City, Country)" 
                  variant="filled"
                  value={formData.location || ''}
                  onChange={e => {
                    const loc = e.target.value;
                    setFormData({ ...formData, location: loc, timezone: guessTimezone(loc) });
                  }}
                  autoFocus
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
                {formData.location && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.container', color: 'primary.onContainer', borderRadius: 3 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>Detected Timezone:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formData.timezone}</Typography>
                  </Paper>
                )}
              </Stack>
            )}

            {activeStep === 2 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Define their employment status and hourly cost.
                </Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>Employment Type</Typography>
                  <ToggleButtonGroup
                    value={formData.employmentType}
                    exclusive
                    onChange={(_, val) => val && setFormData({ ...formData, employmentType: val })}
                    fullWidth
                    sx={{ 
                      bgcolor: 'action.hover',
                      p: 0.5,
                      borderRadius: 3,
                      '& .MuiToggleButton-root': {
                        border: 'none',
                        borderRadius: 2.5,
                        py: 1,
                        '&.Mui-selected': {
                          bgcolor: 'background.paper',
                          boxShadow: theme.shadows[1],
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'background.paper' }
                        }
                      }
                    }}
                  >
                    <ToggleButton value="Full-Time">Full-Time</ToggleButton>
                    <ToggleButton value="Contractor">Contractor</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <TextField 
                  fullWidth 
                  label="Hourly Cost ($ USD)" 
                  variant="filled"
                  type="number"
                  value={formData.hourlyCost || ''}
                  onChange={e => setFormData({ ...formData, hourlyCost: Number(e.target.value) })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
              </Stack>
            )}

            {activeStep === 3 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Select the primary skills and areas of expertise.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {SKILL_OPTIONS.map(skill => {
                    const isSelected = (formData.skills || []).includes(skill);
                    return (
                      <Chip 
                        key={skill} 
                        label={skill} 
                        onClick={() => toggleSkill(skill)}
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        sx={{ 
                          borderRadius: 2,
                          fontWeight: isSelected ? 700 : 400,
                          px: 1
                        }}
                      />
                    );
                  })}
                </Box>
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
