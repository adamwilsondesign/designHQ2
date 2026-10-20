import { describe, expect, it } from 'vitest';
import { planImport } from './plan';

const legacy = {
  users: {
    oldUidAdam: { email: 'adamwilson@lazertechnologies.com', name: 'Adam', role: 'Super Admin', avatar: '' },
    oldUidDes: { email: 'Des@lazertechnologies.com', name: 'Des', role: 'Regular User', avatar: 'a.png' },
    'louie@lazertechnologies.com': { email: 'louie@lazertechnologies.com', name: 'Louie', role: 'Admin', avatar: '' },
    oldUidOdd: { email: 'odd@lazertechnologies.com', name: 'Odd', role: 'Owner', avatar: '' },
  },
  staff: { s1: { name: 'Des', lazerEmail: 'des@lazertechnologies.com', hourlyCost: 60 }, s2: { name: 'Kai', hourlyCost: 70 } },
  projects: { p1: { client: 'Acme', totalValue: 100 }, p2: { client: 'Beta', totalValue: 200 } },
  sales: { x1: { client: 'Lead', projectedValue: 5 } },
};

describe('planImport', () => {
  it('copies data unchanged, adds companion docs, and skips what already exists', () => {
    const { writes, rows } = planImport({
      legacy,
      existingIds: { projects: new Set(['p2']), users: new Set(['adamUidNew']) },
      existingUserEmails: new Set(['adamwilson@lazertechnologies.com']),
    });
    const ids = (c: string) => writes.filter(w => w.collection === c).map(w => w.id).sort();
    expect(ids('projects')).toEqual(['p1']);
    expect(writes.find(w => w.id === 'p1')!.data).toEqual({ client: 'Acme', totalValue: 100 });
    expect(ids('staff')).toEqual(['s1', 's2']);
    expect(ids('staffProfiles')).toEqual(['s1', 's2']);
    expect(ids('projectMeta')).toEqual(['p1', 'p2']);
    expect(rows.find(r => r.collection === 'projects')).toEqual({ collection: 'projects', inOld: 2, alreadyHere: 1, toImport: 1 });
  });

  it('turns old accounts into invites with role and staff link, skipping people already here', () => {
    const { writes, skippedUsers } = planImport({ legacy, existingIds: {}, existingUserEmails: new Set(['adamwilson@lazertechnologies.com']) });
    const invites = Object.fromEntries(writes.filter(w => w.collection === 'users').map(w => [w.id, w.data]));
    expect(Object.keys(invites).sort()).toEqual(['des@lazertechnologies.com', 'louie@lazertechnologies.com', 'odd@lazertechnologies.com']);
    expect(invites['des@lazertechnologies.com']).toMatchObject({ role: 'Regular User', staffId: 's1', avatar: 'a.png' });
    expect(invites['louie@lazertechnologies.com']).toMatchObject({ role: 'Admin' });
    expect(invites['odd@lazertechnologies.com']).toMatchObject({ role: 'Regular User' });
    expect(skippedUsers).toEqual(['adamwilson@lazertechnologies.com']);
  });
});
