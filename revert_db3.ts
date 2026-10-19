import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const salesSnap = await getDocs(collection(db, 'sales'));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const saleIds = new Set(sales.map(s => s.id));
  
  const badProjects = projects.filter(p => saleIds.has(p.id));
  console.log('Bad projects found:', badProjects.length);
  
  for (const p of badProjects) {
    console.log('Deleting project:', p.id, p.client);
    await deleteDoc(doc(db, 'projects', p.id));
    
    console.log('Reverting sale:', p.id);
    await updateDoc(doc(db, 'sales', p.id), { status: 'In Negotiation' });
  }

  process.exit(0);
}
run().catch(console.error);
