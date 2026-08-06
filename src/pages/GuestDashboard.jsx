import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listUserReservations } from '../services/reservationService';
import { listBillsForGuest } from '../services/billService';
import { listGuestCleaningRequests } from '../services/housekeepingService';
import { listMyLostReports } from '../services/lostFoundService';
import { formatPrice, formatDateRange, formatDateTime, statusTone } from '../lib/utils';
import './guest.css';

const STATUS_LABEL = {
  Pending: 'warn', Approved: 'info', CheckedIn: 'success', CheckedOut: 'muted', Cancelled: 'muted', Declined: 'danger',
};

export default function GuestDashboard() {
  const { user, sendVerificationEmail } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [bills, setBills] = useState([]);
  const [cleaning, setCleaning] = useState([]);
  const [lost, setLost] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);

  const load = async () => {
    const [r, b, c, l] = await Promise.all([
      listUserReservations(user.uid),
      listBillsForGuest(user.uid),
      listGuestCleaningRequests(user.uid),
      listMyLostReports(user.uid),
    ]);
    setReservations(r);
    setBills(b);
    setCleaning(c);
    setLost(l);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.uid) load();
  }, [user?.uid]);

  const resend = async () => {
    const result = await sendVerificationEmail();
    if (result?.ok) setSent(true);
  };

  const totalBalance = bills.reduce((s, b) => s + (b.balanceDue || 0), 0);

  return (
    <div className="dash-shell">
      {user && !user.emailVerified && user.role === 'guest' && (
        <div className="dash-notice">
          <strong>Verify your email</strong> to unlock the full experience.
          {!sent ? (
            <button type="button" className="btn btn-sm btn-link p-0 ms-2" onClick={resend}>Resend verification email</button>
          ) : (
            <span className="ms-2 text-success"><i className="bi bi-check-circle me-1" />Verification email sent.</span>
          )}
        </div>
      )}

      <div className="dash-hero">
        <div>
          <div className="dash-hero-kicker">Guest Dashboard</div>
          <h1 className="dash-hero-title">Welcome, {user?.name}</h1>
          <p className="dash-hero-copy">
            Manage your stays, request services, and keep track of your bills — all in one place.
          </p>
          <div className="d-flex gap-2 flex-wrap">
            <Link to="/Reservations/Create" className="dash-check-btn">
              <i className="bi bi-calendar-plus" /> Book a stay
            </Link>
            <Link to="/Housekeeping/RequestRoomCleaning" className="dash-check-btn" style={{ background: '#9a7a38' }}>
              <i className="bi bi-stars" /> Request cleaning
            </Link>
          </div>
        </div>
      </div>

      <div className="dash-feature-grid">
        <Link to="/Reservations/Create" className="dash-feature-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80)' }}>
          <div className="dash-feature-content"><h3>Book a Stay</h3><p>Plan your next visit</p></div>
        </Link>
        <Link to="/Events" className="dash-feature-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80)' }}>
          <div className="dash-feature-content"><h3>Experiences</h3><p>Dinner, spa &amp; more</p></div>
        </Link>
        <Link to="/LostItems/Services" className="dash-feature-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1601924638867-3ec6e54a7af3?auto=format&fit=crop&w=900&q=80)' }}>
          <div className="dash-feature-content"><h3>Lost Item</h3><p>Report or track</p></div>
        </Link>
        <Link to="/Maintenance/Create" className="dash-feature-card" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&q=80)' }}>
          <div className="dash-feature-content"><h3>Maintenance</h3><p>Report an issue</p></div>
        </Link>
      </div>

      <div className="dash-grid">
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2>My reservations</h2>
            <Link className="dash-panel-link" to="/Reservations/Create">+ New booking</Link>
          </div>
          {loading ? (
            <div className="dash-empty">Loading…</div>
          ) : reservations.length === 0 ? (
            <div className="dash-empty">
              <i className="bi bi-calendar-x" /> No reservations yet.
            </div>
          ) : (
            reservations.slice(0, 5).map((r) => (
              <div className="dash-row" key={r.id}>
                <div className="dash-row-thumb" style={{ background: 'linear-gradient(135deg,#775a19,#9a7a38)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem' }}>
                  <i className="bi bi-door-open" />
                </div>
                <div>
                  <div className="dash-row-title">Room {r.roomNumber} · {r.roomType}</div>
                  <div className="dash-row-meta">
                    <span>{formatDateRange(r.checkInDate, r.checkOutDate)}</span>
                    <span>{r.bookingRef}</span>
                  </div>
                </div>
                <span className={`dash-status-pill ${STATUS_LABEL[r.status] || 'info'}`}>{r.status}</span>
                <Link className="dash-icon-btn" to={`/Reservations/Details/${r.id}`} title="Open"><i className="bi bi-arrow-right-circle" /></Link>
              </div>
            ))
          )}
        </div>

        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2>Quick actions</h2>
          </div>
          <div className="dash-quick-list">
            <Link className="dash-quick-item" to="/Amenities/Request"><i className="bi bi-star" /> Request amenities</Link>
            <Link className="dash-quick-item" to="/Housekeeping/RequestRoomCleaning"><i className="bi bi-broom" /> Request cleaning</Link>
            <Link className="dash-quick-item" to="/Maintenance/Create"><i className="bi bi-tools" /> Report maintenance</Link>
            <Link className="dash-quick-item" to="/LostItems/Services"><i className="bi bi-search" /> Report lost item</Link>
            <Link className="dash-quick-item" to="/Events"><i className="bi bi-calendar-event" /> Book an event</Link>
          </div>
        </div>
      </div>

      <div className="dash-section dash-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2>Bills</h2>
            <Link className="dash-panel-link" to={`/Payments/Bill/${bills[0]?.id || ''}`}>Open latest</Link>
          </div>
          {bills.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-receipt" /> No bills yet.</div>
          ) : (
            bills.slice(0, 4).map((b) => (
              <div className="dash-row dash-row--simple" key={b.id}>
                <div>
                  <div className="dash-row-title">Bill · Room {b.roomNumber}</div>
                  <div className="dash-row-meta">
                    <span>Balance due {formatPrice(b.balanceDue)}</span>
                    <span>{b.status}</span>
                  </div>
                </div>
                <Link className="dash-icon-btn" to={`/Payments/Bill/${b.id}`}><i className="bi bi-receipt" /></Link>
              </div>
            ))
          )}
          {totalBalance > 0 && (
            <div className="dash-notice dash-notice--info" style={{ margin: '1rem', marginBottom: 0 }}>
              Total outstanding balance: <strong>{formatPrice(totalBalance)}</strong>
            </div>
          )}
        </div>

        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2>Requests</h2>
          </div>
          {cleaning.length === 0 && lost.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-inbox" /> No active requests.</div>
          ) : (
            <>
              {cleaning.map((c) => (
                <div className="dash-row dash-row--simple" key={c.id}>
                  <div>
                    <div className="dash-row-title">Cleaning request</div>
                    <div className="dash-row-meta"><span>{c.services.join(', ')}</span></div>
                  </div>
                  <span className={`dash-status-pill ${statusTone(c.status)}`}>{c.status}</span>
                </div>
              ))}
              {lost.map((l) => (
                <div className="dash-row dash-row--simple" key={l.id}>
                  <div>
                    <div className="dash-row-title">Lost item: {l.item}</div>
                    <div className="dash-row-meta"><span>{l.category} · {formatDateTime(l.createdAt)}</span></div>
                  </div>
                  <span className={`dash-status-pill ${l.status === 'Found' ? 'success' : 'warn'}`}>{l.status}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
