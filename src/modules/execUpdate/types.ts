export type HealthStatus = 'On Track' | 'At Risk' | 'Off Track';

export const HEALTH_OPTIONS: HealthStatus[] = ['On Track', 'At Risk', 'Off Track'];

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
  recruiting: string;
  initiatives: string; // one per line
  departmentNotes: string; // extra department lines, one per line
}

// execUpdates/{id}: saved copy of each generated post.
export interface ExecUpdateRecord {
  id: string;
  createdAt: string;
  createdBy: string;
  since: string;
  text: string;
  manual: ExecUpdateManual;
  includedClosed: string[];
  includedScoped: string[];
}
