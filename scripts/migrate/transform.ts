// Pure transform from the legacy DesignHQ export to the extended schema.
//
// The rule is "extend, never rewrite": every legacy document is copied with its
// id and fields unchanged, so the existing views compute identical numbers.
// New data lives in companion collections keyed by the same ids, which the
// legacy writers in App.tsx (which overwrite whole documents) cannot clobber:
//   staffProfiles/{staffId}  birthday, join date, PTO, holidays, 1:1 cadence
//   projectMeta/{projectId}  health status
// New fields start empty. Nothing is inferred or invented.

export type DocMap = Record<string, Record<string, unknown>>;
export type ExportFile = {
  exportedAt: string;
  source: { projectId: string; databaseId: string | null };
  collections: Record<string, DocMap>;
};

export const LEGACY_PROJECT_ID = 'gen-lang-client-0470160406';

export function emptyStaffProfile() {
  return {
    birthday: null,
    companyJoinDate: null,
    ptoDates: [],
    holidays: [],
    lastOneOnOneDate: null,
    oneOnOneCadence: null,
    lastShowAndTellDate: null,
    updatedAt: null,
  };
}

export function emptyProjectMeta() {
  return { healthStatus: null, healthNote: '', updatedAt: null };
}

export interface TransformReport {
  copied: Record<string, number>;
  created: Record<string, number>;
  linkedUsers: { userId: string; email: string; staffId: string }[];
  unlinkedUsers: string[];
  ambiguousLinks: { email: string; staffIds: string[] }[];
}

export function transformExport(input: ExportFile): { collections: Record<string, DocMap>; report: TransformReport } {
  const out: Record<string, DocMap> = {};
  const report: TransformReport = { copied: {}, created: {}, linkedUsers: [], unlinkedUsers: [], ambiguousLinks: [] };

  // 1. Copy every legacy collection verbatim, including ones this script does
  //    not know about, so nothing is lost.
  for (const [name, docs] of Object.entries(input.collections)) {
    out[name] = {};
    for (const [id, data] of Object.entries(docs)) {
      out[name][id] = structuredClone(data);
    }
    report.copied[name] = Object.keys(docs).length;
  }

  const staff = out.staff || {};
  const projects = out.projects || {};
  const users = out.users || {};

  // 2. Companion docs for the extended schema.
  out.staffProfiles = { ...(out.staffProfiles || {}) };
  for (const id of Object.keys(staff)) {
    if (!out.staffProfiles[id]) out.staffProfiles[id] = emptyStaffProfile();
  }
  report.created.staffProfiles = Object.keys(out.staffProfiles).length - Object.keys(input.collections.staffProfiles || {}).length;

  out.projectMeta = { ...(out.projectMeta || {}) };
  for (const id of Object.keys(projects)) {
    if (!out.projectMeta[id]) out.projectMeta[id] = emptyProjectMeta();
  }
  report.created.projectMeta = Object.keys(out.projectMeta).length - Object.keys(input.collections.projectMeta || {}).length;

  // 3. Link users to staff records by exact (case-insensitive) Lazer email match
  //    so Regular Users can see their assignments. Ambiguous or missing matches
  //    are reported, not guessed.
  const byEmail = new Map<string, string[]>();
  for (const [id, s] of Object.entries(staff)) {
    const email = typeof s.lazerEmail === 'string' ? s.lazerEmail.trim().toLowerCase() : '';
    if (!email) continue;
    byEmail.set(email, [...(byEmail.get(email) || []), id]);
  }
  for (const [userId, u] of Object.entries(users)) {
    const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
    if (u.staffId) continue;
    const matches = byEmail.get(email) || [];
    if (matches.length === 1) {
      u.staffId = matches[0];
      report.linkedUsers.push({ userId, email, staffId: matches[0] });
    } else if (matches.length > 1) {
      report.ambiguousLinks.push({ email, staffIds: matches });
    } else {
      report.unlinkedUsers.push(email || userId);
    }
  }

  return { collections: out, report };
}
