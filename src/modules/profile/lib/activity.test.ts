import { describe, expect, it } from 'vitest';
import { SocialDraft } from '../../social/types';
import { JobApplication } from '../../jobSearch/types';
import { Reminder } from '../../calendar/types';
import { buildActivity, momentum } from './activity';

const draft = (x: Partial<SocialDraft>): SocialDraft => ({ id: 'd', weekOf: '2026-10-19', platform: 'linkedin', kind: 'text', theme: 'Craft', body: 'b', visualBrief: '', imagePath: null, status: 'draft', createdAt: '2026-10-19T09:00:00Z', ...x });
const app = (x: Partial<JobApplication>): JobApplication => ({ id: 'a', url: '', role: 'VP Design', company: 'Acme', appliedDate: '2026-10-20', status: 'applied', source: '', notes: '', createdAt: '2026-10-20T10:00:00Z', ...x });
const rem = (x: Partial<Reminder>): Reminder => ({ id: 'r', kind: 'birthday', title: 'Mom', date: '1960-11-10', recurrence: 'yearly', leadDays: 30, blockMinutes: 20, action: 'Gift', handled: [], createdAt: '', ...x });

describe('personal activity', () => {
  it('merges modules newest first and skips discarded drafts', () => {
    const items = buildActivity({
      drafts: [draft({ id: '1' }), draft({ id: '2', status: 'posted', updatedAt: '2026-10-21T08:00:00Z', platform: 'x' }), draft({ id: '3', status: 'discarded' })],
      applications: [app({})],
      tailored: [],
      reminders: [rem({ handled: ['2026-11-10'], createdAt: '2026-10-18T09:00:00Z' })],
    });
    expect(items.map(i => i.label)).toEqual(['Handled: Mom', 'Posted on X', 'Applied: Acme', 'LinkedIn draft', 'Reminder added: Mom']);
  });

  it('summarises the week', () => {
    const m = momentum({
      drafts: [draft({}), draft({ status: 'posted' }), draft({ weekOf: '2026-10-12' })],
      applications: [app({}), app({ appliedDate: '2026-10-10' })],
      reminders: [rem({})],
    }, '2026-10-19', new Date(2026, 9, 21));
    expect(m).toMatchObject({ draftsThisWeek: 2, postedThisWeek: 1, applicationsThisWeek: 1 });
    expect(m.upcomingReminders[0].title).toBe('Mom');
  });
});

describe('tone of voice default', () => {
  it('matches the server fallback in functions/src/personal.ts', async () => {
    const { readFileSync } = await import('fs');
    const { DEFAULT_TONE } = await import('../types');
    const server = readFileSync('functions/src/personal.ts', 'utf8');
    const match = /export const DEFAULT_TONE =\s*([\s\S]*?);\n/.exec(server)![1];
    const serverTone = match.split('+').map(part => part.trim().replace(/^'|'$/g, '')).join('');
    expect(serverTone).toBe(DEFAULT_TONE);
  });
});
