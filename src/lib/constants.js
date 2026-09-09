export const ROOM_TYPES = ['Single', 'Double', 'Twin', 'Suite', 'Deluxe'];
export const ROOM_STATUSES = ['Available', 'Occupied', 'Reserved', 'Dirty', 'Maintenance'];

export const RESERVATION_STATUSES = ['Pending', 'Approved', 'Declined', 'Cancelled', 'CheckedIn', 'CheckedOut'];

export const BOOKING_CATEGORIES = ['Individual', 'Group', 'Corporate'];

export const VAT_RATE = 0.15;
export const LEVY_RATE = 0.01;
export const RESCHEDULE_FEE = 250;

export const PAYMENT_METHODS = ['Cash', 'Card', 'EFT', 'Stripe'];

export const amenityIcons = {
  'wi-fi': 'bi-wifi',
  'sea-view': 'bi-water',
  balcony: 'bi-sun',
  'air-conditioning': 'bi-snow',
  minibar: 'bi-cup-straw',
  breakfast: 'bi-cup-hot',
  'room-service': 'bi-bell',
};

export const amenityLabels = {
  'wi-fi': 'Wi-Fi',
  'sea-view': 'Sea View',
  balcony: 'Balcony',
  'air-conditioning': 'Climate',
  minibar: 'Minibar',
  breakfast: 'Breakfast',
  'room-service': 'Room Service',
};

export const HOUSEKEEPING_SERVICES = [
  { name: 'Standard Room Cleaning', icon: 'bi-stars' },
  { name: 'Fresh Towels', icon: 'bi-droplet' },
  { name: 'Change Bed Linen', icon: 'bi-house-heart' },
  { name: 'Bathroom Deep Clean', icon: 'bi-water' },
  { name: 'Trash Removal', icon: 'bi-trash' },
  { name: 'Mini Bar Refill', icon: 'bi-cup-straw' },
];

export const MAINTENANCE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'AirConditioning',
  'Heating',
  'Lighting',
  'Appliance',
  'Furniture',
  'Bathroom',
  'DoorLock',
  'Internet',
  'Other',
];

export const MAINTENANCE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const INSPECTION_TYPES = ['PreCheckIn', 'PostCheckout', 'Routine', 'MaintenanceFollowUp'];

export const INSPECTION_CONDITIONS = ['Good', 'NeedsCleaning', 'Damaged', 'Missing', 'NeedsMaintenance'];

export const INSPECTION_CHECKLIST = [
  'Overall Cleanliness',
  'Bedding Condition',
  'Bathroom Fixtures',
  'Furniture Condition',
  'Electrical Outlets',
  'Windows and Curtains',
  'Flooring',
  'Amenities Stock',
];

export const LOST_ITEM_CATEGORIES = ['Electronics', 'Baggage', 'Clothing', 'Jewellery', 'Documents', 'Keys', 'Other'];

export const LAUNDRY_ITEM_TYPES = ['Washing', 'Dry Cleaning', 'Ironing'];

export const PRODUCT_CATEGORIES = ['Consumable', 'Reusable', 'Amenity'];

export const MAINTENANCE_STATUSES = ['Open', 'InProgress', 'OnHold', 'Completed'];

export const STOCK_ACTIONS = ['StockIn', 'IssuedToRoom', 'ReturnedToStorage', 'Adjustment', 'Lost'];

export const VEHICLE_TYPES = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'Shuttle'];
export const VEHICLE_CATEGORIES = ['Compact', 'Sedan', 'SUV', 'Luxury', 'Shuttle'];
export const VEHICLE_TRANSMISSIONS = ['Automatic', 'Manual'];
export const VEHICLE_STATUSES = ['Available', 'Reserved', 'Rented', 'InMaintenance', 'OutOfService', 'PendingInspection'];

export const CAR_BOOKING_STATUSES = [
  'PendingConfirmation',
  'Confirmed',
  'CheckedOut',
  'PendingInspection',
  'CheckedIn',
  'Cancelled',
  'ModifyRequested',
];

export const CAR_SERVICE_STATUSES = [
  'PendingAssignment',
  'Assigned',
  'EnRoute',
  'Arrived',
  'Completed',
  'Cancelled',
];

export const CAR_SERVICE_TYPES = ['Airport Transfer', 'Local Trip', 'Point-to-Point'];

export const ADDITIONAL_DRIVER_FEE = 532;

// "Additional Driver" is charged via its own toggle (ADDITIONAL_DRIVER_FEE)
// rather than as a bundled add-on, so it isn't double-counted.
export const CAR_RENTAL_ADDONS = [
  { name: 'Child Seat', price: 100 },
  { name: 'GPS Navigation', price: 80 },
  { name: 'Wi-Fi Hotspot', price: 120 },
  { name: 'Collision Waiver', price: 200 },
];

// Hourly and leasing tiers are derived from a vehicle's daily rate unless a
// manager sets explicit pricePerHour / pricePerMonth overrides.
export const HOURLY_RATE_FACTOR = 0.18;
export const LEASE_MONTHLY_FACTOR = 22;
export const HOURLY_FUEL_SURCHARGE = 3;

export const DEPOSIT_AMOUNT = 500;
export const CANCELLATION_WINDOW_HOURS = 48;
export const CANCELLATION_FEE = 250;

export const HANDOVER_ITEMS = [
  'Exterior condition',
  'Interior condition',
  'Tyres / rims',
  'Windscreen & mirrors',
  'Lights & indicators',
  'Boot / storage area',
  'Spare wheel & tools',
  'Audio / climate controls',
];

// Shared liability options — the Incident Register and the return flow are two
// entry points into the one liability/charges model.
export const LIABILITIES = ['Guest fault', 'Normal wear & tear', 'Third party', 'Mechanical failure', 'Undetermined'];

// ---------------------------------------------------------------
// Avis-aligned fee tables & branch model (UC11–UC21)
// ---------------------------------------------------------------

export const FLEET_BRANCHES = [
  { id: 'main', name: 'Hotel Main Branch', code: 'HTL', locationSurcharge: 0, highRisk: false },
  { id: 'airport', name: 'Airport Desk', code: 'APT', locationSurcharge: 150, highRisk: true },
  { id: 'downtown', name: 'Downtown Kiosk', code: 'DTN', locationSurcharge: 90, highRisk: false },
];

// Lookup by (pickup branch, return branch) pair — not a flat one-way fee.
export const ONE_WAY_FEES = {
  'main-airport': 350,
  'airport-main': 350,
  'main-downtown': 200,
  'downtown-main': 200,
  'airport-downtown': 400,
  'downtown-airport': 400,
};

export const YOUNG_DRIVER_SURCHARGE_PER_DAY = 155;
export const YOUNG_DRIVER_SURCHARGE_CAP_DAYS = 10;
export const YOUNG_DRIVER_AGE_THRESHOLD = 25;

// Hard eligibility gate at check-out (distinct from the young-driver pricing
// surcharge above) — a driver below this age fails licence verification outright.
export const MIN_DRIVING_AGE = 18;

// Liability cap when the Collision Waiver add-on is selected; without it the
// guest's exposure is capped at the vehicle deposit instead.
export const WAIVER_LIABILITY_CAP = 2500;

export const HIGH_RISK_EXTRA_HOLD = 10000;

export const LATE_RETURN_DAILY_FEE = 150;
export const LATE_RETURN_GRACE_HOURS = 2;
export const REFUEL_SERVICE_FEE = 50;
export const FUEL_PRICE_PER_LITRE = 23;
export const TANK_LITRES_DEFAULT = 45;

export const ACCIDENT_ADMIN_FEE = 500;
export const ACCIDENT_ADMIN_FEE_LOW = 150;
export const ACCIDENT_ADMIN_FEE_LOW_THRESHOLD = 300;

// UC21 cancellation policy, branched by originating use case.
export const RENTAL_CANCELLATION_POLICY = {
  farWindowDays: 3,
  farWindowFee: 550,
};

export const SERVICE_NOTICE_HOURS = {
  'Airport Transfer': 24,
  'Point-to-Point': 12,
  'Local Trip': 4,
};

export const SERVICE_CANCELLATION_TIERS = {
  hours24: 0,
  underHours24: 0.5,
  underHour1: 1,
};

// "Hotel Manager" tier (UC20 cost-threshold sign-off, UC19 severe-incident
// dual notify) maps onto the existing hotel-wide admin/system roles.
export const HOTEL_MANAGER_ROLES = ['admin', 'system'];
