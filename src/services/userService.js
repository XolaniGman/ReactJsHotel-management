import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const col = 'users';

export const ADMIN_EMAIL = 'admin@hotel.com';

export const isAdminAccount = (email) => (email || '').trim().toLowerCase() === ADMIN_EMAIL;

export const DEMO_ACCOUNTS = {
  'admin@hotel.com': 'admin',
  'housekeeping@hotel.com': 'housekeeping',
  'laundry@hotel.com': 'laundry',
  'storekeeper@hotel.com': 'storekeeper',
  'mainatance@outlook.com': 'maintenance',
  'system@hotel.com': 'system',
};

export const demoRole = (email) => {
  if (!email) return null;
  return DEMO_ACCOUNTS[email.trim().toLowerCase()] || null;
};

export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, col, uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
};

export const ensureUserDoc = async (uid, email, fallbackName) => {
  const snap = await getDoc(doc(db, col, uid));
  const demo = demoRole(email);
  if (snap.exists()) {
    const data = snap.data();
    let role = data.role;
    if (isAdminAccount(email)) role = 'admin';
    else if (role === 'admin' && !isAdminAccount(email)) role = 'guest';
    else if (demo && role === 'guest') role = demo;
    if (role !== data.role) {
      await updateDoc(doc(db, col, uid), { role });
      return { uid, ...data, role };
    }
    return { uid, ...data };
  }
  const data = {
    name: fallbackName || email,
    email,
    role: isAdminAccount(email) ? 'admin' : demo || 'guest',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, col, uid), data);
  return { uid, ...data };
};

export const createUserDoc = (uid, data) =>
  setDoc(doc(db, col, uid), { ...data, createdAt: Date.now() });

export const updateUser = (uid, data) => updateDoc(doc(db, col, uid), data);

export const listUsers = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};

export const listGuests = async () => {
  const snap = await getDocs(query(collection(db, col), where('role', '==', 'guest')));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
};

export const getAdminCount = async () => {
  const snap = await getDocs(query(collection(db, col), where('role', '==', 'admin')));
  return snap.size;
};
