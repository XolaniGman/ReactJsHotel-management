import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const lostCol = 'lostReports';
const foundCol = 'foundReports';

export const createLostReport = async ({
  guestUid,
  guestName,
  roomNumber,
  item,
  category,
  lastSeen,
  description,
  contactPreference,
  urgency,
}) =>
  addDoc(collection(db, lostCol), {
    guestUid,
    guestName,
    roomNumber,
    item,
    category,
    lastSeen,
    description: description || '',
    contactPreference: contactPreference || 'Email',
    urgency: urgency || 'Low',
    status: 'Searching',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

export const listLostReports = async () => {
  const snap = await getDocs(query(collection(db, lostCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const listMyLostReports = async (guestUid) => {
  const snap = await getDocs(query(collection(db, lostCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.guestUid === guestUid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateLostReportStatus = (id, status) =>
  updateDoc(doc(db, lostCol, id), { status, updatedAt: Date.now() });

export const createFoundReport = async ({
  item,
  category,
  description,
  foundBy,
  foundDate,
  location,
  image,
}) =>
  addDoc(collection(db, foundCol), {
    item,
    category,
    description: description || '',
    foundBy,
    foundDate,
    location,
    image: image || '',
    status: 'Unclaimed',
    createdAt: Date.now(),
  });

export const listFoundReports = async () => {
  const snap = await getDocs(query(collection(db, foundCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateFoundReportStatus = (id, status) =>
  updateDoc(doc(db, foundCol, id), { status });

export const matchFoundToLost = async (foundId, lostId, byName) => {
  await updateDoc(doc(db, foundCol, foundId), {
    status: 'Claimed',
    lostReportId: lostId,
    matchedBy: byName,
    matchedAt: Date.now(),
  });
  await updateLostReportStatus(lostId, 'Found');
};
