import { applicationsInWeek } from '../../jobSearch/lib/progress';
import { JobApplication, TailoredDoc } from '../../jobSearch/types';
import { SocialDraft } from '../../social/types';
import { Reminder } from '../../calendar/types';
import { upcoming } from '../../calendar/lib/reminders';

export type ActivityKind = 'social' | 'job' | 'tailored' | 'reminder';

export interface ActivityItem {
  at: string; // ISO
  kind: ActivityKind;
  label: string;
  detail: string;
}

const PLATFORM: Record<string, string> = { linkedin: 'LinkedIn', x: 'X' };

// Recent personal activity, newest first, built from the module collections
// (nothing is duplicated into a separate log).
export function buildActivity(input: { drafts: SocialDraft[]; applications: JobApplication[]; tailored: TailoredDoc[]; reminders: Reminder[] }, limit = 15): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const d of input.drafts) {
    if (d.status === 'posted') items.push({ at: d.updatedAt || d.createdAt, kind: 'social', label: `Posted on ${PLATFORM[d.platform]}`, detail: d.theme || d.body.slice(0, 80) });
    else if (d.status === 'draft') items.push({ at: d.createdAt, kind: 'social', label: `${PLATFORM[d.platform]} draft`, detail: d.theme || d.body.slice(0, 80) });
  }
  for (const a of input.applications) items.push({ at: a.createdAt || `${a.appliedDate}T12:00:00`, kind: 'job', label: `Applied: ${a.company}`, detail: a.role });
  for (const t of input.tailored) if (t.draft) items.push({ at: t.draft.generatedAt || t.createdAt, kind: 'tailored', label: `Tailored resume: ${t.company || 'posting'}`, detail: `${t.role || ''} v${t.draft.version}`.trim() });
  for (const r of input.reminders) {
    if (r.createdAt) items.push({ at: r.createdAt, kind: 'reminder', label: `Reminder added: ${r.title}`, detail: r.action });
    for (const key of r.handled || []) items.push({ at: `${key}T00:00:00`, kind: 'reminder', label: `Handled: ${r.title}`, detail: r.action });
  }
  return items.filter(i => i.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface Momentum {
  draftsThisWeek: number;
  postedThisWeek: number;
  applicationsThisWeek: number;
  upcomingReminders: { title: string; date: Date }[];
}

export function momentum(input: { drafts: SocialDraft[]; applications: JobApplication[]; reminders: Reminder[] }, weekOf: string, now = new Date()): Momentum {
  const week = input.drafts.filter(d => d.weekOf === weekOf && d.status !== 'discarded');
  return {
    draftsThisWeek: week.length,
    postedThisWeek: week.filter(d => d.status === 'posted').length,
    applicationsThisWeek: applicationsInWeek(input.applications, weekOf).length,
    upcomingReminders: upcoming(input.reminders, 30, now).map(x => ({ title: x.reminder.title, date: x.occurrence })),
  };
}
