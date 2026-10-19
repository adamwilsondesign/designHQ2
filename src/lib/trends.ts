import { Project, StaffMember } from './mockData';

function getWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

export function calculateWeeklyTrends(projects: Project[], staff: StaffMember[]) {
  if (projects.length === 0 || staff.length === 0) return null;

  let minDate = new Date();
  let maxDate = new Date();
  let hasValidDates = false;

  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  projects.forEach(p => {
    if (p.startDate && p.finishDate) {
      const start = parseLocalDate(p.startDate);
      const end = parseLocalDate(p.finishDate);
      if (!hasValidDates || start < minDate) minDate = start;
      if (!hasValidDates || end > maxDate) maxDate = end;
      hasValidDates = true;
    }
  });

  if (!hasValidDates) return null;

  // Cap maxDate to 1 month in the future
  if (maxDate > oneMonthFromNow) {
    maxDate = new Date(oneMonthFromNow);
  }

  // Enforce fiscal year start
  const fiscalYearStart = new Date('2026-02-01T00:00:00');
  if (minDate < fiscalYearStart) {
    minDate = new Date(fiscalYearStart);
  }

  // Round minDate down to start of week (Sunday)
  minDate.setDate(minDate.getDate() - minDate.getDay());
  minDate.setHours(0, 0, 0, 0);

  // Round maxDate up to end of week (Saturday)
  maxDate.setDate(maxDate.getDate() + (6 - maxDate.getDay()));
  maxDate.setHours(23, 59, 59, 999);

  const weeks: { start: Date, end: Date, name: string }[] = [];
  let current = new Date(minDate);
  while (current < maxDate) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    weeks.push({
      start: new Date(current),
      end: weekEnd,
      name: `${current.toLocaleDateString(undefined, {month: 'short'})} W${weeks.length + 1}`
    });
    
    current.setDate(current.getDate() + 7);
  }

  if (weeks.length < 2) return null;

  const revenueData: { name: string, revenue: number }[] = [];
  const utilizationData: { name: string, util: number, utilContractor?: number, utilAll?: number, isCurrentWeek: boolean, isHistoricalOrCurrent: boolean }[] = [];

  const fullTimeStaff = staff.filter(s => s.employmentType === 'Full-Time');
  const contractorStaff = staff.filter(s => s.employmentType !== 'Full-Time');
  
  const totalWeeklyAvailableHoursFte = fullTimeStaff.length * 40;
  const totalWeeklyAvailableHoursContractor = contractorStaff.length * 40;
  const totalWeeklyAvailableHoursAll = staff.length * 40;
  
  const avgFteHourlyRate = fullTimeStaff.length > 0 ? fullTimeStaff.reduce((sum, s) => sum + s.hourlyCost, 0) / fullTimeStaff.length : 0;
  const now = new Date();

  let totalBenchBurn = 0;
  
  let currentUtilFte = 0;
  let currentUtilContractor = 0;
  let currentUtilAll = 0;

  weeks.forEach(week => {
    let weeklyRevenue = 0;
    let weeklyHoursFte = 0;
    let weeklyHoursContractor = 0;
    let contractorAllocationThisWeek = 0;
    const activeContractorsThisWeek = new Map<string, number>();

    projects.forEach(p => {
      if (!p.startDate || !p.finishDate) return;

      const assignedStaff = staff.filter(s => (p.assignedStaffIds || []).includes(s.id));
      const ftes = assignedStaff.filter(s => s.employmentType === 'Full-Time');
      const contractors = assignedStaff.filter(s => s.employmentType !== 'Full-Time');
      
      let fteWeeklyHours = 0;
      ftes.forEach(s => {
        const allocation = p.staffAllocations?.[s.id] ?? 100;
        fteWeeklyHours += (allocation / 100) * 40;
      });

      let contractorWeeklyHours = 0;
      contractors.forEach(s => {
        const allocation = p.staffAllocations?.[s.id] ?? 100;
        contractorWeeklyHours += (allocation / 100) * 40;
      });

      const [sYear, sMonth, sDay] = p.startDate.split('-').map(Number);
      const pStart = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);
      
      const [eYear, eMonth, eDay] = p.finishDate.split('-').map(Number);
      const pEnd = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      
      // Check if project overlaps with this week
      if (pStart <= week.end && pEnd >= week.start) {
        const projectDurationWorkingDays = Math.max(1, getWorkingDays(pStart, pEnd));
        const projectDurationWeeks = projectDurationWorkingDays / 5;
        
        // Calculate overlap duration in this week
        const overlapStart = new Date(Math.max(pStart.getTime(), week.start.getTime()));
        const overlapEnd = new Date(Math.min(pEnd.getTime(), week.end.getTime()));
        
        const overlapWorkingDays = getWorkingDays(overlapStart, overlapEnd);
        
        if (overlapWorkingDays > 0) {
          const overlapWeeks = overlapWorkingDays / 5;
          
          // Apportion revenue and hours based on overlap
          weeklyRevenue += (p.totalValue / projectDurationWeeks) * overlapWeeks;
          weeklyHoursFte += fteWeeklyHours * overlapWeeks;
          weeklyHoursContractor += contractorWeeklyHours * overlapWeeks;
          
          contractors.forEach(c => {
            const allocation = p.staffAllocations?.[c.id] ?? 100;
            const current = activeContractorsThisWeek.get(c.id) || 0;
            activeContractorsThisWeek.set(c.id, current + ((allocation / 100) * overlapWeeks));
          });
        }
      }
    });
    
    contractorAllocationThisWeek = Array.from(activeContractorsThisWeek.values()).reduce((sum, val) => sum + Math.min(1, val), 0);

    revenueData.push({ name: week.name, revenue: Math.round(weeklyRevenue) });
    
    const utilFte = totalWeeklyAvailableHoursFte > 0 
      ? Math.round((weeklyHoursFte / totalWeeklyAvailableHoursFte) * 100) 
      : 0;
      
    const utilContractor = contractorStaff.length > 0 
      ? Math.round((contractorAllocationThisWeek / contractorStaff.length) * 100) 
      : 0;
      
    const utilAll = totalWeeklyAvailableHoursAll > 0 
      ? Math.round(((weeklyHoursFte + weeklyHoursContractor) / totalWeeklyAvailableHoursAll) * 100) 
      : 0;
    
    const isCurrentWeek = now >= week.start && now <= week.end;
    const isHistoricalOrCurrent = week.start <= now;
    utilizationData.push({ 
      name: week.name, 
      util: Math.round(utilFte), 
      utilContractor: Math.round(utilContractor),
      utilAll: Math.round(utilAll),
      isCurrentWeek, 
      isHistoricalOrCurrent 
    });

    if (isCurrentWeek) {
      currentUtilFte = utilFte;
      currentUtilContractor = utilContractor;
      currentUtilAll = utilAll;
    }

    if (isHistoricalOrCurrent) {
      const benchBurnHours = Math.max(0, totalWeeklyAvailableHoursFte - weeklyHoursFte);
      totalBenchBurn += benchBurnHours * avgFteHourlyRate;
    }
  });

  const historicalUtils = utilizationData.filter(d => d.isHistoricalOrCurrent);
  const avgUtil = historicalUtils.length > 0 
    ? Math.round(historicalUtils.reduce((sum, d) => sum + d.util, 0) / historicalUtils.length) 
    : 0;

  return { 
    revenueData, 
    utilizationData, 
    avgUtil, 
    currentUtil: currentUtilFte, 
    currentUtilFte, 
    currentUtilContractor, 
    currentUtilAll, 
    benchBurn: totalBenchBurn 
  };
}
