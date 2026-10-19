export type HealthStatus = 'On Track' | 'At Risk' | 'Off Track' | 'Not Started';

export const HEALTH_OPTIONS: HealthStatus[] = ['On Track', 'At Risk', 'Off Track', 'Not Started'];

// projectMeta/{projectId}
export interface ProjectMeta {
  id: string;
  healthStatus: HealthStatus | null;
  healthNote?: string;
  updatedAt?: string | null;
}

// The parts Adam fills in by hand.
export interface ExecUpdateManual {
  takeaways: string[]; // five
  recruiting: string; // free text, multiple lines allowed
  initiatives: string; // one per line
  utilizationNote: string; // e.g. "(Neff = internal)", printed under the FTE line
  extraProjectLines: string; // rows not in Projects, e.g. internal work; printed as typed
  departmentNotes: string; // anything else for the department block, one per line
}

export const EMPTY_MANUAL: ExecUpdateManual = {
  takeaways: ['', '', '', '', ''],
  recruiting: '',
  initiatives: '',
  utilizationNote: '',
  extraProjectLines: '',
  departmentNotes: '',
};

// Numbers saved with each update so the next one can show the change.
export interface ExecSnapshot {
  revenue: number;
  avgProfitability: number;
  pipeline: number;
  pacePct: number;
}

// execUpdates/{id}: saved copy of each generated post.
export interface ExecUpdateRecord {
  id: string;
  createdAt: string;
  createdBy: string;
  since: string;
  text: string;
  manual: Partial<ExecUpdateManual>;
  snapshot?: ExecSnapshot;
  includedClosed: string[];
  includedScoped: string[];
  excludedProjects?: string[];
}
