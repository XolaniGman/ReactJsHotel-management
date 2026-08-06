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

const col = 'housekeepingRequests';

export const requestCleaning = async ({
  guestUid,
  guestName,
  reservationId,
  roomNumber,
  services,
  preferredDate,
  preferredTime,
  priority,
}) =>
  addDoc(collection(db, col), {
    guestUid,
    guestName,
    reservationId,
    roomNumber,
    services: services || [],
    preferredDate,
    preferredTime,
    priority: priority || 'Medium',
    status: 'Pending',
    assignee: '',
    submittedAt: Date.now(),
    completedAt: null,
  });

export const listCleaningRequests = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
};

export const getCleaningRequest = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const listGuestCleaningRequests = async (guestUid) => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.guestUid === guestUid)
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
};

export const acceptCleaningRequest = async (id, assignee) =>
  updateDoc(doc(db, col, id), { status: 'InProgress', assignee });

export const completeCleaningRequest = async (id) =>
  updateDoc(doc(db, col, id), { status: 'Completed', completedAt: Date.now() });
