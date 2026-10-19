import React, { useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { callFunction } from '../../../common/firebaseHelpers';

interface AccountStatus { account: 'lazer' | 'polyform' | 'personal'; connected: boolean; email: string | null }

// Connection status for the Lazer Google account used to book meetings.
export function useGoogleAccounts() {
  const [accounts, setAccounts] = useState<AccountStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    callFunction<object, { accounts: AccountStatus[] }>('googleAccountsStatus', {})
      .then(r => { setAccounts(r.accounts); setError(null); })
      .catch(e => setError(e.message));
  useEffect(() => { refresh(); }, []);
  return { accounts, error, refresh };
}

export async function connectGoogle(account: AccountStatus['account']) {
  const { url } = await callFunction<object, { url: string }>('googleAuthUrl', { account });
  window.location.href = url;
}

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
