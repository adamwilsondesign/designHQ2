import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const inNeg = sales.filter(s => s.status === 'In Negotiation');
  console.log('In Negotiation:', inNeg.length);
  
  const open = sales.filter(s => s.status === 'Open');
  console.log('Open:', open.length);
  
  const closed = sales.filter(s => s.status === 'Closed');
  console.log('Closed:', closed.length);

  process.exit(0);
}
run().catch(console.error);
