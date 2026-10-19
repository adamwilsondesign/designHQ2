import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { DashboardMetrics, isOpenPipelineSale, parseLocalDate } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { ExecUpdateManual, HealthStatus, ProjectMeta } from '../types';

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
// active/inactive schedule), earliest start first.
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
  const names = (p.assignedStaffIds || []).map(id => staff.find(s => s.id === id)?.name).filter(Boolean) as string[];
  return names.length ? names.join(', ') : 'Unassigned';
}

const HEALTH_EMOJI: Record<HealthStatus, string> = {
  'On Track': ':large_green_circle:',
  'At Risk': ':large_yellow_circle:',
  'Off Track': ':red_circle:',
};

const pct = (n: number) => `${n.toFixed(1)}%`;
const lines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);
const dealList = (deals: Sale[]) => (deals.length ? deals.map(d => `${d.client} (${formatUSD(d.projectedValue)})`).join(', ') : 'None');

export interface ExecUpdateInput {
  date: Date;
  metrics: DashboardMetrics;
  closedDeals: Sale[];
  scopedDeals: Sale[];
  projects: Project[];
  staff: StaffMember[];
  meta: (projectId: string) => ProjectMeta | undefined;
  manual: ExecUpdateManual;
}

// Slack mrkdwn, copy-paste ready.
export function buildExecUpdate(i: ExecUpdateInput): string {
  const m = i.metrics;
  const takeaways = i.manual.takeaways.map(t => t.trim());
  const out: string[] = [];

  out.push(`*Design Department Update — ${i.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}*`, '');

  out.push('*Top 5 takeaways*');
  takeaways.forEach((t, n) => out.push(`${n + 1}. ${t || '_TBD_'}`));
  out.push('');

  out.push('*Department updates*');
  out.push(`• Revenue since Feb 1: *${formatUSD(m.totalValue)}* (${pct(m.goalProgress)} of the $5M goal)`);
  out.push(`• Monthly pace: ${formatUSD(m.currentMonthlyPace)}/mo vs ${formatUSD(m.monthlyRevenueGoal)}/mo needed (${m.monthlyPacePercentage.toFixed(0)}% of pace)`);
  out.push(`• Average profitability: ${pct(m.avgProfitability)}`);
  out.push(`• Pipeline: ${formatUSD(m.pipelineValue)}`);
  out.push(`• Utilization this week: FTE ${m.trends?.currentUtilFte ?? 0}% · Contractors ${m.trends?.currentUtilContractor ?? 0}%`);
  out.push(`• New deals closed: ${dealList(i.closedDeals)}`);
  out.push(`• Scoped, not yet closed: ${dealList(i.scopedDeals)}`);
  if (i.manual.recruiting.trim()) out.push(`• Recruiting: ${i.manual.recruiting.trim()}`);
  lines(i.manual.departmentNotes).forEach(l => out.push(`• ${l}`));
  out.push('');

  out.push('*Project updates*');
  if (i.projects.length === 0) out.push('• No active projects');
  i.projects.forEach(p => {
    const h = i.meta(p.id)?.healthStatus;
    const note = i.meta(p.id)?.healthNote?.trim();
    out.push(`• *${p.client}* — ${p.lob} · ${designerNames(p, i.staff)} · ${h ? `${HEALTH_EMOJI[h]} ${h}` : 'Health not set'}${note ? ` — ${note}` : ''}`);
  });
  out.push('');

  out.push('*New internal initiatives*');
  const inits = lines(i.manual.initiatives);
  if (inits.length === 0) out.push('• _TBD_');
  inits.forEach(l => out.push(`• ${l}`));

  return out.join('\n');
}
