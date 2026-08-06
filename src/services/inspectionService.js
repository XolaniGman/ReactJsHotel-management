import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const col = 'roomInspections';

export const createInspection = async ({ roomId, roomNumber, type, inspector, checklist, notes }) =>
  addDoc(collection(db, col), {
    roomId,
    roomNumber,
    type,
    inspector: inspector || 'Hotel Staff',
    checklist: checklist || [],
    notes: notes || '',
    status: 'Completed',
    date: Date.now(),
  });

export const listInspections = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));
};

export const getInspection = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};
