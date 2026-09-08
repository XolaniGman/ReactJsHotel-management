import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { listRooms, createRoom } from './roomService';
import { createProduct } from './productService';
import { createEvent } from './eventService';
import { createAmenity } from './amenityService';
import { seedRestaurantData } from './restaurantService';
import { listUsers } from './userService';
import { listAllReservations, createReservation, approveReservation } from './reservationService';
import { listCheckIns } from './checkinService';
import { listPayments } from './billService';
import { listAmenityRequests } from './amenityService';
import { listLostReports } from './lostFoundService';
import { seedFleetData } from './fleetService';
import { todayISO, addDaysISO } from '../lib/utils';

const schedulesCol = 'cleanerSchedules';

export const listCleanerSchedules = async () => {
  const snap = await getDocs(query(collection(db, schedulesCol)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createCleanerSchedule = ({ staffName, date, shift, roomNumbers }) =>
  addDoc(collection(db, schedulesCol), {
    staffName,
    date,
    shift: shift || 'Morning',
    roomNumbers: roomNumbers || [],
    createdAt: Date.now(),
  });

export const updateCleanerSchedule = (id, data) =>
  updateDoc(doc(db, schedulesCol, id), {
    staffName: data.staffName,
    date: data.date,
    shift: data.shift,
    roomNumbers: data.roomNumbers || [],
  });

export const deleteCleanerSchedule = (id) => deleteDoc(doc(db, schedulesCol, id));

export const dashboardStats = async () => {
  const [rooms, users, reservations, checkIns, payments, amenityRequests, lostReports] =
    await Promise.all([
      listRooms(),
      listUsers(),
      listAllReservations(),
      listCheckIns(),
      listPayments(),
      listAmenityRequests(),
      listLostReports(),
    ]);

  return {
    totalRooms: rooms.length,
    availableRooms: rooms.filter((r) => r.status === 'Available').length,
    occupiedRooms: rooms.filter((r) => r.status === 'Occupied').length,
    dirtyRooms: rooms.filter((r) => r.status === 'Dirty').length,
    pendingBookings: reservations.filter((r) => r.status === 'Pending').length,
    approvedBookings: reservations.filter((r) => r.status === 'Approved').length,
    registeredGuests: users.filter((u) => u.role === 'guest').length,
    staffCount: users.filter((u) => u.role !== 'guest').length,
    activeCheckIns: checkIns.filter((c) => !c.isCheckedOut).length,
    revenue: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    pendingServices: amenityRequests.filter((r) => r.status === 'Pending').length,
    openLostReports: lostReports.filter((r) => r.status === 'Searching').length,
    recentReservations: reservations.slice(0, 6),
  };
};

export const seedDemoData = async () => {
  const demoRooms = [
    { number: 101, name: 'Single Suite', type: 'Single', price: 1500, floor: 1, capacity: 1, description: 'Sea View', beds: '1 Single Bed', size: '24 m²', amenities: ['wi-fi', 'sea-view', 'air-conditioning', 'minibar'] },
    { number: 102, name: 'Double Suite', type: 'Double', price: 2000, floor: 1, capacity: 2, description: 'Sea View', beds: '1 Queen Bed', size: '32 m²', amenities: ['wi-fi', 'sea-view', 'air-conditioning', 'breakfast'] },
    { number: 103, name: 'Double Suite', type: 'Double', price: 2500, floor: 1, capacity: 2, description: 'Sea View', beds: '1 King Bed', size: '34 m²', amenities: ['wi-fi', 'balcony', 'air-conditioning', 'minibar'] },
    { number: 201, name: 'Twin Suite', type: 'Twin', price: 3000, floor: 2, capacity: 2, description: 'Balcony', beds: '2 Single Beds', size: '36 m²', amenities: ['wi-fi', 'balcony', 'air-conditioning', 'room-service'] },
    { number: 202, name: 'Double Suite', type: 'Double', price: 3300, floor: 2, capacity: 2, description: 'Coastal view', beds: '1 King Bed', size: '38 m²', amenities: ['wi-fi', 'sea-view', 'air-conditioning', 'breakfast'] },
    { number: 301, name: 'Single Suite', type: 'Single', price: 4000, floor: 3, capacity: 1, description: 'Sea View', beds: '1 Single Bed', size: '28 m²', amenities: ['wi-fi', 'sea-view', 'air-conditioning', 'minibar'] },
    { number: 504, name: 'Signature Suite', type: 'Suite', price: 6600, floor: 5, capacity: 3, description: 'Penthouse', beds: '1 King Bed + Lounge', size: '60 m²', amenities: ['wi-fi', 'sea-view', 'balcony', 'air-conditioning', 'minibar', 'breakfast'] },
    { number: 505, name: 'Deluxe Suite', type: 'Deluxe', price: 5500, floor: 5, capacity: 3, description: 'Premium', beds: '1 King Bed + Sofa', size: '52 m²', amenities: ['wi-fi', 'balcony', 'air-conditioning', 'minibar', 'room-service'] },
    { number: 506, name: 'Twin Suite', type: 'Twin', price: 4700, floor: 5, capacity: 2, description: 'Sea View', beds: '2 Single Beds', size: '40 m²', amenities: ['wi-fi', 'balcony', 'air-conditioning', 'room-service'] },
  ];

  const createdRooms = [];
  for (const room of demoRooms) {
    const ref = await createRoom({
      ...room,
      status: 'Available',
      overview: `${room.name} — ${room.description}.`,
    });
    createdRooms.push({ id: ref.id, number: room.number, type: room.type, price: room.price });
  }

  const demoEvents = [
    { name: 'Sunset Dinner by the Sea', date: '2026-08-15', time: '18:00', location: 'Ocean Terrace', price: 750, capacity: 40, description: 'An elegant evening of refined plates and coastal views.' },
    { name: 'Wellness & Spa Retreat', date: '2026-08-22', time: '09:00', location: 'The Spa Rituals Suite', price: 1200, capacity: 20, description: 'Quiet treatments and a guided wellness journey.' },
    { name: 'Coastal Wine Tasting', date: '2026-09-05', time: '17:30', location: 'Cellar Lounge', price: 950, capacity: 30, description: 'Regional wines paired with artisan cheeses.' },
    { name: 'Guided Coast Expedition', date: '2026-09-12', time: '07:30', location: 'Hotel Pier', price: 1450, capacity: 15, description: 'Explore the coast with a curated guided trip.' },
  ];
  for (const e of demoEvents) await createEvent(e);

  const demoAmenities = [
    { name: 'Extra Pillow', unitPrice: 0, isFree: true, icon: 'bi-moon-stars' },
    { name: 'Extra Towel', unitPrice: 0, isFree: true, icon: 'bi-droplet-half' },
    { name: 'Tea/Coffee Sachets', unitPrice: 0, isFree: true, icon: 'bi-cup-hot' },
    { name: 'Toothbrush', unitPrice: 0, isFree: true, icon: 'bi-brush' },
    { name: 'Shampoo', unitPrice: 0, isFree: true, icon: 'bi-droplet' },
    { name: 'Adapter', unitPrice: 50, isFree: false, icon: 'bi-plug' },
    { name: 'Baby Crib', unitPrice: 200, isFree: false, icon: 'bi-balloon' },
    { name: 'Bathrobe', unitPrice: 150, isFree: false, icon: 'bi-person' },
    { name: 'Extra Bed', unitPrice: 350, isFree: false, icon: 'bi-layout-text-window' },
    { name: 'Mini Bar Refill', unitPrice: 250, isFree: false, icon: 'bi-cup-straw' },
    { name: 'Room Slippers', unitPrice: 75, isFree: false, icon: 'bi-foot' },
  ];
  for (const a of demoAmenities) await createAmenity(a);

  const demoProducts = [
    { name: 'Bath Towel', code: 'TWL-BATH', category: 'Reusable', unitPrice: 120, storageQty: 120, lowStockThreshold: 20 },
    { name: 'Hand Towel', code: 'TWL-HAND', category: 'Reusable', unitPrice: 60, storageQty: 120, lowStockThreshold: 20 },
    { name: 'Face Towel', code: 'TWL-FACE', category: 'Reusable', unitPrice: 40, storageQty: 120, lowStockThreshold: 20 },
    { name: 'Bed Sheet', code: 'BED-SHEET', category: 'Reusable', unitPrice: 220, storageQty: 80, lowStockThreshold: 15 },
    { name: 'Pillow', code: 'PILLOW', category: 'Reusable', unitPrice: 150, storageQty: 60, lowStockThreshold: 10 },
    { name: 'Pillow Cover', code: 'PIL-COV', category: 'Reusable', unitPrice: 45, storageQty: 80, lowStockThreshold: 15 },
    { name: 'Duvet', code: 'DUVET', category: 'Reusable', unitPrice: 400, storageQty: 50, lowStockThreshold: 10 },
    { name: 'Duvet Cover', code: 'DUV-COV', category: 'Reusable', unitPrice: 180, storageQty: 60, lowStockThreshold: 10 },
    { name: 'Blanket', code: 'BLANKET', category: 'Reusable', unitPrice: 200, storageQty: 40, lowStockThreshold: 8 },
    { name: 'Bathrobe', code: 'BATHROBE', category: 'Reusable', unitPrice: 150, storageQty: 25, lowStockThreshold: 5 },
    { name: 'Soap Bar', code: 'SOAP', category: 'Consumable', unitPrice: 15, storageQty: 200, lowStockThreshold: 50 },
    { name: 'Shampoo', code: 'SHP', category: 'Consumable', unitPrice: 25, storageQty: 200, lowStockThreshold: 50 },
    { name: 'Toothbrush', code: 'TB', category: 'Consumable', unitPrice: 18, storageQty: 150, lowStockThreshold: 30 },
    { name: 'Toothpaste', code: 'TP', category: 'Consumable', unitPrice: 22, storageQty: 150, lowStockThreshold: 30 },
    { name: 'Body Wash', code: 'BW', category: 'Consumable', unitPrice: 30, storageQty: 180, lowStockThreshold: 40 },
    { name: 'Bottled Water', code: 'WATER', category: 'Consumable', unitPrice: 20, storageQty: 300, lowStockThreshold: 60 },
    { name: 'Tea Sachet', code: 'TEA', category: 'Consumable', unitPrice: 3, storageQty: 500, lowStockThreshold: 100 },
    { name: 'Coffee Sachet', code: 'COFFEE', category: 'Consumable', unitPrice: 5, storageQty: 500, lowStockThreshold: 100 },
    { name: 'Trash Bag', code: 'TRASH', category: 'Consumable', unitPrice: 4, storageQty: 400, lowStockThreshold: 80 },
    { name: 'Toilet Paper', code: 'TPAPER', category: 'Consumable', unitPrice: 12, storageQty: 250, lowStockThreshold: 50 },
    { name: 'Cleaning Spray', code: 'CLN-SPRAY', category: 'Consumable', unitPrice: 45, storageQty: 100, lowStockThreshold: 20 },
    { name: 'Disinfectant', code: 'DISINF', category: 'Consumable', unitPrice: 55, storageQty: 80, lowStockThreshold: 15 },
  ];
  for (const p of demoProducts) await createProduct(p);

  const restaurantSeed = await seedRestaurantData();
  const fleetSeed = await seedFleetData();

  let createdReservations = 0;
  if (createdRooms.length > 0) {
    const demoReservations = [
      {
        bookingRef: 'GH-DEMO-101',
        guestName: 'Thando Mkhize',
        guestSurname: 'Mkhize',
        guestEmail: 'thando.mkhize@example.com',
        roomId: createdRooms[0].id,
        roomNumber: createdRooms[0].number,
        roomType: createdRooms[0].type,
        checkInDate: todayISO(),
        checkOutDate: addDaysISO(todayISO(), 2),
        nights: 2,
        category: 'Individual',
        basePrice: createdRooms[0].price,
      },
      {
        bookingRef: 'GH-DEMO-202',
        guestName: 'Lerato Mkhize',
        guestSurname: 'Mkhize',
        guestEmail: 'lerato.mkhize@example.com',
        roomId: createdRooms[3].id,
        roomNumber: createdRooms[3].number,
        roomType: createdRooms[3].type,
        checkInDate: todayISO(),
        checkOutDate: addDaysISO(todayISO(), 3),
        nights: 3,
        category: 'Individual',
        basePrice: createdRooms[3].price,
      },
    ];
    for (const r of demoReservations) {
      const res = await createReservation(r);
      await approveReservation(res.id, 'System');
      createdReservations += 1;
    }
  }

  return {
    rooms: demoRooms.length,
    events: demoEvents.length,
    amenities: demoAmenities.length,
    products: demoProducts.length,
    menuItems: restaurantSeed.menuItems,
    tables: restaurantSeed.tables,
    chefs: restaurantSeed.chefs,
    fleetVehicles: fleetSeed.vehicles,
    fleetDrivers: fleetSeed.drivers,
    reservations: createdReservations,
  };
};
