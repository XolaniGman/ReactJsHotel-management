import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyAb2y_vZ7VZpe0QaVLnhd1aVVfg494tqF8',
  authDomain: 'tests-8660d.firebaseapp.com',
  projectId: 'tests-8660d',
  storageBucket: 'tests-8660d.firebasestorage.app',
  messagingSenderId: '889312960107',
  appId: '1:889312960107:web:a24e387386ac251f209b2e',
  measurementId: 'G-4HTZ17Y08V',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let analytics = null;
try {
  analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
} catch {
  analytics = null;
}
export { analytics };
