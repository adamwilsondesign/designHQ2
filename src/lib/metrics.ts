import { Project, Sale, StaffMember } from './mockData';
import { calculateWeeklyTrends } from './trends';

// Single source of truth for the department numbers. This logic was lifted
// verbatim out of components/views/Dashboard.tsx so that the Dashboard, the
// daily dashboard and the exec update generator all read identical values.
// Do not change a formula here without updating src/lib/metrics.test.ts.

export const REVENUE_GOAL = 5000000;

export const getFiscalYearStart = () => new Date('2026-02-01T00:00:00');

export const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Filter out any data from before Feb 2026 for fiscal year
export function filterFiscalYearProjects(projectsList: Project[]) {
  const fiscalYearStart = getFiscalYearStart();
  return projectsList.filter(p => {
    if (!p.finishDate) return true;
    return new Date(p.finishDate) >= fiscalYearStart;
  });
}

export function filterFiscalYearSales(salesList: Sale[]) {
  const fiscalYearStart = getFiscalYearStart();
  return salesList.filter(s => {
    if (!s.lastContactDate) return true;
    return new Date(s.lastContactDate) >= fiscalYearStart;
  });
}

export function getProjectCost(project: Project, staffList: StaffMember[]) {
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
}

export const isOpenPipelineSale = (s: Sale) => s.status === 'Open' || s.status === 'In Negotiation';

export function computeDashboardMetrics(projectsList: Project[], salesList: Sale[], staffList: StaffMember[], now: Date = new Date()) {
  const fyProjectsList = filterFiscalYearProjects(projectsList);
  const fySalesList = filterFiscalYearSales(salesList);

  // Calculate dynamic KPIs
  const totalValue = fyProjectsList.reduce((sum, p) => sum + p.totalValue, 0);
  const totalCost = fyProjectsList.reduce((sum, p) => sum + getProjectCost(p, staffList), 0);
  const totalProfit = totalValue - totalCost;
  const avgProfitability = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;

  const activeProjectsCount = fyProjectsList.filter(p => {
    if (!p.startDate || !p.finishDate) return false;
    const start = parseLocalDate(p.startDate);
    const end = parseLocalDate(p.finishDate);
    // End date is inclusive, so we set it to end of day
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now;
  }).length;

  const totalDesigners = staffList.length;
  const pipelineValue = fySalesList.filter(isOpenPipelineSale).reduce((sum, s) => sum + s.projectedValue, 0);

  // New Sub-callout Calculations
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const projectsKickedOffThisMonth = fyProjectsList.filter(p => {
    if (!p.startDate) return false;
    const startDate = parseLocalDate(p.startDate);
    return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
  }).length;

  const activeSales = fySalesList.filter(isOpenPipelineSale);
  const projectsProjectedToCloseThisMonth = Math.round(activeSales.length * 0.33);
  const optimisticCloseValue = pipelineValue * 0.33;

  // calculateWeeklyTrends reads the wall clock internally; it is not passed `now`.
  const trends = calculateWeeklyTrends(fyProjectsList, staffList);

  const benchBurn = trends?.benchBurn || 0;
  const netProfit = totalProfit - benchBurn;

  const revenueGoal = REVENUE_GOAL;
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
    fyProjectsList,
    fySalesList,
    totalValue,
    totalCost,
    totalProfit,
    avgProfitability,
    activeProjectsCount,
    totalDesigners,
    pipelineValue,
    projectsKickedOffThisMonth,
    activeSales,
    projectsProjectedToCloseThisMonth,
    optimisticCloseValue,
    trends,
    benchBurn,
    netProfit,
    revenueGoal,
    goalProgress,
    timeProgress,
    monthlyRevenueGoal,
    monthsElapsed,
    currentMonthlyPace,
    monthlyPacePercentage,
    totalFTEs,
    allocatedFTEs,
    ftesOnBench,
  };
}

export type DashboardMetrics = ReturnType<typeof computeDashboardMetrics>;

// --- Additions for the daily dashboard. These are NEW derived numbers; they do
// not replace or alter any of the values above. ---

// Month-over-month direction. Built on the same weekly revenue apportionment the
// "Weekly Revenue Trend" chart already uses (calculateWeeklyTrends), bucketed by
// the calendar month each week starts in. Returns null if there is not enough
// trend data to compare two months.
export function computeMonthOverMonth(metrics: DashboardMetrics, now: Date = new Date()) {
  const trends = metrics.trends;
  if (!trends) return null;
  const fyStart = getFiscalYearStart();
  // calculateWeeklyTrends names weeks but does not return their dates, so the
  // start dates are reconstructed exactly the way trends.ts builds them.
  const firstWeekStart = (() => {
    let minDate = new Date();
    let hasValid = false;
    metrics.fyProjectsList.forEach(p => {
      if (p.startDate && p.finishDate) {
        const start = parseLocalDate(p.startDate);
        if (!hasValid || start < minDate) minDate = start;
        hasValid = true;
      }
    });
    if (minDate < fyStart) minDate = new Date(fyStart);
    minDate.setDate(minDate.getDate() - minDate.getDay());
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  })();

  const byMonth = new Map<string, number>();
  trends.revenueData.forEach((w, i) => {
    const start = new Date(firstWeekStart);
    start.setDate(start.getDate() + i * 7);
    const key = `${start.getFullYear()}-${start.getMonth()}`;
    byMonth.set(key, (byMonth.get(key) || 0) + w.revenue);
  });

  const thisKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${prev.getMonth()}`;
  if (!byMonth.has(thisKey) || !byMonth.has(prevKey)) return null;
  const current = byMonth.get(thisKey)!;
  const previous = byMonth.get(prevKey)!;
  const changePct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, changePct };
}
