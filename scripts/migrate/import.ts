// One-time import of an export.json into the NEW DesignHQ project, applying the
// extended-schema transform (transform.ts).
//
//   GOOGLE_APPLICATION_CREDENTIALS=rebuild-sa.json npm run migrate:import -- \
//     --in migration-export/<stamp>/export.json --project <new-project-id> [--database <id>] [--commit]
//
// Safety:
//   * Dry run unless --commit is passed. The dry run prints exactly what would be written.
//   * Refuses to target the legacy production project.
//   * Uses create(), so an existing document in the target is never overwritten;
//     the run stops on the first conflict.
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { GeoPoint, getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import { ExportFile, LEGACY_PROJECT_ID, transformExport } from './transform';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const inFile = arg('in');
  const projectId = arg('project');
  const databaseId = arg('database');
  const commit = process.argv.includes('--commit');

  if (!inFile || !projectId) {
    console.error('Usage: --in <export.json> --project <new-project-id> [--database <id>] [--commit]');
    process.exit(1);
  }
  if (projectId === LEGACY_PROJECT_ID) {
    console.error(`Refusing to import into ${projectId}: that is the legacy production project.`);
    process.exit(1);
  }

  const input: ExportFile = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const { collections, report } = transformExport(input);

  console.log(`Source: ${input.source.projectId} (${input.source.databaseId ?? 'default'}) exported ${input.exportedAt}`);
  console.log(`Target: ${projectId} (${databaseId ?? 'default'})${commit ? '' : '  [DRY RUN]'}`);
  for (const [name, docs] of Object.entries(collections)) {
    console.log(`  ${name}: ${Object.keys(docs).length} docs`);
  }
  console.log('Companion docs created:', report.created);
  console.log('Users linked to staff:', report.linkedUsers);
  if (report.ambiguousLinks.length) console.log('Ambiguous staff matches (left unlinked):', report.ambiguousLinks);
  if (report.unlinkedUsers.length) console.log('Users with no staff match (left unlinked):', report.unlinkedUsers);

  if (!commit) {
    console.log('\nDry run only. Re-run with --commit to write.');
    return;
  }

  const app = initializeApp({
    projectId,
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')))
      : applicationDefault(),
  });
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const deserialize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(deserialize);
    if (value && typeof value === 'object') {
      const v = value as Record<string, any>;
      if (v.__type === 'timestamp') return new Timestamp(v.seconds, v.nanoseconds);
      if (v.__type === 'geopoint') return new GeoPoint(v.latitude, v.longitude);
      if (v.__type === 'ref') return db.doc(v.path);
      if (v.__type === 'bytes') return Buffer.from(v.base64, 'base64');
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deserialize(x)]));
    }
    return value;
  };

  for (const [name, docs] of Object.entries(collections)) {
    const entries = Object.entries(docs);
    for (let i = 0; i < entries.length; i += 400) {
      const batch = db.batch();
      for (const [id, data] of entries.slice(i, i + 400)) {
        batch.create(db.collection(name).doc(id), deserialize(data) as FirebaseFirestore.DocumentData);
      }
      await batch.commit();
    }
    console.log(`  wrote ${name}: ${entries.length}`);
  }
  console.log('Import complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
