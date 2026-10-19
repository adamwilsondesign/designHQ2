import { describe, expect, it } from 'vitest';
import { mondayOf, shiftWeek, ymd } from './week';

describe('weeks', () => {
  it('finds the Monday for any day, including Sunday', () => {
    expect(ymd(mondayOf(new Date(2026, 9, 19)))).toBe('2026-10-19'); // Monday
    expect(ymd(mondayOf(new Date(2026, 9, 25)))).toBe('2026-10-19'); // Sunday
    expect(ymd(mondayOf(new Date(2026, 9, 21)))).toBe('2026-10-19'); // Wednesday
  });
  it('shifts across months', () => {
    expect(shiftWeek('2026-10-26', 1)).toBe('2026-11-02');
    expect(shiftWeek('2026-11-02', -1)).toBe('2026-10-26');
  });
});
