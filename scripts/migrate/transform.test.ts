import { describe, expect, it } from 'vitest';
import { ExportFile, transformExport } from './transform';

const input: ExportFile = {
  exportedAt: '2026-10-19T00:00:00Z',
  source: { projectId: 'gen-lang-client-0470160406', databaseId: 'ai-studio' },
  collections: {
    users: {
      uidAdam: { email: 'adamwilson@lazertechnologies.com', name: 'Adam', role: 'Super Admin', avatar: '' },
      uidDes: { email: 'des@lazertechnologies.com', name: 'Des', role: 'Regular User', avatar: '' },
      uidTwo: { email: 'two@lazertechnologies.com', name: 'Two', role: 'Regular User', avatar: '' },
    },
    staff: {
      s1: { name: 'Des', lazerEmail: 'Des@LazerTechnologies.com', hourlyCost: 60 },
      s2: { name: 'Two A', lazerEmail: 'two@lazertechnologies.com', hourlyCost: 60 },
      s3: { name: 'Two B', lazerEmail: 'two@lazertechnologies.com', hourlyCost: 60 },
    },
    projects: { p1: { client: 'X', totalValue: 1000, assignedStaffIds: ['s1'] } },
    sales: { x1: { client: 'L', projectedValue: 5 } },
    somethingElse: { a: { b: 1 } },
  },
};

describe('migration transform', () => {
  it('copies every legacy document unchanged', () => {
    const { collections } = transformExport(input);
    expect(collections.projects).toEqual(input.collections.projects);
    expect(collections.sales).toEqual(input.collections.sales);
    expect(collections.staff).toEqual(input.collections.staff);
    expect(collections.somethingElse).toEqual(input.collections.somethingElse);
  });

  it('adds empty companion docs without inventing values', () => {
    const { collections } = transformExport(input);
    expect(Object.keys(collections.staffProfiles).sort()).toEqual(['s1', 's2', 's3']);
    expect(collections.staffProfiles.s1.birthday).toBeNull();
    expect(collections.projectMeta.p1.healthStatus).toBeNull();
  });

  it('links users to staff only on an unambiguous email match', () => {
    const { collections, report } = transformExport(input);
    expect(collections.users.uidDes.staffId).toBe('s1');
    expect(collections.users.uidTwo.staffId).toBeUndefined();
    expect(report.ambiguousLinks).toEqual([{ email: 'two@lazertechnologies.com', staffIds: ['s2', 's3'] }]);
    expect(report.unlinkedUsers).toEqual(['adamwilson@lazertechnologies.com']);
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(input);
    transformExport(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
