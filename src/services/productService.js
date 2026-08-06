import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const productsCol = 'products';
const txCol = 'inventoryTransactions';
const roomInvCol = 'roomInventory';

export const listProducts = async () => {
  const snap = await getDocs(query(collection(db, productsCol)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getProduct = async (id) => {
  const snap = await getDoc(doc(db, productsCol, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const createProduct = (data) =>
  addDoc(collection(db, productsCol), {
    name: data.name,
    code: data.code || '',
    category: data.category || 'Consumable',
    unitPrice: Number(data.unitPrice) || 0,
    storageQty: Number(data.storageQty) || 0,
    lowStockThreshold: Number(data.lowStockThreshold) || 10,
    createdAt: Date.now(),
  });

export const updateProduct = (id, data) =>
  updateDoc(doc(db, productsCol, id), {
    name: data.name,
    code: data.code || '',
    category: data.category || 'Consumable',
    unitPrice: Number(data.unitPrice) || 0,
    lowStockThreshold: Number(data.lowStockThreshold) || 10,
  });

export const deleteProduct = (id) => deleteDoc(doc(db, productsCol, id));

export const adjustProductQty = (id, qty) =>
  updateDoc(doc(db, productsCol, id), { storageQty: increment(qty) });

export const listTransactions = async () => {
  const snap = await getDocs(query(collection(db, txCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));
};

export const recordTransaction = ({ productId, productName, type, from, to, qty, note, byName }) =>
  addDoc(collection(db, txCol), {
    productId,
    productName,
    type,
    from,
    to,
    qty: Number(qty) || 0,
    note: note || '',
    byName: byName || 'System',
    date: Date.now(),
  });

export const stockIn = async ({ productId, productName, qty, from = 'Supplier', byName }) => {
  await adjustProductQty(productId, qty);
  await recordTransaction({
    productId,
    productName,
    type: 'StockIn',
    from,
    to: 'Storage',
    qty,
    byName,
  });
};

export const issueToRoom = async ({ productId, productName, roomNumber, qty, byName }) => {
  await adjustProductQty(productId, -qty);
  const roomRef = doc(db, roomInvCol, String(roomNumber));
  await setDoc(roomRef, { [productId]: increment(qty) }, { merge: true });
  await recordTransaction({
    productId,
    productName,
    type: 'IssuedToRoom',
    from: 'Storage',
    to: `Room ${roomNumber}`,
    qty,
    byName,
  });
};

export const returnToStorage = async ({ productId, productName, roomNumber, qty, byName }) => {
  await adjustProductQty(productId, qty);
  const roomRef = doc(db, roomInvCol, String(roomNumber));
  await setDoc(roomRef, { [productId]: increment(-qty) }, { merge: true });
  await recordTransaction({
    productId,
    productName,
    type: 'ReturnedToStorage',
    from: `Room ${roomNumber}`,
    to: 'Storage',
    qty,
    byName,
  });
};

export const adjustStock = async ({ productId, productName, qty, reason = 'Adjustment', byName }) => {
  await adjustProductQty(productId, qty);
  await recordTransaction({
    productId,
    productName,
    type: qty < 0 ? 'Adjustment' : 'StockIn',
    from: 'Storage',
    to: 'Storage',
    qty: Math.abs(qty),
    note: reason,
    byName,
  });
};

export const getRoomInventory = async (roomNumber) => {
  const snap = await getDoc(doc(db, roomInvCol, String(roomNumber)));
  return snap.exists() ? snap.data() : {};
};

export const recordLostItem = async ({ productId, productName, qty, byName }) => {
  await adjustProductQty(productId, -qty);
  await recordTransaction({
    productId,
    productName,
    type: 'Lost',
    from: 'Storage',
    to: 'Used/Disposed',
    qty,
    byName,
  });
};
