import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const badProjects = projects.filter(p => p.startDate === '2026-04-09' && p.finishDate === '2026-05-09');
  console.log('Bad projects found:', badProjects.length);
  
  for (const p of badProjects) {
    console.log('Deleting project:', p.id, p.client);
    await deleteDoc(doc(db, 'projects', p.id));
    
    // The sale ID is the same as the project ID
    console.log('Reverting sale:', p.id);
    await updateDoc(doc(db, 'sales', p.id), { status: 'In Negotiation' });
  }

  console.log('Done reverting.');
  process.exit(0);
}
run().catch(console.error);
