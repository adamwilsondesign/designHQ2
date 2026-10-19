import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  projects.filter(p => p.assignedStaffIds?.includes('6u51ob61f')).forEach(p => {
    console.log(`Project ${p.id} (${p.client}): ${p.startDate} to ${p.finishDate}, status: ${p.status}`);
  });

  process.exit(0);
}
run().catch(console.error);
