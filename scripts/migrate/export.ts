// One-time export of every Firestore collection in the legacy DesignHQ project
// to JSON. Read-only: it never writes to the source.
//
//   GOOGLE_APPLICATION_CREDENTIALS=legacy-sa.json npm run migrate:export
//   (optional) -- --project <id> --database <id> --out <dir>
//
// Defaults come from firebase-applet-config.json (the production config).
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { DocumentReference, getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import type { DocMap, ExportFile } from './transform';

const legacy = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

// Firestore types are tagged so import.ts can restore them exactly.
function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __type: 'ref', path: value.path };
  if (Buffer.isBuffer(value)) return { __type: 'bytes', base64: value.toString('base64') };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

async function main() {
  const projectId = arg('project', legacy.projectId)!;
  const databaseId = arg('database', legacy.firestoreDatabaseId) || null;
  const outDir = arg('out', path.join('migration-export', new Date().toISOString().replace(/[:.]/g, '-')))!;

  const app = initializeApp({
    projectId,
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')))
      : applicationDefault(),
  });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const result: ExportFile = { exportedAt: new Date().toISOString(), source: { projectId, databaseId }, collections: {} };

  // Subcollections are flattened into "parent/doc/sub" collection keys.
  async function exportCollection(ref: FirebaseFirestore.CollectionReference) {
    const snap = await ref.get();
    const docs: DocMap = {};
    for (const d of snap.docs) {
      docs[d.id] = serialize(d.data()) as Record<string, unknown>;
      for (const sub of await d.ref.listCollections()) {
        await exportCollection(sub);
      }
    }
    result.collections[ref.path] = docs;
    console.log(`  ${ref.path}: ${snap.size} docs`);
  }

  console.log(`Exporting ${projectId}${databaseId ? ` (database ${databaseId})` : ''}`);
  for (const col of await db.listCollections()) {
    await exportCollection(col);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'export.json');
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`Wrote ${file}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
