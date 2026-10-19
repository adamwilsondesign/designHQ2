export type ReminderKind = 'birthday' | 'anniversary' | 'trip' | 'other';

// personal/{uid}/reminders/{id}: recurring personal reminders Adam defines.
export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string; // e.g. "Mom's birthday"
  date: string; // YYYY-MM-DD; for yearly reminders only month/day are used
  recurrence: 'yearly' | 'once';
  leadDays: number; // how far ahead to suggest the block
  blockMinutes: number;
  action: string; // what the block is for, e.g. "Buy and ship a gift"
  handled: string[]; // occurrence dates (YYYY-MM-DD) already blocked or dismissed
  createdAt: string;
}

export const REMINDER_DEFAULTS: Record<ReminderKind, Pick<Reminder, 'recurrence' | 'leadDays' | 'blockMinutes' | 'action'>> = {
  birthday: { recurrence: 'yearly', leadDays: 30, blockMinutes: 20, action: 'Buy and ship a gift' },
  anniversary: { recurrence: 'yearly', leadDays: 30, blockMinutes: 20, action: 'Plan something and buy a gift' },
  trip: { recurrence: 'once', leadDays: 14, blockMinutes: 30, action: 'Trip prep: bookings, packing, out-of-office' },
  other: { recurrence: 'once', leadDays: 7, blockMinutes: 20, action: 'Prepare' },
};

export const KIND_LABEL: Record<ReminderKind, string> = { birthday: 'Birthday', anniversary: 'Anniversary', trip: 'Trip', other: 'Other' };
