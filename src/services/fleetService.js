import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addBillItem } from './billService';
import { nightsBetween, round, todayISO, addDaysISO } from '../lib/utils';
import { DEPOSIT_AMOUNT, HIGH_RISK_EXTRA_HOLD, LATE_RETURN_GRACE_HOURS, MIN_DRIVING_AGE } from '../lib/constants';
import {
  dynamicRateMultiplier,
  additionalDriverFee,
  youngDriverSurcharge,
  locationSurcharge,
  liabilityCapFor,
  branchById,
  oneWayFee,
  noticePeriodCheck,
  lateReturnCharges,
  fuelVarianceCharge,
  accidentAdminFee,
  rentalCancellationPenalty,
  serviceCancellationPenalty,
  ageFromDob,
  computeReturnSettlement,
} from '../lib/fleetAlgo';

const vehiclesCol = 'fleetVehicles';
const bookingsCol = 'carBookings';
const servicesCol = 'carServiceRequests';
const driversCol = 'fleetDrivers';
const handoversCol = 'vehicleHandovers';
const incidentsCol = 'fleetIncidents';
const workOrdersCol = 'fleetWorkOrders';

export const carRef = (prefix = 'CR') =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

export const bookingDisplay = (status) => {
  if (status === 'PendingInspection') return 'Returned — Pending Inspection';
  return String(status || '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
};

const mockImg = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const MOCK_FLEET_VEHICLES = [
    // ---- Compact (hatchbacks) ----
    {
      name: 'VW Polo Vivo 1.4', category: 'Compact', type: 'Hatchback', transmission: 'Manual',
      capacity: 5, pricePerDay: 470, deposit: 500, fuelType: 'Petrol',
      unitNumber: 'EC-101', plateNumber: 'GH 101 ZA', year: 2022, mileage: 21400,
      nextServiceDate: addDaysISO(todayISO(), 10), status: 'Available',
      image: mockImg('1541348263662-e068662d82af'),
      description: 'Sharp, friendly hatchback — effortless for city errands and short hops.',
      features: ['Bluetooth', 'USB Charging', 'Air Conditioning'],
    },
    {
      name: 'Toyota Starlet 1.2', category: 'Compact', type: 'Hatchback', transmission: 'Automatic',
      capacity: 5, pricePerDay: 510, deposit: 500, fuelType: 'Petrol',
      unitNumber: 'EC-102', plateNumber: 'GH 102 ZA', year: 2023, mileage: 16800,
      nextServiceDate: addDaysISO(todayISO(), 25), status: 'Available',
      image: mockImg('1541443131876-44b03de101c5'),
      description: 'Compliant cruiser with light steering — perfect first rental.',
      features: ['Bluetooth', 'Reverse Camera', 'Air Conditioning'],
    },
    {
      name: 'Hyundai Grand i10', category: 'Compact', type: 'Hatchback', transmission: 'Manual',
      capacity: 5, pricePerDay: 430, deposit: 450, fuelType: 'Petrol',
      unitNumber: 'EC-103', plateNumber: 'GH 103 ZA', year: 2021, mileage: 30250,
      nextServiceDate: addDaysISO(todayISO(), 18), status: 'Available',
      image: mockImg('1592198084033-aade902d1aae'),
      description: 'Smart city runabout with a remarkably low running cost.',
      features: ['Bluetooth', 'Air Conditioning'],
    },
    {
      name: 'Suzuki Swift 1.2', category: 'Compact', type: 'Hatchback', transmission: 'Automatic',
      capacity: 5, pricePerDay: 490, deposit: 500, fuelType: 'Petrol',
      unitNumber: 'EC-104', plateNumber: 'GH 104 ZA', year: 2023, mileage: 12900,
      nextServiceDate: addDaysISO(todayISO(), 40), status: 'Available',
      image: mockImg('1562911791-c7a97b729ec5'),
      description: 'Playful and economical — the ideal companion for exploring the coast.',
      features: ['Bluetooth', 'USB Charging', 'Air Conditioning'],
    },
    {
      name: 'Kia Picanto 1.2', category: 'Compact', type: 'Hatchback', transmission: 'Manual',
      capacity: 5, pricePerDay: 420, deposit: 400, fuelType: 'Petrol',
      unitNumber: 'EC-105', plateNumber: 'GH 105 ZA', year: 2021, mileage: 28900,
      nextServiceDate: addDaysISO(todayISO(), 6), status: 'Available',
      image: mockImg('1572569511254-d8f925fe2cbb'),
      description: 'The smallest coachwork with the biggest personality.',
      features: ['Air Conditioning', 'USB Charging'],
    },

    // ---- Sedan ----
    {
      name: 'Toyota Corolla Quest', category: 'Sedan', type: 'Sedan', transmission: 'Automatic',
      capacity: 5, pricePerDay: 720, deposit: 700, fuelType: 'Petrol',
      unitNumber: 'SD-201', plateNumber: 'GH 201 ZA', year: 2023, mileage: 15800,
      nextServiceDate: addDaysISO(todayISO(), 35), status: 'Available',
      image: mockImg('1621784563330-caee0b138a00'),
      description: 'South Africa’s favourite sedan — spacious boot, effortless automatic.',
      features: ['GPS Navigation', 'Bluetooth', 'Reverse Camera'],
    },
    {
      name: 'VW Polo Vivo Sedan', category: 'Sedan', type: 'Sedan', transmission: 'Manual',
      capacity: 5, pricePerDay: 650, deposit: 650, fuelType: 'Petrol',
      unitNumber: 'SD-202', plateNumber: 'GH 202 ZA', year: 2022, mileage: 20400,
      nextServiceDate: addDaysISO(todayISO(), 20), status: 'Available',
      image: mockImg('1590362891991-f776e747a588'),
      description: 'Refined ride quality and a great balance of style and value.',
      features: ['Bluetooth', 'Parking Sensors'],
    },
    {
      name: 'Hyundai Elantra 2.0', category: 'Sedan', type: 'Sedan', transmission: 'Automatic',
      capacity: 5, pricePerDay: 850, deposit: 850, fuelType: 'Petrol',
      unitNumber: 'SD-203', plateNumber: 'GH 203 ZA', year: 2024, mileage: 7400,
      nextServiceDate: addDaysISO(todayISO(), 60), status: 'Available',
      image: mockImg('1553440569-bcc63803a83d'),
      description: 'Sleek lines, generous rear seat space and a whisper-quiet cabin.',
      features: ['GPS Navigation', 'Bluetooth', 'Lane Assist'],
    },
    {
      name: 'Honda Civic 1.8', category: 'Sedan', type: 'Sedan', transmission: 'Automatic',
      capacity: 5, pricePerDay: 880, deposit: 900, fuelType: 'Petrol',
      unitNumber: 'SD-204', plateNumber: 'GH 204 ZA', year: 2023, mileage: 13600,
      nextServiceDate: addDaysISO(todayISO(), 28), status: 'Available',
      image: mockImg('1519245659620-e859806a8d3b'),
      description: 'Timelessly sporty with impeccable build and driving dynamics.',
      features: ['GPS Navigation', 'Bluetooth', 'Cruise Control'],
    },
    {
      name: 'Nissan Sentra 1.8', category: 'Sedan', type: 'Sedan', transmission: 'Automatic',
      capacity: 5, pricePerDay: 780, deposit: 800, fuelType: 'Petrol',
      unitNumber: 'SD-205', plateNumber: 'GH 205 ZA', year: 2022, mileage: 23100,
      nextServiceDate: addDaysISO(todayISO(), 15), status: 'Reserved',
      image: mockImg('1489824904134-891ab64532f1'),
      description: 'Zero-gravity seats and a smooth CVT for long, easy drives.',
      features: ['Bluetooth', 'USB Charging', 'Parking Sensors'],
    },

    // ---- SUV ----
    {
      name: 'Toyota Fortuner 2.8', category: 'SUV', type: 'SUV', transmission: 'Automatic',
      capacity: 7, pricePerDay: 1650, deposit: 1600, fuelType: 'Diesel',
      unitNumber: 'UV-301', plateNumber: 'GH 301 ZA', year: 2024, mileage: 9800,
      nextServiceDate: addDaysISO(todayISO(), 45), status: 'Available',
      image: mockImg('1519641471654-76ce0107ad1b'),
      description: 'Seven-seat legend — confident on gravel, comfortable on tar.',
      features: ['4x4', 'GPS Navigation', 'Child Seat', 'Roof Rack'],
    },
    {
      name: 'Hyundai Tucson 2.0', category: 'SUV', type: 'SUV', transmission: 'Automatic',
      capacity: 5, pricePerDay: 1250, deposit: 1200, fuelType: 'Petrol',
      unitNumber: 'UV-302', plateNumber: 'GH 302 ZA', year: 2023, mileage: 15200,
      nextServiceDate: addDaysISO(todayISO(), 30), status: 'Available',
      image: mockImg('1606016159991-dfe4f2746ad5'),
      description: 'Polished crossover with striking looks and a vast boot.',
      features: ['GPS Navigation', 'Parking Sensors', 'Bluetooth'],
    },
    {
      name: 'Ford Everest 2.0', category: 'SUV', type: 'SUV', transmission: 'Automatic',
      capacity: 7, pricePerDay: 1450, deposit: 1450, fuelType: 'Diesel',
      unitNumber: 'UV-303', plateNumber: 'GH 303 ZA', year: 2023, mileage: 18600,
      nextServiceDate: addDaysISO(todayISO(), 22), status: 'Available',
      image: mockImg('1580273916550-e323be2ae537'),
      description: 'Ladder-frame 4x4 that doubles as a refined seven-seat tourer.',
      features: ['4x4', 'GPS Navigation', 'Roof Rack'],
    },
    {
      name: 'VW Tiguan 1.4', category: 'SUV', type: 'SUV', transmission: 'Automatic',
      capacity: 5, pricePerDay: 1350, deposit: 1300, fuelType: 'Petrol',
      unitNumber: 'UV-304', plateNumber: 'GH 304 ZA', year: 2022, mileage: 21800,
      nextServiceDate: addDaysISO(todayISO(), 12), status: 'Available',
      image: mockImg('1568605117036-5fe5e7bab0b7'),
      description: 'Premium compact SUV — serene, roomy and genuinely practical.',
      features: ['Bluetooth', 'Parking Sensors', 'Cruise Control'],
    },
    {
      name: 'Nissan X-Trail 2.5', category: 'SUV', type: 'SUV', transmission: 'Automatic',
      capacity: 5, pricePerDay: 1180, deposit: 1150, fuelType: 'Petrol',
      unitNumber: 'UV-305', plateNumber: 'GH 305 ZA', year: 2022, mileage: 19600,
      nextServiceDate: addDaysISO(todayISO(), 34), status: 'Available',
      image: mockImg('1525609004556-c46c7d6cf023'),
      description: 'Commanding driving position with flexible seating and 4x4-i.',
      features: ['4x4', 'GPS Navigation', 'USB Charging'],
    },

    // ---- Luxury ----
    {
      name: 'BMW 3 Series 320i', category: 'Luxury', type: 'Luxury', transmission: 'Automatic',
      capacity: 5, pricePerDay: 2400, deposit: 2400, fuelType: 'Petrol',
      unitNumber: 'LX-401', plateNumber: 'GH 401 ZA', year: 2024, mileage: 6900,
      nextServiceDate: addDaysISO(todayISO(), 55), status: 'Available',
      image: mockImg('1555215695-3004980ad54e'),
      description: 'The definitive executive sedan — sharp, fast and beautifully built.',
      features: ['GPS Navigation', 'Adaptive Cruise', 'Head-Up Display', 'Wireless Charging'],
    },
    {
      name: 'Mercedes-Benz C-Class', category: 'Luxury', type: 'Luxury', transmission: 'Automatic',
      capacity: 5, pricePerDay: 2350, deposit: 2300, fuelType: 'Petrol',
      unitNumber: 'LX-402', plateNumber: 'GH 402 ZA', year: 2024, mileage: 8200,
      nextServiceDate: addDaysISO(todayISO(), 48), status: 'Available',
      image: mockImg('1617531653332-bd46c24f2068'),
      description: 'A first-class cabin wrapped in three-pointed-star refinement.',
      features: ['GPS Navigation', 'MBUX Voice', 'Ambient Lighting'],
    },
    {
      name: 'Audi A5 Sportback', category: 'Luxury', type: 'Luxury', transmission: 'Automatic',
      capacity: 4, pricePerDay: 2600, deposit: 2600, fuelType: 'Petrol',
      unitNumber: 'LX-403', plateNumber: 'GH 403 ZA', year: 2023, mileage: 11400,
      nextServiceDate: addDaysISO(todayISO(), 38), status: 'Available',
      image: mockImg('1605559424843-9e4c228bf1c2'),
      description: 'Coupe elegance with hatchback practicality and quattro sure-footedness.',
      features: ['Quattro', 'GPS Navigation', 'Lane Assist'],
    },
    {
      name: 'Porsche 911 Carrera', category: 'Luxury', type: 'Luxury', transmission: 'Automatic',
      capacity: 2, pricePerDay: 4200, deposit: 4500, fuelType: 'Petrol',
      unitNumber: 'LX-404', plateNumber: 'GH 404 ZA', year: 2023, mileage: 5400,
      nextServiceDate: addDaysISO(todayISO(), 70), status: 'Reserved',
      image: mockImg('1503376780353-7e6692767b70'),
      description: 'An icon for a special occasion — book a day you will never forget.',
      features: ['Sport Chrono', 'Bose Sound', 'Sport Exhaust'],
    },
    {
      name: 'Mercedes-AMG GT', category: 'Luxury', type: 'Luxury', transmission: 'Automatic',
      capacity: 2, pricePerDay: 3800, deposit: 4000, fuelType: 'Petrol',
      unitNumber: 'LX-405', plateNumber: 'GH 405 ZA', year: 2022, mileage: 4700,
      nextServiceDate: addDaysISO(todayISO(), 65), status: 'Available',
      image: mockImg('1511919884226-fd3cad34687c'),
      description: 'Race-bred V8 grand tourer with unmistakable presence.',
      features: ['V8 BiTurbo', 'AMG Performance', 'Burmester Sound'],
    },

    // ---- Shuttle ----
    {
      name: 'Mercedes-Benz Vito', category: 'Shuttle', type: 'Shuttle', transmission: 'Automatic',
      capacity: 8, pricePerDay: 1900, deposit: 2000, fuelType: 'Diesel',
      unitNumber: 'SH-501', plateNumber: 'GH 501 ZA', year: 2023, mileage: 30500,
      nextServiceDate: addDaysISO(todayISO(), 50), status: 'Available',
      image: mockImg('1565043666747-69f6646db940'),
      description: 'Eight-seat executive shuttle with generous luggage space.',
      features: ['Wi-Fi Hotspot', 'Air Conditioning', 'USB Charging'],
    },
    {
      name: 'Toyota Quantum 2.8', category: 'Shuttle', type: 'Shuttle', transmission: 'Manual',
      capacity: 15, pricePerDay: 2300, deposit: 2500, fuelType: 'Diesel',
      unitNumber: 'SH-502', plateNumber: 'GH 502 ZA', year: 2022, mileage: 51200,
      nextServiceDate: addDaysISO(todayISO(), 12), status: 'Available',
      image: mockImg('1526738549149-8e07eca6c147'),
      description: 'Full-size people mover for group tours and conference transfers.',
      features: ['Wi-Fi Hotspot', 'Air Conditioning', 'Onboard PA'],
    },
    {
      name: 'Hyundai H-1', category: 'Shuttle', type: 'Shuttle', transmission: 'Automatic',
      capacity: 11, pricePerDay: 2100, deposit: 2200, fuelType: 'Diesel',
      unitNumber: 'SH-503', plateNumber: 'GH 503 ZA', year: 2023, mileage: 26800,
      nextServiceDate: addDaysISO(todayISO(), 42), status: 'Available',
      image: mockImg('1617469767053-d3b523a0b982'),
      description: 'Lounge-like group shuttle that keeps everyone comfortable.',
      features: ['Air Conditioning', 'USB Charging', 'Climate Control'],
    },
    {
      name: 'VW Caravelle 2.0', category: 'Shuttle', type: 'Shuttle', transmission: 'Manual',
      capacity: 9, pricePerDay: 2150, deposit: 2300, fuelType: 'Diesel',
      unitNumber: 'SH-504', plateNumber: 'GH 504 ZA', year: 2022, mileage: 34800,
      nextServiceDate: addDaysISO(todayISO(), 26), status: 'Available',
      image: mockImg('1504221507732-5246c045949b'),
      description: 'German-engineered luxury shuttle, beautifully appointed within.',
      features: ['Swivel Seats', 'Air Conditioning', 'USB Charging'],
    },
    {
      name: 'Mercedes-Benz Sprinter', category: 'Shuttle', type: 'Shuttle', transmission: 'Automatic',
      capacity: 19, pricePerDay: 2800, deposit: 3000, fuelType: 'Diesel',
      unitNumber: 'SH-505', plateNumber: 'GH 505 ZA', year: 2024, mileage: 15900,
      nextServiceDate: addDaysISO(todayISO(), 80), status: 'Available',
      image: mockImg('1601362840469-51e4d8d58785'),
      description: 'Long-range coach for airport transfers and full-day outings.',
      features: ['Wi-Fi Hotspot', 'Air Conditioning', 'Luggage Racks'],
    },
  ];

export const seedFleetData = async () => {
  const drivers = [
    { name: 'Sipho Dlamini', phone: '082 555 0101', licenseNo: 'ZA-441520', vehicleUnit: 'SH-501', shiftStart: '06:00', shiftEnd: '14:00', available: true, rating: 4.9 },
    { name: 'Nomsa Khumalo', phone: '083 555 0102', licenseNo: 'ZA-558231', vehicleUnit: 'SH-502', shiftStart: '10:00', shiftEnd: '18:00', available: true, rating: 4.7 },
    { name: 'Bongani Nkosi', phone: '084 555 0103', licenseNo: 'ZA-773242', vehicleUnit: '', shiftStart: '14:00', shiftEnd: '22:00', available: true, rating: 4.5 },
  ];

  for (const v of MOCK_FLEET_VEHICLES) await createFleetVehicle(v);
  for (const d of drivers) await createFleetDriver(d);
  return { vehicles: MOCK_FLEET_VEHICLES.length, drivers: drivers.length };
};

// ---------------- Vehicles catalogue ----------------

const mockVehicle = (unitNumber) => {
  const v = MOCK_FLEET_VEHICLES.find((x) => x.unitNumber === unitNumber);
  return v ? { ...v, id: `mock-${v.unitNumber}`, demo: true } : null;
};

export const listFleetVehicles = async () => {
  const snap = await getDocs(query(collection(db, vehiclesCol)));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (docs.length === 0) return MOCK_FLEET_VEHICLES.map((v) => mockVehicle(v.unitNumber));
  return docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const getFleetVehicle = async (id) => {
  const snap = await getDoc(doc(db, vehiclesCol, id));
  if (snap.exists()) return { id, ...snap.data() };
  if (String(id).startsWith('mock-')) {
    return mockVehicle(String(id).replace('mock-', ''));
  }
  return null;
};

// A booking's `unitNumber` (the physically assigned unit, set at confirm/
// reassign time) is the source of truth for "which vehicle" — `vehicleId`
// can still point at the originally-quoted vehicle if a different unit was
// assigned. Resolve by unitNumber first, falling back to vehicleId.
export const getFleetVehicleForBooking = async (booking) => {
  if (!booking) return null;
  if (booking.unitNumber) {
    const vehicles = await listFleetVehicles();
    const byUnit = vehicles.find((v) => v.unitNumber === booking.unitNumber || v.plateNumber === booking.unitNumber);
    if (byUnit) return byUnit;
  }
  return booking.vehicleId ? getFleetVehicle(booking.vehicleId) : null;
};

// ---------------- Realtime subscriptions ----------------

const sortByName = (docs) => [...docs].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
const sortByPickup = (docs) =>
  [...docs].sort((a, b) =>
    `${a.pickupDate || ''} ${a.pickupTime || ''}`.localeCompare(`${b.pickupDate || ''} ${b.pickupTime || ''}`),
  );

export const subscribeFleetVehicles = (cb) =>
  onSnapshot(
    query(collection(db, vehiclesCol)),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(docs.length === 0 ? MOCK_FLEET_VEHICLES.map((v) => mockVehicle(v.unitNumber)) : sortByName(docs));
    },
    (err) => console.error('fleetVehicles listener error', err),
  );

export const subscribeCarBookings = (cb) =>
  onSnapshot(
    query(collection(db, bookingsCol)),
    (snap) => cb(sortByPickup(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (err) => console.error('carBookings listener error', err),
  );

export const subscribeCarServices = (cb) =>
  onSnapshot(
    query(collection(db, servicesCol)),
    (snap) => cb(sortByPickup(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (err) => console.error('carServiceRequests listener error', err),
  );

export const subscribeFleetDrivers = (cb) =>
  onSnapshot(
    query(collection(db, driversCol)),
    (snap) => cb(sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (err) => console.error('fleetDrivers listener error', err),
  );

export const updateServiceLivePosition = (serviceId, { lat, lng }) =>
  updateDoc(doc(db, servicesCol, serviceId), {
    livePosition: { lat: Number(lat), lng: Number(lng), ts: Date.now() },
  });

// Rental bookings: stream a checked-out vehicle's GPS position to the booking
// record so the guest's My Trips view can show the car live (mirrors shuttle
// tracking). `on` marks the stream active so listeners can render the map.
export const updateBookingLivePosition = (bookingId, { lat, lng, on } = {}) => {
  const patch = {};
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    patch.livePosition = { lat: Number(lat), lng: Number(lng), ts: Date.now() };
  }
  if (typeof on === 'boolean') patch.liveTracking = on;
  return updateDoc(doc(db, bookingsCol, bookingId), patch);
};

export const createFleetVehicle = (data) =>
  addDoc(collection(db, vehiclesCol), {
    name: data.name,
    type: data.type,
    transmission: data.transmission,
    capacity: Number(data.capacity) || 4,
    pricePerDay: Number(data.pricePerDay) || 0,
    pricePerHour: Number(data.pricePerHour) || 0,
    pricePerMonth: Number(data.pricePerMonth) || 0,
    deposit: Number(data.deposit) || DEPOSIT_AMOUNT,
    fuelType: data.fuelType || 'Petrol',
    unitNumber: data.unitNumber || '',
    plateNumber: data.plateNumber || '',
    year: Number(data.year) || new Date().getFullYear(),
    mileage: Number(data.mileage) || 0,
    nextServiceDate: data.nextServiceDate || '',
    status: data.status || 'Available',
    image: data.image || '',
    description: data.description || '',
    features: data.features || [],
    rating: Number(data.rating) || 0,
    reviewCount: Number(data.reviewCount) || 0,
    createdAt: Date.now(),
  });

export const updateFleetVehicle = (id, data) =>
  updateDoc(doc(db, vehiclesCol, id), {
    name: data.name,
    type: data.type,
    transmission: data.transmission,
    capacity: Number(data.capacity) || 4,
    pricePerDay: Number(data.pricePerDay) || 0,
    pricePerHour: Number(data.pricePerHour) || 0,
    pricePerMonth: Number(data.pricePerMonth) || 0,
    deposit: Number(data.deposit) || DEPOSIT_AMOUNT,
    fuelType: data.fuelType || 'Petrol',
    unitNumber: data.unitNumber || '',
    plateNumber: data.plateNumber || '',
    year: Number(data.year) || new Date().getFullYear(),
    mileage: Number(data.mileage) || 0,
    nextServiceDate: data.nextServiceDate || '',
    status: data.status || 'Available',
    image: data.image || '',
    description: data.description || '',
    features: data.features || [],
    rating: Number(data.rating) || 0,
    reviewCount: Number(data.reviewCount) || 0,
  });

export const deleteFleetVehicle = (id) => deleteDoc(doc(db, vehiclesCol, id));

export const setVehicleStatus = (id, status) => {
  if (String(id).startsWith('mock-')) return Promise.resolve();
  return updateDoc(doc(db, vehiclesCol, id), { status });
};

// ---------------- Quotes & availability ----------------

export const computeRentalQuote = ({
  vehicle,
  pickupDate,
  dropoffDate,
  addOns = [],
  additionalDriver = false,
  dob = '',
  pickupBranchId = 'main',
  hasWaiver = false,
}) => {
  const days = Math.max(1, nightsBetween(pickupDate, dropoffDate) || 1);
  const dyn = dynamicRateMultiplier({ pickupDate, dropoffDate, pricePerDay: vehicle.pricePerDay });
  const base = dyn.adjustedDaily * days;
  const addOnTotal = addOns.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const deposit = Number(vehicle.deposit) || DEPOSIT_AMOUNT;
  const additionalDriverAmount = additionalDriverFee(additionalDriver);
  const youngDriverAmount = youngDriverSurcharge(dob, days);
  const locationAmount = locationSurcharge(pickupBranchId);
  const liabilityCap = liabilityCapFor(vehicle, hasWaiver);
  const estimatedTotal = round(base + addOnTotal + additionalDriverAmount + youngDriverAmount + locationAmount + deposit);
  return {
    days,
    base,
    addOnTotal,
    additionalDriverAmount,
    youngDriverAmount,
    locationAmount,
    deposit,
    liabilityCap,
    authorisationHoldAmount: deposit,
    capturedAmount: 0,
    estimatedTotal,
    baseDaily: Number(vehicle.pricePerDay) || 0,
    rateFactor: dyn.factor,
    adjustedDaily: dyn.adjustedDaily,
    dynamicReasons: dyn.reasons,
  };
};

// ---------------- Rental bookings ----------------

const logBookingHistory = (id, to, by, note) => {
  const bookingId = id;
  return getCarBooking(bookingId).then((b) => {
    const history = [
      ...(b?.history || []),
      { at: Date.now(), from: b?.status || '', to, by: by || 'System', note: note || '' },
    ];
    return updateDoc(doc(db, bookingsCol, bookingId), { history });
  });
};

export const createCarBooking = async ({
  guestUid,
  guestName,
  vehicleId,
  pickupDate,
  pickupTime,
  dropoffDate,
  dropoffTime,
  licenseNumber,
  licenseExpiry,
  addOns,
  reservationId,
  notes,
  additionalDriver = false,
  driverDob = '',
  pickupBranchId = 'main',
  returnBranchId = 'main',
  hasWaiver = false,
  documentReviewRequired = false,
  riskFlag = false,
}) => {
  const vehicle = await getFleetVehicle(vehicleId);
  if (!vehicle) return { error: 'Vehicle not found.' };
  if (vehicle.status === 'InMaintenance' || vehicle.status === 'OutOfService') {
    return { error: 'This vehicle is not available at the moment.' };
  }
  const quote = computeRentalQuote({
    vehicle,
    pickupDate,
    dropoffDate,
    addOns,
    additionalDriver,
    dob: driverDob,
    pickupBranchId,
    hasWaiver,
  });
  const ref = await addDoc(collection(db, bookingsCol), {
    ref: carRef('CR'),
    guestUid,
    guestName,
    vehicleId,
    vehicleName: vehicle.name,
    vehicleType: vehicle.type,
    vehicleImage: vehicle.image || '',
    unitNumber: vehicle.unitNumber || vehicle.plateNumber || '',
    pickupDate,
    pickupTime,
    dropoffDate,
    dropoffTime,
    days: quote.days,
    basePrice: quote.base,
    addOns: addOns || [],
    addOnTotal: quote.addOnTotal,
    additionalDriver: !!additionalDriver,
    additionalDriverAmount: quote.additionalDriverAmount,
    driverDob: driverDob || '',
    youngDriverAmount: quote.youngDriverAmount,
    pickupBranchId,
    returnBranchId,
    locationAmount: quote.locationAmount,
    hasWaiver: !!hasWaiver,
    liabilityCap: quote.liabilityCap,
    deposit: quote.deposit,
    authorisationHoldAmount: quote.authorisationHoldAmount,
    capturedAmount: 0,
    estimatedTotal: quote.estimatedTotal,
    paidAmount: 0,
    finalCharges: 0,
    cancelFee: 0,
    pendingCharges: [],
    licenseNumber: licenseNumber || '',
    licenseExpiry: licenseExpiry || '',
    reservationId: reservationId || '',
    notes: notes || '',
    documentReviewRequired: !!documentReviewRequired,
    riskFlag: !!riskFlag,
    riskOverrideBy: '',
    riskOverrideNote: '',
    status: 'PendingConfirmation',
    assignedBy: '',
    confirmedAt: null,
    cancelledAt: null,
    history: [
      {
        at: Date.now(),
        from: '',
        to: 'PendingConfirmation',
        by: guestName || 'Guest',
        note: documentReviewRequired
          ? 'Rental request submitted — documents flagged for staff review'
          : 'Rental request submitted',
      },
    ],
    createdAt: Date.now(),
  });
  return { id: ref.id };
};

export const listCarBookings = async () => {
  const snap = await getDocs(query(collection(db, bookingsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => `${a.pickupDate || ''} ${a.pickupTime || ''}`.localeCompare(`${b.pickupDate || ''} ${b.pickupTime || ''}`));
};

export const listMyCarBookings = async (guestUid) => {
  const all = await listCarBookings();
  return all.filter((b) => b.guestUid === guestUid);
};

export const getCarBooking = async (id) => {
  const snap = await getDoc(doc(db, bookingsCol, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const subscribeCarBooking = (ids, cb) => {
  const id = Array.isArray(ids) ? ids[0] : ids;
  if (!id) return () => {};
  return onSnapshot(
    doc(db, bookingsCol, id),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => console.error('carBooking listener error', err),
  );
};

export const confirmCarBooking = async (id, { unitNumber, vehicleId, assignedBy, overrideNote }) => {
  const booking = await getCarBooking(id);
  if (!booking) return { error: 'Booking not found.' };
  if (booking.riskFlag && !booking.riskOverrideBy && !overrideNote?.trim()) {
    return { error: 'This guest is flagged high-risk — an explicit, logged staff override note is required before confirming.' };
  }
  const patch = {
    unitNumber,
    assignedBy,
    status: 'Confirmed',
    confirmedAt: Date.now(),
  };
  if (vehicleId) patch.vehicleId = vehicleId;
  if (booking.riskFlag) {
    patch.riskOverrideBy = assignedBy || 'Front Desk';
    patch.riskOverrideNote = overrideNote?.trim() || '';
  }
  await updateDoc(doc(db, bookingsCol, id), patch);
  if (vehicleId) await setVehicleStatus(vehicleId, 'Reserved');
  await logBookingHistory(
    id,
    'Confirmed',
    assignedBy,
    booking.riskFlag
      ? `Vehicle ${unitNumber} assigned & confirmed — high-risk override: ${overrideNote?.trim() || 'n/a'}`
      : `Vehicle ${unitNumber} assigned & confirmed`,
  );
  return { ok: true };
};

export const updateCarBookingStatus = async (id, status, by) => {
  await updateDoc(doc(db, bookingsCol, id), { status });
  await logBookingHistory(id, status, by, `Status updated to ${status}`);
};

export const cancelCarBooking = async (id, { byName }) => {
  const booking = await getCarBooking(id);
  if (!booking) return { error: 'Booking not found.' };
  const pickup = new Date(`${booking.pickupDate}T${booking.pickupTime || '00:00'}`);
  const hoursUntilPickup = Number.isNaN(pickup.getTime()) ? 0 : (pickup.getTime() - Date.now()) / 3600000;
  const isDayOf = !Number.isNaN(pickup.getTime()) && new Date().toDateString() === pickup.toDateString();
  const penalty = rentalCancellationPenalty({
    paidAmount: booking.paidAmount || 0,
    dailyRate: booking.days ? round(booking.basePrice / booking.days) : 0,
    hoursUntilPickup,
    isDayOf,
  });
  await updateDoc(doc(db, bookingsCol, id), {
    status: 'Cancelled',
    cancelFee: penalty.fee,
    cancelledAt: Date.now(),
  });
  if (booking.vehicleId && booking.status !== 'CheckedOut' && booking.status !== 'CheckedIn' && booking.status !== 'PendingInspection') {
    await setVehicleStatus(booking.vehicleId, 'Available');
  }
  await logBookingHistory(
    id,
    'Cancelled',
    byName || 'Guest',
    `Cancelled (${penalty.tier}) — ${penalty.note || penalty.tier}, fee of R${penalty.fee} applied`,
  );
  return { fee: penalty.fee, tier: penalty.tier };
};

export const modifyCarBooking = async (id, fields, byName) => {
  const booking = await getCarBooking(id);
  if (!booking) return { error: 'Booking not found.' };
  const data = { ...fields };
  if (fields.vehicleId && fields.vehicleId !== booking.vehicleId) {
    const vehicle = await getFleetVehicle(fields.vehicleId);
    if (!vehicle) return { error: 'Vehicle not found.' };
    const quote = computeRentalQuote({
      vehicle,
      pickupDate: fields.pickupDate || booking.pickupDate,
      dropoffDate: fields.dropoffDate || booking.dropoffDate,
      addOns: fields.addOns || booking.addOns || [],
    });
    data.vehicleName = vehicle.name;
    data.vehicleType = vehicle.type;
    data.vehicleImage = vehicle.image || '';
    data.unitNumber = vehicle.unitNumber || vehicle.plateNumber || '';
    data.days = quote.days;
    data.basePrice = quote.base;
    data.addOnTotal = quote.addOnTotal;
    data.deposit = quote.deposit;
    data.estimatedTotal = quote.estimatedTotal;
  } else if (fields.pickupDate || fields.dropoffDate) {
    const quote = computeRentalQuote({
      vehicle: booking,
      pickupDate: fields.pickupDate || booking.pickupDate,
      dropoffDate: fields.dropoffDate || booking.dropoffDate,
      addOns: fields.addOns || booking.addOns || [],
    });
    data.days = quote.days;
    data.basePrice = quote.base;
    data.addOnTotal = quote.addOnTotal;
    data.estimatedTotal = quote.estimatedTotal;
  }
  data.status = booking.status === 'Confirmed' ? 'ModifyRequested' : booking.status;
  await updateDoc(doc(db, bookingsCol, id), data);
  await logBookingHistory(id, data.status, byName || 'Guest', 'Booking modified');
  return {};
};

// Guest relief: after an incident is reported, a Fleet Manager or Admin picks
// an available unit to swap the running rental onto. The booking is re-quoted,
// re-activated (if the incident had suspended it), and both book records and
// the incident audit trail show the replacement.
export const allocateReplacementVehicle = async (bookingId, { vehicleId, incidentId = '', by = 'Fleet Manager', reason = '', note = '' } = {}) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
if (['CheckedIn', 'PendingInspection', 'Cancelled'].includes(booking.status)) {
    return { error: `This booking is ${bookingDisplay(booking.status)} — a replacement unit can't be allocated now.` };
  }
  const vehicle = await getFleetVehicle(vehicleId);
  if (!vehicle) return { error: 'Replacement vehicle not found.' };
  if (vehicle.status !== 'Available') {
    return { error: `Replacement unit ${vehicle.unitNumber || vehicle.name} is ${vehicle.status} — pick an available vehicle.` };
  }
  const quote = computeRentalQuote({
    vehicle,
    pickupDate: booking.pickupDate,
    dropoffDate: booking.dropoffDate,
    addOns: booking.addOns || [],
    additionalDriver: booking.additionalDriver,
    dob: booking.driverDob,
    pickupBranchId: booking.pickupBranchId,
    hasWaiver: booking.hasWaiver,
  });
  const patch = {
    vehicleId,
    vehicleName: vehicle.name,
    vehicleType: vehicle.type,
    vehicleImage: vehicle.image || '',
    unitNumber: vehicle.unitNumber || vehicle.plateNumber || '',
    days: quote.days,
    basePrice: quote.base,
    addOnTotal: quote.addOnTotal,
    deposit: quote.deposit,
    authorisationHoldAmount: quote.authorisationHoldAmount,
    estimatedTotal: quote.estimatedTotal,
    replacementVehicleId: vehicleId,
    replacementVehicleName: vehicle.name,
    replacementBy: by,
    replacementReason: reason.trim(),
    replacementNote: note.trim(),
    replacementAllocatedAt: Date.now(),
  };
  if (booking.status === 'Suspended') patch.status = 'Confirmed';
  await updateDoc(doc(db, bookingsCol, bookingId), patch);
  await logBookingHistory(
    bookingId,
    patch.status || booking.status,
    by,
    `Replacement vehicle allocated: ${vehicle.name} (${vehicle.unitNumber || vehicle.plateNumber})${reason.trim() ? ` — reason: ${reason.trim()}` : ''}`,
  );
  if (incidentId) {
    const incSnap = await getDoc(doc(db, incidentsCol, incidentId));
    if (incSnap.exists()) {
      await updateDoc(doc(db, incidentsCol, incidentId), {
        replacementBookingId: bookingId,
        replacementVehicleId: vehicleId,
        replacementVehicleName: vehicle.name,
        replacementBy: by,
        replacementAt: Date.now(),
        history: [
          ...(incSnap.data().history || []),
          { at: Date.now(), from: incSnap.data().status, to: 'Replacement allocated', by, note: `Replacement vehicle ${vehicle.name} (${vehicle.unitNumber || vehicle.plateNumber}) allocated to ${booking.guestName}${reason.trim() ? ` — ${reason.trim()}` : ''}` },
        ],
      });
    }
  }
  return { ok: true, vehicleName: vehicle.name, unitNumber: vehicle.unitNumber || vehicle.plateNumber || '', estimatedTotal: quote.estimatedTotal };
};

// ---------------- Shuttle / car service requests ----------------

export const computeFareEstimate = ({ serviceType, distanceKm = 0, durationMin = 0 }) => {
  const baseRate = serviceType === 'Airport Transfer' ? 350 : 150;
  const distanceCharge = Number(distanceKm) * 12;
  const timeCharge = Number(durationMin) * 2;
  return round(baseRate + distanceCharge + timeCharge);
};

export const createCarService = async ({
  guestUid,
  guestName,
  serviceType,
  vehicleId,
  vehicleName,
  pickupLocation,
  pickupLat,
  pickupLng,
  destination,
  pickupDate,
  pickupTime,
  paymentMethod,
  reservationId,
  notes,
}) => {
  const notice = noticePeriodCheck(serviceType, pickupDate, pickupTime);
  if (!notice.ok) {
    return {
      error: `${serviceType} requests need at least ${notice.hoursRequired}h notice — this pickup is only ${Math.max(0, notice.hoursNotice)}h away.`,
    };
  }
  const estimatedFare = computeFareEstimate({ serviceType });
  const ref = await addDoc(collection(db, servicesCol), {
    ref: carRef('CS'),
    guestUid,
    guestName,
    serviceType,
    vehicleId: vehicleId || '',
    vehicleName: vehicleName || '',
    pickupLocation,
    pickupLat: pickupLat != null ? Number(pickupLat) : null,
    pickupLng: pickupLng != null ? Number(pickupLng) : null,
    destination: destination || '',
    pickupDate,
    pickupTime,
    paymentMethod: paymentMethod || 'Folio',
    reservationId: reservationId || '',
    notes: notes || '',
    estimatedFare,
    confirmedBookingAmount: 0,
    distanceKm: 0,
    durationMin: 0,
    status: 'PendingAssignment',
    driverId: '',
    driverName: '',
    vehicleUnit: '',
    eta: '',
    assignedBy: '',
    history: [
      {
        at: Date.now(),
        from: '',
        to: 'PendingAssignment',
        by: guestName || 'Guest',
        note: 'Service request submitted',
      },
    ],
    createdAt: Date.now(),
  });
  return { id: ref.id };
};

export const listCarServices = async () => {
  const snap = await getDocs(query(collection(db, servicesCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => `${a.pickupDate || ''} ${a.pickupTime || ''}`.localeCompare(`${b.pickupDate || ''} ${b.pickupTime || ''}`));
};

export const listMyCarServices = async (guestUid) => {
  const all = await listCarServices();
  return all.filter((s) => s.guestUid === guestUid);
};

export const getCarService = async (id) => {
  const snap = await getDoc(doc(db, servicesCol, id));
  return snap.exists() ? { id, ...snap.data() } : null;
};

export const assignDriverToService = async (id, { driverId, driverName, vehicleUnit, eta, assignedBy }) => {
  const before = await getCarService(id);
  // UC17: confirmed_booking_amount locks at confirmation (assignment) and is
  // captured immediately — folio charge if linked to a stay, else billed direct.
  const confirmedBookingAmount = before?.confirmedBookingAmount || before?.estimatedFare || 0;
  await updateDoc(doc(db, servicesCol, id), {
    driverId,
    driverName,
    vehicleUnit,
    eta: eta || '',
    status: 'Assigned',
    assignedBy,
    confirmedBookingAmount,
  });
  if (before?.paymentMethod === 'Folio' && before?.reservationId) {
    await addBillItem(before.reservationId, {
      type: 'ChauffeurService',
      description: `${before.serviceType}: ${before.pickupLocation || 'pickup'} → ${before.destination || 'destination'}`,
      qty: 1,
      unitPrice: confirmedBookingAmount,
    });
  }
  const ref = await getDoc(doc(db, servicesCol, id));
  const service = ref.exists() ? { id, ...ref.data() } : null;
  const history = [
    ...(service?.history || []),
    {
      at: Date.now(),
      from: service?.status || '',
      to: 'Assigned',
      by: assignedBy || 'Dispatcher',
      note: `${driverName} assigned${vehicleUnit ? ` · ${vehicleUnit}` : ''} · confirmed amount R${confirmedBookingAmount}`,
    },
  ];
  await updateDoc(doc(db, servicesCol, id), { history });
};

export const updateCarServiceStatus = async (id, status, by, extra = {}) => {
  const ref = await getDoc(doc(db, servicesCol, id));
  const service = ref.exists() ? { id, ...ref.data() } : null;
  const history = [
    ...(service?.history || []),
    { at: Date.now(), from: service?.status || '', to: status, by: by || 'System', note: `Status → ${status}` },
  ];
  await updateDoc(doc(db, servicesCol, id), { status, ...extra, history });
};

export const cancelServiceRequest = async (id, byName) => {
  const ref = await getDoc(doc(db, servicesCol, id));
  const service = ref.exists() ? { id, ...ref.data() } : null;
  if (!service) return { error: 'Service request not found.' };
  const pickup = new Date(`${service.pickupDate}T${service.pickupTime || '00:00'}`);
  const hoursUntilPickup = Number.isNaN(pickup.getTime()) ? 0 : Math.max(0, (pickup.getTime() - Date.now()) / 3600000);
  const penalty = serviceCancellationPenalty({
    confirmedBookingAmount: service.confirmedBookingAmount || service.estimatedFare || 0,
    hoursUntilPickup,
  });
  const history = [
    ...(service.history || []),
    { at: Date.now(), from: service.status || '', to: 'Cancelled', by: byName || 'Guest', note: `Request cancelled (${penalty.tier}) — fee of R${penalty.fee} applied` },
  ];
  await updateDoc(doc(db, servicesCol, id), { status: 'Cancelled', cancelFee: penalty.fee, history });
  return { fee: penalty.fee, tier: penalty.tier };
};

// ---------------- Drivers ----------------

export const listFleetDrivers = async () => {
  const snap = await getDocs(query(collection(db, driversCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const createFleetDriver = (data) =>
  addDoc(collection(db, driversCol), {
    name: data.name,
    phone: data.phone || '',
    licenseNo: data.licenseNo || '',
    vehicleUnit: data.vehicleUnit || '',
    shiftStart: data.shiftStart || '08:00',
    shiftEnd: data.shiftEnd || '18:00',
    available: data.available !== false,
    rating: Number(data.rating) || 5,
    callback: data.callback || '',
    tripsCompleted: 0,
    createdAt: Date.now(),
  });

export const updateFleetDriver = (id, data) =>
  updateDoc(doc(db, driversCol, id), {
    name: data.name,
    phone: data.phone || '',
    licenseNo: data.licenseNo || '',
    vehicleUnit: data.vehicleUnit || '',
    shiftStart: data.shiftStart || '08:00',
    shiftEnd: data.shiftEnd || '18:00',
    available: data.available !== false,
    rating: Number(data.rating) || 5,
    callback: data.callback || '',
  });

export const deleteFleetDriver = (id) => deleteDoc(doc(db, driversCol, id));

export const toggleDriverAvailability = (id, available) =>
  updateDoc(doc(db, driversCol, id), { available });

// ---------------- Vehicle check-out / check-in ----------------

export const recordVehicleHandover = async ({
  bookingId,
  handoverType,
  unitNumber,
  fuelLevel,
  mileage,
  items,
  notes,
  photos,
  signedBy,
  guestSignature,
  guestSignsOnPhone = false,
  reservationId,
  damageCheck,
  returnBranchId,
  waiveExtraHold = false,
  waiveNote = '',
  damageOverride = null,
  returnedAt = Date.now(),
}) => {
  const returnedAtMs = Number(returnedAt) || Date.now();
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };

  if (handoverType === 'CheckOut' && booking.status !== 'Confirmed') {
    return { error: `This rental cannot be checked out while it is ${bookingDisplay(booking.status)}.` };
  }
  if (handoverType === 'CheckIn' && booking.status !== 'CheckedOut') {
    return { error: `This rental cannot be checked in while it is ${bookingDisplay(booking.status)}.` };
  }

  // Three check-out gates, enforced here (not just by disabled UI buttons) so
  // they hold even if this function is invoked directly.
  if (handoverType === 'CheckOut') {
    if (!['Verified', 'Overridden'].includes(booking.licenceVerification?.status)) {
      return { error: 'Licence verification must pass (or be explicitly overridden with a logged reason) before check-out.' };
    }
    const damagedItem = (items || []).find((i) => i?.condition === 'Damaged');
    if (damagedItem) {
      return {
        error: `Pre-existing damage marked (${damagedItem.label || damagedItem.name || 'item'}) — this unit is not roadworthy. Handover is blocked; return to Front Desk to reassign a different vehicle.`,
      };
    }
    if (!signedBy?.trim()) {
      return { error: 'Staff signed-by name is required.' };
    }
    if (!guestSignature?.trim() && !guestSignsOnPhone) {
      return { error: 'Guest co-signature is required, or mark that the guest will sign on their own phone.' };
    }
  }

  const ref = await addDoc(collection(db, handoversCol), {
    bookingId,
    handoverType,
    unitNumber,
    fuelLevel: Number(fuelLevel) || 0,
    mileage: Number(mileage) || 0,
    items: items || [],
    notes: notes || '',
    photos: photos || [],
    signedBy: signedBy || '',
    guestSignature: guestSignature || '',
    reservationId: reservationId || '',
    damageCheck: damageCheck || null,
    damageOverride: damageOverride || null,
    createdAt: handoverType === 'CheckIn' ? returnedAtMs : Date.now(),
  });

  if (handoverType === 'CheckOut') {
    const branch = branchById(booking.pickupBranchId);
    let authorisationHoldAmount = Number(booking.authorisationHoldAmount) || Number(booking.deposit) || 0;
    let extraHoldNote = '';
    if (branch?.highRisk) {
      if (waiveExtraHold) {
        extraHoldNote = `High-risk extra hold waived by ${signedBy || 'Front Desk'}${waiveNote ? ` — ${waiveNote}` : ''}`;
      } else {
        authorisationHoldAmount = round(authorisationHoldAmount + HIGH_RISK_EXTRA_HOLD);
        extraHoldNote = `High-risk branch — extra hold of R${HIGH_RISK_EXTRA_HOLD} applied`;
      }
    }
    const agreementIssuedAt = Date.now();
    await updateDoc(doc(db, bookingsCol, bookingId), {
      status: 'CheckedOut',
      handoverOut: { id: ref.id, fuelLevel: Number(fuelLevel), mileage: Number(mileage), at: Date.now() },
      authorisationHoldAmount,
      guestSignature: guestSignature || booking.guestSignature || '',
      ...(guestSignature?.trim()
        ? { guestAcknowledgedAt: Date.now() }
        : {}),
      collectionProgress: {
        step: guestSignature?.trim() ? 'complete' : 'signature',
        stepUpdatedAt: Date.now(),
      },
      agreementIssuedAt,
      checkoutLock: null,
    });
    const rentedVehicle = await getFleetVehicleForBooking({ ...booking, unitNumber });
    if (rentedVehicle?.id) await setVehicleStatus(rentedVehicle.id, 'Rented');
    await logBookingHistory(
      bookingId,
      'CheckedOut',
      signedBy,
      `Vehicle handed out · fuel ${fuelLevel}% · ${mileage} km${extraHoldNote ? ` · ${extraHoldNote}` : ''}${guestSignature?.trim() ? '' : ' · guest will sign on their phone'} · rental agreement & gate pass generated`,
    );
    return { id: ref.id, agreementIssuedAt };
  } else {
    const out = booking?.handoverOut || {};
    const variance = {
      fuelDelta: out.fuelLevel != null ? round((Number(out.fuelLevel) || 0) - (Number(fuelLevel) || 0)) : 0,
      mileageDelta: out.mileage != null ? Math.max(0, (Number(mileage) || 0) - (Number(out.mileage) || 0)) : 0,
      damages: (items || []).filter((i) => i && (i.condition === 'Damaged' || i.damaged)).map((i) => i.label || i.name),
    };
    const damageDetected = variance.damages.length > 0 || damageCheck?.flagged === true;

    const returnedAt = returnedAtMs;
    const late = lateReturnCharges({
      scheduledDropoff: booking.dropoffDate,
      scheduledDropoffTime: booking.dropoffTime,
      actualReturn: returnedAt,
      dailyRate: booking.days ? round(booking.basePrice / booking.days) : 0,
      graceHours: LATE_RETURN_GRACE_HOURS,
    });
    const returnTiming = {
      status: late.status,
      scheduled: `${booking.dropoffDate}T${booking.dropoffTime || '00:00'}`,
      returnedAt,
      elapsedHours: late.elapsedHours,
      lateHours: late.lateHours,
      graceHours: LATE_RETURN_GRACE_HOURS,
    };
    const fuel = fuelVarianceCharge({
      fuelOutPct: out.fuelLevel,
      fuelInPct: Number(fuelLevel) || 0,
      tankLitres: booking.tankLitres,
    });
    const oneWay = oneWayFee(booking.pickupBranchId, returnBranchId || booking.returnBranchId);

    const stamp = Date.now();
    const pendingCharges = [];
    if (late.total > 0) {
      pendingCharges.push({ id: `late-day-${stamp}`, type: 'LateReturn', description: `Extra day(s) — ${late.lateDays} day(s) over (${late.lateHours}h after a ${late.graceHours}h grace)`, amount: late.extraDayFee, status: 'Held' });
      pendingCharges.push({ id: `late-fee-${stamp}`, type: 'LateFee', description: `Late-return fee — ${late.lateDays} day(s) × R${round(late.dailyLateFee / late.lateDays)}`, amount: late.dailyLateFee, status: 'Held' });
    }
    if (fuel.total > 0) {
      pendingCharges.push({ id: `fuel-${stamp}`, type: 'Fuel', description: `Fuel shortfall — ${fuel.shortfallLitres}L`, amount: fuel.fuelCost, status: 'Held' });
      pendingCharges.push({ id: `refuel-${stamp}`, type: 'RefuelFee', description: 'Refuelling service fee', amount: fuel.serviceFee, status: 'Held' });
    }
    if (oneWay > 0) {
      pendingCharges.push({ id: `oneway-${stamp}`, type: 'OneWay', description: `One-way fee (${booking.pickupBranchId} → ${returnBranchId || booking.returnBranchId})`, amount: oneWay, status: 'Held' });
    }

    await updateDoc(doc(db, bookingsCol, bookingId), {
      status: 'PendingInspection',
      handoverIn: { id: ref.id, fuelLevel: Number(fuelLevel), mileage: Number(mileage), at: returnedAt },
      returnBranchId: returnBranchId || booking.returnBranchId || booking.pickupBranchId,
      variance: { ...variance, damageDetected },
      returnTiming,
      pendingCharges: [...(booking.pendingCharges || []), ...pendingCharges],
      returnProgress: { step: 'CHARGES_REVIEW', stepUpdatedAt: returnedAt },
    });
    // UC15: the vehicle stays UNAVAILABLE until the post-rental inspection is completed
    // (finalized later → Available or InMaintenance). Repairs queued from damage already
    // have a work order created below while the unit waits for inspection.
    const returnedVehicle = await getFleetVehicleForBooking({ ...booking, unitNumber });
    if (returnedVehicle?.id) await setVehicleStatus(returnedVehicle.id, 'PendingInspection');
    await logBookingHistory(bookingId, 'PendingInspection', signedBy, `Vehicle re-checked · return ${late.status} (${late.elapsedHours}h vs scheduled) · fuel ${fuelLevel}% · ${mileage} km · ${pendingCharges.length} item(s) held for review · awaiting post-rental inspection`);

    // Damage detected → automatically open a repair work order so the damage is
    // visible in the maintenance register; the unit is released/blocked once the
    // post-rental inspection is finalized.
    let workOrder = null;
    if (damageDetected && booking.vehicleId) {
      const woRes = await createFleetWorkOrder({
        source: 'CheckIn',
        title: `Damage at check-in — ${booking.vehicleName || 'vehicle'}`,
        description: [
          variance.damages.length ? `Damages recorded on check-in: ${variance.damages.join(', ')}` : 'Damage flagged by pixel comparison at check-in.',
          notes ? `Notes: ${notes}` : '',
          damageCheck?.flagged ? 'Pixel comparison flagged a visual difference.' : '',
        ].filter(Boolean).join(' · '),
        vehicleId: booking.vehicleId,
        vehicleName: booking.vehicleName || '',
        unitNumber: unitNumber || booking.unitNumber || '',
        priority: damageCheck?.flagged ? 'High' : 'Normal',
        handoverId: ref.id,
        handoverType: 'CheckIn',
        bookingId,
        createdBy: signedBy || 'Front Desk',
      });
      if (!woRes?.error) workOrder = woRes;
    }
    return { id: ref.id, damageDetected, damageDetails: variance.damages, workOrder, finalizedCharges: pendingCharges, returnTiming };
  }
};

// UC15 step 7 → 8: the Post-Rental Inspection is completed by staff. Booking is
// finalized (CheckedIn), the vehicle is returned to service (or sent to
// maintenance when the return flagged damage), and pending charges are presented.
export const finalizePostRentalInspection = async (bookingId, { qualifiedBy = 'Front Desk', notes = '' }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  if (booking.status !== 'PendingInspection') {
    return { error: `This rental is ${bookingDisplay(booking.status)} — not awaiting a post-rental inspection.` };
  }
  const damageDetected = booking.variance?.damageDetected === true;
  const vehicleStatus = damageDetected ? 'InMaintenance' : 'Available';
  if (booking.vehicleId) await setVehicleStatus(booking.vehicleId, vehicleStatus);
  const returnReceiptIssuedAt = Date.now();
  await updateDoc(doc(db, bookingsCol, bookingId), {
    status: 'CheckedIn',
    finalizedBy: qualifiedBy,
    finalizedAt: Date.now(),
    finalizedNotes: notes.trim(),
    finalizedVehicleStatus: vehicleStatus,
    returnProgress: { step: 'COMPLETE', stepUpdatedAt: returnReceiptIssuedAt },
    returnReceiptIssuedAt,
  });
  await logBookingHistory(bookingId, 'CheckedIn', qualifiedBy, `Post-rental inspection passed by ${qualifiedBy} — vehicle ${vehicleStatus}${notes.trim() ? ` · ${notes.trim()}` : ''}`);
  return { ok: true, damageDetected, vehicleStatus, returnReceiptIssuedAt };
};

// One-action finalize for the staff return wizard. Composes the existing pieces —
// recordVehicleHandover (CheckIn) creates the return record + held charges + damage
// work order, the liability record reuses the Incident Register model, and
// finalizePostRentalInspection flips booking + vehicle state. No parallel model.
export const finalizeVehicleReturn = async (bookingId, {
  unitNumber = '',
  fuelLevel = 100,
  mileage = 0,
  items = [],
  notes = '',
  photos = [],
  signedBy = 'Front Desk',
  returnedAt = Date.now(),
  returnBranchId = '',
  liability = 'Undetermined',
  liabilityNote = '',
  chargeLines = [],
}) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  if (booking.status !== 'CheckedOut') {
    return { error: `This rental is ${bookingDisplay(booking.status)} — only a checked-out vehicle can be finalized for return.` };
  }

  const res = await recordVehicleHandover({
    bookingId,
    handoverType: 'CheckIn',
    unitNumber: unitNumber || booking.unitNumber || '',
    fuelLevel,
    mileage,
    items,
    notes,
    photos,
    signedBy: signedBy || 'Front Desk',
    reservationId: booking.reservationId || '',
    returnBranchId: returnBranchId || booking.returnBranchId || booking.pickupBranchId,
    returnedAt,
  });
  if (res?.error) return res;

  // Damage → liability/charges via the SAME Incident Register data model. Damage
  // routing (work order) and guest billing (liability) stay independent decisions.
  const damageLines = (chargeLines || [])
    .filter((l) => l && (l.label || '').trim() && Number(l.amount) > 0)
    .map((l) => ({ label: String(l.label).trim(), amount: Math.round(Number(l.amount) * 100) / 100 }));
  const damageTotal = damageLines.reduce((s, l) => s + l.amount, 0);
  const hasDamage = res.damageDetected === true || damageLines.length > 0;
  const openIncidents = (await listFleetIncidents())
    .filter((i) => i.bookingId === bookingId && !['Resolved', 'Cancelled'].includes(i.status))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  let incident = null;
  let incidentId = '';
  if (hasDamage || openIncidents.length > 0) {
    const existing = openIncidents[0];
    incidentId = existing?.id || '';
    if (existing) {
      // Resolve an existing mid-rental incident as part of this return — keep any
      // charge lines the incident already established, else adopt the return's.
      const baseLines = (existing.chargeLines || []).filter((l) => Number(l.amount) > 0).length
        ? existing.chargeLines
        : damageLines;
      await determineIncidentLiability(incidentId, {
        liability,
        description: liabilityNote,
        byName: signedBy,
        chargeLines: baseLines,
      });
    } else {
      const created = await createFleetIncident({
        reporterUid: 'system',
        reporterName: signedBy || 'Front Desk',
        reporterRole: 'staff',
        category: 'Damage at return',
        description: [
          liabilityNote.trim(),
          `Damages at check-in of ${booking.vehicleName || 'vehicle'} (${booking.ref}): ${res.damageDetails?.join(', ') || damageLines.map((d) => d.label).join(', ') || 'new damage marked on the return checklist'}.`,
        ].filter(Boolean).join(' · '),
        bookingId,
        vehicleId: booking.vehicleId || '',
        vehicleName: booking.vehicleName || '',
      });
      if (!created?.error) {
        incidentId = created.id;
        await determineIncidentLiability(created.id, {
          liability,
          description: liabilityNote,
          byName: signedBy,
          chargeLines: damageLines,
        });
        if (res.workOrder?.id) {
          await updateFleetIncident(created.id, {
            patch: { linkedWorkOrderId: res.workOrder.id },
            by: signedBy,
            note: 'Check-in damage work order linked to return',
          }).catch(() => {});
        }
      }
    }
    if (incidentId) {
      const snap = await getDoc(doc(db, incidentsCol, incidentId));
      incident = snap.exists() ? { id: incidentId, ...snap.data() } : null;
    }
    if (res.workOrder?.id) {
      await updateFleetWorkOrder(res.workOrder.id, {
        patch: { estimatedCost: damageTotal || Number(res.workOrder.estimatedCost) || 0, incidentId: incident?.id || '' },
        by: signedBy,
        note: 'Estimate from return damage line-items',
      }).catch(() => {});
    }
  }

  const fin = await finalizePostRentalInspection(bookingId, { qualifiedBy: signedBy, notes: liabilityNote });
  if (fin?.error) return fin;

  const fresh = await getCarBooking(bookingId);
  return {
    ok: true,
    status: fresh?.status || 'CheckedIn',
    vehicleStatus: fin.vehicleStatus,
    returnReceiptIssuedAt: fin.returnReceiptIssuedAt,
    charges: fresh?.pendingCharges || [],
    settlement: fresh ? computeReturnSettlement(fresh) : null,
    incident,
    workOrder: res.workOrder || null,
    damageDetected: hasDamage,
    dataGap: !booking.handoverOut,
  };
};

export const subscribeVehicleHandovers = (cb) =>
  onSnapshot(
    query(collection(db, handoversCol)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
    (err) => console.error('vehicleHandovers listener error', err),
  );

export const listVehicleHandovers = async () => {
  const snap = await getDocs(query(collection(db, handoversCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

// ---------------- Guest vehicle collection flow ----------------
export const COLLECTION_STEPS = ['prep', 'arrived', 'verification', 'inspection', 'signature', 'complete'];
export const collectionStepLabel = (step) => ({
  prep: 'Ready for pick-up',
  arrived: 'Guest arrived',
  verification: 'Licence verification',
  inspection: 'Vehicle inspection',
  signature: 'Awaiting your signature',
  complete: 'Keys issued',
}[step] || 'Ready for pick-up');

export const markGuestArrived = async (bookingId) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  await updateDoc(doc(db, bookingsCol, bookingId), {
    guestArrived: true,
    guestArrivedAt: Date.now(),
    collectionProgress: { step: 'arrived', arrivedAt: Date.now(), stepUpdatedAt: Date.now() },
  });
  await logBookingHistory(bookingId, booking.status, 'Guest', 'Guest arrived for vehicle collection');
  return { ok: true };
};

export const updateHandoverStep = async (bookingId, step) => {
  await updateDoc(doc(db, bookingsCol, bookingId), {
    collectionProgress: { step, stepUpdatedAt: Date.now() },
  });
};

export const getHandoverForBooking = async (bookingId) => {
  const snap = await getDocs(query(collection(db, handoversCol), where('bookingId', '==', bookingId)));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return docs[0] || null;
};

export const subscribeHandoverForBooking = (bookingId, cb) => {
  if (!bookingId) return () => {};
  return onSnapshot(
    query(collection(db, handoversCol), where('bookingId', '==', bookingId)),
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(docs[0] || null);
    },
    (err) => console.error('handover listener error', err),
  );
};

export const submitGuestSignature = async (bookingId, { signatureText }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const handover = await getHandoverForBooking(bookingId);
  if (!handover) return { error: 'No handover record found yet — the front desk is still completing the vehicle inspection.' };
  const trimmed = (signatureText || '').trim();
  if (!trimmed) return { error: 'Signature is required.' };
  const stamp = Date.now();
  await updateDoc(doc(db, handoversCol, handover.id), {
    guestSignature: trimmed,
    guestAcknowledgedAt: stamp,
  });
  await updateDoc(doc(db, bookingsCol, bookingId), {
    collectionProgress: { step: 'complete', stepUpdatedAt: stamp },
    guestSignature: trimmed,
    guestAcknowledgedAt: stamp,
  });
  await logBookingHistory(bookingId, 'CheckedOut', 'Guest', 'Vehicle collection acknowledged — guest signed digitally');
  return { ok: true, signedAt: stamp };
};

// ---------------- Guest vehicle return flow ----------------
// Mirrors the collection-flow pattern above: a persisted `returnProgress.step`
// the guest tracker subscribes to, advanced by a guest action (`returning`), a
// small staff-side instrumentation signal (`inspection`, from FleetHandover.jsx's
// CheckIn path), and the existing recordVehicleHandover/finalizePostRentalInspection
// writes (`charges`, `complete`) — no parallel data model, same booking doc.

export const RETURN_STEPS = ['RETURN_LOGGED', 'INSPECTION_IN_PROGRESS', 'LIABILITY_PENDING', 'CHARGES_REVIEW', 'COMPLETE'];
export const returnStepLabel = (step) => ({
  RETURN_LOGGED: 'Return logged',
  INSPECTION_IN_PROGRESS: 'Vehicle inspection',
  LIABILITY_PENDING: 'Liability review',
  CHARGES_REVIEW: 'Charges review',
  COMPLETE: 'Return complete',
}[step] || 'Return scheduled');

export const markGuestReturning = async (bookingId) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  await updateDoc(doc(db, bookingsCol, bookingId), {
    guestReturning: true,
    guestReturningAt: Date.now(),
    returnProgress: { step: 'RETURN_LOGGED', stepUpdatedAt: Date.now() },
  });
  await logBookingHistory(bookingId, booking.status, 'Guest', 'Guest is heading back to return the vehicle');
  return { ok: true };
};

export const updateReturnStep = async (bookingId, step) => {
  await updateDoc(doc(db, bookingsCol, bookingId), {
    returnProgress: { step, stepUpdatedAt: Date.now() },
  });
};

// Staff-guided return wizard (source of truth for the return tracker): advances the
// shared returnProgress.step and appends an audit-trail entry, so the guest-facing
// tracker reflects where the desk is without staff having to narrate progress.
export const advanceReturnStep = async (bookingId, step, { by, note } = {}) => {
  if (!RETURN_STEPS.includes(step)) return { error: `Unknown return step ${step}.` };
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const stamp = Date.now();
  await updateDoc(doc(db, bookingsCol, bookingId), {
    returnProgress: { step, stepUpdatedAt: stamp },
  });
  await logBookingHistory(bookingId, booking.status, by || 'Front Desk', note || `Return progress → ${returnStepLabel(step)}`);
  return { ok: true, step, at: stamp };
};

export const acknowledgeReturnSummary = async (bookingId, { by } = {}) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const stamp = Date.now();
  await updateDoc(doc(db, bookingsCol, bookingId), {
    returnAcknowledgedAt: stamp,
    returnAcknowledgedBy: by || 'Guest',
  });
  await logBookingHistory(bookingId, booking.status, by || 'Guest', 'Guest acknowledged the return summary');
  return { ok: true, acknowledgedAt: stamp };
};

// ---------------- Licence verification (check-out gate 1) ----------------
// No external verification provider is integrated (no backend to hold
// credentials) — these are real local checks (expiry, minimum age, required
// fields) that the UI wraps in a simulated "contacting verification
// service…" delay, matching how Stripe is simulated elsewhere in this app.

export const verifyDriverLicence = async (bookingId, { checkedBy } = {}) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const reasons = [];
  if (!booking.licenseNumber?.trim()) reasons.push('No licence number on file.');
  if (!booking.licenseExpiry) {
    reasons.push('No licence expiry date on file.');
  } else if (new Date(`${booking.licenseExpiry}T23:59:59`) < new Date()) {
    reasons.push(`Licence expired on ${booking.licenseExpiry}.`);
  }
  const age = ageFromDob(booking.driverDob);
  if (age == null) {
    reasons.push('Driver date of birth not on file — cannot confirm minimum age.');
  } else if (age < MIN_DRIVING_AGE) {
    reasons.push(`Driver is ${age} — below the minimum driving age of ${MIN_DRIVING_AGE}.`);
  }
  const status = reasons.length === 0 ? 'Verified' : 'Failed';
  const licenceVerification = {
    status,
    checkedAt: Date.now(),
    checkedBy: checkedBy || 'Front Desk',
    reasons,
  };
  await updateDoc(doc(db, bookingsCol, bookingId), { licenceVerification });
  await logBookingHistory(
    bookingId,
    booking.status,
    checkedBy || 'Front Desk',
    status === 'Verified' ? 'Licence verification passed' : `Licence verification failed — ${reasons.join(' ')}`,
  );
  return { ok: true, licenceVerification };
};

export const overrideLicenceVerification = async (bookingId, { by, note }) => {
  const trimmed = (note || '').trim();
  if (!trimmed) return { error: 'An override reason is required and will be logged.' };
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const licenceVerification = {
    ...(booking.licenceVerification || {}),
    status: 'Overridden',
    overrideBy: by || 'Front Desk',
    overrideNote: trimmed,
    overrideAt: Date.now(),
  };
  await updateDoc(doc(db, bookingsCol, bookingId), { licenceVerification });
  await logBookingHistory(bookingId, booking.status, by || 'Front Desk', `Licence verification overridden — ${trimmed}`);
  return { ok: true, licenceVerification };
};

// ---------------- Check-out concurrency lock ----------------
// Last-write-wins after a visible staleness window, with an explicit
// "take over" action rather than a silent overwrite — avoids two staff
// members quietly clobbering each other's handover progress.

const CHECKOUT_LOCK_STALE_MS = 10 * 60 * 1000;

export const acquireCheckoutLock = async (bookingId, { by, uid, force = false } = {}) => {
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, bookingsCol, bookingId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return { error: 'Booking not found.' };
      const existing = snap.data().checkoutLock;
      const isStale = existing?.at && Date.now() - existing.at > CHECKOUT_LOCK_STALE_MS;
      if (existing && existing.uid !== uid && !isStale && !force) {
        return { error: 'Locked by another staff member.', lockedBy: existing.by, lockedAt: existing.at };
      }
      const lock = { by: by || 'Front Desk', uid: uid || '', at: Date.now() };
      tx.update(ref, { checkoutLock: lock });
      return { ok: true, lock };
    });
  } catch {
    return { error: 'Could not acquire the check-out lock — please retry.' };
  }
};

export const releaseCheckoutLock = (bookingId) =>
  updateDoc(doc(db, bookingsCol, bookingId), { checkoutLock: null }).catch(() => {});

// ---------------- Reassign vehicle after a damage-gate block ----------------
// Keeps the booking Confirmed on a different unit without losing the
// guest's already-captured licence data (which lives on the booking, not
// the vehicle or handover record).

export const reassignBookingVehicle = async (bookingId, { vehicleId, unitNumber, by }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  if (booking.status !== 'Confirmed') {
    return { error: `This booking is ${bookingDisplay(booking.status)} — it can only be reassigned while Confirmed.` };
  }
  const newVehicle = await getFleetVehicle(vehicleId);
  if (!newVehicle) return { error: 'Replacement vehicle not found.' };
  if (newVehicle.status !== 'Available') {
    return { error: `${newVehicle.unitNumber || newVehicle.name} is ${newVehicle.status} — pick an available unit.` };
  }
  const oldVehicle = await getFleetVehicleForBooking(booking);
  await updateDoc(doc(db, bookingsCol, bookingId), {
    vehicleId,
    vehicleName: newVehicle.name,
    vehicleImage: newVehicle.image || '',
    unitNumber: unitNumber || newVehicle.unitNumber || newVehicle.plateNumber || '',
    notRoadworthySwap: true,
    replacementVehicleId: vehicleId,
    replacementVehicleName: newVehicle.name,
  });
  await setVehicleStatus(vehicleId, 'Reserved');
  if (oldVehicle?.id && oldVehicle.id !== vehicleId) await setVehicleStatus(oldVehicle.id, 'Available');
  await logBookingHistory(
    bookingId,
    'Confirmed',
    by || 'Front Desk',
    `Reassigned to ${newVehicle.name} (${newVehicle.unitNumber || newVehicle.plateNumber}) — pre-existing damage found on the previous unit at check-out`,
  );
  return { ok: true, vehicleId, vehicleName: newVehicle.name, unitNumber: unitNumber || newVehicle.unitNumber };
};

// ---------------- Charges & payments ----------------

export const postBookingChargeToBill = async (bookingId, { amount, description, reservationId }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const rid = reservationId || booking.reservationId;
  if (!rid) {
    return { error: 'This booking has no linked stay (folio) on file.' };
  }
  await addBillItem(rid, {
    type: 'CarRental',
    description: description || `Car rental: ${booking.vehicleName}`,
    qty: 1,
    unitPrice: amount,
  });
  const finalCharges = round((booking.finalCharges || 0) + Number(amount));
  await updateDoc(doc(db, bookingsCol, bookingId), { finalCharges });
  return { ok: true, finalCharges };
};

// UC16 joint sign-off: a pending (Held) charge is either accepted (posted to
// the folio/capturedAmount) or disputed (stays held, escalates to Fleet
// Manager) — nothing is billed automatically.
export const reviewPendingCharge = async (bookingId, itemId, { action, by, note = '' }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const pendingCharges = booking.pendingCharges || [];
  const idx = pendingCharges.findIndex((i) => i.id === itemId);
  if (idx === -1) return { error: 'Charge item not found.' };
  const item = pendingCharges[idx];
  if (item.status !== 'Held') return { error: `This item is already ${item.status}.` };

  const updated = [...pendingCharges];
  if (action === 'accept') {
    updated[idx] = { ...item, status: 'Posted' };
    if (booking.reservationId) {
      await addBillItem(booking.reservationId, {
        type: item.type || 'CarRental',
        description: `${item.description} (${booking.vehicleName})`,
        qty: 1,
        unitPrice: item.amount,
      });
    }
    const finalCharges = round((booking.finalCharges || 0) + Number(item.amount));
    const capturedAmount = round((booking.capturedAmount || 0) + Number(item.amount));
    await updateDoc(doc(db, bookingsCol, bookingId), { pendingCharges: updated, finalCharges, capturedAmount });
    await logBookingHistory(bookingId, booking.status, by || 'Guest', `Charge accepted: ${item.description} (R${item.amount})`);
    return { ok: true, finalCharges, capturedAmount };
  }
  if (action === 'dispute') {
    updated[idx] = { ...item, status: 'Disputed', disputeNote: note };
    await updateDoc(doc(db, bookingsCol, bookingId), { pendingCharges: updated });
    await logBookingHistory(bookingId, booking.status, by || 'Guest', `Charge disputed: ${item.description}${note ? ` — ${note}` : ''}`);
    return { ok: true };
  }
  return { error: `Unknown action ${action}.` };
};

export const recordBookingPayment = async (bookingId, { amount, byName, method = 'Manual' }) => {
  const booking = await getCarBooking(bookingId);
  if (!booking) return { error: 'Booking not found.' };
  const paidAmount = round((booking.paidAmount || 0) + Number(amount));
  await updateDoc(doc(db, bookingsCol, bookingId), { paidAmount, paymentMethod: method });
  await logBookingHistory(
    bookingId,
    booking.status,
    byName || 'Billing',
    `Payment of R${amount} recorded via ${method}`,
  );
  return { ok: true, paidAmount };
};

export const recordServicePayment = async (serviceId, { amount, byName }) => {
  const ref = await getDoc(doc(db, servicesCol, serviceId));
  const service = ref.exists() ? { id: serviceId, ...ref.data() } : null;
  if (!service) return { error: 'Service request not found.' };
  const paidAmount = round((service.paidAmount || 0) + Number(amount));
  const history = [
    ...(service.history || []),
    { at: Date.now(), from: service.status || '', to: service.status || '', by: byName || 'Billing', note: `Payment of ${amount} recorded` },
  ];
  await updateDoc(doc(db, servicesCol, serviceId), { paidAmount, history });
  return { ok: true, paidAmount };
};

// ---------------- Dashboards & reports ----------------

export const computeFleetStats = ({ vehicles = [], bookings = [], services = [], drivers = [], handovers = [], incidents = [], workOrders = [] } = {}) => ({
  vehicles,
  bookings,
  services,
  drivers,
  handovers,
  incidents,
  workOrders,
  fleetSize: vehicles.length,
  available: vehicles.filter((v) => v.status === 'Available').length,
  reserved: vehicles.filter((v) => v.status === 'Reserved').length,
  inMaintenance: vehicles.filter((v) => v.status === 'InMaintenance').length,
  openIncidents: incidents.filter((i) => !['Resolved', 'Cancelled'].includes(i.status)).length,
  highSeverityIncidents: incidents.filter((i) => i.severity === 'High' && i.status !== 'Resolved').length,
  openWorkOrders: workOrders.filter((w) => !['SignedOff', 'Cancelled'].includes(w.status)).length,
  awaitingPartsOrders: workOrders.filter((w) => w.status === 'AwaitingParts').length,
  pendingConfirmations: bookings.filter((b) => b.status === 'PendingConfirmation').length,
  pendingInspections: bookings.filter((b) => b.status === 'PendingInspection').length,
  confirmedActive: bookings.filter((b) => ['Confirmed', 'CheckedOut'].includes(b.status)).length,
  pendingServices: services.filter((s) => s.status === 'PendingAssignment').length,
  activeTrips: services.filter((s) => ['Assigned', 'EnRoute', 'Arrived'].includes(s.status)).length,
  availableDrivers: drivers.filter((d) => d.available !== false).length,
  documentsNeedingReview: bookings.filter((b) => b.documentReviewRequired && b.status === 'PendingConfirmation').length,
  highRiskOverridesPending: bookings.filter((b) => b.riskFlag && b.status === 'PendingConfirmation').length,
  chargesAwaitingGuestResponse: bookings.reduce((s, b) => s + (b.pendingCharges || []).filter((c) => c.status === 'Held').length, 0),
  incidentsAwaitingGuestResponse: incidents.filter((i) => i.status === 'PendingGuestReview').length,
  awaitingHotelManagerSignoff:
    workOrders.filter((w) => w.status === 'AwaitingApproval').length +
    incidents.filter((i) => i.escalationTier === 'FleetManager+HotelManager' && i.status !== 'Resolved').length,
});

export const fleetDashboardStats = async () => {
  const [vehicles, bookings, services, drivers, handovers] = await Promise.all([
    listFleetVehicles(),
    listCarBookings(),
    listCarServices(),
    listFleetDrivers(),
    listVehicleHandovers(),
  ]);
  return computeFleetStats({ vehicles, bookings, services, drivers, handovers });
};

export const fleetReports = async () => {
  const [vehicles, bookings, services, drivers] = await Promise.all([
    listFleetVehicles(),
    listCarBookings(),
    listCarServices(),
    listFleetDrivers(),
  ]);

  const completedBookings = bookings.filter((b) => ['CheckedIn', 'CheckedOut', 'Confirmed'].includes(b.status));
  const totalRentalRevenue = completedBookings.reduce((s, b) => s + (Number(b.finalCharges) || Number(b.estimatedTotal) || 0), 0);
  const completedServices = services.filter((s) => s.status === 'Completed');
  const serviceRevenue = completedServices.reduce((s, x) => s + (Number(x.estimatedFare) || 0), 0);

  const utilization = vehicles.length
    ? round(
        (vehicles.filter((v) => ['Reserved', 'OutOfService'].includes(v.status)).length / vehicles.length) * 100,
      )
    : 0;

  const today = new Date();
  today.setDate(today.getDate() + 7);
  const serviceDueSoon = vehicles.filter((v) => {
    if (!v.nextServiceDate) return false;
    return new Date(v.nextServiceDate) <= today;
  });

  const driverPerformance = drivers.map((d) => {
    const done = services.filter((s) => s.driverId === d.id && s.status === 'Completed');
    return {
      driver: d,
      trips: done.length,
      revenue: done.reduce((s, x) => s + (Number(x.estimatedFare) || 0), 0),
    };
  });

  const byType = vehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRentalRevenue,
    serviceRevenue,
    totalRevenue: round(totalRentalRevenue + serviceRevenue),
    utilization,
    availableCount: vehicles.filter((v) => v.status === 'Available').length,
    inMaintenanceCount: vehicles.filter((v) => v.status === 'InMaintenance').length,
    serviceDueSoon,
    driverPerformance,
    byType,
    totalBookings: bookings.length,
    activeBookings: bookings.filter((b) => ['PendingConfirmation', 'Confirmed', 'CheckedOut'].includes(b.status)).length,
    totalServices: services.length,
  };
};

// ---------------- Incidents (4.19) ----------------

// Small tamper-evident checksum (FNV-1a 32-bit, hex) computed on capture for dispute resolution.
export const evidenceChecksum = (str) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
};

export const severityTriage = ({ category = '', injuries = false, undriveable = false } = {}) => {
  const flags = [];
  let level = 'Low';
  if (category === 'Theft/Break-in') flags.push('Theft/burglary reported');
  if (injuries) flags.push('Injuries reported');
  if (undriveable) flags.push('Vehicle undriveable');
  if (category === 'Accident/Collision') flags.push('Collision reported');
  if (category === 'Breakdown/Mechanical Fault') flags.push('Mechanical fault');
  if (flags.length >= 2 || category === 'Theft/Break-in' || injuries || undriveable) level = 'High';
  else if (category === 'Accident/Collision' || category === 'Breakdown/Mechanical Fault') level = 'Medium';
  return { level, flags, escalated: level === 'High' };
};

export const createFleetIncident = async ({
  reporterUid,
  reporterName,
  reporterRole = 'guest',
  category,
  description,
  occurredAt = Date.now(),
  lat = null,
  lng = null,
  locationLabel = '',
  injuries = false,
  undriveable = false,
  thirdPartyInvolved = false,
  otherPartyDetails = '',
  policeRef = '',
  insuranceRef = '',
  bookingId = '',
  serviceId = '',
  vehicleId = '',
  vehicleName = '',
  vehicleImage = '',
  evidence = [],
}) => {
  if (!reporterUid || !category || !description?.trim()) return { error: 'Reporter, category and a description are required.' };
  const triage = severityTriage({ category, injuries, undriveable });
  const incidentRef = carRef('INC');
  const ref = await addDoc(collection(db, incidentsCol), {
    ref: incidentRef,
    reporterUid,
    reporterName,
    reporterRole,
    category,
    description: description.trim(),
    occurredAt: Number(occurredAt) || Date.now(),
    location: { lat: Number(lat) || null, lng: Number(lng) || null, label: locationLabel || '' },
    injuries: !!injuries,
    undriveable: !!undriveable,
    thirdPartyInvolved: !!thirdPartyInvolved,
    otherPartyDetails,
    policeRef,
    insuranceRef,
    bookingId,
    serviceId,
    vehicleId,
    vehicleName,
    vehicleImage,
    severity: triage.level,
    flags: triage.flags,
    escalated: triage.escalated,
    // UC19: severe incidents dual-notify Fleet Manager and Hotel Manager at once.
    escalationTier: triage.level === 'High' ? 'FleetManager+HotelManager' : 'FleetManager',
    status: triage.escalated ? 'Suspended' : 'Open',
    evidence: (evidence || []).map((e) => ({ name: e.name || 'photo', checksum: e.checksum || '', dataUrl: e.dataUrl || '', addedAt: Date.now() })),
    liability: '',
    chargeAmount: 0,
    resolutionNote: '',
    linkedWorkOrderId: '',
    history: [
      { at: Date.now(), to: triage.escalated ? 'Suspended' : 'Open', by: reporterName || 'Guest', note: triage.flags.length ? triage.flags.join(' · ') : `Reported as ${category}` },
    ],
    createdAt: Date.now(),
  });
  if (triage.escalated && bookingId) {
    await updateCarBookingStatus(bookingId, 'Suspended', reporterName || 'System').catch(() => {});
  }
  if (triage.escalated && serviceId) {
    await updateCarServiceStatus(serviceId, 'Suspended', reporterName || 'System').catch(() => {});
  }
  return { id: ref.id, ref: incidentRef, severity: triage.level, escalated: triage.escalated, flags: triage.flags };
};

export const listFleetIncidents = async () => {
  const snap = await getDocs(query(collection(db, incidentsCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const subscribeFleetIncidents = (cb) =>
  onSnapshot(
    query(collection(db, incidentsCol)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
    (err) => console.error('fleetIncidents listener error', err),
  );

export const updateFleetIncident = async (id, { patch = {}, by = 'System', note = '' } = {}) => {
  const snap = await getDoc(doc(db, incidentsCol, id));
  if (!snap.exists()) return { error: 'Incident not found.' };
  const current = snap.data();
  const history = [...(current.history || []), { at: Date.now(), from: current.status, to: patch.status || current.status, by, note: note || 'Incident updated' }];
  await updateDoc(doc(db, incidentsCol, id), { ...patch, history });
  return { ok: true };
};

// UC19 §9.1: liability is proposed here but not billed yet — the guest must
// accept or dispute it (resolveIncidentReview) before anything posts, same
// held-charge pattern as UC16. Repair costs only flow to the guest when
// liability is assigned to them; normal wear/mechanical/third-party stays an
// internal fleet-maintenance cost with no guest charge at all.
export const determineIncidentLiability = async (id, { liability = 'Undetermined', repairEstimate = 0, description = '', byName = 'System', chargeLines = [] } = {}) => {
  const snap = await getDoc(doc(db, incidentsCol, id));
  if (!snap.exists()) return { error: 'Incident not found.' };
  const incident = { id, ...snap.data() };
  const guestLiable = liability === 'Guest fault';
  const lines = (chargeLines || [])
    .filter((l) => l && (l.label || '').trim() && Number(l.amount) > 0)
    .map((l) => ({ label: String(l.label).trim(), amount: Math.round(Number(l.amount) * 100) / 100 }));
  const lineTotal = lines.reduce((s, l) => s + l.amount, 0);
  const estimate = guestLiable ? (lineTotal > 0 ? lineTotal : Number(repairEstimate) || 0) : 0;
  const adminFee = estimate > 0 ? accidentAdminFee(estimate) : 0;
  const chargeAmount = round(estimate + adminFee);
  const patch = {
    liability,
    resolutionNote: description,
    chargeLines: lines,
    repairEstimate: estimate,
    adminFee,
    chargeAmount,
    status: 'PendingGuestReview',
  };
  const history = [
    ...(incident.history || []),
    { at: Date.now(), from: incident.status, to: 'PendingGuestReview', by: byName, note: `Liability determined: ${liability}${chargeAmount ? ` · proposed charge R${chargeAmount} (repair R${estimate} + admin fee R${adminFee})` : ' · no guest charge'}` },
  ];
  await updateDoc(doc(db, incidentsCol, id), { ...patch, history });
  return { ok: true, chargeAmount };
};

export const resolveIncidentReview = async (id, { action, by = 'Guest', reservationId = '' } = {}) => {
  const snap = await getDoc(doc(db, incidentsCol, id));
  if (!snap.exists()) return { error: 'Incident not found.' };
  const incident = { id, ...snap.data() };
  if (incident.status !== 'PendingGuestReview') return { error: `Incident is not awaiting review (status: ${incident.status}).` };

  if (action === 'accept') {
    if (Number(incident.chargeAmount) > 0) {
      const res = await postBookingChargeToBill(incident.bookingId, {
        amount: Number(incident.chargeAmount),
        description: `Incident ${incident.ref}: ${incident.category} (repair R${incident.repairEstimate} + admin fee R${incident.adminFee})`,
        reservationId,
      });
      if (res?.error) return res;
    }
    const history = [...(incident.history || []), { at: Date.now(), from: incident.status, to: 'Resolved', by, note: 'Guest accepted liability & charge' }];
    await updateDoc(doc(db, incidentsCol, id), { status: 'Resolved', resolvedAt: Date.now(), history });
    return { ok: true, chargeAmount: incident.chargeAmount };
  }
  if (action === 'dispute') {
    const history = [...(incident.history || []), { at: Date.now(), from: incident.status, to: 'Adjudicating', by, note: 'Guest disputed liability — routed to Fleet Manager for adjudication' }];
    await updateDoc(doc(db, incidentsCol, id), { status: 'Adjudicating', history });
    return { ok: true };
  }
  return { error: `Unknown action ${action}.` };
};

// ---------------- Work orders & repair/maintenance (4.20) ----------------

const WORK_ORDER_APPROVAL_THRESHOLD = 2000;
const WORK_ORDER_STATUSES = ['Open', 'AwaitingApproval', 'InProgress', 'AwaitingParts', 'Completed', 'SignedOff', 'Cancelled'];

export const listFleetWorkOrders = async () => {
  const snap = await getDocs(query(collection(db, workOrdersCol)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const subscribeFleetWorkOrders = (cb) =>
  onSnapshot(
    query(collection(db, workOrdersCol)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
    (err) => console.error('fleetWorkOrders listener error', err),
  );

const workOrderDoc = (data) => ({
  ref: carRef('WO'),
  status: 'Open',
  source: data.source || 'Manual',
  title: data.title || '',
  description: data.description || '',
  vehicleId: data.vehicleId || '',
  vehicleName: data.vehicleName || '',
  unitNumber: data.unitNumber || '',
  priority: data.priority || 'Normal',
  technician: data.technician || '',
  workshop: data.workshop || '',
  parts: data.parts || [],
  estimatedCost: Number(data.estimatedCost) || 0,
  finalCost: 0,
  incidentId: data.incidentId || '',
  handoverId: data.handoverId || '',
  handoverType: data.handoverType || '',
  bookingId: data.bookingId || '',
  checklist: data.checklist || {},
  completedAt: null,
  closedAt: null,
  history: [{ at: Date.now(), to: 'Open', by: data.createdBy || 'System', note: 'Work order created' }],
  createdAt: Date.now(),
});

export const createFleetWorkOrder = async (data) => {
  const needsApproval = Number(data.estimatedCost) > WORK_ORDER_APPROVAL_THRESHOLD;
  const base = workOrderDoc(data);
  base.status = needsApproval ? 'AwaitingApproval' : 'Open';
  base.history = [{ at: Date.now(), to: base.status, by: data.createdBy || 'System', note: needsApproval ? `Estimate R${round(Number(data.estimatedCost))} exceeds approval threshold — awaiting manager sign-off` : 'Work order created' }];
  const ref = await addDoc(collection(db, workOrdersCol), base);
  if (data.vehicleId) await updateDoc(doc(db, vehiclesCol, data.vehicleId), { status: 'InMaintenance' }).catch(() => {});
  if (data.incidentId) {
    await updateFleetIncident(data.incidentId, { patch: { linkedWorkOrderId: ref.id, status: 'UnderReview' }, by: data.createdBy || 'System', note: 'Work order linked from incident' });
  }
  return { id: ref.id, ref: base.ref, status: base.status };
};

export const openWorkOrderFromIncident = async (incidentId, { createdBy = 'System' } = {}) => {
  const snap = await getDoc(doc(db, incidentsCol, incidentId));
  if (!snap.exists()) return { error: 'Incident not found.' };
  const incident = { id: incidentId, ...snap.data() };
  if (incident.linkedWorkOrderId) {
    return { id: incident.linkedWorkOrderId, existing: true };
  }
  if (!incident.vehicleId) return { error: 'This incident is not linked to a vehicle, so a repair work order cannot be opened.' };
  return createFleetWorkOrder({
    source: 'Incident',
    title: `${incident.category} — ${incident.vehicleName || 'vehicle'}`,
    description: incident.description,
    vehicleId: incident.vehicleId || '',
    vehicleName: incident.vehicleName || '',
    priority: incident.severity === 'High' ? 'High' : 'Normal',
    incidentId,
    createdBy,
  });
};

export const updateFleetWorkOrder = async (id, { patch = {}, by = 'System', note = '' } = {}) => {
  const snap = await getDoc(doc(db, workOrdersCol, id));
  if (!snap.exists()) return { error: 'Work order not found.' };
  const current = snap.data();
  const history = [...(current.history || []), { at: Date.now(), from: current.status, to: patch.status || current.status, by, note: note || 'Work order updated' }];
  await updateDoc(doc(db, workOrdersCol, id), { ...patch, history });
  return { ok: true };
};

export const advanceFleetWorkOrder = async (id, to, { by = 'System', note = '', checklist = null, parts = null, finalCost = null, mileageAtCompletion = null } = {}) => {
  const snap = await getDoc(doc(db, workOrdersCol, id));
  if (!snap.exists()) return { error: 'Work order not found.' };
  const wo = snap.data();
  if (!WORK_ORDER_STATUSES.includes(to)) return { error: `Unknown status ${to}.` };

  const patch = { status: to };
  if (to === 'Completed') {
    const ok = checklist && Object.values(checklist).every(Boolean);
    if (!ok) return { error: 'Return-to-service checklist must pass every item before completion.' };
    patch.checklist = checklist;
    patch.completedAt = Date.now();
    patch.finalCost = Number(finalCost) || Number(wo.estimatedCost) || 0;
    if (mileageAtCompletion) patch.mileageAtCompletion = Number(mileageAtCompletion);

    // Damage repaired from a check-in inspection is billed back to the guest whose
    // rental caused it — same Held/accept/dispute review as late & fuel charges.
    if (wo.source === 'CheckIn' && wo.bookingId && patch.finalCost > 0) {
      const booking = await getCarBooking(wo.bookingId);
      if (booking) {
        const chargeId = `damage-${id}`;
        const alreadyCharged = (booking.pendingCharges || []).some((c) => c.id === chargeId);
        if (!alreadyCharged) {
          const pendingCharges = [
            ...(booking.pendingCharges || []),
            {
              id: chargeId,
              type: 'DamageRepair',
              description: `Damage repair — ${wo.ref} (${wo.title || 'vehicle damage'})`,
              amount: patch.finalCost,
              status: 'Held',
            },
          ];
          await updateDoc(doc(db, bookingsCol, wo.bookingId), { pendingCharges });
          await logBookingHistory(wo.bookingId, booking.status, by, `Repair completed on ${wo.ref} — damage charge of R${patch.finalCost} held for your review`);
        }
      }
    }
  }
  if (parts && parts.length) patch.parts = parts;
  if (to === 'SignedOff') {
    patch.closedAt = Date.now();
    if (wo.vehicleId) {
      const mileage = wo.mileageAtCompletion || null;
      await updateDoc(doc(db, vehiclesCol, wo.vehicleId), {
        status: 'Available',
        nextServiceDate: addDaysISO(todayISO(), 180),
        lastServiceDate: todayISO(),
        ...(mileage ? { mileage: Number(mileage) } : {}),
      }).catch(() => {});
    }
  }
  const history = [...(wo.history || []), { at: Date.now(), from: wo.status, to, by, note: note || workOrderStatusNote(to) }];
  await updateDoc(doc(db, workOrdersCol, id), { ...patch, history });
  return { ok: true };
};

const workOrderStatusNote = (to) =>
  to === 'SignedOff' ? 'Signed off — unit returned to service' : to === 'Completed' ? 'Repair/maintenance completed' : `Status updated to ${to}`;