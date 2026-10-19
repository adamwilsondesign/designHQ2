import { shiftWeek } from '../../../common/week';
import { JobApplication } from '../types';

export function applicationsInWeek(apps: JobApplication[], weekOf: string) {
  const end = shiftWeek(weekOf, 1);
  return apps.filter(a => a.appliedDate >= weekOf && a.appliedDate < end).sort((a, b) => a.appliedDate.localeCompare(b.appliedDate));
}

export type WeekState = 'below' | 'met' | 'stretch';

export function weekState(count: number, min: number, max: number): WeekState {
  if (count >= max) return 'stretch';
  if (count >= min) return 'met';
  return 'below';
}
