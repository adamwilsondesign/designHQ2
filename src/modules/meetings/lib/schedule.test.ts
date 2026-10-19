import { describe, expect, it } from 'vitest';
import { emptyStaffProfile, StaffProfile } from '../../staffData/types';
import { Meeting, MeetingSeries } from '../types';
import { designTeamAgenda, nextOneOnOneDate, oneOnOnesDue, seriesDue, showAndTellRotation, toYmd } from './schedule';

const profiles = (map: Record<string, Partial<StaffProfile>>) => (id: string) => ({ ...emptyStaffProfile(id), ...(map[id] || {}) });
const meeting = (m: Partial<Meeting>): Meeting => ({ id: 'm', kind: 'oneOnOne', title: '', date: '', durationMinutes: 30, status: 'scheduled', createdAt: '', createdBy: '', ...m });

describe('nextOneOnOneDate', () => {
  it('monthly keeps the day and clamps to month end', () => {
    expect(toYmd(nextOneOnOneDate('2026-09-15', 'monthly'))).toBe('2026-10-15');
    expect(toYmd(nextOneOnOneDate('2026-01-31', 'monthly'))).toBe('2026-02-28');
  });
  it('six weeks adds 42 days', () => {
    expect(toYmd(nextOneOnOneDate('2026-09-01', 'sixWeeks'))).toBe('2026-10-13');
  });
});

describe('oneOnOnesDue', () => {
  const now = new Date(2026, 9, 19); // Oct 19 2026
  const p = profiles({
    a: { oneOnOneCadence: 'monthly', lastOneOnOneDate: '2026-09-25' }, // due Oct 25 -> 6 days
    b: { oneOnOneCadence: 'sixWeeks', lastOneOnOneDate: '2026-09-30' }, // due Nov 11 -> 23 days, outside
    c: { oneOnOneCadence: 'monthly', lastOneOnOneDate: '2026-08-01' }, // due Sep 1 -> overdue
    d: { oneOnOneCadence: 'monthly' }, // never met -> due now
    e: { lastOneOnOneDate: '2026-01-01' }, // no cadence -> not tracked
  });

  it('lists people due within two weeks, overdue first', () => {
    const due = oneOnOnesDue(['a', 'b', 'c', 'd', 'e'], p, [], now);
    expect(due.map(d => d.staffId)).toEqual(['c', 'd', 'a']);
    expect(due.find(d => d.staffId === 'a')!.daysUntil).toBe(6);
    expect(due.find(d => d.staffId === 'c')!.daysUntil).toBeLessThan(0);
  });

  it('marks a future scheduled one-on-one as booked', () => {
    const due = oneOnOnesDue(['a'], p, [meeting({ staffId: 'a', date: '2026-10-23T15:00:00.000Z' })], now);
    expect(due[0].booked?.date).toBe('2026-10-23T15:00:00.000Z');
  });
});

describe('seriesDue', () => {
  const now = new Date(2026, 9, 19);
  const s = (x: Partial<MeetingSeries>): MeetingSeries => ({ id: 'x', kind: 'townHall', name: 'TH', cadenceWeeks: 12, leadTimeDays: 60, durationMinutes: 60, attendees: '', lastHeldDate: null, ...x });

  it('uses the two-month lead time', () => {
    const due = seriesDue([
      s({ id: 'soon', lastHeldDate: '2026-09-01' }), // +12w = Nov 24 -> 36 days
      s({ id: 'later', lastHeldDate: '2026-10-15' }), // +12w = Jan 7 -> 80 days
      s({ id: 'never' }),
    ], [], now);
    expect(due.map(d => d.series.id)).toEqual(['never', 'soon']);
  });
});

describe('showAndTellRotation', () => {
  it('puts people who never presented first, then the longest ago', () => {
    const people = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }];
    const order = showAndTellRotation(people, profiles({ a: { lastShowAndTellDate: '2026-09-01' }, b: { lastShowAndTellDate: '2026-03-01' } }));
    expect(order.map(p => p.id)).toEqual(['c', 'd', 'b', 'a']);
  });
});

describe('designTeamAgenda', () => {
  it('contains the standing agenda with presenters', () => {
    const text = designTeamAgenda(['Ann', 'Bob', 'Cy']);
    for (const item of ['Project updates', 'Department news', 'Show-and-tells', 'Ann', 'Q&A', 'Industry and tools']) expect(text).toContain(item);
  });
});
