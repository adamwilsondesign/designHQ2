import React from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';

export function EmptyState({ title, description, action }: { title: string; description: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 480, mx: 'auto' }}>{description}</Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Paper>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }} role="status">
      <CircularProgress size={24} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert severity="error" action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
      {message}
    </Alert>
  );
}
