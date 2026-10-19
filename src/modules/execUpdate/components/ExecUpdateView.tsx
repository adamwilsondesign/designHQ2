import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import PageHeader from '../../../common/components/PageHeader';
import MetricCard from '../../../common/components/MetricCard';
import CopyButton from '../../../common/components/CopyButton';
import { EmptyState } from '../../../common/components/States';
import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { computeDashboardMetrics } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { saveExecUpdate, saveProjectHealth, useProjectMeta, useRecentExecUpdates } from '../hooks/useExecUpdate';
import { allocatedHeadcount, buildExecUpdate, currentProjects, dealsLabel, dealsSince, designerNames, snapshotOf } from '../lib/buildExecUpdate';
import { EMPTY_MANUAL, ExecUpdateManual, HEALTH_OPTIONS, HealthStatus } from '../types';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const firstOfMonth = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };

export default function ExecUpdateView({ staffList, projectsList, salesList }: { staffList: StaffMember[]; projectsList: Project[]; salesList: Sale[] }) {
  const meta = useProjectMeta();
  const recent = useRecentExecUpdates();
  const last = recent.data[0];

  const [windowMode, setWindowMode] = useState<'month' | 'last' | 'custom'>('month');
  const [customSince, setCustomSince] = useState(firstOfMonth());
  const [manual, setManual] = useState<ExecUpdateManual>(EMPTY_MANUAL);
  const [excludedDeals, setExcludedDeals] = useState<Set<string>>(new Set());
  const [excludedProjects, setExcludedProjects] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carry the slow-changing parts forward from the last saved update.
  const lastId = last?.id;
  useEffect(() => {
    if (!last) return;
    setManual(m => ({
      ...m,
      recruiting: m.recruiting || last.manual.recruiting || '',
      initiatives: m.initiatives || last.manual.initiatives || '',
      utilizationNote: m.utilizationNote || last.manual.utilizationNote || '',
      extraProjectLines: m.extraProjectLines || last.manual.extraProjectLines || '',
    }));
    setExcludedProjects(new Set(last.excludedProjects || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  const since = windowMode === 'month' ? firstOfMonth() : windowMode === 'last' && last ? last.createdAt.slice(0, 10) : customSince;

  const metrics = useMemo(() => computeDashboardMetrics(projectsList, salesList, staffList), [projectsList, salesList, staffList]);
  const deals = useMemo(() => dealsSince(metrics.fySalesList, since), [metrics.fySalesList, since]);
  const projects = useMemo(() => currentProjects(metrics.fyProjectsList), [metrics.fyProjectsList]);
  const headcount = useMemo(() => allocatedHeadcount(metrics.fyProjectsList, staffList), [metrics.fyProjectsList, staffList]);
  const metaById = useMemo(() => new Map(meta.data.map(m => [m.id, m])), [meta.data]);
  const previous = last?.snapshot || null;

  const closedDeals = deals.closed.filter(d => !excludedDeals.has(d.id));
  const scopedDeals = deals.scoped.filter(d => !excludedDeals.has(d.id));
  const includedProjects = projects.filter(p => !excludedProjects.has(p.id));
  const text = buildExecUpdate({
    date: new Date(), metrics, previous, closedDeals, scopedDeals, dealsLabel: dealsLabel(since), headcount,
    projects: includedProjects, staff: staffList, meta: id => metaById.get(id), manual,
  });

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };
  const setField = <K extends keyof ExecUpdateManual>(k: K, v: ExecUpdateManual[K]) => setManual({ ...manual, [k]: v });
  const setTakeaway = (i: number, v: string) => setField('takeaways', manual.takeaways.map((t, j) => (j === i ? v : t)));
  const delta = (now: number, before: number | undefined, fmt: (d: number) => string) =>
    previous && before != null ? `${now - before >= 0 ? '+' : '−'}${fmt(Math.abs(now - before))} since last update` : undefined;

  const DealList = ({ title, rows }: { title: string; rows: Sale[] }) => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {rows.length === 0 ? <Typography variant="body2" color="text.secondary">None with a last-contact date since {since}.</Typography> : rows.map(d => (
        <FormControlLabel key={d.id} sx={{ display: 'flex' }} control={<Checkbox size="small" checked={!excludedDeals.has(d.id)} onChange={() => toggle(excludedDeals, setExcludedDeals, d.id)} />}
          label={<Typography variant="body2">{d.client} <Typography component="span" variant="body2" color="text.secondary">· {formatUSD(d.projectedValue)} · last contact {d.lastContactDate}</Typography></Typography>} />
      ))}
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Exec update" subtitle="Live numbers from HQ in your Slack format. Fill in the takeaways, recruiting and initiatives." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Revenue since Feb 1" value={formatUSD(metrics.totalValue)} detail={delta(metrics.totalValue, previous?.revenue, formatUSD) || `${metrics.goalProgress.toFixed(1)}% of $5M`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Monthly pace" value={`${metrics.monthlyPacePercentage.toFixed(0)}%`} detail={delta(metrics.monthlyPacePercentage, previous?.pacePct, d => `${d.toFixed(0)} pts`) || `${formatUSD(metrics.currentMonthlyPace)} / ${formatUSD(metrics.monthlyRevenueGoal)} per month`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Avg profitability" value={`${metrics.avgProfitability.toFixed(1)}%`} detail={delta(metrics.avgProfitability, previous?.avgProfitability, d => `${d.toFixed(1)} pts`)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Pipeline" value={formatUSD(metrics.pipelineValue)} detail={delta(metrics.pipelineValue, previous?.pipeline, formatUSD)} /></Grid>
      </Grid>
      {!previous && (
        <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
          Changes like (+$552,000) appear once you've saved one update; each saved copy stores the numbers the next one compares against.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Top 5 takeaways this sprint</Typography>
              <Stack spacing={1.5}>
                {manual.takeaways.map((t, i) => (
                  <TextField key={i} size="small" label={`Takeaway ${i + 1}`} value={t} onChange={e => setTakeaway(i, e.target.value)} fullWidth />
                ))}
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Dept. updates</Typography>
              <Stack spacing={2}>
                <TextField size="small" label="Utilization note" value={manual.utilizationNote} onChange={e => setField('utilizationNote', e.target.value)} fullWidth
                  helperText={`Printed under the FTE line, e.g. "(Neff = internal)". Today: FTEs ${headcount.fte.allocated} / ${headcount.fte.total}, contractors ${headcount.contractors.allocated} / ${headcount.contractors.total} on active projects.`} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Deals window</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                    <ToggleButtonGroup size="small" exclusive value={windowMode} onChange={(_, v) => v && setWindowMode(v)}>
                      <ToggleButton value="month">This month</ToggleButton>
                      <ToggleButton value="last" disabled={!last}>Since last update</ToggleButton>
                      <ToggleButton value="custom">Custom</ToggleButton>
                    </ToggleButtonGroup>
                    {windowMode === 'custom' && (
                      <TextField size="small" type="date" label="Since" value={customSince} onChange={e => setCustomSince(e.target.value)} InputLabelProps={{ shrink: true }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Sales have no closed-on date, so deals are matched on their last-contact date. Untick anything that isn't new.
                  </Typography>
                </Box>
                <DealList title="New deals closed" rows={deals.closed} />
                <DealList title="New deals scoped, not closed" rows={deals.scoped} />
                <TextField size="small" label="Recruiting" value={manual.recruiting} onChange={e => setField('recruiting', e.target.value)} fullWidth multiline minRows={2} />
                <TextField size="small" label="Other department lines" value={manual.departmentNotes} onChange={e => setField('departmentNotes', e.target.value)}
                  fullWidth multiline minRows={2} helperText="Optional. One per line." />
              </Stack>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>Project updates & allocations</Typography>
              <TextField size="small" label="Extra rows" value={manual.extraProjectLines} onChange={e => setField('extraProjectLines', e.target.value)}
                fullWidth multiline minRows={2} sx={{ mb: 2 }}
                helperText="Rows that aren't in Projects (e.g. internal work), printed first exactly as typed. One per line." />
              {projects.length === 0 ? <EmptyState title="No active projects" description="Projects that haven't finished yet appear here." /> : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>Name</TableCell>
                        <TableCell>LOB</TableCell>
                        <TableCell>Designer</TableCell>
                        <TableCell width={150}>Health</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {projects.map(p => {
                        const m = metaById.get(p.id);
                        const included = !excludedProjects.has(p.id);
                        return (
                          <TableRow key={p.id} sx={{ opacity: included ? 1 : 0.5 }}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={included} onChange={() => toggle(excludedProjects, setExcludedProjects, p.id)} inputProps={{ 'aria-label': `Include ${p.client}` }} />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500 }}>{p.client}</TableCell>
                            <TableCell>{p.lob}</TableCell>
                            <TableCell>{designerNames(p, staffList).join(', ') || '—'}</TableCell>
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
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Health only appears in the post when it isn't On Track.
              </Typography>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" gutterBottom>New internal initiatives</Typography>
              <TextField label="Initiatives" value={manual.initiatives} onChange={e => setField('initiatives', e.target.value)} fullWidth multiline minRows={3} helperText="One per line" />
            </CardContent></Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined" sx={{ position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h6">Slack post</Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={async () => {
                    setError(null);
                    try {
                      await saveExecUpdate({
                        since, text, manual, snapshot: snapshotOf(metrics),
                        includedClosed: closedDeals.map(d => d.id), includedScoped: scopedDeals.map(d => d.id), excludedProjects: [...excludedProjects],
                      });
                      setSaved(new Date().toLocaleTimeString());
                    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                  }}>Save copy</Button>
                  <CopyButton text={text} variant="contained" />
                </Stack>
              </Stack>
              {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
              {saved && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Saved at {saved}. The next update will show changes from these numbers.</Typography>}
              <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', typography: 'body2', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, maxHeight: '75vh', overflow: 'auto' }}>
                {text}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
