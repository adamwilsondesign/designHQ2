// personal/{uid}/profile/main: the single source of truth every personal
// generator reads (social drafts, resume tailoring, cover letters).

export interface TargetSet {
  roles: string[];
  companies: string[];
  industries: string[];
}

export interface PersonalProfile {
  fullName: string;
  linkedinUrl: string;
  portfolioUrl: string;
  resume: { path: string; name: string; uploadedAt: string } | null;
  bio: string;
  targets: TargetSet;
  toneOfVoice: string;
  updatedAt?: string;
}

// Kept identical to DEFAULT_TONE in functions/src/personal.ts, which applies
// when the profile has no tone saved yet.
export const DEFAULT_TONE =
  'Casual but knowledgeable. Storytelling with a bit of philosophy, in the spirit of Anthony Bourdain: curious, candid, wry, ' +
  'unpretentious, specific about people and places. No kitchen, food, restaurant or cooking references or metaphors.';

export const emptyProfile = (): PersonalProfile => ({
  fullName: '',
  linkedinUrl: '',
  portfolioUrl: '',
  resume: null,
  bio: '',
  targets: { roles: [], companies: [], industries: [] },
  toneOfVoice: DEFAULT_TONE,
});
