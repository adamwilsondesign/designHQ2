import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, Sale, StaffMember } from '../../../lib/mockData';
import { computeDashboardMetrics } from '../../../lib/metrics';
import { formatUSD } from '../../../lib/utils';
import { EMPTY_MANUAL } from '../types';
import { allocatedHeadcount, buildExecUpdate, compactUSD, currentProjects, dealsLabel, dealsSince, postDate, snapshotOf } from './buildExecUpdate';

const base = { lob: 'Commerce', type: 'Website', clientLocation: 'NYC', billedRate: 150 };
const staff: StaffMember[] = [
  { id: 's1', name: 'Jinny Gantumur', location: '', timezone: '', employmentType: 'Full-Time', hourlyCost: 60, skills: [] },
  { id: 's2', name: 'Neff Loria', location: '', timezone: '', employmentType: 'Full-Time', hourlyCost: 60, skills: [] },
  { id: 's3', name: 'Eivan K', location: '', timezone: '', employmentType: 'Contractor', hourlyCost: 90, skills: [] },
  { id: 's4', name: 'Stefan Rauch', location: '', timezone: '', employmentType: 'Contractor', hourlyCost: 90, skills: [] },
];
const projects: Project[] = [
  { ...base, id: 'p1', client: 'Goop', status: 'Open', totalHours: 100, totalValue: 128000, startDate: '2026-09-01', finishDate: '2026-12-01', assignedStaffIds: ['s1'] },
  { ...base, id: 'p2', client: 'Deloitte', lob: 'AI', status: 'Open', totalHours: 100, totalValue: 52000, startDate: '2026-09-15', finishDate: '2026-11-30', assignedStaffIds: ['s3'] },
  { ...base, id: 'p3', client: 'RBCX', lob: 'AI', status: 'Open', totalHours: 100, totalValue: 101000, startDate: '2026-11-01', finishDate: '2027-01-15', assignedStaffIds: ['s4'] },
  { ...base, id: 'p4', client: 'TTW', lob: 'AI', status: 'Open', totalHours: 10, totalValue: 10000, startDate: '2026-11-10', finishDate: '2026-12-15', assignedStaffIds: [] },
  { ...base, id: 'p5', client: 'Old', status: 'Closed', totalHours: 50, totalValue: 20000, startDate: '2026-03-01', finishDate: '2026-04-01', assignedStaffIds: ['s1'] },
];
const sale = (id: string, client: string, status: Sale['status'], value: number, last: string): Sale =>
  ({ ...base, id, client, status, projectedValue: value, projectedHours: 1, projectedRate: 1, lastContactDate: last });
const sales: Sale[] = [
  sale('x1', 'CatBird', 'Closed', 24000, '2026-10-02'),
  sale('x2', 'Goop', 'Closed', 128000, '2026-10-05'),
  sale('x3', 'Old Win', 'Closed', 10000, '2026-08-10'),
  sale('x4', 'Figs', 'In Negotiation', 80000, '2026-10-12'),
  sale('x5', 'Sorel', 'Open', 80000, '2026-10-14'),
];

describe('exec update', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T10:00:00')); });
  afterEach(() => vi.useRealTimers());

  it('helpers format like the Slack post', () => {
    expect(postDate(new Date(2026, 8, 25))).toBe('Sept.25');
    expect(compactUSD(24000)).toBe('$24K');
    expect(compactUSD(340000)).toBe('$340K');
    expect(compactUSD(1001000)).toBe('$1M');
    expect(compactUSD(1250000)).toBe('$1.3M');
    expect(dealsLabel('2026-10-01')).toBe('this month');
    expect(dealsLabel('2026-10-05')).toBe('since Oct.5');
  });

  it('selects deals, current projects and headcount', () => {
    const { closed, scoped } = dealsSince(sales, '2026-10-01');
    expect(closed.map(s => s.client)).toEqual(['Goop', 'CatBird']);
    expect(scoped.map(s => s.client)).toEqual(['Figs', 'Sorel']);
    expect(currentProjects(projects).map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(allocatedHeadcount(projects, staff)).toEqual({ fte: { allocated: 1, total: 2 }, contractors: { allocated: 1, total: 2 } });
  });

  it("matches Adam's post layout, with deltas from the previous snapshot", () => {
    const metrics = computeDashboardMetrics(projects, sales, staff, new Date());
    const { closed, scoped } = dealsSince(sales, '2026-10-01');
    const previous = { revenue: metrics.totalValue - 552000, avgProfitability: metrics.avgProfitability + 0.2, pipeline: metrics.pipelineValue + 133000, pacePct: metrics.monthlyPacePercentage + 13 };
    const meta: Record<string, { id: string; healthStatus: 'On Track' | 'Not Started' }> = {
      p1: { id: 'p1', healthStatus: 'On Track' },
      p3: { id: 'p3', healthStatus: 'Not Started' },
      p4: { id: 'p4', healthStatus: 'Not Started' },
    };
    const text = buildExecUpdate({
      date: new Date(2026, 8, 25),
      metrics,
      previous,
      closedDeals: closed,
      scopedDeals: scoped,
      dealsLabel: dealsLabel('2026-10-01'),
      headcount: allocatedHeadcount(projects, staff),
      projects: currentProjects(projects),
      staff,
      meta: id => meta[id],
      manual: {
        ...EMPTY_MANUAL,
        takeaways: ['Closed & Kicked Off Goop', 'Maintaining pipeline', '', '', ''],
        recruiting: 'Continuing to hunt for Shopify expert commerce designers!!!',
        utilizationNote: '(Neff = internal)',
        extraProjectLines: 'Lazer Brand & Site Update - Neff',
        initiatives: 'Website & Brand updates underway!\n* Shopify Design System Standard',
      },
    });

    const expected = [
      'Sept.25 Design Dept. Update  @channel',
      '',
      'Top 5 Takeaways this Sprint:',
      '',
      '1- Closed & Kicked Off Goop',
      '',
      '2- Maintaining pipeline',
      '',
      '3- TBD',
    ];
    expect(text.split('\n').slice(0, expected.length)).toEqual(expected);
    expect(text).toContain('--------------- Dept. Updates ---------------\n\nMoney:\n');
    expect(text).toContain(`Total Dept. Rev (since Feb.01) - ${formatUSD(metrics.totalValue)} (+$552,000)`);
    expect(text).toContain(`Avg. Profitability: ${metrics.avgProfitability.toFixed(1)}% (-0.2%)`);
    expect(text).toContain(`Pipeline Value: ${formatUSD(metrics.pipelineValue)} (-$133,000)`);
    expect(text).toContain(`Monthly pace for $5M revenue goal: ${metrics.monthlyPacePercentage.toFixed(0)}% (-13%)`);
    expect(text).toContain('Utilization:\nFTEs - 1 / 2 (50%)\n(Neff = internal)\nContractors - 1 / 2 (50%)');
    expect(text).toContain('New Deals Closed ($152K this month) : \nGoop ($128K)\nCatBird ($24K)');
    expect(text).toContain('New Deals Scoped not Closed: \nFigs ($80K)\nSorel ($80K)');
    expect(text).toContain('Recruiting: \nContinuing to hunt for Shopify expert commerce designers!!!');
    expect(text).toContain([
      '--------------- Project Updates & Allocations ------',
      '',
      'Name - LOB - Designer - Health',
      '',
      'Lazer Brand & Site Update - Neff',
      'Goop - Commerce - Jinny',
      'Deloitte - AI - Eivan',
      'RBCX - AI - Stefan - Not Started',
      'TTW - AI - Not Started',
    ].join('\n'));
    expect(text).toContain('New Internal Initiatives------------------\n\n* Website & Brand updates underway!\n\n\n* Shopify Design System Standard');
  });

  it('omits deltas on the first update', () => {
    const metrics = computeDashboardMetrics(projects, sales, staff, new Date());
    const text = buildExecUpdate({
      date: new Date(), metrics, previous: null, closedDeals: [], scopedDeals: [], dealsLabel: 'this month',
      headcount: allocatedHeadcount(projects, staff), projects: [], staff, meta: () => undefined, manual: EMPTY_MANUAL,
    });
    expect(text).toContain(`Total Dept. Rev (since Feb.01) - ${formatUSD(metrics.totalValue)}\n`);
    expect(text).toContain('New Deals Closed ($0 this month) : \nNone');
    expect(snapshotOf(metrics).revenue).toBe(metrics.totalValue);
  });
});
