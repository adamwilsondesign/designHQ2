import { DocMap, transformExport } from '../../../../scripts/migrate/transform';

// Plans the copy from the old DesignHQ database into this one, using the same
// transform as scripts/migrate (companion staffProfiles / projectMeta docs,
// staff links by email). Nothing that already exists here is overwritten.
//
// Old user docs are keyed by the OLD project's sign-in ids, which mean nothing
// in this project. They become invites keyed by email instead; lib/auth.ts
// turns an invite into a real account (same role and staff link) the first
// time that person signs in.

export const LEGACY_COLLECTIONS = ['users', 'staff', 'projects', 'sales'] as const;

export interface PlannedWrite {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

export interface PlanRow {
  collection: string;
  inOld: number;
  alreadyHere: number;
  toImport: number;
}

const ROLES = ['Super Admin', 'Admin', 'Regular User'];

export function planImport(input: {
  legacy: Record<string, DocMap>;
  existingIds: Record<string, Set<string>>;
  existingUserEmails: Set<string>;
}): { writes: PlannedWrite[]; rows: PlanRow[]; skippedUsers: string[] } {
  const { collections } = transformExport({
    exportedAt: new Date().toISOString(),
    source: { projectId: 'legacy', databaseId: null },
    collections: input.legacy,
  });

  const writes: PlannedWrite[] = [];
  const rows: PlanRow[] = [];
  const skippedUsers: string[] = [];

  for (const [name, docs] of Object.entries(collections)) {
    if (name === 'users') continue;
    const existing = input.existingIds[name] || new Set<string>();
    const ids = Object.keys(docs);
    const fresh = ids.filter(id => !existing.has(id));
    fresh.forEach(id => writes.push({ collection: name, id, data: docs[id] }));
    rows.push({ collection: name, inOld: ids.length, alreadyHere: ids.length - fresh.length, toImport: fresh.length });
  }

  const users = Object.values(collections.users || {});
  const existingUsers = input.existingIds.users || new Set<string>();
  let userImports = 0;
  for (const u of users) {
    const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
    if (!email) continue;
    if (input.existingUserEmails.has(email) || existingUsers.has(email)) {
      skippedUsers.push(email);
      continue;
    }
    writes.push({
      collection: 'users',
      id: email,
      data: {
        email,
        name: typeof u.name === 'string' && u.name ? u.name : email.split('@')[0],
        role: ROLES.includes(u.role as string) ? u.role : 'Regular User',
        avatar: typeof u.avatar === 'string' ? u.avatar : '',
        ...(u.staffId ? { staffId: u.staffId } : {}),
      },
    });
    userImports++;
  }
  rows.unshift({ collection: 'users (as invites)', inOld: users.length, alreadyHere: skippedUsers.length, toImport: userImports });

  return { writes, rows, skippedUsers };
}
