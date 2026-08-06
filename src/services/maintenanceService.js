import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const col = 'maintenanceRequests';

export const createMaintenanceRequest = async ({
  guestUid,
  guestName,
  roomNumber,
  category,
  priority,
  description,
  photo,
  submittedBy,
}) =>
  addDoc(collection(db, col), {
    guestUid,
    guestName,
    roomNumber,
    category,
    priority: priority || 'Medium',
    description: description || '',
    photo: photo || '',
    submittedBy: submittedBy || 'Guest',
    status: 'Open',
    assignee: '',
    createdAt: Date.now(),
    completedAt: null,
  });

export const listMaintenanceRequests = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const getMaintenanceRequest = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const listMyMaintenanceRequests = async (guestUid) => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.guestUid === guestUid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateMaintenanceStatus = async (id, status) => {
  const data = { status };
  if (status === 'Completed') data.completedAt = Date.now();
  await updateDoc(doc(db, col, id), data);
};

export const assignMaintenanceTask = (id, assignee) =>
  updateDoc(doc(db, col, id), { assignee, status: 'InProgress' });
