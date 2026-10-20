import { User } from './mockData';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    if (!user.email?.endsWith('@lazertechnologies.com')) {
      await signOut(auth);
      throw new Error('Must use a @lazertechnologies.com email address');
    }

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.email === 'adamwilson@lazertechnologies.com' && userData.role !== 'Super Admin') {
        const updatedUser = { ...userData, role: 'Super Admin' as const };
        await setDoc(userRef, updatedUser);
        return updatedUser;
      }
      return userData;
    } else {
      // Check if a pre-created user exists by email
      const emailLower = user.email.toLowerCase();
      const preCreatedRef = doc(db, 'users', emailLower);
      const preCreatedSnap = await getDoc(preCreatedRef);
      
      let role: User['role'] = emailLower === 'adamwilson@lazertechnologies.com' ? 'Super Admin' : 'Regular User';
      
      if (preCreatedSnap.exists()) {
        role = preCreatedSnap.data().role as User['role'];
      }

      // An invite can also carry the staff record this person is linked to.
      const invitedStaffId = preCreatedSnap.exists() ? preCreatedSnap.data().staffId : undefined;

      // Create new user profile
      const newUser: User = {
        email: emailLower,
        name: user.displayName || emailLower.split('@')[0],
        role: role,
        avatar: user.photoURL || `https://i.pravatar.cc/150?u=${emailLower}`,
        ...(invitedStaffId ? { staffId: invitedStaffId } : {}),
      };
      
      await setDoc(userRef, newUser);
      
      if (preCreatedSnap.exists()) {
        await deleteDoc(preCreatedRef);
      }
      
      return newUser;
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null, uid: string | null) => void) {
  let unsubDoc: (() => void) | null = null;
  
  const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
    if (unsubDoc) {
      unsubDoc();
      unsubDoc = null;
    }
    
    if (firebaseUser) {
      const userRef = doc(db, 'users', firebaseUser.uid);
      unsubDoc = onSnapshot(userRef, async (userSnap) => {
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          if (userData.email === 'adamwilson@lazertechnologies.com' && userData.role !== 'Super Admin') {
            const updatedUser = { ...userData, role: 'Super Admin' as const };
            await setDoc(userRef, updatedUser);
            callback(updatedUser, firebaseUser.uid);
          } else {
            callback(userData, firebaseUser.uid);
          }
        } else {
          callback(null, null);
        }
      });
    } else {
      callback(null, null);
    }
  });
  
  return () => {
    unsubAuth();
    if (unsubDoc) unsubDoc();
  };
}
