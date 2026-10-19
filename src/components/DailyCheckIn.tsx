import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, UserPlus, TrendingUp, Briefcase } from 'lucide-react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  Button, 
  Box, 
  IconButton, 
  LinearProgress,
  useTheme,
  Stack,
  Avatar
} from '@mui/material';

interface Props {
  onComplete: (responses: { newStaff: boolean, newLeads: boolean, newProjects: boolean }) => void;
  onSkip: () => void;
}

export default function DailyCheckIn({ onComplete, onSkip }: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({
    newStaff: false,
    newLeads: false,
    newProjects: false
  });

  const questions = [
    { 
      key: 'newStaff', 
      title: 'New faces in the studio?', 
      subtitle: 'Any new staff members joined the team today?',
      icon: UserPlus,
      color: 'primary.main'
    },
    { 
      key: 'newLeads', 
      title: 'Fresh opportunities?', 
      subtitle: 'Have any new sales leads landed on your desk?',
      icon: TrendingUp,
      color: 'success.main'
    },
    { 
      key: 'newProjects', 
      title: 'Kicking off something big?', 
      subtitle: 'Are there any new projects starting today?',
      icon: Briefcase,
      color: 'secondary.main'
    }
  ];

  const handleAnswer = (value: boolean) => {
    const currentKey = questions[step].key as keyof typeof responses;
    const newResponses = { ...responses, [currentKey]: value };
    setResponses(newResponses);
    
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(newResponses);
    }
  };

  const progress = ((step + 1) / questions.length) * 100;
  const currentQuestion = questions[step];
  const Icon = currentQuestion.icon;

  return (
    <Dialog 
      open={true} 
      onClose={onSkip}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 4, p: 1, overflow: 'hidden' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Daily Sync</Typography>
          <Typography variant="caption" color="text.secondary">Step {step + 1} of {questions.length}</Typography>
        </Box>
        <IconButton onClick={onSkip} size="small" sx={{ bgcolor: 'action.hover' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mx: 3, height: 4, borderRadius: 2, bgcolor: 'action.hover' }} 
      />

      <DialogContent sx={{ mt: 4, mb: 2 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Stack spacing={3} alignItems="center" textAlign="center">
              <Avatar 
                sx={{ 
                  width: 80, 
                  height: 80, 
                  bgcolor: 'primary.container', 
                  color: currentQuestion.color,
                  boxShadow: `0 8px 24px -8px ${theme.palette.primary.main}40`
                }}
              >
                <Icon size={40} />
              </Avatar>
              
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.01em' }}>
                  {currentQuestion.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                  {currentQuestion.subtitle}
                </Typography>
              </Box>
              
              <Stack direction="row" spacing={2} sx={{ width: '100%', pt: 2 }}>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={() => handleAnswer(false)}
                  sx={{ 
                    py: 1.5, 
                    borderRadius: 10,
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  Nope
                </Button>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={() => handleAnswer(true)}
                  sx={{ 
                    py: 1.5, 
                    borderRadius: 10,
                    boxShadow: theme.shadows[4]
                  }}
                >
                  Yes, log it
                </Button>
              </Stack>
            </Stack>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
