import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const now = new Date();
  const parseLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const currentActiveProjects = projects.filter(p => {
    if (!p.startDate || !p.finishDate) return false;
    const start = parseLocalDate(p.startDate);
    const end = parseLocalDate(p.finishDate);
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now;
  });
  
  console.log('Active projects:', currentActiveProjects.map(p => p.id));
  
  const fullTimeStaffIds = new Set(['6u51ob61f', 'ppia4woxs', 'x8avmp4dk']);
  
  let totalAllocatedPercentage = 0;
  currentActiveProjects.forEach(p => {
    if (p.assignedStaffIds) {
      p.assignedStaffIds.forEach(staffId => {
        if (fullTimeStaffIds.has(staffId)) {
          const allocation = p.staffAllocations?.[staffId] ?? 100;
          totalAllocatedPercentage += allocation;
          console.log(`Staff ${staffId} allocated ${allocation}% on project ${p.id}`);
        }
      });
    }
  });
  
  console.log('Total allocated percentage:', totalAllocatedPercentage);
  console.log('FTEs on bench:', 3 - (totalAllocatedPercentage / 100));

  process.exit(0);
}
run().catch(console.error);
