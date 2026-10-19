import { OneOnOneCadence, StaffProfile } from '../../staffData/types';
import { Meeting, MeetingSeries, ONE_ON_ONE_WINDOW_DAYS } from '../types';

const DAY = 24 * 60 * 60 * 1000;

export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Monthly = same day next month (clamped to month end); six weeks = +42 days.
export function nextOneOnOneDate(last: string, cadence: OneOnOneCadence): Date {
  const d = parseYmd(last);
  if (cadence === 'sixWeeks') return new Date(d.getTime() + 42 * DAY);
  const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

export const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);

export interface OneOnOneDue {
  staffId: string;
  dueDate: Date | null; // null = never met, due now
  daysUntil: number; // negative = overdue
  booked: Meeting | null;
}

// Everyone with a cadence whose next one-on-one falls within the window
// (overdue included). A future scheduled one-on-one counts as booked.
export function oneOnOnesDue(
  staffIds: string[],
  profiles: (id: string) => StaffProfile,
  meetings: Meeting[],
  now = new Date(),
  windowDays = ONE_ON_ONE_WINDOW_DAYS,
): OneOnOneDue[] {
  const today = startOfDay(now);
  const out: OneOnOneDue[] = [];
  for (const staffId of staffIds) {
    const p = profiles(staffId);
    if (!p.oneOnOneCadence) continue;
    const dueDate = p.lastOneOnOneDate ? nextOneOnOneDate(p.lastOneOnOneDate, p.oneOnOneCadence) : null;
    const daysUntil = dueDate ? daysBetween(today, dueDate) : 0;
    if (daysUntil > windowDays) continue;
    const booked =
      meetings
        .filter(m => m.kind === 'oneOnOne' && m.staffId === staffId && m.status === 'scheduled' && new Date(m.date) >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
    out.push({ staffId, dueDate, daysUntil, booked });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export interface SeriesDue {
  series: MeetingSeries;
  dueDate: Date | null; // null = never held, due now
  daysUntil: number;
  booked: Meeting | null;
}

// Group meetings whose next occurrence is inside the series' lead time.
export function seriesDue(series: MeetingSeries[], meetings: Meeting[], now = new Date()): SeriesDue[] {
  const today = startOfDay(now);
  return series
    .map(s => {
      const dueDate = s.lastHeldDate ? new Date(parseYmd(s.lastHeldDate).getTime() + s.cadenceWeeks * 7 * DAY) : null;
      const daysUntil = dueDate ? daysBetween(today, dueDate) : 0;
      const booked =
        meetings
          .filter(m => m.seriesId === s.id && m.status === 'scheduled' && new Date(m.date) >= today)
          .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
      return { series: s, dueDate, daysUntil, booked };
    })
    .filter(d => d.booked || d.daysUntil <= d.series.leadTimeDays)
    .sort((a, b) => (a.booked ? new Date(a.booked.date).getTime() : a.dueDate?.getTime() ?? 0) - (b.booked ? new Date(b.booked.date).getTime() : b.dueDate?.getTime() ?? 0));
}

// Fair rotation: people who have never presented first, then oldest presentation.
// Ties break by name so the order is stable.
export function showAndTellRotation<T extends { id: string; name: string }>(
  people: T[],
  profiles: (id: string) => StaffProfile,
): (T & { lastShowAndTellDate: string | null })[] {
  return people
    .map(p => ({ ...p, lastShowAndTellDate: profiles(p.id).lastShowAndTellDate }))
    .sort((a, b) => {
      if (!a.lastShowAndTellDate && b.lastShowAndTellDate) return -1;
      if (a.lastShowAndTellDate && !b.lastShowAndTellDate) return 1;
      const byDate = (a.lastShowAndTellDate || '').localeCompare(b.lastShowAndTellDate || '');
      return byDate || a.name.localeCompare(b.name);
    });
}

export function designTeamAgenda(presenterNames: string[]): string {
  return [
    'Design team meeting',
    '',
    '1. Project updates',
    '2. Department news',
    `3. Show-and-tells${presenterNames.length ? '' : ' (3–4 presenters)'}`,
    ...presenterNames.map(n => `   • ${n}`),
    '4. Q&A',
    '5. Industry and tools',
  ].join('\n');
}
