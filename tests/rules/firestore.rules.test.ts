import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { getBytes, ref, uploadString } from 'firebase/storage';

// Runs against the local emulators: npm run test:rules

let env: RulesTestEnvironment;

const ADAM = { uid: 'adam', email: 'adamwilson@lazertechnologies.com' };
const LOUIE = { uid: 'louie', email: 'louie@lazertechnologies.com' };
const DESIGNER = { uid: 'designer', email: 'designer@lazertechnologies.com' };
const NEWBIE = { uid: 'newbie', email: 'newbie@lazertechnologies.com' };
const OUTSIDER = { uid: 'outsider', email: 'someone@gmail.com' };

const as = (u: { uid: string; email: string }) =>
  env.authenticatedContext(u.uid, { email: u.email, email_verified: true });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-designhq',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADAM.uid), { email: ADAM.email, name: 'Adam', role: 'Super Admin', avatar: '' });
    await setDoc(doc(db, 'users', LOUIE.uid), { email: LOUIE.email, name: 'Louie', role: 'Admin', avatar: '' });
    await setDoc(doc(db, 'users', DESIGNER.uid), { email: DESIGNER.email, name: 'Des', role: 'Regular User', avatar: '', staffId: 's1' });
    await setDoc(doc(db, 'staff', 's1'), { name: 'Des', hourlyCost: 60 });
    await setDoc(doc(db, 'staff', 's2'), { name: 'Other', hourlyCost: 80 });
    await setDoc(doc(db, 'projects', 'p1'), { client: 'Mine', assignedStaffIds: ['s1'] });
    await setDoc(doc(db, 'projects', 'p2'), { client: 'Not mine', assignedStaffIds: ['s2'] });
    await setDoc(doc(db, 'sales', 'x1'), { client: 'Lead' });
    await setDoc(doc(db, 'personal', ADAM.uid, 'socialDrafts', 'd1'), { text: 'draft' });
    await setDoc(doc(db, 'tasks', 't1'), { ownerUid: DESIGNER.uid, title: 'Do it' });
  });
});

describe('Super Admin', () => {
  it('reads everything professional and personal', async () => {
    const db = as(ADAM).firestore();
    await assertSucceeds(getDocs(collection(db, 'staff')));
    await assertSucceeds(getDocs(collection(db, 'sales')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(getDoc(doc(db, 'personal', ADAM.uid, 'socialDrafts', 'd1')));
    await assertSucceeds(setDoc(doc(db, 'personal', ADAM.uid, 'profile', 'main'), { fullName: 'Adam Wilson' }));
  });

  it('cannot read another super admin personal data', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', 'other-sa'), { email: 'x@lazertechnologies.com', name: 'X', role: 'Super Admin', avatar: '' });
    });
    const db = as(ADAM).firestore();
    await assertFails(getDoc(doc(db, 'personal', 'other-sa', 'socialDrafts', 'd1')));
  });
});

describe('Admin', () => {
  it('reads and writes professional collections', async () => {
    const db = as(LOUIE).firestore();
    await assertSucceeds(getDocs(collection(db, 'staff')));
    await assertSucceeds(getDocs(collection(db, 'projects')));
    await assertSucceeds(getDocs(collection(db, 'sales')));
    await assertSucceeds(setDoc(doc(db, 'proposals', 'pr1'), { title: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'staffProfiles', 's1'), { birthday: '1990-01-01' }));
    await assertSucceeds(setDoc(doc(db, 'meetings', 'm1'), { kind: 'oneOnOne' }));
    await assertSucceeds(setDoc(doc(db, 'execUpdates', 'e1'), { body: '' }));
  });

  it('is denied every personal module', async () => {
    const db = as(LOUIE).firestore();
    await assertFails(getDoc(doc(db, 'personal', ADAM.uid, 'socialDrafts', 'd1')));
    await assertFails(getDocs(collection(db, 'personal', ADAM.uid, 'socialDrafts')));
    await assertFails(setDoc(doc(db, 'personal', LOUIE.uid, 'profile', 'main'), { fullName: 'Louie' }));
  });

  it('cannot change roles or list users', async () => {
    const db = as(LOUIE).firestore();
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, 'users', LOUIE.uid), { role: 'Super Admin' }));
    await assertFails(updateDoc(doc(db, 'users', DESIGNER.uid), { role: 'Admin' }));
  });
});

describe('Regular User', () => {
  it('reads only their own staff record and assigned projects', async () => {
    const db = as(DESIGNER).firestore();
    await assertSucceeds(getDoc(doc(db, 'staff', 's1')));
    await assertFails(getDoc(doc(db, 'staff', 's2')));
    await assertFails(getDocs(collection(db, 'staff')));
    await assertSucceeds(getDoc(doc(db, 'projects', 'p1')));
    await assertFails(getDoc(doc(db, 'projects', 'p2')));
    await assertFails(getDocs(collection(db, 'projects')));
    await assertSucceeds(getDocs(query(collection(db, 'projects'), where('assignedStaffIds', 'array-contains', 's1'))));
  });

  it('is denied financials, professional modules and personal modules', async () => {
    const db = as(DESIGNER).firestore();
    await assertFails(getDocs(collection(db, 'sales')));
    await assertFails(getDoc(doc(db, 'proposals', 'pr1')));
    await assertFails(getDocs(collection(db, 'meetings')));
    await assertFails(getDoc(doc(db, 'staffProfiles', 's1')));
    await assertFails(getDoc(doc(db, 'personal', ADAM.uid, 'socialDrafts', 'd1')));
    await assertFails(setDoc(doc(db, 'projects', 'p1'), { client: 'hacked', assignedStaffIds: ['s1'] }));
  });

  it('manages only their own tasks', async () => {
    const db = as(DESIGNER).firestore();
    await assertSucceeds(getDocs(query(collection(db, 'tasks'), where('ownerUid', '==', DESIGNER.uid))));
    await assertSucceeds(setDoc(doc(db, 'tasks', 't2'), { ownerUid: DESIGNER.uid, title: 'x' }));
    await assertFails(setDoc(doc(db, 'tasks', 't3'), { ownerUid: ADAM.uid, title: 'x' }));
    await assertFails(getDocs(collection(db, 'tasks')));
  });

  it('can edit name/avatar but not role or staff link', async () => {
    const db = as(DESIGNER).firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', DESIGNER.uid), { name: 'Designer', avatar: 'x' }));
    await assertFails(updateDoc(doc(db, 'users', DESIGNER.uid), { role: 'Admin' }));
    await assertFails(updateDoc(doc(db, 'users', DESIGNER.uid), { staffId: 's2' }));
  });
});

describe('First sign-in (lib/auth.ts flow)', () => {
  it('a new user can only create themselves as Regular User', async () => {
    const db = as(NEWBIE).firestore();
    await assertFails(setDoc(doc(db, 'users', NEWBIE.uid), { email: NEWBIE.email, name: 'N', role: 'Super Admin', avatar: '' }));
    await assertFails(setDoc(doc(db, 'users', NEWBIE.uid), { email: NEWBIE.email, name: 'N', role: 'Admin', avatar: '' }));
    await assertSucceeds(setDoc(doc(db, 'users', NEWBIE.uid), { email: NEWBIE.email, name: 'N', role: 'Regular User', avatar: '' }));
  });

  it('a pre-created invite carries its role, and can be consumed', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', NEWBIE.email), { email: NEWBIE.email, name: 'N', role: 'Admin', avatar: '' });
    });
    const db = as(NEWBIE).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', NEWBIE.email)));
    await assertSucceeds(setDoc(doc(db, 'users', NEWBIE.uid), { email: NEWBIE.email, name: 'N', role: 'Admin', avatar: '' }));
    await assertSucceeds(deleteDoc(doc(db, 'users', NEWBIE.email)));
  });

  it("Adam's very first sign-in follows lib/auth.ts exactly", async () => {
    // Empty database apart from other users: no users/{uid} doc for Adam yet.
    await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore(), 'users', ADAM.uid)); });
    const db = as(ADAM).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', ADAM.uid)));
    await assertSucceeds(getDoc(doc(db, 'users', ADAM.email)));
    await assertSucceeds(setDoc(doc(db, 'users', ADAM.uid), { email: ADAM.email, name: 'Adam Wilson', role: 'Super Admin', avatar: 'https://example.com/a.png' }));
    await assertSucceeds(getDocs(collection(db, 'staff')));
    await assertSucceeds(getDocs(collection(db, 'sales')));
  });

  it("Adam's account may promote itself to Super Admin", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', ADAM.uid), { email: ADAM.email, name: 'Adam', role: 'Regular User', avatar: '' });
    });
    const db = as(ADAM).firestore();
    await assertSucceeds(setDoc(doc(db, 'users', ADAM.uid), { email: ADAM.email, name: 'Adam', role: 'Super Admin', avatar: '' }));
  });

  it('non-Lazer accounts get nothing', async () => {
    const db = as(OUTSIDER).firestore();
    await assertFails(setDoc(doc(db, 'users', OUTSIDER.uid), { email: OUTSIDER.email, name: 'O', role: 'Regular User', avatar: '' }));
    await assertFails(getDocs(collection(db, 'projects')));
  });

  it('unauthenticated requests get nothing', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'staff', 's1')));
    await assertFails(getDoc(doc(db, 'test', 'connection')));
  });
});

describe('Personal modules', () => {
  const paths = ['profile/main', 'socialDrafts/d2', 'socialWeeks/2026-10-19', 'reminders/r1', 'jobApplications/a1', 'tailoredDocs/t1', 'settings/jobSearch'];

  it('Adam can read and write every personal collection', async () => {
    const db = as(ADAM).firestore();
    for (const p of paths) {
      await assertSucceeds(setDoc(doc(db, `personal/${ADAM.uid}/${p}`), { x: 1 }));
      await assertSucceeds(getDoc(doc(db, `personal/${ADAM.uid}/${p}`)));
    }
  });

  it('Louie and regular users are denied all of them', async () => {
    for (const who of [LOUIE, DESIGNER]) {
      const db = as(who).firestore();
      for (const p of paths) {
        await assertFails(getDoc(doc(db, `personal/${ADAM.uid}/${p}`)));
        await assertFails(setDoc(doc(db, `personal/${who.uid}/${p}`), { x: 1 }));
      }
    }
  });

  it('OAuth tokens are never readable from a client', async () => {
    await assertFails(getDoc(doc(as(ADAM).firestore(), `integrations/${ADAM.uid}/googleAccounts/lazer`)));
  });
});

describe('Storage', () => {
  it('professional files are Admin+, personal files are owner Super Admin only', async () => {
    await assertSucceeds(uploadString(ref(as(LOUIE).storage(), 'professional/templates/a.docx'), 'x'));
    await assertSucceeds(uploadString(ref(as(ADAM).storage(), 'personal/adam/resume.pdf'), 'x'));
    await assertSucceeds(getBytes(ref(as(ADAM).storage(), 'professional/templates/a.docx')));
    await assertFails(getBytes(ref(as(LOUIE).storage(), 'personal/adam/resume.pdf')));
    await assertFails(uploadString(ref(as(LOUIE).storage(), 'personal/louie/x.txt'), 'x'));
    await assertFails(uploadString(ref(as(DESIGNER).storage(), 'professional/templates/b.docx'), 'x'));
  });
});
