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
import { addBillItem } from './billService';

const col = 'amenities';
const requestsCol = 'amenityRequests';
const laundryCol = 'laundryRequests';

export const listAmenities = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAmenity = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const createAmenity = (data) =>
  addDoc(collection(db, col), {
    name: data.name,
    unitPrice: Number(data.unitPrice) || 0,
    isFree: !!data.isFree,
    icon: data.icon || 'bi-star',
    createdAt: Date.now(),
  });

export const updateAmenity = (id, data) =>
  updateDoc(doc(db, col, id), {
    name: data.name,
    unitPrice: Number(data.unitPrice) || 0,
    isFree: !!data.isFree,
    icon: data.icon || 'bi-star',
  });

export const deleteAmenity = (id) => deleteDoc(doc(db, col, id));

export const requestAmenity = async ({
  guestUid,
  guestName,
  reservationId,
  roomNumber,
  amenityId,
  amenityName,
  quantity,
  unitPrice,
}) => {
  const total = (Number(unitPrice) || 0) * (Number(quantity) || 1);
  return addDoc(collection(db, requestsCol), {
    guestUid,
    guestName,
    reservationId,
    roomNumber,
    amenityId,
    amenityName,
    quantity: Number(quantity) || 1,
    unitPrice: Number(unitPrice) || 0,
    totalPrice: total,
    status: 'Pending',
    createdAt: Date.now(),
  });
};

export const listAmenityRequests = async () => {
  const snap = await getDocs(query(collection(db, requestsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const listGuestAmenityRequests = async (guestUid) => {
  const snap = await getDocs(query(collection(db, requestsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.guestUid === guestUid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateAmenityRequestStatus = async (id, status) => {
  await updateDoc(doc(db, requestsCol, id), { status });
  if (status === 'Completed') {
    const snap = await getDoc(doc(db, requestsCol, id));
    const req = snap.data();
    if (req?.reservationId && (req.unitPrice || 0) > 0) {
      await addBillItem(req.reservationId, {
        type: 'Amenity',
        description: `${req.amenityName} × ${req.quantity}`,
        qty: req.quantity,
        unitPrice: req.unitPrice,
      });
    }
  }
};

export const requestLaundry = async ({
  guestUid,
  guestName,
  reservationId,
  roomNumber,
  items,
  notes,
}) =>
  addDoc(collection(db, laundryCol), {
    guestUid,
    guestName,
    reservationId,
    roomNumber,
    items: items || [],
    notes: notes || '',
    status: 'Pending',
    createdAt: Date.now(),
  });

export const listLaundryRequests = async () => {
  const snap = await getDocs(query(collection(db, laundryCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const listGuestLaundryRequests = async (guestUid) => {
  const snap = await getDocs(query(collection(db, laundryCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.guestUid === guestUid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateLaundryRequestStatus = (id, status) =>
  updateDoc(doc(db, laundryCol, id), { status });
