import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { bookingRef } from '../lib/utils';
import { computeTotals, ensureBill, addBillItem, getBillByReservation } from './billService';

const col = 'reservations';
const auditsCol = 'reservationAudits';

const addAudit = (reservationId, entry) =>
  addDoc(collection(db, auditsCol), {
    reservationId,
    ...entry,
    date: Date.now(),
  });

export const createReservation = async (data) => {
  const totals = computeTotals(data.basePrice, data.nights, data.addOns || [], data.discount || 0);
  const docData = {
    guestUid: data.guestUid,
    guestName: data.guestName,
    guestSurname: data.guestSurname,
    guestEmail: (data.guestEmail || '').trim().toLowerCase(),
    roomId: data.roomId,
    roomNumber: data.roomNumber,
    roomType: data.roomType,
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    nights: data.nights,
    category: data.category || 'Individual',
    company: data.company || '',
    bookingRef: data.bookingRef || bookingRef(),
    basePrice: data.basePrice,
    addOns: data.addOns || [],
    discount: data.discount || 0,
    subtotal: totals.subtotal,
    vat: totals.vat,
    levy: totals.levy,
    total: totals.total,
    status: 'Pending',
    rescheduleCount: 0,
    wasRescheduled: false,
    notes: data.notes || '',
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, col), docData);
  const created = { id: ref.id, ...docData };
  await ensureBill(created);
  return created;
};

export const getReservation = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const listUserReservations = async (guestUid) => {
  const snap = await getDocs(
    query(collection(db, col), where('guestUid', '==', guestUid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const listAllReservations = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const findByBookingRef = async (ref) => {
  const snap = await getDocs(query(collection(db, col), where('bookingRef', '==', (ref || '').trim().toUpperCase())));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const listBookingsByEmail = async (email) => {
  const snap = await getDocs(
    query(collection(db, col), where('guestEmail', '==', (email || '').trim().toLowerCase())),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const setReservationStatus = (id, status) =>
  updateDoc(doc(db, col, id), { status });

export const approveReservation = async (id, byName) => {
  await setReservationStatus(id, 'Approved');
  await addAudit(id, { action: 'Approved', byName });
};

export const declineReservation = async (id, byName, reason) => {
  await setReservationStatus(id, 'Declined');
  await addAudit(id, { action: 'Declined', byName, note: reason });
};

export const rescheduleReservation = async (id, { checkInDate, checkOutDate, nights, byName }) => {
  const res = await getReservation(id);
  if (!res) return null;
  const totals = computeTotals(res.basePrice, nights, res.addOns || [], res.discount || 0);
  await updateDoc(doc(db, col, id), {
    checkInDate,
    checkOutDate,
    nights,
    subtotal: totals.subtotal,
    vat: totals.vat,
    levy: totals.levy,
    total: totals.total,
    rescheduleCount: (res.rescheduleCount || 0) + 1,
    wasRescheduled: true,
  });
  await addAudit(id, {
    action: 'Rescheduled',
    byName,
    from: `${res.checkInDate} → ${res.checkOutDate}`,
    to: `${checkInDate} → ${checkOutDate}`,
    fee: 250,
  });
  const bill = await getBillForReservation(id);
  if (bill) {
    await addBillItem(id, {
      type: 'RescheduleFee',
      description: 'Reservation Reschedule Fee',
      qty: 1,
      unitPrice: 250,
    });
  }
  return { ...res, checkInDate, checkOutDate, nights, ...totals };
};

export const cancelReservation = async (id, { byName, byRole, reason, refund = 0 }) => {
  await setReservationStatus(id, 'Cancelled');
  await addAudit(id, {
    action: 'Cancelled',
    byName,
    byRole,
    note: reason,
    refund,
  });
};

export const listReservationAudits = async (reservationId) => {
  const snap = await getDocs(
    query(collection(db, auditsCol), where('reservationId', '==', reservationId)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || 0) - (b.date || 0));
};

export const getBillForReservation = (reservationId) => getBillByReservation(reservationId);
