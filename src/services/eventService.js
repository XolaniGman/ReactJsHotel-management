import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addBillItem } from './billService';

const col = 'events';
const bookingsCol = 'eventBookings';

export const listEvents = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
};

export const getEvent = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const createEvent = (data) =>
  addDoc(collection(db, col), {
    name: data.name,
    date: data.date,
    time: data.time,
    location: data.location,
    price: Number(data.price) || 0,
    capacity: Number(data.capacity) || 0,
    description: data.description || '',
    image: data.image || '',
    createdAt: Date.now(),
  });

export const updateEvent = (id, data) =>
  updateDoc(doc(db, col, id), {
    name: data.name,
    date: data.date,
    time: data.time,
    location: data.location,
    price: Number(data.price) || 0,
    capacity: Number(data.capacity) || 0,
    description: data.description || '',
  });

export const deleteEvent = (id) => deleteDoc(doc(db, col, id));

export const bookEvent = async ({ eventId, guestUid, guestName, quantity, reservationId }) => {
  const event = await getEvent(eventId);
  if (!event) return { error: 'Event not found.' };
  const total = (event.price || 0) * quantity;
  const ref = await addDoc(collection(db, bookingsCol), {
    eventId,
    eventName: event.name,
    eventDate: event.date,
    guestUid,
    guestName,
    quantity,
    unitPrice: event.price || 0,
    total,
    status: 'Confirmed',
    createdAt: Date.now(),
  });
  if (reservationId && total > 0) {
    await addBillItem(reservationId, {
      type: 'Event',
      description: `Event: ${event.name} × ${quantity}`,
      qty: quantity,
      unitPrice: event.price || 0,
    });
  }
  return { id: ref.id };
};

export const listEventBookings = async () => {
  const snap = await getDocs(query(collection(db, bookingsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};
