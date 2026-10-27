import React, { useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { connectGoogle, useGoogleAccounts } from '../../../common/google';

// Shows which Lazer Google account meetings are booked on.
export default function LazerCalendarStatus() {
  const { accounts, error } = useGoogleAccounts();
  const [connectError, setConnectError] = useState<string | null>(null);
  const lazer = accounts?.find(a => a.account === 'lazer');
  if (error) return <Alert severity="warning">Calendar status unavailable: {error}</Alert>;
  if (!accounts) return null;
  if (lazer?.connected) return <Typography variant="body2" color="text.secondary">Booking on {lazer.email}</Typography>;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" color="text.secondary">Lazer calendar not connected</Typography>
      <Button size="small" variant="outlined" onClick={() => { setConnectError(null); connectGoogle('lazer', 'meetings').catch(e => setConnectError(e.message)); }}>Connect</Button>
      {connectError && <Typography variant="caption" color="error">{connectError}</Typography>}
    </Stack>
  );
}
