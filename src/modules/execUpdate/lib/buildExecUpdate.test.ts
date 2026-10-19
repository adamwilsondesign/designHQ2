import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { computeDashboardMetrics } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { buildExecUpdate, currentProjects, dealsSince } from './buildExecUpdate';

const base = { lob: 'Commerce', type: 'Website', clientLocation: 'NYC', billedRate: 150 };
const staff: StaffMember[] = [
  { id: 's1', name: 'Ann', location: '', timezone: '', employmentType: 'Full-Time', hourlyCost: 60, skills: [] },
  { id: 's2', name: 'Cal', location: '', timezone: '', employmentType: 'Contractor', hourlyCost: 90, skills: [] },
];
const projects: Project[] = [
  { ...base, id: 'p1', client: 'Acme', status: 'Open', totalHours: 100, totalValue: 50000, startDate: '2026-09-01', finishDate: '2026-12-01', assignedStaffIds: ['s1', 's2'] },
  { ...base, id: 'p2', client: 'Done Co', status: 'Closed', totalHours: 50, totalValue: 20000, startDate: '2026-03-01', finishDate: '2026-04-01', assignedStaffIds: ['s1'] },
];
const sales: Sale[] = [
  { ...base, id: 'x1', client: 'NewWin', status: 'Closed', projectedValue: 40000, projectedHours: 1, projectedRate: 1, lastContactDate: '2026-10-10' },
  { ...base, id: 'x2', client: 'OldWin', status: 'Closed', projectedValue: 10000, projectedHours: 1, projectedRate: 1, lastContactDate: '2026-08-10' },
  { ...base, id: 'x3', client: 'Scoped', status: 'In Negotiation', projectedValue: 75000, projectedHours: 1, projectedRate: 1, lastContactDate: '2026-10-12' },
];

describe('exec update', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T10:00:00')); });
  afterEach(() => vi.useRealTimers());

  it('selects deals by last contact date and current projects', () => {
    const { closed, scoped } = dealsSince(sales, '2026-10-01');
    expect(closed.map(s => s.id)).toEqual(['x1']);
    expect(scoped.map(s => s.id)).toEqual(['x3']);
    expect(currentProjects(projects).map(p => p.id)).toEqual(['p1']);
  });

  it('uses the shared metrics verbatim and produces the four blocks', () => {
    const metrics = computeDashboardMetrics(projects, sales, staff, new Date());
    const { closed, scoped } = dealsSince(sales, '2026-10-01');
    const text = buildExecUpdate({
      date: new Date(),
      metrics,
      closedDeals: closed,
      scopedDeals: scoped,
      projects: currentProjects(projects),
      staff,
      meta: id => (id === 'p1' ? { id, healthStatus: 'At Risk', healthNote: 'Scope creep' } : undefined),
      manual: { takeaways: ['One', 'Two', '', 'Four', 'Five'], recruiting: 'Hiring a senior PD', initiatives: 'Design system v2\nAI workflow pilot', departmentNotes: '' },
    });
    expect(text).toContain('*Top 5 takeaways*\n1. One\n2. Two\n3. _TBD_');
    expect(text).toContain(`Revenue since Feb 1: *${formatUSD(metrics.totalValue)}*`);
    expect(text).toContain(`Pipeline: ${formatUSD(metrics.pipelineValue)}`);
    expect(text).toContain(`Average profitability: ${metrics.avgProfitability.toFixed(1)}%`);
    expect(text).toContain('New deals closed: NewWin ($40,000)');
    expect(text).toContain('Scoped, not yet closed: Scoped ($75,000)');
    expect(text).toContain('• Recruiting: Hiring a senior PD');
    expect(text).toContain('• *Acme* — Commerce · Ann, Cal · :large_yellow_circle: At Risk — Scope creep');
    expect(text).toContain('*New internal initiatives*\n• Design system v2\n• AI workflow pilot');
  });
});
