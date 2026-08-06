import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LEVY_RATE, VAT_RATE } from '../lib/constants';
import { round } from '../lib/utils';

const col = 'bills';
const paymentsCol = 'payments';

export const computeTotals = (basePrice, nights, addOns = [], discount = 0) => {
  const roomTotal = round((Number(basePrice) || 0) * (Number(nights) || 0));
  const addOnTotal = addOns.reduce(
    (sum, a) => sum + round((a.total ?? (Number(a.unitPrice) || 0) * (Number(a.qty) || 1)) || 0),
    0,
  );
  const subtotal = round(roomTotal + addOnTotal - (Number(discount) || 0));
  const vat = round(subtotal * VAT_RATE);
  const levy = round(subtotal * LEVY_RATE);
  const total = round(subtotal + vat + levy);
  return { roomTotal, addOnTotal, subtotal, vat, levy, total };
};

const recompute = (chargeItems) => {
  const subtotal = round(chargeItems.reduce((s, i) => s + (i.amount || 0), 0));
  const vat = round(subtotal * VAT_RATE);
  const levy = round(subtotal * LEVY_RATE);
  const total = round(subtotal + vat + levy);
  return {
    subtotal,
    vat,
    levy,
    total,
    lineItems: [
      ...chargeItems,
      { type: 'VAT', description: 'VAT (15%)', qty: 1, unitPrice: vat, amount: vat },
      { type: 'Levy', description: 'Tourism Levy (1%)', qty: 1, unitPrice: levy, amount: levy },
    ],
  };
};

export const ensureBill = async (reservation) => {
  const existing = await getBillByReservation(reservation.id);
  if (existing) return existing;

  const { roomTotal } = computeTotals(
    reservation.basePrice,
    reservation.nights,
    reservation.addOns || [],
    reservation.discount || 0,
  );

  const chargeItems = [
    {
      type: 'RoomCharge',
      description: `Room ${reservation.roomNumber} (${reservation.roomType}) × ${reservation.nights} night(s)`,
      qty: reservation.nights,
      unitPrice: reservation.basePrice,
      amount: roomTotal,
    },
  ];
  (reservation.addOns || []).forEach((a) => {
    chargeItems.push({
      type: 'AddOn',
      description: a.description || a.name,
      qty: a.qty || 1,
      unitPrice: a.unitPrice,
      amount: round((a.total ?? (Number(a.unitPrice) || 0) * (Number(a.qty) || 1)) || 0),
    });
  });

  const totals = recompute(chargeItems);

  const bill = {
    reservationId: reservation.id,
    guestUid: reservation.guestUid,
    guestName: reservation.guestName,
    roomNumber: reservation.roomNumber,
    roomType: reservation.roomType,
    checkIn: reservation.checkInDate,
    checkOut: reservation.checkOutDate,
    nights: reservation.nights,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    vat: totals.vat,
    levy: totals.levy,
    total: totals.total,
    paidAmount: 0,
    balanceDue: totals.total,
    status: 'Open',
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, col), bill);
  return { id: ref.id, ...bill };
};

export const getBillByReservation = async (reservationId) => {
  const snap = await getDocs(query(collection(db, col), where('reservationId', '==', reservationId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const getBill = async (id) => {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const addBillItem = async (reservationId, item) => {
  const bill = await getBillByReservation(reservationId);
  if (!bill) return null;
  const chargeItems = (bill.lineItems || []).filter(
    (li) => li.type !== 'VAT' && li.type !== 'Levy',
  );
  chargeItems.push({
    type: item.type || 'Charge',
    description: item.description,
    qty: item.qty || 1,
    unitPrice: item.unitPrice || 0,
    amount: round((Number(item.unitPrice) || 0) * (Number(item.qty) || 1)),
  });
  const totals = recompute(chargeItems);
  await updateDoc(doc(db, col, bill.id), {
    ...totals,
    balanceDue: round(totals.total - (bill.paidAmount || 0)),
  });
  return { id: bill.id, ...bill, ...totals };
};

export const listBills = async () => {
  const snap = await getDocs(query(collection(db, col)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const listBillsForGuest = async (guestUid) => {
  const snap = await getDocs(query(collection(db, col), where('guestUid', '==', guestUid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const listPayments = async () => {
  const snap = await getDocs(query(collection(db, paymentsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));
};

export const recordPayment = async ({ billId, method, amount, reference, byName }) => {
  const bill = await getBill(billId);
  if (!bill) return null;
  const paidAmount = round((bill.paidAmount || 0) + amount);
  const balanceDue = round(bill.total - paidAmount);
  await addDoc(collection(db, paymentsCol), {
    billId,
    reservationId: bill.reservationId,
    guestName: bill.guestName,
    method,
    amount,
    reference: reference || `PAY-${Date.now().toString(36).toUpperCase()}`,
    byName: byName || 'Guest',
    date: Date.now(),
  });
  await updateDoc(doc(db, col, billId), {
    paidAmount,
    balanceDue,
    status: balanceDue <= 0 ? 'Paid' : 'PartiallyPaid',
  });
  return { ...bill, paidAmount, balanceDue };
};
