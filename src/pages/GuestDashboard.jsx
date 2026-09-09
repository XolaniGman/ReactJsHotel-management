import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listUserReservations } from '../services/reservationService';
import { listBillsForGuest } from '../services/billService';
import { listTableReservations, updateTableReservationStatus } from '../services/restaurantService';
import { subscribeCarBookings, collectionStepLabel, bookingDisplay } from '../services/fleetService';
import { formatPrice, formatGuestDate, todayISO, nightsBetween } from '../lib/utils';
import './palm.css';

const STAY_STATUS = {
  Pending: 'warn', Approved: 'info', CheckedIn: 'success', CheckedOut: 'muted', Cancelled: 'muted', Declined: 'danger',
};

const DINING_STATUS = {
  Reserved: 'info', CheckedIn: 'success', Completed: 'success', Cancelled: 'muted', NoShow: 'danger',
};

const TODAY_AT_THE_PALM = [
  { icon: 'bi-moon-stars', title: 'Sunset Luau on Ocean Terrace', meta: 'Complimentary sparkling wine for suite guests · from 6:00 PM' },
  { icon: 'bi-sun', title: 'Morning Reef Snorkel & Yoga', meta: '07:00 AM · West Beach Pavilion' },
];

const QUICK_ACTIONS = [
  { to: '/Amenities/Request', icon: 'bi-flower2', label: 'Book Spa', sub: 'Serenity Spa & Massage' },
  { to: '/Fleet/Vehicles', icon: 'bi-car-front', label: 'Rent a Car', sub: 'Browse our fleet' },
  { to: '/Fleet/Service', icon: 'bi-airplane', label: 'Airport Shuttle', sub: 'Private transfer' },
  { to: '/Housekeeping/RequestRoomCleaning', icon: 'bi-box-seam', label: 'Room Supplies', sub: 'Request essentials' },
  { to: '/Maintenance/Request', icon: 'bi-tools', label: 'Maintenance', sub: 'Report an issue' },
  { to: '/LostItems/Services', icon: 'bi-search', label: 'Lost & Found', sub: 'Item recovery' },
];

export default function GuestDashboard() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [bills, setBills] = useState([]);
  const [dining, setDining] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [checkingIn, setCheckingIn] = useState('');

  const load = async () => {
    const [r, b, tr] = await Promise.all([
      listUserReservations(user.uid),
      listBillsForGuest(user.uid),
      listTableReservations(),
    ]);
    setReservations(r);
    setBills(b);
    setDining(
      tr
        .filter((x) => x.guestUid === user.uid)
        .sort((a, c) => `${a.date} ${a.time}`.localeCompare(`${c.date} ${c.time}`)),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (user?.uid) load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeCarBookings((all) => setCars(all.filter((b) => b.guestUid === user.uid)));
  }, [user?.uid]);

  const activeRes = reservations.find((r) => r.status === 'CheckedIn') || reservations.find((r) => r.status === 'Approved');
  const latestBill = activeRes
    ? bills.find((b) => b.reservationId === activeRes.id) || bills[0]
    : bills[0];
  const folioLines = (latestBill?.lineItems || []).filter((l) => l.type !== 'VAT' && l.type !== 'Levy').slice(0, 4);

  const canCheckIn = (r) => {
    if (r.status !== 'Reserved' || r.date !== todayISO()) return false;
    const [hh, mm] = String(r.time || '00:00').split(':').map(Number);
    const slot = new Date();
    slot.setHours(hh, mm, 0, 0);
    return Date.now() >= slot.getTime() - 15 * 60000;
  };

  const carDue = (b) => {
    if (b.status === 'PendingConfirmation') return { tone: 'warn', label: 'Awaiting confirmation' };
    if (b.status === 'Confirmed') {
      const started = b.guestArrived || (b.collectionProgress?.step && b.collectionProgress.step !== 'prep');
      return started ? { tone: 'info', label: `Collection in progress · ${collectionStepLabel(b.collectionProgress?.step)}` } : { tone: 'info', label: `Ready for pick-up · ${b.pickupDate} ${b.pickupTime || ''}` };
    }
    if (b.status === 'CheckedOut') {
      return b.guestAcknowledgedAt || b.guestSignature
        ? { tone: 'success', label: 'Keys handed over' }
        : { tone: 'warn', label: 'Please review & sign your condition report' };
    }
    return { tone: 'muted', label: bookingDisplay(b.status) };
  };

  const carCta = (b) => {
    if (b.status === 'Confirmed') {
      const started = b.guestArrived || (b.collectionProgress?.step && b.collectionProgress.step !== 'prep');
      return { to: `/Fleet/Collection/${b.id}`, icon: 'bi-box-arrow-right', label: started ? 'Continue' : 'Start pickup' };
    }
    if (b.status === 'CheckedOut' && !b.guestAcknowledgedAt && !b.guestSignature) {
      return { to: `/Fleet/Collection/${b.id}`, icon: 'bi-pen', label: 'Review & sign' };
    }
    if (b.status === 'CheckedOut') {
      return { to: '/Fleet/MyTrips', icon: 'bi-geo-alt', label: 'Track' };
    }
    return null;
  };

  const carRows = cars
    .filter((b) => ['PendingConfirmation', 'Confirmed', 'CheckedOut'].includes(b.status))
    .sort((a, b) => (a.pickupDate || '').localeCompare(b.pickupDate || ''))
    .slice(0, 3);

  const checkIn = async (id) => {
    setCheckingIn(id);
    setNotice('');
    try {
      await updateTableReservationStatus(id, 'CheckedIn');
      setNotice('Checked in — the host has been notified. Enjoy your meal.');
      await load();
    } catch (err) {
      setNotice(`Could not check in: ${err.message}`);
    }
    setCheckingIn('');
  };

  if (loading) {
    return <div className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading your stay…</div>;
  }

  return (
    <div>
      <div
        className="palm-hero"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1600&q=80')" }}
      >
        <div className="palm-hero-badges">
          {activeRes?.status === 'CheckedIn' && <span className="palm-hero-pill status">Currently In-House</span>}
          {activeRes && <span className="palm-hero-pill">{formatGuestDate(activeRes.checkInDate)} – {formatGuestDate(activeRes.checkOutDate)}</span>}
        </div>
        <div className="palm-hero-body">
          <div className="palm-hero-kicker">Guest Portal</div>
          <h1 className="palm-hero-title">Welcome back, {user?.name}</h1>
          <p className="palm-hero-copy">
            {activeRes
              ? `Your private sanctuary at Room ${activeRes.roomNumber} (${activeRes.roomType}). Everything you need during your stay is thoughtfully arranged below.`
              : 'Everything you need for your next stay is thoughtfully arranged below.'}
          </p>
          <div className="palm-hero-actions">
            <button type="button" className="palm-btn palm-btn-light" disabled title="Digital key coming soon">
              <i className="bi bi-key" />Open Digital Key
            </button>
            <Link to="/Restaurant" className="palm-btn palm-btn-primary">
              <i className="bi bi-egg-fried" />Order In-Room Dining
            </Link>
            <Link to="/Fleet/MyTrips" className="palm-btn palm-btn-light">
              <i className="bi bi-car-front" />View Rental Details
            </Link>
            <Link to="/Amenities/Request" className="palm-hero-link">Request Amenities →</Link>
          </div>
        </div>
      </div>

      {notice && <div className="palm-card"><div className="palm-card-body pt-3"><i className="bi bi-check-circle me-2 text-success" />{notice}</div></div>}

      <div className="palm-grid">
        <div>
          {activeRes ? (
            <div className="palm-card">
              <div className="palm-card-header">
                <span className="palm-card-title">Room {activeRes.roomNumber} · {activeRes.roomType}</span>
                <span className={`palm-status-chip ${STAY_STATUS[activeRes.status] || 'info'}`}>{activeRes.status}</span>
              </div>
              <div className="palm-card-body">
                <div className="palm-card-sub">Reservation {activeRes.bookingRef}</div>
                <div className="palm-stay-meta-grid">
                  <div className="palm-stay-meta-item">
                    <div className="label">Check-in</div>
                    <div className="value">{formatGuestDate(activeRes.checkInDate)}</div>
                  </div>
                  <div className="palm-stay-meta-item">
                    <div className="label">Check-out</div>
                    <div className="value">{formatGuestDate(activeRes.checkOutDate)}</div>
                  </div>
                  <div className="palm-stay-meta-item">
                    <div className="label">Nights</div>
                    <div className="value">{nightsBetween(activeRes.checkInDate, activeRes.checkOutDate)}</div>
                  </div>
                  <div className="palm-stay-meta-item">
                    <div className="label">Current Folio</div>
                    <div className="value">{latestBill ? formatPrice(latestBill.balanceDue) : '—'}</div>
                  </div>
                </div>
                <div className="palm-stay-actions">
                  <Link to="/Housekeeping/RequestRoomCleaning" className="palm-btn palm-btn-outline">
                    <i className="bi bi-stars" />Request Room Cleaning
                  </Link>
                  <Link to="/Amenities/Request" className="palm-btn palm-btn-outline">
                    <i className="bi bi-star" />Suite Amenities
                  </Link>
                </div>
                <Link to={`/Reservations/Details/${activeRes.id}`} className="palm-card-link">View Full Stay Details →</Link>
              </div>
            </div>
          ) : (
            <div className="palm-card">
              <div className="palm-card-body pt-4 text-center">
                <p className="text-muted mb-3">You don&apos;t have an active or upcoming stay yet.</p>
                <Link to="/Reservations/Create" className="palm-btn palm-btn-primary"><i className="bi bi-calendar-plus" />Book a Stay</Link>
              </div>
            </div>
          )}

          <div className="palm-card">
            <div className="palm-card-header">
              <span className="palm-card-title">Restaurant &amp; Table Reservations</span>
              <Link to="/Restaurant/Reserve" className="palm-btn palm-btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem' }}>
                <i className="bi bi-plus-lg" />Reserve a Table
              </Link>
            </div>
            <div className="palm-card-body">
              {dining.length === 0 ? (
                <div className="text-muted small py-3"><i className="bi bi-calendar-x me-2" />No table reservations yet.</div>
              ) : (
                dining.slice(0, 5).map((r) => {
                  const isToday = r.date === todayISO();
                  const ready = canCheckIn(r);
                  return (
                    <div className="palm-dining-row" key={r.id}>
                      <span className="palm-dining-thumb"><i className="bi bi-egg-fried" /></span>
                      <div className="flex-grow-1">
                        <div className="palm-dining-title">
                          Table {r.tableNumber}
                          <span className={`palm-status-chip ${DINING_STATUS[r.status] || 'info'}`}>{r.status}</span>
                        </div>
                        <div className="palm-dining-meta">
                          {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'} · {r.preference || 'No preference'} · Ref {r.ref}
                        </div>
                        <div className="palm-dining-meta">{formatGuestDate(r.date)} · {r.time}</div>
                      </div>
                      <div className="palm-dining-actions">
                        {ready ? (
                          <button type="button" className="palm-btn palm-btn-green" disabled={checkingIn === r.id} onClick={() => checkIn(r.id)}>
                            <i className="bi bi-person-check" />{checkingIn === r.id ? 'Checking in…' : 'Check In'}
                          </button>
                        ) : r.status === 'CheckedIn' ? (
                          <Link to={`/Restaurant?table=${r.tableNumber}`} className="palm-btn palm-btn-green">
                            <i className="bi bi-egg-fried" />Order at Table
                          </Link>
                        ) : r.status === 'Reserved' && isToday ? (
                          <span className="palm-card-sub" style={{ whiteSpace: 'nowrap' }}>Opens at {r.time}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
              <Link to="/Restaurant/Reserve" className="palm-card-link">View all dining reservations for your stay →</Link>
            </div>
          </div>
        </div>

        <div>
          <div className="palm-card">
            <div className="palm-card-header">
              <span className="palm-card-title">Vehicle Collection</span>
              {carRows.length > 0 && (
                <Link to="/Fleet/Collection" className="palm-btn palm-btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem' }}>
                  <i className="bi bi-box-arrow-right" />Fetch the Car
                </Link>
              )}
            </div>
            <div className="palm-card-body">
              {carRows.length === 0 ? (
                <div className="text-muted small py-3">
                  <i className="bi bi-car-front me-2" />No active car pick-ups yet.
                  <div className="mt-3"><Link to="/Fleet/Vehicles" className="palm-btn palm-btn-outline"><i className="bi bi-car-front" />Rent a Vehicle</Link></div>
                </div>
              ) : (
                carRows.map((b) => {
                  const d = carDue(b);
                  const c = carCta(b);
                  return (
                    <div className="palm-dining-row" key={b.id}>
                      <span className="palm-dining-thumb"><i className="bi bi-car-front" /></span>
                      <div className="flex-grow-1">
                        <div className="palm-dining-title">
                          {b.vehicleName}{b.unitNumber ? ` · ${b.unitNumber}` : ''}
                          <span className={`palm-status-chip ${d.tone}`}>{d.label}</span>
                        </div>
                        <div className="palm-dining-meta">Pick-up {formatGuestDate(b.pickupDate)} {b.pickupTime} · Ref {b.ref}</div>
                      </div>
                      {c && (
                        <div className="palm-dining-actions">
                          <Link to={c.to} className="palm-btn palm-btn-green">
                            <i className={`bi ${c.icon}`} />{c.label}
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {carRows.length > 0 && <Link to="/Fleet/Collection" className="palm-card-link">View all vehicle pick-ups for your stay →</Link>}
            </div>
          </div>

          <div className="palm-card">
            <div className="palm-card-header"><span className="palm-card-title">Guest Quick Actions</span></div>
            <div className="palm-card-body">
              <div className="palm-quick-grid">
                {QUICK_ACTIONS.map((a) => (
                  <Link className="palm-quick-item" key={a.to} to={a.to}>
                    <span className="palm-quick-icon"><i className={`bi ${a.icon}`} /></span>
                    <span>
                      <span className="palm-quick-label d-block">{a.label}</span>
                      <span className="palm-quick-sub">{a.sub}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="palm-card">
            <div className="palm-card-header">
              <span className="palm-card-title">Today at The Palm</span>
              <span className="palm-weather-chip"><i className="bi bi-brightness-high" />32°C</span>
            </div>
            <div className="palm-card-body">
              {TODAY_AT_THE_PALM.map((item) => (
                <div className="palm-today-item" key={item.title}>
                  <span className="palm-today-icon"><i className={`bi ${item.icon}`} /></span>
                  <div>
                    <div className="palm-today-title">{item.title}</div>
                    <div className="palm-today-meta">{item.meta}</div>
                  </div>
                </div>
              ))}
              <Link to="/Events" className="palm-btn palm-btn-primary w-100 justify-content-center mt-3">
                <i className="bi bi-calendar-event" />Explore Today&apos;s Event Calendar
              </Link>
            </div>
          </div>

          <div className="palm-card">
            <div className="palm-card-header"><span className="palm-card-title">Room Folio Balance</span></div>
            <div className="palm-card-body">
              {latestBill ? (
                <>
                  <div className="palm-folio-total">{formatPrice(latestBill.balanceDue)}</div>
                  <div className="palm-folio-sub">Estimated when you check out · Room {latestBill.roomNumber}</div>
                  {folioLines.map((l, i) => (
                    <div className="palm-folio-line" key={i}>
                      <span>{l.description}</span>
                      <span>{formatPrice(l.amount)}</span>
                    </div>
                  ))}
                  <div className="palm-folio-actions">
                    <Link to={`/Payments/Bill/${latestBill.id}`} className="palm-btn palm-btn-outline"><i className="bi bi-receipt" />View Bill</Link>
                    <Link to={`/Payments/Bill/${latestBill.id}`} className="palm-btn palm-btn-primary"><i className="bi bi-credit-card" />Express Pay &amp; Tip</Link>
                  </div>
                </>
              ) : (
                <div className="text-muted small py-2"><i className="bi bi-receipt me-2" />No open folio yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
