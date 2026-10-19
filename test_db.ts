import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const salesSnap = await getDocs(collection(db, 'sales'));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  console.log('Total sales:', sales.length);
  const inNeg = sales.filter(s => s.status === 'In Negotiation');
  console.log('In Negotiation:', inNeg.length);
  
  // Close 3 of them
  let closedCount = 0;
  for (const sale of inNeg) {
    if (closedCount >= 3) break;
    await updateDoc(doc(db, 'sales', sale.id), { status: 'Closed' });
    
    // Also create a project for the closed sale
    await setDoc(doc(db, 'projects', sale.id), {
      client: sale.client,
      lob: sale.lob,
      type: sale.type,
      clientLocation: sale.clientLocation,
      status: 'Open',
      startDate: new Date().toISOString().split('T')[0],
      finishDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalValue: sale.projectedValue,
      totalHours: sale.projectedHours || Math.round(sale.projectedValue / 150),
      billedRate: sale.projectedRate || 150,
      assignedStaffIds: [],
      staffAllocations: {},
      designSourced: sale.designSourced || false,
      designClosed: sale.designClosed || false
    });
    
    closedCount++;
  }
  console.log('Closed', closedCount, 'sales and created projects');
  
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('Total projects:', projects.length);
  
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('Total staff:', staff.length);
  
  process.exit(0);
}
run().catch(console.error);
