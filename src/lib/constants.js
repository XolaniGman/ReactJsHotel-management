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
export const VEHICLE_STATUSES = ['Available', 'Reserved', 'InMaintenance', 'OutOfService'];

export const CAR_BOOKING_STATUSES = [
  'PendingConfirmation',
  'Confirmed',
  'CheckedOut',
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

export const CAR_RENTAL_ADDONS = [
  { name: 'Child Seat', price: 100 },
  { name: 'GPS Navigation', price: 80 },
  { name: 'Extra Driver', price: 150 },
  { name: 'Wi-Fi Hotspot', price: 120 },
  { name: 'Collision Waiver', price: 200 },
];

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
