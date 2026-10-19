import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { DashboardMetrics, isOpenPipelineSale, parseLocalDate } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { ExecSnapshot, ExecUpdateManual, ProjectMeta } from '../types';

// Builds Adam's Slack post in the exact shape he uses (see the test for a
// full example). Department numbers come from lib/metrics; deltas compare
// with the snapshot saved on the previous update.

// Deals "since" a date use Sale.lastContactDate: it is the only date a sale
// carries. There is no closed-on date in the data model, so the UI shows these
// as suggestions Adam ticks on or off.
export function dealsSince(sales: Sale[], since: string) {
  const after = (s: Sale) => !!s.lastContactDate && s.lastContactDate >= since;
  return {
    closed: sales.filter(s => s.status === 'Closed' && after(s)).sort((a, b) => b.projectedValue - a.projectedValue),
    scoped: sales.filter(s => isOpenPipelineSale(s) && after(s)).sort((a, b) => b.projectedValue - a.projectedValue),
  };
}

// Projects that have not finished yet (same split as the Dashboard's
// active/inactive schedule), earliest start first. Includes ones not started.
export function currentProjects(projects: Project[], now = new Date()) {
  return projects
    .filter(p => {
      if (!p.finishDate) return true;
      const end = parseLocalDate(p.finishDate);
      end.setHours(23, 59, 59, 999);
      return end >= now;
    })
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}

export function designerNames(p: Project, staff: StaffMember[]) {
  return (p.assignedStaffIds || [])
    .map(id => staff.find(s => s.id === id)?.name.split(' ')[0])
    .filter(Boolean) as string[];
}

// People on a project that is running today (same "active" test the
// Dashboard uses for FTEs on bench). This is a headcount, unlike the
// hours-based utilization percentages on the Dashboard.
export function allocatedHeadcount(projects: Project[], staff: StaffMember[], now = new Date()) {
  const active = projects.filter(p => {
    if (!p.startDate || !p.finishDate) return false;
    const start = parseLocalDate(p.startDate);
    const end = parseLocalDate(p.finishDate);
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now;
  });
  const busy = new Set(active.flatMap(p => p.assignedStaffIds || []));
  const fte = staff.filter(s => s.employmentType === 'Full-Time');
  const contractors = staff.filter(s => s.employmentType !== 'Full-Time');
  return {
    fte: { allocated: fte.filter(s => busy.has(s.id)).length, total: fte.length },
    contractors: { allocated: contractors.filter(s => busy.has(s.id)).length, total: contractors.length },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
export const postDate = (d: Date) => `${MONTHS[d.getMonth()]}.${d.getDate()}`;

// $24K, $128K, $1.2M
export function compactUSD(n: number) {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return formatUSD(n);
}

const signedUSD = (d: number) => `${d >= 0 ? '+' : '-'}${formatUSD(Math.abs(d))}`;
const signed = (d: number, digits: number) => `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(digits)}%`;
const pctOf = (a: number, b: number) => (b > 0 ? Math.floor((a / b) * 100) : 0);
const lines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

export function snapshotOf(m: DashboardMetrics): ExecSnapshot {
  return { revenue: m.totalValue, avgProfitability: m.avgProfitability, pipeline: m.pipelineValue, pacePct: m.monthlyPacePercentage };
}

export function dealsLabel(since: string, now = new Date()) {
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  if (since === firstOfMonth) return 'this month';
  return `since ${postDate(parseLocalDate(since))}`;
}

export interface ExecUpdateInput {
  date: Date;
  metrics: DashboardMetrics;
  previous: ExecSnapshot | null;
  closedDeals: Sale[];
  scopedDeals: Sale[];
  dealsLabel: string;
  headcount: ReturnType<typeof allocatedHeadcount>;
  projects: Project[];
  staff: StaffMember[];
  meta: (projectId: string) => ProjectMeta | undefined;
  manual: ExecUpdateManual;
}

// Plain text, copy-paste ready for Slack.
export function buildExecUpdate(i: ExecUpdateInput): string {
  const m = i.metrics;
  const prev = i.previous;
  const out: string[] = [];
  const delta = (s: string) => (prev ? ` (${s})` : '');

  out.push(`${postDate(i.date)} Design Dept. Update  @channel`, '');

  out.push('Top 5 Takeaways this Sprint:', '');
  i.manual.takeaways.forEach((t, n) => out.push(`${n + 1}- ${t.trim() || 'TBD'}`, ''));
  out.push('');

  out.push('--------------- Dept. Updates ---------------', '');
  out.push('Money:');
  out.push(`Total Dept. Rev (since Feb.01) - ${formatUSD(m.totalValue)}${delta(signedUSD(m.totalValue - (prev?.revenue ?? 0)))}`);
  out.push(`Avg. Profitability: ${m.avgProfitability.toFixed(1)}%${delta(signed(m.avgProfitability - (prev?.avgProfitability ?? 0), 1))}`);
  out.push(`Pipeline Value: ${formatUSD(m.pipelineValue)}${delta(signedUSD(m.pipelineValue - (prev?.pipeline ?? 0)))}`);
  out.push('');
  out.push(`Monthly pace for $5M revenue goal: ${m.monthlyPacePercentage.toFixed(0)}%${delta(signed(m.monthlyPacePercentage - (prev?.pacePct ?? 0), 0))}`);
  out.push('');

  const h = i.headcount;
  out.push('Utilization:');
  out.push(`FTEs - ${h.fte.allocated} / ${h.fte.total} (${pctOf(h.fte.allocated, h.fte.total)}%)`);
  lines(i.manual.utilizationNote).forEach(l => out.push(l));
  out.push(`Contractors - ${h.contractors.allocated} / ${h.contractors.total} (${pctOf(h.contractors.allocated, h.contractors.total)}%)`);
  out.push('');

  const closedTotal = i.closedDeals.reduce((s, d) => s + d.projectedValue, 0);
  out.push(`New Deals Closed (${compactUSD(closedTotal)} ${i.dealsLabel}) : `);
  if (i.closedDeals.length === 0) out.push('None');
  i.closedDeals.forEach(d => out.push(`${d.client} (${compactUSD(d.projectedValue)})`));
  out.push('');

  out.push('New Deals Scoped not Closed: ');
  if (i.scopedDeals.length === 0) out.push('None');
  i.scopedDeals.forEach(d => out.push(`${d.client} (${compactUSD(d.projectedValue)})`));
  out.push('');

  if (i.manual.recruiting.trim()) {
    out.push('Recruiting: ');
    lines(i.manual.recruiting).forEach(l => out.push(l));
    out.push('');
  }
  if (lines(i.manual.departmentNotes).length) {
    lines(i.manual.departmentNotes).forEach(l => out.push(l));
    out.push('');
  }

  out.push('--------------- Project Updates & Allocations ------', '');
  out.push('Name - LOB - Designer - Health', '');
  lines(i.manual.extraProjectLines).forEach(l => out.push(l));
  i.projects.forEach(p => {
    const meta = i.meta(p.id);
    const parts = [p.client, p.lob];
    const names = designerNames(p, i.staff);
    if (names.length) parts.push(names.join(', '));
    // Health is called out only when it isn't on track, as in Adam's posts.
    if (meta?.healthStatus && meta.healthStatus !== 'On Track') parts.push(meta.healthStatus);
    if (meta?.healthNote?.trim()) parts.push(meta.healthNote.trim());
    out.push(parts.join(' - '));
  });
  out.push('', '', '');

  out.push('New Internal Initiatives------------------', '');
  const inits = lines(i.manual.initiatives);
  if (inits.length === 0) out.push('* TBD');
  inits.forEach(l => out.push(`* ${l.replace(/^[*•-]\s*/, '')}`, '', ''));

  return out.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd();
}
