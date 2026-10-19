import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Sale } from '../../lib/mockData';
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
  LinearProgress,
  Stack,
  Fade
} from '@mui/material';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sale: Sale) => void;
  initialData?: Sale | null;
}

export default function AddSaleWizard({ isOpen, onClose, onSave, initialData }: Props) {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Partial<Sale>>({
    status: 'Open',
    lastContactDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          status: 'Open',
          lastContactDate: new Date().toISOString().split('T')[0]
        });
      }
      setActiveStep(0);
    }
  }, [isOpen, initialData]);

  const steps = ['Client Details', 'Project Scope', 'Financials', 'Design Sourced', 'Design Closed'];
  const progress = ((activeStep + 1) / steps.length) * 100;

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSave = () => {
    const projectedHours = Number(formData.projectedHours) || 0;
    const projectedRate = Number(formData.projectedRate) || 0;
    
    onSave({
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      client: formData.client || 'Unknown Client',
      lob: formData.lob || 'Design',
      type: formData.type || 'Product',
      clientLocation: formData.clientLocation || 'Unknown Location',
      status: formData.status || 'Open',
      projectedHours,
      projectedRate,
      projectedValue: projectedHours * projectedRate,
      lastContactDate: formData.lastContactDate || new Date().toISOString().split('T')[0],
      projectedCloseDate: formData.projectedCloseDate,
      designSourced: formData.designSourced ?? false,
      designClosed: formData.designClosed ?? false
    });
    onClose();
    if (!initialData) {
      setTimeout(() => {
        setActiveStep(0);
        setFormData({ status: 'Open', lastContactDate: new Date().toISOString().split('T')[0], designSourced: false, designClosed: false });
      }, 300);
    }
  };

  const totalProjectedValue = (Number(formData.projectedHours) || 0) * (Number(formData.projectedRate) || 0);

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
          <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            {initialData ? 'Edit Lead' : 'Add New Lead'}
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
                  Who is the potential client and where are they located?
                </Typography>
                <TextField 
                  fullWidth 
                  label="Client Name" 
                  variant="filled"
                  value={formData.client || ''}
                  onChange={e => setFormData({ ...formData, client: e.target.value })}
                  autoFocus
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
                <TextField 
                  fullWidth 
                  label="Client Location" 
                  variant="filled"
                  value={formData.clientLocation || ''}
                  onChange={e => setFormData({ ...formData, clientLocation: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
              </Stack>
            )}

            {activeStep === 1 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  What kind of project are we looking at?
                </Typography>
                <TextField
                  select
                  fullWidth
                  label="Line of Business"
                  variant="filled"
                  value={formData.lob || ''}
                  onChange={e => setFormData({ ...formData, lob: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  <MenuItem value="Design">Design</MenuItem>
                  <MenuItem value="Core">Core</MenuItem>
                  <MenuItem value="Fintech">Fintech</MenuItem>
                  <MenuItem value="Commerce">Commerce</MenuItem>
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Project Type"
                  variant="filled"
                  value={formData.type || ''}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                >
                  <MenuItem value="Product">Product</MenuItem>
                  <MenuItem value="Staff Aug">Staff Aug</MenuItem>
                  <MenuItem value="Branding">Branding</MenuItem>
                  <MenuItem value="Website">Website</MenuItem>
                </TextField>
              </Stack>
            )}

            {activeStep === 2 && (
              <Stack spacing={3}>
                <Typography variant="body2" color="text.secondary">
                  Estimate the project value and projected close date.
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Projected Hours" 
                      variant="filled"
                      type="number"
                      value={formData.projectedHours || ''}
                      onChange={e => setFormData({ ...formData, projectedHours: Number(e.target.value) })}
                      autoFocus
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Projected Rate ($)" 
                      variant="filled"
                      type="number"
                      value={formData.projectedRate || ''}
                      onChange={e => setFormData({ ...formData, projectedRate: Number(e.target.value) })}
                      InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                    />
                  </Grid>
                </Grid>
                <TextField 
                  fullWidth 
                  label="Projected Close Date" 
                  variant="filled"
                  type="date"
                  value={formData.projectedCloseDate || ''}
                  onChange={e => setFormData({ ...formData, projectedCloseDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ disableUnderline: true, sx: { borderRadius: 3 } }}
                />
                <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.container', color: 'primary.onContainer', borderRadius: 4, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>Total Projected Value:</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
                    ${totalProjectedValue.toLocaleString()}
                  </Typography>
                </Paper>
              </Stack>
            )}

            {activeStep === 3 && (
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

            {activeStep === 4 && (
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
