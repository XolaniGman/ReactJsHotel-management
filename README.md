# Grand Hotel

Full-stack hotel management app built with React + Vite on Firebase (Auth + Firestore). Covers the complete end-to-end journey: guest booking, self-service check-in, housekeeping, maintenance, laundry, storekeeping, lost & found, events, and admin oversight.

## Stack

- React 19 + Vite 8 + react-router-dom 7
- Bootstrap 5.3.2 CSS + Bootstrap Icons (CDN, see `index.html`)
- Firebase Auth + Cloud Firestore

## Getting started

1. **Install**
   ```bash
   npm install
   npm run dev
   ```
   App runs at http://localhost:5173.

2. **Firebase setup**
   - Create a Firebase project.
   - Enable **Authentication** (Email/Password) and **Firestore**.
   - Copy your web-app config into `src/lib/firebase.js`.
   - Publish `firestore.rules` (see below).

3. **Admin account**
   Only **admin@hotel.com** is granted the `admin` role and can access the Admin dashboard. All other registered accounts are guests. Create staff accounts (`housekeeping`, `laundry`, `storekeeper`, `maintenance`) directly in the Firebase console under *Authentication → Users → Add user*, and assign their roles in the `users/{uid}` document (or they are auto-assigned by demo email).

4. **Seed data**
   From the admin dashboard use **Seed Demo Data** (or create rooms/products/events via the admin CRUD pages). Rooms can carry a base64 image uploaded in the room form.

## Security rules

Deploy `firestore.rules` to your project so only authenticated users can read/write, admins/staff can manage operational data, and the public check-in kiosk can verify bookings:

```bash
firebase deploy --only firestore:rules
```

## Accounts

| Role         | Home                             |
| ------------ | -------------------------------- |
| admin        | `/Admin/Dashboard`               |
| housekeeping | `/Housekeeping/Dashboard`        |
| laundry      | `/Laundry/Dashboard`             |
| storekeeper  | `/Storekeeper/Dashboard`         |
| maintenance  | `/Maintenance/Dashboard`         |
| guest        | `/Guest/Dashboard`               |

## Key flows

- **UC-101/102** Register + email verification → confirm reservation email + invoice.
- **UC-104** 7-step booking wizard (dates → room → add-ons → details → price → review) with VAT (15%) and tourism levy (1%).
- **UC-105** Admin approves/declines reservations.
- **UC-106/107** Reschedule (R250 fee + audit trail) and cancel (refund + audit trail).
- **UC-108/109** Self check-in (4 stages, booking-ref + ID) and lobby kiosk check-in.
- **UC-110/111** Checkout + bill payment (Cash/Card/EFT/Stripe); event bookings and amenity requests billed to the room.
- **UC-201…207** Cleaning requests, housekeeper kanban, stock-in, issue-to-room, laundry flow, lost & found with matching.

## Layout

- `src/lib/` – Firebase config, constants, utils.
- `src/services/` – Firestore data layer (one module per domain).
- `src/context/AuthContext.jsx` – Firebase auth provider.
- `src/pages/` – One component per screen.
- `src/components/LuxLayout.jsx` – Role-based navigation shell.
