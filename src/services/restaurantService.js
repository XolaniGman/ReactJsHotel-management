import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addBillItem } from './billService';
import { round } from '../lib/utils';

const menuCol = 'menuItems';
const tablesCol = 'tables';
const reservationsCol = 'tableReservations';
const ordersCol = 'restaurantOrders';
const chefsCol = 'chefs';

const restaurantRef = () =>
  `RT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

// ---------- Seed / populate ----------

const DEMO_MENU = [
  { name: 'Full Coastal Breakfast', description: 'Eggs, grilled tomato, boerewors, toast and coffee.', category: 'Breakfast', price: 165, prepTime: 20, dietary: [], image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80' },
  { name: 'Fluffy Buttermilk Pancakes', description: 'Stack of buttermilk pancakes, seasonal fruit and honey.', category: 'Breakfast', price: 95, prepTime: 15, dietary: ['Vegetarian'], image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80' },
  { name: 'Smoked Snoek Pâté', description: 'Creamy smoked snoek pâté with melba toast and caper salad.', category: 'Starters', price: 85, prepTime: 10, dietary: ['Gluten-Free'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80' },
  { name: 'Halloumi & Avocado Salad', description: 'Grilled halloumi, avocado, rocket and citrus dressing.', category: 'Light Bites', price: 145, prepTime: 12, dietary: ['Vegetarian', 'Gluten-Free'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80' },
  { name: 'Butternut & Chickpea Buddha Bowl', description: 'Roast butternut, chickpeas, quinoa and tahini drizzle.', category: 'Light Bites', price: 135, prepTime: 15, dietary: ['Vegan', 'Gluten-Free'], image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80' },
  { name: 'Coastal Fish Tacos', description: 'Lightly battered linefish, slaw and chipotle mayo in corn tortillas.', category: 'Light Bites', price: 165, prepTime: 18, dietary: [], image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80' },
  { name: 'Cape Malay Chicken Curry', description: 'Slow-cooked chicken curry with sambals and fragrant rice.', category: 'Grills & Mains', price: 175, prepTime: 25, dietary: ['Halal'], image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80' },
  { name: 'Grilled Karoo Lamb Chops', description: 'Herb-crusted lamb chops, roast vegetables and jus.', category: 'Grills & Mains', price: 285, prepTime: 30, dietary: ['Gluten-Free'], image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80' },
  { name: 'Cape Malay Bobotie', description: 'Spiced mince baked with a golden egg topping and rice.', category: 'Grills & Mains', price: 165, prepTime: 28, dietary: ['Halal'], image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=800&q=80' },
  { name: 'Linefish & Chips', description: 'Crispy hake, hand-cut chips, lemon and tartare sauce.', category: 'Seafood', price: 195, prepTime: 25, dietary: ['Halal'], image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80' },
  { name: 'Grilled Prawn Skewers', description: 'Char-grilled prawns, garlic butter and lemon aioli.', category: 'Seafood', price: 265, prepTime: 25, dietary: ['Gluten-Free'], image: 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&q=80' },
  { name: 'Churros with Chocolate', description: 'Cinnamon sugar churros with warm chocolate dip.', category: 'Desserts', price: 75, prepTime: 12, dietary: ['Vegetarian'], image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80' },
  { name: 'Malva Pudding', description: 'Warm malva pudding, custard and a hint of apricot.', category: 'Desserts', price: 85, prepTime: 15, dietary: ['Vegetarian'], image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80' },
  { name: 'Artisan Coffee', description: 'Freshly ground single-origin filter coffee.', category: 'Beverages', price: 45, prepTime: 5, dietary: ['Vegan'], image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80' },
  { name: 'Rooibos Tea', description: 'South African rooibos served hot with honey on the side.', category: 'Beverages', price: 35, prepTime: 5, dietary: ['Vegan', 'Halal'], image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80' },
  { name: 'Craft Ginger Beer', description: 'House-made ginger beer over ice with lime.', category: 'Beverages', price: 50, prepTime: 5, dietary: ['Vegan'], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80' },
];

const DEMO_TABLES = [
  { number: 1, capacity: 2, location: 'Window' },
  { number: 2, capacity: 4, location: 'Window' },
  { number: 3, capacity: 2, location: 'Window' },
  { number: 4, capacity: 4, location: 'Outdoor' },
  { number: 5, capacity: 6, location: 'Outdoor' },
  { number: 6, capacity: 2, location: 'Quiet zone' },
  { number: 7, capacity: 4, location: 'Standard' },
  { number: 8, capacity: 8, location: 'Standard' },
];

const DEMO_CHEFS = [
  { name: 'Sipho Dlamini', station: 'Grill' },
  { name: 'Naledi Mokoena', station: 'Pastry' },
  { name: 'Yusuf Khan', station: 'Seafood' },
  { name: 'Thandi Ndlovu', station: 'Hot Kitchen' },
];

export const seedRestaurantData = async () => {
  for (const m of DEMO_MENU) await createMenuItem(m);
  for (const t of DEMO_TABLES) await createTable(t);
  for (const c of DEMO_CHEFS) await createChef(c);
  return { menuItems: DEMO_MENU.length, tables: DEMO_TABLES.length, chefs: DEMO_CHEFS.length };
};

// ---------- Menu (UC-02) ----------

export const listMenuItems = async () => {
  const snap = await getDocs(query(collection(db, menuCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) =>
      `${a.category || ''}${a.name || ''}`.localeCompare(`${b.category || ''}${b.name || ''}`),
    );
};

export const getMenuItem = async (id) => {
  const snap = await getDoc(doc(db, menuCol, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const createMenuItem = (data) =>
  addDoc(collection(db, menuCol), {
    name: data.name,
    description: data.description || '',
    category: data.category || 'Mains',
    price: round(Number(data.price) || 0),
    dietary: data.dietary || [],
    image: data.image || '',
    prepTime: Number(data.prepTime) || 15,
    available: data.available !== false,
    createdAt: Date.now(),
  });

export const updateMenuItem = (id, data) =>
  updateDoc(doc(db, menuCol, id), {
    name: data.name,
    description: data.description || '',
    category: data.category || 'Mains',
    price: round(Number(data.price) || 0),
    dietary: data.dietary || [],
    image: data.image || '',
    prepTime: Number(data.prepTime) || 15,
    available: data.available !== false,
  });

export const deleteMenuItem = (id) => deleteDoc(doc(db, menuCol, id));

export const setMenuItemAvailability = (id, available) =>
  updateDoc(doc(db, menuCol, id), { available });

// ---------- Tables (floor plan) ----------

export const listTables = async () => {
  const snap = await getDocs(query(collection(db, tablesCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.number || 0) - (b.number || 0));
};

export const getTableByNumber = async (number) => {
  const snap = await getDocs(query(collection(db, tablesCol), where('number', '==', Number(number))));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const createTable = (data) =>
  addDoc(collection(db, tablesCol), {
    number: Number(data.number) || 0,
    capacity: Number(data.capacity) || 2,
    location: data.location || 'Standard',
    status: data.status || 'Available',
    createdAt: Date.now(),
  });

export const updateTable = (id, data) =>
  updateDoc(doc(db, tablesCol, id), {
    number: Number(data.number) || 0,
    capacity: Number(data.capacity) || 2,
    location: data.location || 'Standard',
    status: data.status || 'Available',
  });

export const deleteTable = (id) => deleteDoc(doc(db, tablesCol, id));

export const setTableStatus = async (number, status) => {
  const table = await getTableByNumber(number);
  if (!table) return null;
  return updateDoc(doc(db, tablesCol, table.id), { status });
};

// ---------- Table reservations (UC-01) ----------

export const listTableReservations = async () => {
  const snap = await getDocs(query(collection(db, reservationsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => `${a.date || ''}${a.time || ''}`.localeCompare(`${b.date || ''}${b.time || ''}`));
};

export const isTableBooked = async (number, date, time) => {
  const snap = await getDocs(
    query(
      collection(db, reservationsCol),
      where('tableNumber', '==', Number(number)),
      where('date', '==', date),
      where('status', 'in', ['Reserved', 'CheckedIn']),
    ),
  );
  return snap.docs.some((d) => d.data().time === time);
};

export const reserveTable = async ({
  tableNumber,
  date,
  time,
  partySize,
  preference = 'No preference',
  guestUid = '',
  guestName,
  guestContact = '',
}) => {
  const booked = await isTableBooked(tableNumber, date, time);
  if (booked) return { error: `Table ${tableNumber} is already reserved for ${date} at ${time}.` };
  const table = await getTableByNumber(tableNumber);
  if (!table) return { error: 'Table not found.' };
  if (Number(partySize) > table.capacity) {
    return { error: `Table ${tableNumber} only seats ${table.capacity} guests.` };
  }
  const ref = restaurantRef();
  const docRef = await addDoc(collection(db, reservationsCol), {
    ref,
    tableNumber: table.number,
    tableCapacity: table.capacity,
    date,
    time,
    partySize: Number(partySize) || 1,
    preference,
    guestUid,
    guestName: guestName || 'Guest',
    guestContact,
    status: 'Reserved',
    createdAt: Date.now(),
  });
  await setTableStatus(table.number, 'Reserved');
  return { id: docRef.id, ref };
};

export const updateTableReservationStatus = async (id, status) => {
  const snap = await getDoc(doc(db, reservationsCol, id));
  if (!snap.exists()) return;
  const reservation = snap.data();
  await updateDoc(doc(db, reservationsCol, id), { status });
  if (status === 'CheckedIn') await setTableStatus(reservation.tableNumber, 'Occupied');
  if (['Completed', 'Cancelled', 'NoShow'].includes(status)) {
    await setTableStatus(reservation.tableNumber, 'Available');
  }
};

export const deleteTableReservation = (id) => deleteDoc(doc(db, reservationsCol, id));

// ---------- Chefs (UC-05) ----------

export const listChefs = async () => {
  const snap = await getDocs(query(collection(db, chefsCol)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createChef = (data) =>
  addDoc(collection(db, chefsCol), {
    name: data.name,
    station: data.station || 'Hot Kitchen',
    available: data.available !== false,
    activeOrders: 0,
    createdAt: Date.now(),
  });

export const setChefAvailable = (id, available) =>
  updateDoc(doc(db, chefsCol, id), { available });

const pickChef = async () => {
  const chefs = await listChefs();
  const available = chefs.filter((c) => c.available !== false);
  if (available.length === 0) return null;
  return available.sort((a, b) => (a.activeOrders || 0) - (b.activeOrders || 0))[0];
};

const bumpChef = async (chefId, delta) => {
  if (!chefId) return;
  const snap = await getDoc(doc(db, chefsCol, chefId));
  if (!snap.exists()) return;
  await updateDoc(doc(db, chefsCol, chefId), {
    activeOrders: Math.max(0, (snap.data().activeOrders || 0) + delta),
  });
};

// ---------- Orders (UC-03 .. UC-09) ----------

export const listOrders = async () => {
  const snap = await getDocs(query(collection(db, ordersCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const getOrder = async (id) => {
  const snap = await getDoc(doc(db, ordersCol, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const placeOrder = async ({
  items,
  tableNumber,
  guestUid = '',
  guestName = 'Guest',
  guestContact = '',
  reservationId = '',
}) => {
  if (!items || items.length === 0) return { error: 'Your order is empty.' };
  const table = await getTableByNumber(tableNumber);
  if (!table) return { error: 'Please choose a valid table.' };

  const orderItems = [];
  let total = 0;
  let prepMinutes = 0;
  for (const item of items) {
    const menuItem = await getMenuItem(item.menuItemId);
    if (!menuItem) return { error: 'A menu item no longer exists.' };
    if (menuItem.available === false) {
      return { error: `${menuItem.name} is currently sold out.` };
    }
    const qty = Math.max(0, Number(item.qty) || 0);
    if (qty <= 0) continue;
    orderItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      qty,
      unitPrice: menuItem.price || 0,
      notes: item.notes || '',
    });
    total += (menuItem.price || 0) * qty;
    prepMinutes += (menuItem.prepTime || 0) * qty;
  }
  if (orderItems.length === 0) return { error: 'Your order is empty.' };

  const chef = await pickChef();
  const orderNo = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const order = {
    orderNo,
    tableNumber: table.number,
    items: orderItems,
    guestUid,
    guestName: guestName || 'Guest',
    guestContact,
    reservationId,
    total: round(total),
    prepMinutes: round(prepMinutes),
    estimateMinutes: round(prepMinutes),
    status: 'Queued',
    chefId: chef ? chef.id : '',
    assignedChef: chef ? chef.name : 'Unassigned',
    createdAt: Date.now(),
    acceptedAt: 0,
    readyAt: 0,
    servedAt: 0,
    payment: null,
  };
  const ref = await addDoc(collection(db, ordersCol), order);
  if (chef) await bumpChef(chef.id, 1);
  await setTableStatus(table.number, 'Occupied');
  return { id: ref.id, orderNo, estimateMinutes: order.estimateMinutes };
};

export const updateOrderStatus = async (id, status) => {
  const order = await getOrder(id);
  if (!order) return;
  const now = Date.now();
  const patch = { status };
  if (status === 'InPreparation') patch.acceptedAt = now;
  if (status === 'ReadyForCollection') patch.readyAt = now;
  if (status === 'Served') {
    patch.servedAt = now;
    await bumpChef(order.chefId, -1);
  }
  if (status === 'Cancelled') {
    await bumpChef(order.chefId, -1);
    await setTableStatus(order.tableNumber, 'Available');
  }
  await updateDoc(doc(db, ordersCol, id), patch);
};

export const reassignOrder = async (id, chefId, chefName) => {
  const order = await getOrder(id);
  if (!order) return;
  await bumpChef(order.chefId, -1);
  await bumpChef(chefId, 1);
  await updateDoc(doc(db, ordersCol, id), { chefId, assignedChef: chefName });
};

export const settleOrder = async (id, method) => {
  const order = await getOrder(id);
  if (!order) return { error: 'Order not found.' };
  if (order.payment) return { error: 'This order has already been settled.' };
  if (method === 'RoomCharge') {
    if (!order.reservationId) {
      return { error: 'No linked stay for a room charge. Use cash or card instead.' };
    }
    await addBillItem(order.reservationId, {
      type: 'Restaurant',
      description: `Dining: ${order.orderNo} (Table ${order.tableNumber})`,
      qty: 1,
      unitPrice: order.total,
    });
  }
  await updateDoc(doc(db, ordersCol, id), {
    status: 'Served',
    servedAt: Date.now(),
    payment: { method, amount: order.total, paidAt: Date.now() },
  });
  await bumpChef(order.chefId, -1);
  await setTableStatus(order.tableNumber, 'Available');
  return order;
};
