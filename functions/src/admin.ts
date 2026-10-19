import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export const bucket = () => getStorage().bucket();

export type Role = 'Super Admin' | 'Admin' | 'Regular User';

// Same role model as firestore.rules. Callables re-check it because the Admin
// SDK bypasses security rules.
export async function requireRole(request: CallableRequest, allowed: Role[]): Promise<{ uid: string; role: Role; email: string }> {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const email = String(auth.token.email || '').toLowerCase();
  if (!auth.token.email_verified || !email.endsWith('@lazertechnologies.com')) {
    throw new HttpsError('permission-denied', 'A verified @lazertechnologies.com account is required.');
  }
  const snap = await db.doc(`users/${auth.uid}`).get();
  const role = snap.get('role') as Role | undefined;
  if (!role || !allowed.includes(role)) throw new HttpsError('permission-denied', 'Your role does not allow this.');
  return { uid: auth.uid, role, email };
}

export const PROFESSIONAL: Role[] = ['Super Admin', 'Admin'];
export const PERSONAL: Role[] = ['Super Admin'];

// Storage paths a caller may read, mirroring storage.rules.
export function assertReadablePath(path: string, uid: string, role: Role) {
  if (path.startsWith('professional/') && PROFESSIONAL.includes(role)) return;
  if (path.startsWith(`personal/${uid}/`) && role === 'Super Admin') return;
  throw new HttpsError('permission-denied', `Not allowed to read ${path}.`);
}
