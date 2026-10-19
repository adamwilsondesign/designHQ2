import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log('Total projects:', projects.length);
  
  const badProjects = projects.filter(p => p.id === '0qi7nund7' || p.id === 'a1twefl4z' || p.id === 'xs6liy8io'); // I only found 2 earlier, let's just find the ones with 0qi7nund7 and a1twefl4z
  console.log('Bad projects found:', badProjects.length);
  
  for (const p of badProjects) {
    console.log('Deleting project:', p.id, p.client);
    await deleteDoc(doc(db, 'projects', p.id));
    
    // The sale ID is the same as the project ID
    console.log('Reverting sale:', p.id);
    await updateDoc(doc(db, 'sales', p.id), { status: 'In Negotiation' });
  }

  process.exit(0);
}
run().catch(console.error);
