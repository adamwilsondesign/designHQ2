import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, Firestore, getDocs, getFirestore } from 'firebase/firestore';
import legacyConfig from '../../../../firebase-applet-config.json';
import { DocMap } from '../../../../scripts/migrate/transform';
import { LEGACY_COLLECTIONS } from './plan';

// Read-only connection to the old DesignHQ project (AI Studio). It runs as a
// separate Firebase app with its own sign-in, and this module only ever calls
// getDocs on it.

const EMULATED = import.meta.env.VITE_USE_EMULATORS === 'true';

function legacyApp() {
  const existing = getApps().find(a => a.name === 'legacy');
  if (existing) return { app: existing, db: getFirestore(existing, EMULATED ? '(default)' : legacyConfig.firestoreDatabaseId) };
  const app = initializeApp(EMULATED ? { ...legacyConfig, projectId: 'demo-legacy' } : legacyConfig, 'legacy');
  const db: Firestore = EMULATED ? getFirestore(app) : getFirestore(app, legacyConfig.firestoreDatabaseId);
  if (EMULATED) {
    connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { app, db };
}

export const legacyAuth = () => getAuth(legacyApp().app);
export const LEGACY_PROJECT_ID = legacyConfig.projectId;

export async function connectLegacy() {
  const current = legacyAuth().currentUser;
  if (current?.email) return current.email; // already signed in (e.g. retrying)
  const cred = await signInWithPopup(legacyAuth(), new GoogleAuthProvider());
  return cred.user.email || '';
}

export const disconnectLegacy = () => signOut(legacyAuth());

export async function readLegacy(): Promise<Record<string, DocMap>> {
  const { db } = legacyApp();
  const out: Record<string, DocMap> = {};
  for (const name of LEGACY_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    out[name] = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
  }
  return out;
}
