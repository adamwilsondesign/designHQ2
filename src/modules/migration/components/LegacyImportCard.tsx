import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { connectLegacy, disconnectLegacy, LEGACY_AUTH_DOMAIN, LEGACY_PROJECT_ID, LegacySignInMode, readLegacy, setLegacySignInMode } from '../lib/legacyClient';
import { PlannedWrite, planImport, PlanRow } from '../lib/plan';

type Step = 'idle' | 'connecting' | 'reading' | 'ready' | 'importing' | 'done';

const explain = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('unauthorized-domain')) {
    return `The old project doesn't allow sign-in from ${window.location.hostname} yet. In the Firebase console for the OLD project (${LEGACY_PROJECT_ID}), go to Authentication → Settings → Authorized domains and add ${window.location.hostname}, then try again.`;
  }
  if (/redirect_uri|invalid_request|400/.test(msg)) {
    return `Google rejected the sign-in address. For "Connect via this site", add https://${window.location.host}/__/auth/handler as an authorised redirect URI on the old project's OAuth client (see the steps in Admin help).`;
  }
  if (msg.includes('popup')) return 'The sign-in window was blocked or closed. Allow popups for this site and try again.';
  if (/permission|insufficient/i.test(msg)) return `The old database refused to share its data with this account (${msg}). Sign in with the account you use for the old DesignHQ.`;
  return msg;
};

// One-time copy of the old DesignHQ data into this project. Reads the old
// database only; never overwrites anything that already exists here.
export default function LegacyImportCard() {
  const [step, setStep] = useState<Step>('idle');
  const [account, setAccount] = useState('');
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [writes, setWrites] = useState<PlannedWrite[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connectAndPreview = async (via: LegacySignInMode) => {
    setError(null);
    setLegacySignInMode(via);
    try {
      setStep('connecting');
      setAccount(await connectLegacy());
      setStep('reading');
      const legacy = await readLegacy();
      const names = ['users', 'staff', 'projects', 'sales', 'staffProfiles', 'projectMeta'];
      const existingIds: Record<string, Set<string>> = {};
      let existingUserEmails = new Set<string>();
      for (const name of names) {
        const snap = await getDocs(collection(db, name));
        existingIds[name] = new Set(snap.docs.map(d => d.id));
        if (name === 'users') existingUserEmails = new Set(snap.docs.map(d => String(d.data().email || '').toLowerCase()));
      }
      const plan = planImport({ legacy, existingIds, existingUserEmails });
      setRows(plan.rows);
      setWrites(plan.writes);
      setStep('ready');
    } catch (e) {
      setError(explain(e));
      setStep('idle');
    }
  };

  const runImport = async () => {
    setError(null);
    setStep('importing');
    try {
      for (let i = 0; i < writes.length; i += 400) {
        const batch = writeBatch(db);
        for (const w of writes.slice(i, i + 400)) batch.set(doc(db, w.collection, w.id), w.data);
        await batch.commit();
        setProgress(Math.min(writes.length, i + 400));
      }
      await disconnectLegacy();
      setStep('done');
    } catch (e) {
      setError(`${explain(e)} Nothing already copied is lost; you can run the import again and it will continue where it stopped.`);
      setStep('ready');
    }
  };

  return (
    <Card variant="outlined" sx={{ mt: 4 }}>
      <CardContent>
        <Typography variant="h6">Import from the old DesignHQ</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Copies staff, projects, sales and users from the old Google AI Studio version. The old database is only read, never changed, and
          nothing that already exists here is overwritten, so it's safe to run more than once. Old accounts become invites: each person keeps
          their role and staff link when they first sign in here.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {(step === 'idle' || step === 'connecting' || step === 'reading') && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" onClick={() => connectAndPreview('direct')} disabled={step !== 'idle'}>
              {step === 'idle' ? 'Connect to old DesignHQ' : step === 'connecting' ? 'Signing in…' : 'Reading old data…'}
            </Button>
            <Button onClick={() => connectAndPreview('proxy')} disabled={step !== 'idle'}>Connect via this site</Button>
          </Stack>
        )}
        {step === 'idle' && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Sign in with the Google account you use for the old DesignHQ. If your network blocks {LEGACY_AUTH_DOMAIN}, use “Connect via this site”.
          </Typography>
        )}

        {(step === 'ready' || step === 'importing' || step === 'done') && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>Read from the old project as <strong>{account}</strong>.</Typography>
            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Collection</TableCell>
                  <TableCell align="right">In old DesignHQ</TableCell>
                  <TableCell align="right">Already here</TableCell>
                  <TableCell align="right">{step === 'done' ? 'Imported' : 'Will import'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.collection}>
                    <TableCell>{r.collection}</TableCell>
                    <TableCell align="right">{r.inOld}</TableCell>
                    <TableCell align="right">{r.alreadyHere}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{r.toImport}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {step === 'importing' && <LinearProgress variant="determinate" value={writes.length ? (progress / writes.length) * 100 : 100} sx={{ mb: 2 }} />}
            {step === 'done' ? (
              <Alert severity="success">
                Imported {writes.length} records. Your dashboard updates automatically. Link anyone who isn't matched to a staff record in the table above.
              </Alert>
            ) : writes.length === 0 ? (
              <Alert severity="info">Everything from the old DesignHQ is already here.</Alert>
            ) : (
              <Button variant="contained" onClick={runImport} disabled={step === 'importing'}>
                {step === 'importing' ? `Importing… ${progress} / ${writes.length}` : `Import ${writes.length} records`}
              </Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
