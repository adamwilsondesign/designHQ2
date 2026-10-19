export type ApplicationStatus = 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

// personal/{uid}/jobApplications/{id}
export interface JobApplication {
  id: string;
  url: string;
  role: string;
  company: string;
  appliedDate: string; // YYYY-MM-DD
  status: ApplicationStatus;
  source: string; // board it came from
  notes: string;
  tailoredDocId?: string | null;
  createdAt: string;
}

// personal/{uid}/tailoredDocs/{id}
export interface TailoredDoc {
  id: string;
  jobUrl: string;
  postingText: string;
  notes: string;
  company: string;
  role: string;
  fetchError?: string | null;
  draft?: { version: number; resume: string; coverLetter: string; gaps: string[]; generatedAt: string };
  history?: { version: number; resume: string; coverLetter: string; notes: string }[];
  createdAt: string;
}

// personal/{uid}/settings/jobSearch
export interface JobSearchSettings {
  weeklyMin: number;
  weeklyMax: number;
  boards: { name: string; url: string }[];
}

// Weekly goal of five to ten from the spec. Lenny's Jobs has no URL here
// because it wasn't given; add it in the Boards tab.
export const DEFAULT_SETTINGS: JobSearchSettings = {
  weeklyMin: 5,
  weeklyMax: 10,
  boards: [
    { name: "Lenny's Jobs", url: '' },
    { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/' },
  ],
};
