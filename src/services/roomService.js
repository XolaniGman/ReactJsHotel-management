import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const col = 'rooms';

export const listRooms = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
};

export const getRoom = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const createRoom = (data) =>
  addDoc(collection(db, col), { ...data, createdAt: Date.now() });

export const updateRoom = (id, data) => updateDoc(doc(db, col, id), data);

export const deleteRoom = (id) => deleteDoc(doc(db, col, id));

export const setRoomStatus = (id, status) => updateDoc(doc(db, col, id), { status });

export const listRoomsByStatus = async (status) => {
  const rooms = await listRooms();
  return rooms.filter((r) => r.status === status);
};
