import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { connectGoogle, useGoogleAccounts } from '../../../common/google';

// Shows which Lazer Google account meetings are booked on.
export default function LazerCalendarStatus() {
  const { accounts, error } = useGoogleAccounts();
  const lazer = accounts?.find(a => a.account === 'lazer');
  if (error) return <Alert severity="warning">Calendar status unavailable: {error}</Alert>;
  if (!accounts) return null;
  if (lazer?.connected) return <Typography variant="body2" color="text.secondary">Booking on {lazer.email}</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" color="text.secondary">Lazer calendar not connected</Typography>
      <Button size="small" variant="outlined" onClick={() => connectGoogle('lazer')}>Connect</Button>
    </Stack>
  );
}
