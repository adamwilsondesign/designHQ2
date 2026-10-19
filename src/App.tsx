/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, StaffMember, Project, Sale } from './lib/mockData';
import { subscribeToAuthChanges } from './lib/auth';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/views/Dashboard';
import Staff from './components/views/Staff';
import Allocation from './components/views/Allocation';
import Projects from './components/views/Projects';
import Revenue from './components/views/Revenue';
import Admin from './components/views/Admin';
import { AnimatePresence, motion } from 'motion/react';
import DailyCheckIn from './components/DailyCheckIn';
import AddStaffWizard from './components/wizards/AddStaffWizard';
import AddSaleWizard from './components/wizards/AddSaleWizard';
import AddProjectWizard from './components/wizards/AddProjectWizard';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { lightTheme, darkTheme } from './lib/theme';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Daily Check In State
  const [showDailyCheckIn, setShowDailyCheckIn] = useState(false);
  const [checkInResponses, setCheckInResponses] = useState<{newStaff: boolean, newLeads: boolean, newProjects: boolean} | null>(null);
  const [activeWizard, setActiveWizard] = useState<'staff' | 'leads' | 'projects' | null>(null);

  // Global State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dhq_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('dhq_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('dhq_theme', 'light');
    }
  }, [isDarkMode]);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);

  // Test connection on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((sessionUser, uid) => {
      setUser(sessionUser);
      setUserId(uid);
      setIsAuthReady(true);
      setLoading(false);
      
      // Check for daily check-in
      if (sessionUser && sessionUser.role === 'Super Admin') {
        const today = new Date().toISOString().split('T')[0];
        const lastCheckIn = localStorage.getItem('dhq_last_checkin');
        if (lastCheckIn !== today) {
          setShowDailyCheckIn(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffMember)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'staff');
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjectsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSalesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    return () => {
      unsubStaff();
      unsubProjects();
      unsubSales();
    };
  }, [isAuthReady, user]);

  const handleSetStaffList = async (action: StaffMember[] | ((prev: StaffMember[]) => StaffMember[])) => {
    const resolvedList = typeof action === 'function' ? action(staffList) : action;
    const oldMap = new Map(staffList.map(s => [s.id, s]));
    const newMap = new Map(resolvedList.map(s => [s.id, s]));
    
    // Handle updates and creations
    for (const item of resolvedList) {
      const oldItem = oldMap.get(item.id);
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
        try {
          const data = {
            name: item.name,
            personalEmail: item.personalEmail || '',
            lazerEmail: item.lazerEmail || '',
            location: item.location,
            timezone: item.timezone,
            employmentType: item.employmentType,
            hourlyCost: item.hourlyCost,
            skills: item.skills
          };
          await setDoc(doc(db, 'staff', item.id), data);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'staff');
        }
      }
    }
    
    // Handle deletions
    for (const [id, _] of oldMap) {
      if (!newMap.has(id)) {
        try {
          await deleteDoc(doc(db, 'staff', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'staff');
        }
      }
    }
  };

  const handleSetProjectsList = async (action: Project[] | ((prev: Project[]) => Project[])) => {
    const resolvedList = typeof action === 'function' ? action(projectsList) : action;
    const oldMap = new Map(projectsList.map(s => [s.id, s]));
    const newMap = new Map(resolvedList.map(s => [s.id, s]));
    
    // Handle updates and creations
    for (const item of resolvedList) {
      const oldItem = oldMap.get(item.id);
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
        try {
          const data = {
            client: item.client,
            lob: item.lob,
            type: item.type,
            clientLocation: item.clientLocation,
            status: item.status,
            totalHours: item.totalHours,
            billedRate: item.billedRate,
            totalValue: item.totalValue,
            startDate: item.startDate,
            finishDate: item.finishDate,
            assignedStaffIds: item.assignedStaffIds,
            staffAllocations: item.staffAllocations || {},
            designSourced: item.designSourced ?? false,
            designClosed: item.designClosed ?? false
          };
          await setDoc(doc(db, 'projects', item.id), data);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'projects');
        }
      }
    }
    
    // Handle deletions
    for (const [id, _] of oldMap) {
      if (!newMap.has(id)) {
        try {
          await deleteDoc(doc(db, 'projects', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'projects');
        }
      }
    }
  };

  const handleSetSalesList = async (action: Sale[] | ((prev: Sale[]) => Sale[])) => {
    const resolvedList = typeof action === 'function' ? action(salesList) : action;
    const oldMap = new Map(salesList.map(s => [s.id, s]));
    const newMap = new Map(resolvedList.map(s => [s.id, s]));
    
    // Handle updates and creations
    for (const item of resolvedList) {
      const oldItem = oldMap.get(item.id);
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(item)) {
        try {
          const data = {
            client: item.client,
            lob: item.lob,
            type: item.type,
            clientLocation: item.clientLocation,
            status: item.status,
            projectedValue: item.projectedValue,
            projectedHours: item.projectedHours,
            projectedRate: item.projectedRate,
            lastContactDate: item.lastContactDate,
            designSourced: item.designSourced ?? false,
            designClosed: item.designClosed ?? false
          };
          await setDoc(doc(db, 'sales', item.id), data);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'sales');
        }
      }
    }
    
    // Handle deletions
    for (const [id, _] of oldMap) {
      if (!newMap.has(id)) {
        try {
          await deleteDoc(doc(db, 'sales', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'sales');
        }
      }
    }
  };

  const handleCheckInComplete = (responses: { newStaff: boolean, newLeads: boolean, newProjects: boolean }) => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('dhq_last_checkin', today);
    setShowDailyCheckIn(false);
    setCheckInResponses(responses);
    
    if (responses.newStaff) setActiveWizard('staff');
    else if (responses.newLeads) setActiveWizard('leads');
    else if (responses.newProjects) setActiveWizard('projects');
  };

  const handleCheckInSkip = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('dhq_last_checkin', today);
    setShowDailyCheckIn(false);
  };

  const handleWizardClose = () => {
    if (!checkInResponses) {
      setActiveWizard(null);
      return;
    }
    
    if (activeWizard === 'staff') {
      if (checkInResponses.newLeads) setActiveWizard('leads');
      else if (checkInResponses.newProjects) setActiveWizard('projects');
      else {
        setActiveWizard(null);
        setCheckInResponses(null);
      }
    } else if (activeWizard === 'leads') {
      if (checkInResponses.newProjects) setActiveWizard('projects');
      else {
        setActiveWizard(null);
        setCheckInResponses(null);
      }
    } else if (activeWizard === 'projects') {
      setActiveWizard(null);
      setCheckInResponses(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard user={user} staffList={staffList} projectsList={projectsList} salesList={salesList} />;
      case 'staff': return <Staff user={user} staffList={staffList} setStaffList={handleSetStaffList} />;
      case 'allocation': return <Allocation user={user} staffList={staffList} projectsList={projectsList} />;
      case 'projects': return <Projects user={user} projectsList={projectsList} setProjectsList={handleSetProjectsList} staffList={staffList} />;
      case 'revenue': return <Revenue user={user} salesList={salesList} setSalesList={handleSetSalesList} projectsList={projectsList} setProjectsList={handleSetProjectsList} />;
      case 'admin': return <Admin user={user} />;
      default: return <Dashboard user={user} staffList={staffList} projectsList={projectsList} salesList={salesList} />;
    }
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <Layout 
        user={user} 
        userId={userId}
        currentView={currentView} 
        onNavigate={setCurrentView}
        onLogout={() => setUser(null)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>

        {showDailyCheckIn && (
          <DailyCheckIn 
            onComplete={handleCheckInComplete}
            onSkip={handleCheckInSkip}
          />
        )}

        <AddStaffWizard 
          isOpen={activeWizard === 'staff'}
          onClose={handleWizardClose}
          onSave={(staff) => {
            handleSetStaffList([...staffList, staff]);
            handleWizardClose();
          }}
        />

        <AddSaleWizard 
          isOpen={activeWizard === 'leads'}
          onClose={handleWizardClose}
          onSave={(sale) => {
            handleSetSalesList([...salesList, sale]);
            handleWizardClose();
          }}
        />

        <AddProjectWizard 
          isOpen={activeWizard === 'projects'}
          onClose={handleWizardClose}
          onSave={(project) => {
            handleSetProjectsList([...projectsList, project]);
            handleWizardClose();
          }}
          staffList={staffList}
          projectsList={projectsList}
        />
      </Layout>
    </ThemeProvider>
  );
}

