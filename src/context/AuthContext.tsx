import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import type { UserProfile } from '../types/note';

export type AppUser = User | UserProfile;

interface StoredAccount {
  uid: string;
  email: string;
  displayName: string;
  password: string;
  createdAt: number;
}

interface AuthContextType {
  currentUser: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  resetPassword: (email: string, newPassword?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCOUNTS_STORAGE_KEY = 'cogninote_registered_accounts';
const ACTIVE_SESSION_KEY = 'cogninote_active_session';
const GUEST_STORAGE_KEY = 'cogninote_guest_user';

function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredAccount(account: StoredAccount): void {
  try {
    const accounts = getStoredAccounts();
    const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === account.email.toLowerCase());
    if (existingIdx !== -1) {
      accounts[existingIdx] = account;
    } else {
      accounts.push(account);
    }
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Error saving stored account:', e);
  }
}

function findAccountByEmail(email: string): StoredAccount | undefined {
  const accounts = getStoredAccounts();
  const clean = email.trim().toLowerCase();
  return accounts.find((a) => a.email.toLowerCase() === clean);
}

function updateAccountPassword(email: string, newPass: string): boolean {
  try {
    const accounts = getStoredAccounts();
    const clean = email.trim().toLowerCase();
    const target = accounts.find((a) => a.email.toLowerCase() === clean);
    if (target) {
      target.password = newPass;
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      return true;
    }
  } catch (e) {
    console.warn('Error updating account password:', e);
  }
  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function syncUserProfile(user: User | null) {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const profile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || (user.isAnonymous ? 'Guest Note-Taker' : user.email?.split('@')[0] || 'User'),
      photoURL: user.photoURL,
      isAnonymous: user.isAnonymous,
    };
    setUserProfile(profile);

    // Only sync to Firestore if user is an authenticated Firebase user
    if (
      auth.currentUser &&
      auth.currentUser.uid === user.uid &&
      !user.uid.startsWith('usr_') &&
      !user.uid.startsWith('guest_') &&
      !user.uid.startsWith('local_')
    ) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            name: profile.displayName,
            email: profile.email || 'user@cogninote.app',
            photoURL: profile.photoURL || null,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Could not sync user profile to firestore:', err);
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Active Firebase user (e.g. Google Sign In)
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setCurrentUser(firebaseUser);
        await syncUserProfile(firebaseUser);
        setLoading(false);
      } else {
        // Check for active local account session
        try {
          const storedSession = localStorage.getItem(ACTIVE_SESSION_KEY);
          if (storedSession) {
            const parsedSession: UserProfile = JSON.parse(storedSession);
            setCurrentUser(parsedSession);
            setUserProfile(parsedSession);
            setLoading(false);
            return;
          }

          // Check for existing guest session
          const storedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
          if (storedGuest) {
            const guestProfile: UserProfile = JSON.parse(storedGuest);
            setCurrentUser(guestProfile);
            setUserProfile(guestProfile);
            setLoading(false);
            return;
          }

          setCurrentUser(null);
          setUserProfile(null);
        } catch {
          setCurrentUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!pass) {
      throw new Error('Please enter your password.');
    }

    // Try Firebase Authentication first
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(GUEST_STORAGE_KEY);
      return;
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please verify and try again.');
      }
      if (err.code === 'auth/user-not-found') {
        throw new Error('No account found with this email. Please click Create Account.');
      }

      // If Firebase Email Auth is disabled or restricted in this Firebase project:
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/admin-restricted-operation' ||
        err.message?.includes('operation-not-allowed')
      ) {
        const storedUser = findAccountByEmail(cleanEmail);
        if (!storedUser) {
          throw new Error('No account found with this email. Please switch to Create Account to register.');
        }

        if (storedUser.password !== pass) {
          throw new Error('Incorrect password. Please try again or use Reset Password.');
        }

        const profile: UserProfile = {
          uid: storedUser.uid,
          email: storedUser.email,
          displayName: storedUser.displayName,
          photoURL: null,
          isAnonymous: false,
        };

        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(profile));
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setCurrentUser(profile);
        setUserProfile(profile);
        return;
      }

      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Please enter your full name.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!pass || pass.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    // Try Firebase Authentication first
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      await updateProfile(cred.user, { displayName: cleanName });
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(GUEST_STORAGE_KEY);
      await syncUserProfile({ ...cred.user, displayName: cleanName } as User);
      return;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in with your password.');
      }

      // If Firebase Email Auth is disabled/restricted in this project:
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/admin-restricted-operation' ||
        err.message?.includes('operation-not-allowed')
      ) {
        const existing = findAccountByEmail(cleanEmail);
        if (existing) {
          throw new Error('An account with this email already exists. Please click Log In.');
        }

        const newUid = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        const newAccount: StoredAccount = {
          uid: newUid,
          email: cleanEmail,
          displayName: cleanName,
          password: pass,
          createdAt: Date.now(),
        };

        saveStoredAccount(newAccount);

        const profile: UserProfile = {
          uid: newAccount.uid,
          email: newAccount.email,
          displayName: newAccount.displayName,
          photoURL: null,
          isAnonymous: false,
        };

        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(profile));
        localStorage.removeItem(GUEST_STORAGE_KEY);
        setCurrentUser(profile);
        setUserProfile(profile);
        return;
      }

      throw err;
    }
  };

  const loginWithGoogle = async () => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(GUEST_STORAGE_KEY);
    await signInWithPopup(auth, googleProvider);
  };

  const loginAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/admin-restricted-operation' ||
        err.message?.includes('operation-not-allowed')
      ) {
        let guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
        try {
          const existing = localStorage.getItem(GUEST_STORAGE_KEY);
          if (existing) {
            const parsed = JSON.parse(existing);
            if (parsed.uid) guestId = parsed.uid;
          }
        } catch {}

        const localGuest: UserProfile = {
          uid: guestId,
          email: null,
          displayName: 'Guest Note-Taker',
          photoURL: null,
          isAnonymous: true,
        };
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(localGuest));
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        setCurrentUser(localGuest);
        setUserProfile(localGuest);
        return;
      }
      throw err;
    }
  };

  const resetPassword = async (email: string, newPassword?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter your email address.');

    // If a new password is provided for password change
    if (newPassword) {
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
      const updated = updateAccountPassword(cleanEmail, newPassword);
      if (updated) {
        // Automatically establish session with new password
        const account = findAccountByEmail(cleanEmail);
        if (account) {
          const profile: UserProfile = {
            uid: account.uid,
            email: account.email,
            displayName: account.displayName,
            photoURL: null,
            isAnonymous: false,
          };
          localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(profile));
          setCurrentUser(profile);
          setUserProfile(profile);
        }
        return;
      }
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.message?.includes('operation-not-allowed')
      ) {
        const existing = findAccountByEmail(cleanEmail);
        if (!existing) {
          throw new Error('No account found with this email address.');
        }
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    await signOut(auth).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        loginWithEmail,
        signUpWithEmail,
        loginWithGoogle,
        loginAsGuest,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
