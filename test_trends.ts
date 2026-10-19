import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { calculateWeeklyTrends } from './src/lib/trends';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const trends = calculateWeeklyTrends(projects, staff);
  console.log('Trends:', trends?.currentUtilFte);
  console.log('Total FTEs:', staff.filter(s => s.employmentType === 'Full-Time').length);

  process.exit(0);
}
run().catch(console.error);
