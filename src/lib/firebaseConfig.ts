import legacyConfig from '../../firebase-applet-config.json';

// Chooses which Firebase project the app talks to.
//   VITE_FIREBASE_TARGET=rebuild  the new project, from VITE_FIREBASE_* env vars
//   VITE_FIREBASE_TARGET=legacy   the production project in firebase-applet-config.json
// There is deliberately no default: an unconfigured build must not silently
// read and write the production database.

export type FirebaseTarget = 'rebuild' | 'legacy';

export interface ResolvedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export const LEGACY_PROJECT_ID = legacyConfig.projectId;

export function getFirebaseConfigError(): string | null {
  try {
    resolveFirebaseConfig();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function resolveFirebaseConfig(): { target: FirebaseTarget; config: ResolvedFirebaseConfig } {
  const env = import.meta.env;
  const target = env.VITE_FIREBASE_TARGET as FirebaseTarget | undefined;

  if (target === 'legacy') {
    return { target, config: legacyConfig };
  }

  if (target === 'rebuild') {
    const config: ResolvedFirebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY || '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: env.VITE_FIREBASE_APP_ID || '',
      firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || undefined,
    };
    const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter(k => !config[k]);
    if (missing.length > 0) {
      throw new Error(`VITE_FIREBASE_TARGET=rebuild but these values are missing from this build: ${missing.map(k => `VITE_FIREBASE_${k.replace(/[A-Z]/g, c => '_' + c).toUpperCase()}`).join(', ')}. Add them to the hosting environment variables (or .env.local) and rebuild.`);
    }
    if (config.projectId === LEGACY_PROJECT_ID) {
      throw new Error('VITE_FIREBASE_TARGET=rebuild points at the legacy production project. Use a separate Firebase project for the rebuild.');
    }
    return { target, config };
  }

  throw new Error(
    'VITE_FIREBASE_TARGET is not set in this build. On Vercel: Project Settings → Environment Variables, add VITE_FIREBASE_TARGET=rebuild ' +
      'and the other VITE_FIREBASE_* values for this environment (Production and/or Preview), then redeploy. Locally: copy .env.example to .env.local.',
  );
}
