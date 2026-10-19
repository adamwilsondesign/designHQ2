// Extended staff fields, stored in staffProfiles/{staffId} (same id as the staff
// doc). Kept separate because App.tsx rewrites whole staff documents on save.
// Adam enters these by hand from Rippling; there is no self-service.

export type OneOnOneCadence = 'monthly' | 'sixWeeks';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  note?: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface StaffProfile {
  id: string;
  birthday: string | null;
  companyJoinDate: string | null;
  ptoDates: DateRange[];
  holidays: Holiday[];
  lastOneOnOneDate: string | null;
  oneOnOneCadence: OneOnOneCadence | null;
  lastShowAndTellDate: string | null;
  updatedAt: string | null;
}

export const emptyStaffProfile = (id: string): StaffProfile => ({
  id,
  birthday: null,
  companyJoinDate: null,
  ptoDates: [],
  holidays: [],
  lastOneOnOneDate: null,
  oneOnOneCadence: null,
  lastShowAndTellDate: null,
  updatedAt: null,
});

export const CADENCE_LABEL: Record<OneOnOneCadence, string> = {
  monthly: 'Monthly',
  sixWeeks: 'Every six weeks',
};
