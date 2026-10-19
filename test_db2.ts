import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  console.log('PROJECTS:', JSON.stringify(projects, null, 2));
  
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  console.log('STAFF:', JSON.stringify(staff, null, 2));

  process.exit(0);
}
run().catch(console.error);
