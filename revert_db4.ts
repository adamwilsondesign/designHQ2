import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const closedSales = sales.filter(s => s.status === 'Closed');
  console.log('Closed sales:', closedSales.length);
  for (const s of closedSales) {
    console.log('Reverting sale:', s.id, s.client);
    await updateDoc(doc(db, 'sales', s.id), { status: 'In Negotiation' });
  }

  process.exit(0);
}
run().catch(console.error);
