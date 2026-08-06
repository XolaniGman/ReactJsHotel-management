import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { listRooms, setRoomStatus } from './roomService';
import { findByBookingRef, getReservation, setReservationStatus } from './reservationService';

const col = 'checkins';

export const createCheckIn = async ({
  reservationId,
  bookingRef,
  guestName,
  guestSurname,
  guestEmail,
  roomId,
  roomNumber,
  method,
  idDocType,
  idNumber,
  dateOfBirth,
  faceImage,
}) =>
  addDoc(collection(db, col), {
    reservationId,
    bookingRef,
    guestName,
    guestSurname,
    guestEmail,
    roomId,
    roomNumber,
    method,
    idDocType,
    idNumber,
    dateOfBirth,
    faceImage,
    isCheckedOut: false,
    wifi: `GrandHotel-${roomNumber}`,
    wifiPassword: 'guest2026',
    nfcKey: true,
    createdAt: Date.now(),
    checkedOutAt: null,
  });

export const listCheckIns = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const listActiveCheckIns = async () => {
  const all = await listCheckIns();
  return all.filter((c) => !c.isCheckedOut);
};

export const getCheckIn = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const getCheckInByReservation = async (reservationId) => {
  const snap = await getDocs(query(collection(db, col), where('reservationId', '==', reservationId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const allocateRoomForBooking = async (reservation, method, identity = {}) => {
  try {
    let res = reservation;
    if (!res) {
      res = await findByBookingRef(identity.reservationId);
      if (!res) return { error: 'No booking found with that reference.' };
    }

    const rooms = await listRooms();
    const preferred =
      rooms.find((r) => r.id === res.roomId && r.status === 'Available') ||
      rooms.find((r) => r.type === res.roomType && r.status === 'Available') ||
      rooms.find((r) => r.status === 'Available');
    if (!preferred) return { error: 'No available room to allocate. Please contact reception.' };

    await setRoomStatus(preferred.id, 'Occupied');
    await setReservationStatus(res.id, 'CheckedIn');

    const checkInId = await createCheckIn({
      reservationId: res.id,
      bookingRef: res.bookingRef,
      guestName: res.guestName,
      guestSurname: res.guestSurname,
      guestEmail: res.guestEmail,
      roomId: preferred.id,
      roomNumber: preferred.number,
      method,
      ...identity,
    });

    return { room: preferred, checkInId };
  } catch {
    return { error: 'Something went wrong while checking you in. Please try again.' };
  }
};

export const checkout = async (reservationId, { byName = 'System' } = {}) => {
  const res = await getReservation(reservationId);
  if (!res) return null;
  await setReservationStatus(reservationId, 'CheckedOut');
  if (res.roomId) await setRoomStatus(res.roomId, 'Dirty');
  const checkIn = await getCheckInByReservation(reservationId);
  if (checkIn) {
    await updateDoc(doc(db, col, checkIn.id), {
      isCheckedOut: true,
      checkedOutAt: Date.now(),
      checkedOutBy: byName,
    });
  }
  return res;
};
