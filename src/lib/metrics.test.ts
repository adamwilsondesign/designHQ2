import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, Sale, StaffMember } from './mockData';
import { calculateWeeklyTrends } from './trends';
import { computeDashboardMetrics } from './metrics';

// Reference implementation: the calculation block of components/views/Dashboard.tsx
// exactly as it existed before lib/metrics.ts was extracted (commit aa56e1b).
// Kept verbatim so any drift in lib/metrics.ts fails this test.
function originalDashboardCalc(projectsList: Project[], salesList: Sale[], staffList: StaffMember[]) {
  const fiscalYearStart = new Date('2026-02-01T00:00:00');

  // Filter out any data from before Feb 2026 for fiscal year
  const fyProjectsList = projectsList.filter(p => {
    if (!p.finishDate) return true;
    return new Date(p.finishDate) >= fiscalYearStart;
  });

  const fySalesList = salesList.filter(s => {
    if (!s.lastContactDate) return true;
    return new Date(s.lastContactDate) >= fiscalYearStart;
  });

  const getProjectCost = (project: Project) => {
    if (!project.assignedStaffIds || project.assignedStaffIds.length === 0) return 0;
    const assignedStaff = staffList.filter(s => project.assignedStaffIds.includes(s.id));
    if (assignedStaff.length === 0) return 0;
    
    let totalCost = 0;

    if (project.totalHours > 0) {
      // Distribute totalHours based on staff allocations
      const totalAllocation = assignedStaff.reduce((sum, s) => sum + (project.staffAllocations?.[s.id] ?? 100), 0);
      
      if (totalAllocation > 0) {
        assignedStaff.forEach(s => {
          const allocation = project.staffAllocations?.[s.id] ?? 100;
          const proportion = allocation / totalAllocation;
          const hoursWorked = project.totalHours * proportion;
          totalCost += hoursWorked * s.hourlyCost;
        });
        return totalCost;
      }
    }

    if (!project.startDate || !project.finishDate) {
      const avgHourlyRate = assignedStaff.reduce((sum, s) => sum + s.hourlyCost, 0) / assignedStaff.length;
      return avgHourlyRate * project.totalHours;
    }

    const pStart = new Date(project.startDate);
    const pEnd = new Date(project.finishDate);
    const durationWeeks = Math.max(1, (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

    assignedStaff.forEach(s => {
      const allocation = project.staffAllocations?.[s.id] ?? 100;
      const hoursPerWeek = (allocation / 100) * 40;
      totalCost += hoursPerWeek * durationWeeks * s.hourlyCost;
    });

    return totalCost;
  };

  // Calculate dynamic KPIs
  const totalValue = fyProjectsList.reduce((sum, p) => sum + p.totalValue, 0);
  const totalCost = fyProjectsList.reduce((sum, p) => sum + getProjectCost(p), 0);
  const totalProfit = totalValue - totalCost;
  const avgProfitability = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;
  
  const now = new Date();  // system time is mocked in the test
  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const activeProjectsCount = fyProjectsList.filter(p => {
    if (!p.startDate || !p.finishDate) return false;
    const start = parseLocalDate(p.startDate);
    const end = parseLocalDate(p.finishDate);
    // End date is inclusive, so we set it to end of day
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now;
  }).length;
  
  const totalDesigners = staffList.length;
  const pipelineValue = fySalesList.filter(s => s.status === 'Open' || s.status === 'In Negotiation').reduce((sum, s) => sum + s.projectedValue, 0);

  // New Sub-callout Calculations
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const projectsKickedOffThisMonth = fyProjectsList.filter(p => {
    if (!p.startDate) return false;
    const startDate = parseLocalDate(p.startDate);
    return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
  }).length;

  const activeSales = fySalesList.filter(s => s.status === 'Open' || s.status === 'In Negotiation');
  const projectsProjectedToCloseThisMonth = Math.round(activeSales.length * 0.33);
  const optimisticCloseValue = pipelineValue * 0.33;

  const trends = calculateWeeklyTrends(fyProjectsList, staffList);

  const benchBurn = trends?.benchBurn || 0;
  const netProfit = totalProfit - benchBurn;

  const revenueGoal = 5000000;
  const goalProgress = (totalValue / revenueGoal) * 100;

  // Timeline and Monthly Pace Calculations
  const fyStart = new Date(2026, 1, 1); // Feb 1, 2026
  const fyEnd = new Date(2027, 0, 31); // Jan 31, 2027
  const totalFyDays = (fyEnd.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedFyDays = (now.getTime() - fyStart.getTime()) / (1000 * 60 * 60 * 24);
  const timeProgress = Math.min(Math.max((elapsedFyDays / totalFyDays) * 100, 0), 100);
  
  const monthlyRevenueGoal = revenueGoal / 12;
  const monthsElapsed = elapsedFyDays / (365.25 / 12);
  const currentMonthlyPace = totalValue / Math.max(monthsElapsed, 1);
  const monthlyPacePercentage = (currentMonthlyPace / monthlyRevenueGoal) * 100;

  // FTEs on Bench Calculation
  const currentActiveProjects = fyProjectsList.filter(p => {
    if (!p.startDate || !p.finishDate) return false;
    const start = parseLocalDate(p.startDate);
    const end = parseLocalDate(p.finishDate);
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now;
  });

  const fullTimeStaff = staffList.filter(s => s.employmentType === 'Full-Time');
  const fullTimeStaffIds = new Set(fullTimeStaff.map(s => s.id));

  let totalAllocatedPercentage = 0;
  currentActiveProjects.forEach(p => {
    if (p.assignedStaffIds) {
      p.assignedStaffIds.forEach(staffId => {
        if (fullTimeStaffIds.has(staffId)) {
          const allocation = p.staffAllocations?.[staffId] ?? 100;
          totalAllocatedPercentage += allocation;
        }
      });
    }
  });

  const totalFTEs = fullTimeStaff.length;
  const allocatedFTEs = totalAllocatedPercentage / 100;
  const ftesOnBench = Math.max(0, totalFTEs - allocatedFTEs);

  return {
    totalValue, totalCost, totalProfit, avgProfitability, activeProjectsCount, totalDesigners,
    pipelineValue, projectsKickedOffThisMonth, projectsProjectedToCloseThisMonth, optimisticCloseValue,
    trends, benchBurn, netProfit, goalProgress, timeProgress, monthlyPacePercentage, ftesOnBench,
  };
}

const staff: StaffMember[] = [
  { id: 's1', name: 'A', location: 'Toronto', timezone: 'America/Toronto', employmentType: 'Full-Time', hourlyCost: 60, skills: [] },
  { id: 's2', name: 'B', location: 'London', timezone: 'Europe/London', employmentType: 'Full-Time', hourlyCost: 75, skills: [] },
  { id: 's3', name: 'C', location: 'NYC', timezone: 'America/New_York', employmentType: 'Contractor', hourlyCost: 90, skills: [] },
];

const base = { lob: 'Commerce', type: 'Website', clientLocation: 'New York', billedRate: 150 };
const projects: Project[] = [
  { ...base, id: 'p1', client: 'One', status: 'Open', totalHours: 200, totalValue: 40000, startDate: '2026-04-09', finishDate: '2026-05-09', assignedStaffIds: [], staffAllocations: {} },
  { ...base, id: 'p2', client: 'Two', status: 'Closed', totalHours: 120, totalValue: 18000, startDate: '2026-01-12', finishDate: '2026-02-03', assignedStaffIds: ['s1'] },
  { ...base, id: 'p3', client: 'Three', status: 'Open', totalHours: 0, totalValue: 120000, startDate: '2026-08-01', finishDate: '2026-12-15', assignedStaffIds: ['s1', 's3'], staffAllocations: { s1: 50, s3: 100 } },
  { ...base, id: 'p4', client: 'Four', status: 'Open', totalHours: 400, totalValue: 80000, startDate: '2026-09-20', finishDate: '2026-11-30', assignedStaffIds: ['s2', 's3'], staffAllocations: { s2: 75 } },
  { ...base, id: 'p5', client: 'Five', status: 'Closed', totalHours: 10, totalValue: 5000, startDate: '2025-06-01', finishDate: '2025-07-01', assignedStaffIds: ['s2'] },
  { ...base, id: 'p6', client: 'Six', status: 'Open', totalHours: 50, totalValue: 9000, startDate: '', finishDate: '', assignedStaffIds: ['s2'] },
];
const sales: Sale[] = [
  { ...base, id: 'x1', client: 'L1', status: 'Open', projectedValue: 50000, projectedHours: 300, projectedRate: 160, lastContactDate: '2026-10-01' },
  { ...base, id: 'x2', client: 'L2', status: 'In Negotiation', projectedValue: 90000, projectedHours: 500, projectedRate: 180, lastContactDate: '2026-09-10' },
  { ...base, id: 'x3', client: 'L3', status: 'Closed', projectedValue: 30000, projectedHours: 200, projectedRate: 150, lastContactDate: '2026-08-10' },
  { ...base, id: 'x4', client: 'L4', status: 'Open', projectedValue: 70000, projectedHours: 400, projectedRate: 175, lastContactDate: '2025-12-01' },
  { ...base, id: 'x5', client: 'L5', status: 'Lost', projectedValue: 10000, projectedHours: 50, projectedRate: 200, lastContactDate: '2026-05-01' },
];

describe('lib/metrics parity with the original Dashboard', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  for (const iso of ['2026-10-19T10:00:00', '2026-03-02T09:00:00', '2027-01-15T12:00:00']) {
    it(`matches at ${iso}`, () => {
      vi.setSystemTime(new Date(iso));
      const expected = originalDashboardCalc(projects, sales, staff);
      const actual = computeDashboardMetrics(projects, sales, staff, new Date());
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        expect(actual[key], key).toEqual(expected[key]);
      }
    });
  }

  it('handles empty data the same way', () => {
    vi.setSystemTime(new Date('2026-10-19T10:00:00'));
    const expected = originalDashboardCalc([], [], []);
    const actual = computeDashboardMetrics([], [], [], new Date());
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      expect(actual[key], key).toEqual(expected[key]);
    }
  });
});
