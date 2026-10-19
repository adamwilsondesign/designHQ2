export type Platform = 'linkedin' | 'x';

// personal/{uid}/socialDrafts/{id}
export interface SocialDraft {
  id: string;
  weekOf: string; // Monday, YYYY-MM-DD
  platform: Platform;
  kind: 'text' | 'visual';
  theme: string;
  body: string;
  visualBrief: string;
  imagePath: string | null;
  altText?: string;
  status: 'draft' | 'posted' | 'discarded';
  createdAt: string;
  updatedAt?: string;
}

// personal/{uid}/socialWeeks/{weekOf}
export interface SocialWeek {
  id: string;
  weekOf: string;
  themes: { title: string; why: string }[];
  trendsNotes: string;
}

export const PLATFORM_LABEL: Record<Platform, string> = { linkedin: 'LinkedIn', x: 'X' };
export const X_LIMIT = 280;
