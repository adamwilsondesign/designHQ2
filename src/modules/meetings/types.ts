export type MeetingKind = 'oneOnOne' | 'townHall' | 'critique' | 'designTeam';
export type GroupMeetingKind = Exclude<MeetingKind, 'oneOnOne'>;

export interface ActionItem {
  owner: string;
  task: string;
  due: string;
  done: boolean;
}

// meetings/{id}: one occurrence of any meeting type.
export interface Meeting {
  id: string;
  kind: MeetingKind;
  title: string;
  date: string; // ISO datetime of the start
  durationMinutes: number;
  status: 'scheduled' | 'held' | 'cancelled';
  staffId?: string | null; // one-on-ones
  staffName?: string | null;
  seriesId?: string | null; // town halls, critiques, design team
  presenters?: string[]; // staff ids presenting a show-and-tell (design team)
  agenda?: string;
  calendarEventId?: string | null;
  calendarLink?: string | null;
  transcriptPath?: string | null;
  transcriptName?: string | null;
  summary?: string;
  notes?: string[];
  actionItems?: ActionItem[];
  decisions?: string[];
  processedAt?: unknown;
  adamNotes?: string;
  createdAt: string;
  createdBy: string;
}

// meetingSeries/{id}: a recurring group meeting Adam schedules.
export interface MeetingSeries {
  id: string;
  kind: GroupMeetingKind;
  name: string;
  cadenceWeeks: number;
  leadTimeDays: number;
  durationMinutes: number;
  attendees: string; // comma-separated emails for the invite
  lastHeldDate: string | null; // YYYY-MM-DD
}

export const KIND_LABEL: Record<MeetingKind, string> = {
  oneOnOne: 'One-on-one',
  townHall: 'Town hall',
  critique: 'Group critique',
  designTeam: 'Design team meeting',
};

// Defaults from the spec. Town halls and critiques: two-month lead time; their
// cadence was not specified, so Adam sets it per series. Design team: every
// eight weeks; its lead time was not specified, so it starts at two months and
// is editable.
export const SERIES_DEFAULTS: Record<GroupMeetingKind, Omit<MeetingSeries, 'id' | 'name' | 'lastHeldDate' | 'attendees'>> = {
  townHall: { kind: 'townHall', cadenceWeeks: 12, leadTimeDays: 60, durationMinutes: 60 },
  critique: { kind: 'critique', cadenceWeeks: 8, leadTimeDays: 60, durationMinutes: 60 },
  designTeam: { kind: 'designTeam', cadenceWeeks: 8, leadTimeDays: 60, durationMinutes: 60 },
};

export const ONE_ON_ONE_WINDOW_DAYS = 14;
