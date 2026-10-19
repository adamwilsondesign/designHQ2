import { describe, expect, it } from 'vitest';
import { JobApplication } from '../types';
import { applicationsInWeek, weekState } from './progress';

const app = (d: string): JobApplication => ({ id: d, url: '', role: '', company: '', appliedDate: d, status: 'applied', source: '', notes: '', createdAt: '' });

describe('job search progress', () => {
  it('counts Monday through Sunday', () => {
    const apps = ['2026-10-18', '2026-10-19', '2026-10-25', '2026-10-26'].map(app);
    expect(applicationsInWeek(apps, '2026-10-19').map(a => a.appliedDate)).toEqual(['2026-10-19', '2026-10-25']);
  });
  it('classifies against the flexible 5-10 goal', () => {
    expect(weekState(3, 5, 10)).toBe('below');
    expect(weekState(5, 5, 10)).toBe('met');
    expect(weekState(10, 5, 10)).toBe('stretch');
  });
});
