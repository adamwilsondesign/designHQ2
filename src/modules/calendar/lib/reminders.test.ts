import { describe, expect, it } from 'vitest';
import { Reminder } from '../types';
import { nextOccurrence, reminderSuggestions } from './reminders';

const r = (x: Partial<Reminder>): Reminder => ({
  id: 'r', kind: 'birthday', title: 'Mom', date: '1960-11-15', recurrence: 'yearly', leadDays: 30, blockMinutes: 20, action: 'Buy and ship a gift', handled: [], createdAt: '', ...x,
});
const ymd = (d: Date | null) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date(2026, 9, 19); // Oct 19 2026

describe('nextOccurrence', () => {
  it('rolls yearly dates to this or next year', () => {
    expect(ymd(nextOccurrence(r({ date: '1960-11-15' }), now))).toBe('2026-11-15');
    expect(ymd(nextOccurrence(r({ date: '1960-03-02' }), now))).toBe('2027-03-02');
    expect(ymd(nextOccurrence(r({ date: '1960-10-19' }), now))).toBe('2026-10-19');
  });
  it('handles Feb 29 in non-leap years', () => {
    expect(ymd(nextOccurrence(r({ date: '1988-02-29' }), now))).toBe('2027-02-28');
  });
  it('one-off dates expire', () => {
    expect(nextOccurrence(r({ date: '2026-10-01', recurrence: 'once' }), now)).toBeNull();
    expect(ymd(nextOccurrence(r({ date: '2026-12-01', recurrence: 'once' }), now))).toBe('2026-12-01');
  });
});

describe('reminderSuggestions', () => {
  it('suggests a block about a month before a birthday', () => {
    const s = reminderSuggestions([r({ date: '1960-11-15' })], now);
    expect(s).toHaveLength(1);
    expect(s[0].daysUntil).toBe(27);
    expect(ymd(s[0].suggestedDate)).toBe('2026-10-19'); // ideal was Oct 16, already passed -> today
  });
  it('skips reminders outside the lead window and handled occurrences', () => {
    expect(reminderSuggestions([r({ date: '1960-12-25' })], now)).toHaveLength(0);
    expect(reminderSuggestions([r({ date: '1960-11-15', handled: ['2026-11-15'] })], now)).toHaveLength(0);
  });
  it('puts the block exactly leadDays ahead when there is time', () => {
    const s = reminderSuggestions([r({ date: '1960-11-30', leadDays: 30 })], new Date(2026, 9, 31));
    expect(ymd(s[0].suggestedDate)).toBe('2026-10-31');
  });
});
