import { Reminder } from '../types';

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 864e5;

// Next date the reminder falls on, today included. Feb 29 birthdays fall on
// Feb 28 in non-leap years. Returns null for a one-off date in the past.
export function nextOccurrence(r: Pick<Reminder, 'date' | 'recurrence'>, now = new Date()): Date | null {
  const today = startOfDay(now);
  const base = parse(r.date);
  if (r.recurrence === 'once') return base >= today ? base : null;
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const lastDay = new Date(year, base.getMonth() + 1, 0).getDate();
    const occ = new Date(year, base.getMonth(), Math.min(base.getDate(), lastDay));
    if (occ >= today) return occ;
  }
  return null;
}

export interface ReminderSuggestion {
  reminder: Reminder;
  occurrence: Date;
  occurrenceKey: string;
  daysUntil: number;
  suggestedDate: Date; // when to put the block: leadDays before, or today if that's passed
}

// Reminders inside their lead window that haven't been blocked or dismissed
// for this occurrence.
export function reminderSuggestions(reminders: Reminder[], now = new Date()): ReminderSuggestion[] {
  const today = startOfDay(now);
  const out: ReminderSuggestion[] = [];
  for (const r of reminders) {
    const occ = nextOccurrence(r, today);
    if (!occ) continue;
    const key = ymd(occ);
    if ((r.handled || []).includes(key)) continue;
    const daysUntil = Math.round((occ.getTime() - today.getTime()) / DAY);
    if (daysUntil > r.leadDays) continue;
    const ideal = new Date(occ.getTime() - r.leadDays * DAY);
    out.push({ reminder: r, occurrence: occ, occurrenceKey: key, daysUntil, suggestedDate: ideal < today ? today : ideal });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

// Everything coming up in the next `days`, handled or not, for the overview list.
export function upcoming(reminders: Reminder[], days: number, now = new Date()) {
  const today = startOfDay(now);
  return reminders
    .map(r => ({ reminder: r, occurrence: nextOccurrence(r, today) }))
    .filter((x): x is { reminder: Reminder; occurrence: Date } => !!x.occurrence && (x.occurrence.getTime() - today.getTime()) / DAY <= days)
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
}
