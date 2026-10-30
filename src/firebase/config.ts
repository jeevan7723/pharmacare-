import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyBb8aNpfTSXCyJ8ONvRabqfgXWInHXhTSY',
  authDomain: 'pharmacare-1d3a2.firebaseapp.com',
  projectId: 'pharmacare-1d3a2',
  storageBucket: 'pharmacare-1d3a2.firebasestorage.app',
  messagingSenderId: '668753337521',
  appId: '1:668753337521:web:f06d98a5e4cc556b33d690',
  measurementId: 'G-Y11GXJS65E',
};

// Initialize Firebase App instance safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Automatically sign in anonymously so requests carry valid credentials for Firestore rules
signInAnonymously(auth).catch((err) => {
  // Anonymous auth might need to be enabled in Firebase Console (Authentication > Sign-in method)
  console.info('Firebase Auth Notice:', err?.message || err);
});

// Initialize Cloud Firestore with persistent multi-tab local cache for seamless offline billing
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreInstance = getFirestore(app);
}

export const firestore = firestoreInstance;
