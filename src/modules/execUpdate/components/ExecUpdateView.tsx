import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PageHeader from '../../../common/components/PageHeader';
import MetricCard from '../../../common/components/MetricCard';
import CopyButton from '../../../common/components/CopyButton';
import { EmptyState } from '../../../common/components/States';
import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { computeDashboardMetrics } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { saveExecUpdate, saveProjectHealth, useProjectMeta, useRecentExecUpdates } from '../hooks/useExecUpdate';
import { buildExecUpdate, currentProjects, dealsSince, designerNames } from '../lib/buildExecUpdate';
import { ExecUpdateManual, HEALTH_OPTIONS, HealthStatus } from '../types';

const twoWeeksAgo = () => {
  const d = new Date(Date.now() - 14 * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ExecUpdateView({ staffList, projectsList, salesList }: { staffList: StaffMember[]; projectsList: Project[]; salesList: Sale[] }) {
  const meta = useProjectMeta();
  const recent = useRecentExecUpdates();
  const last = recent.data[0];

  const [since, setSince] = useState(twoWeeksAgo());
  const [manual, setManual] = useState<ExecUpdateManual>({ takeaways: ['', '', '', '', ''], recruiting: '', initiatives: '', departmentNotes: '' });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default the window to "since the last update" and carry its initiatives forward.
  const lastId = last?.id;
  useEffect(() => {
    if (!last) return;
    setSince(last.createdAt.slice(0, 10));
    setManual(m => ({ ...m, initiatives: m.initiatives || last.manual.initiatives, recruiting: m.recruiting || last.manual.recruiting }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  const metrics = useMemo(() => computeDashboardMetrics(projectsList, salesList, staffList), [projectsList, salesList, staffList]);
  const deals = useMemo(() => dealsSince(metrics.fySalesList, since), [metrics.fySalesList, since]);
  const projects = useMemo(() => currentProjects(metrics.fyProjectsList), [metrics.fyProjectsList]);
  const metaById = useMemo(() => new Map(meta.data.map(m => [m.id, m])), [meta.data]);

  const closedDeals = deals.closed.filter(d => !excluded.has(d.id));
  const scopedDeals = deals.scoped.filter(d => !excluded.has(d.id));
  const text = buildExecUpdate({ date: new Date(), metrics, closedDeals, scopedDeals, projects, staff: staffList, meta: id => metaById.get(id), manual });

  const toggle = (id: string) => {
    const next = new Set(excluded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExcluded(next);
  };
  const setTakeaway = (i: number, v: string) => setManual({ ...manual, takeaways: manual.takeaways.map((t, j) => (j === i ? v : t)) });
  const missingHealth = projects.filter(p => !metaById.get(p.id)?.healthStatus).length;

  const DealList = ({ title, rows }: { title: string; rows: Sale[] }) => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {rows.length === 0 ? <Typography variant="body2" color="text.secondary">None with a last-contact date since {since}.</Typography> : rows.map(d => (
        <FormControlLabel key={d.id} sx={{ display: 'flex' }} control={<Checkbox size="small" checked={!excluded.has(d.id)} onChange={() => toggle(d.id)} />}
          label={<Typography variant="body2">{d.client} <Typography component="span" variant="body2" color="text.secondary">· {formatUSD(d.projectedValue)} · {d.lastContactDate}</Typography></Typography>} />
      ))}
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Exec update" subtitle="Live numbers from HQ, formatted for Slack. Fill in the takeaways, recruiting line and initiatives." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Revenue since Feb 1" value={formatUSD(metrics.totalValue)} detail={`${metrics.goalProgress.toFixed(1)}% of $5M`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Monthly pace" value={`${metrics.monthlyPacePercentage.toFixed(0)}%`} detail={`${formatUSD(metrics.currentMonthlyPace)} / ${formatUSD(metrics.monthlyRevenueGoal)} per month`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Avg profitability" value={`${metrics.avgProfitability.toFixed(1)}%`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Pipeline" value={formatUSD(metrics.pipelineValue)} detail={`Utilization: FTE ${metrics.trends?.currentUtilFte ?? 0}% · Contractors ${metrics.trends?.currentUtilContractor ?? 0}%`} /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Top 5 takeaways</Typography>
              <Stack spacing={1.5}>
                {manual.takeaways.map((t, i) => (
                  <TextField key={i} size="small" label={`Takeaway ${i + 1}`} value={t} onChange={e => setTakeaway(i, e.target.value)} fullWidth />
                ))}
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Department updates</Typography>
              <Stack spacing={2}>
                <TextField size="small" label="Deals since" type="date" value={since} onChange={e => setSince(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 220 }}
                  helperText={last ? `Last update saved ${new Date(last.createdAt).toLocaleDateString()}` : 'Defaults to two weeks ago'} />
                <Alert severity="info" variant="outlined">
                  Sales have no closed-on date, so deals are matched on their last-contact date. Untick anything that isn't new.
                </Alert>
                <DealList title="New deals closed" rows={deals.closed} />
                <DealList title="Scoped, not yet closed" rows={deals.scoped} />
                <TextField size="small" label="Recruiting callout" value={manual.recruiting} onChange={e => setManual({ ...manual, recruiting: e.target.value })} fullWidth />
                <TextField size="small" label="Other department notes" value={manual.departmentNotes} onChange={e => setManual({ ...manual, departmentNotes: e.target.value })}
                  fullWidth multiline minRows={2} helperText="One per line" />
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Project updates</Typography>
                {missingHealth > 0 && <Typography variant="body2" color="warning.main">{missingHealth} without a health status</Typography>}
              </Stack>
              {projects.length === 0 ? <EmptyState title="No active projects" description="Projects that haven't finished yet appear here." /> : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Project</TableCell>
                        <TableCell>Line of business</TableCell>
                        <TableCell>Designer</TableCell>
                        <TableCell width={150}>Health</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {projects.map(p => {
                        const m = metaById.get(p.id);
                        return (
                          <TableRow key={p.id}>
                            <TableCell sx={{ fontWeight: 500 }}>{p.client}</TableCell>
                            <TableCell>{p.lob}</TableCell>
                            <TableCell>{designerNames(p, staffList)}</TableCell>
                            <TableCell>
                              <TextField select size="small" fullWidth value={m?.healthStatus || ''}
                                onChange={e => saveProjectHealth(p.id, { healthStatus: (e.target.value || null) as HealthStatus | null }).catch(err => setError(err.message))}>
                                <MenuItem value=""><em>Not set</em></MenuItem>
                                {HEALTH_OPTIONS.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField size="small" fullWidth defaultValue={m?.healthNote || ''} placeholder="Optional"
                                onBlur={e => e.target.value !== (m?.healthNote || '') && saveProjectHealth(p.id, { healthNote: e.target.value }).catch(err => setError(err.message))} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>New internal initiatives</Typography>
              <TextField label="Initiatives" value={manual.initiatives} onChange={e => setManual({ ...manual, initiatives: e.target.value })} fullWidth multiline minRows={3} helperText="One per line" />
            </CardContent></Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined" sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6">Slack post</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={async () => {
                    setError(null);
                    try {
                      await saveExecUpdate({ since, text, manual, includedClosed: closedDeals.map(d => d.id), includedScoped: scopedDeals.map(d => d.id) });
                      setSaved(new Date().toLocaleTimeString());
                    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                  }}>Save copy</Button>
                  <CopyButton text={text} variant="contained" />
                </Stack>
              </Stack>
              {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
              {saved && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Saved at {saved}</Typography>}
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', typography: 'body2', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, maxHeight: '70vh', overflow: 'auto' }}>
                {text}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
