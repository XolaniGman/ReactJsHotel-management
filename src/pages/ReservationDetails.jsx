import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getReservation,
  rescheduleReservation,
  cancelReservation,
  listReservationAudits,
} from '../services/reservationService';
import { getBillByReservation } from '../services/billService';
import { checkout } from '../services/checkinService';
import { formatPrice, formatGuestDate, formatDateTime, nightsBetween, addDaysISO, todayISO } from '../lib/utils';

export default function ReservationDetails() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const [res, setRes] = useState(null);
  const [bill, setBill] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showReschedule, setShowReschedule] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState('');
  const [newCheckOut, setNewCheckOut] = useState('');

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refund, setRefund] = useState(0);

  const load = async () => {
    const data = await getReservation(id);
    setRes(data);
    if (data) {
      setBill(await getBillByReservation(data.id));
      setAudits(await listReservationAudits(data.id));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <p className="text-center text-muted py-5">Loading…</p>;
  if (!res) return <div className="res-shell"><div className="res-empty">Reservation not found.</div></div>;

  const ribbonClass =
    res.status === 'Pending' ? 'pending'
    : res.status === 'Approved' ? 'upcoming'
    : res.status === 'CheckedIn' ? 'checkedin'
    : res.status === 'CheckedOut' ? 'checkedout'
    : res.status === 'Declined' ? 'declined'
    : 'cancelled';

  const doReschedule = async () => {
    setError('');
    const nights = nightsBetween(newCheckIn, newCheckOut);
    if (!newCheckIn || !newCheckOut || nights <= 0) return setError('Please select valid new dates.');
    await rescheduleReservation(id, { checkInDate: newCheckIn, checkOutDate: newCheckOut, nights, byName: user?.name });
    setShowReschedule(false);
    setSuccess('Reservation rescheduled. A R250 reschedule fee was added to your bill.');
    load();
  };

  const doCancel = async () => {
    setError('');
    await cancelReservation(id, {
      byName: user?.name,
      byRole: user?.role,
      reason: cancelReason || 'Cancelled by guest',
      refund: Number(refund) || 0,
    });
    setShowCancel(false);
    setSuccess('Reservation cancelled.');
    load();
  };

  const doCheckout = async () => {
    if (!window.confirm('Check out now? Your room will be marked for cleaning and your bill finalized.')) return;
    await checkout(id, { byName: user?.name });
    await refresh();
    setSuccess('You have checked out. Thank you for staying with us!');
    load();
  };

  return (
    <div className="res-shell">
      <div className="res-header">
        <div className="res-kicker">Reservation</div>
        <h1 className="res-title">{res.roomType} Suite</h1>
        <p className="res-subtitle">
          Reference <strong>{res.bookingRef}</strong> · booked {formatDateTime(res.createdAt)}.
        </p>
      </div>

      {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}
      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      <div className="res-detail-card">
        <div className="res-image">
          <span className={`res-ribbon ${ribbonClass}`}>{res.status}</span>
        </div>
        <div className="res-content">
          <div className="res-room-header">
            <div>
              <h2 className="res-room-title">Room {res.roomNumber}</h2>
              <div className="res-room-location">{res.roomType} · {res.category}{res.company ? ` · ${res.company}` : ''}</div>
            </div>
            <div className="res-confirmation">
              <small>Booking Reference</small>
              {res.bookingRef}
            </div>
          </div>

          <div className="res-date-grid">
            <div className="res-date-box">
              <span className="res-label">Check-in</span>
              <span className="res-value">{formatGuestDate(res.checkInDate)}</span>
            </div>
            <div className="res-date-box">
              <span className="res-label">Check-out</span>
              <span className="res-value">{formatGuestDate(res.checkOutDate)}</span>
            </div>
          </div>

          <div className="res-tags">
            <span className="res-tag">{res.nights} night(s)</span>
            {res.wasRescheduled && <span className="res-tag">Rescheduled ×{res.rescheduleCount}</span>}
            {res.addOns?.length > 0 && <span className="res-tag">{res.addOns.length} add-on(s)</span>}
          </div>

          <div className="res-actions">
            {res.status === 'Approved' && (
              <>
                <button type="button" className="res-btn res-btn-outline" onClick={() => setShowReschedule(true)}>
                  <i className="bi bi-calendar-range me-2" /> Reschedule
                </button>
                <button type="button" className="res-btn res-btn-danger" onClick={() => setShowCancel(true)}>
                  <i className="bi bi-x-circle me-2" /> Cancel
                </button>
              </>
            )}
            {res.status === 'Pending' && (
              <button type="button" className="res-btn res-btn-danger" onClick={() => setShowCancel(true)}>
                <i className="bi bi-x-circle me-2" /> Cancel
              </button>
            )}
            {(res.status === 'Approved') && (
              <Link to={`/CheckIns/SelfCheckInWizard?reservation=${id}`} className="res-btn res-btn-success">
                <i className="bi bi-door-open me-2" /> Check In Now
              </Link>
            )}
            {res.status === 'CheckedIn' && (
              <button type="button" className="res-btn res-btn-success" onClick={doCheckout}>
                <i className="bi bi-box-arrow-right me-2" /> Check Out
              </button>
            )}
            {bill && (
              <Link to={`/Payments/Bill/${bill.id}`} className="res-btn res-btn-primary">
                <i className="bi bi-receipt me-2" /> View Bill
              </Link>
            )}
            <Link to="/Guest/Dashboard" className="res-btn res-btn-outline">
              <i className="bi bi-arrow-left me-2" /> Back
            </Link>
          </div>
        </div>
      </div>

      <div className="res-detail-grid">
        <div className="res-tile"><span className="res-label">Subtotal</span><div className="res-value">{formatPrice(res.subtotal)}</div></div>
        <div className="res-tile"><span className="res-label">VAT (15%)</span><div className="res-value">{formatPrice(res.vat)}</div></div>
        <div className="res-tile"><span className="res-label">Levy (1%)</span><div className="res-value">{formatPrice(res.levy)}</div></div>
        <div className="res-tile"><span className="res-label">Total</span><div className="res-value">{formatPrice(res.total)}</div></div>
      </div>

      {audits.length > 0 && (
        <div className="res-recent">
          <h2 className="res-recent-title">Activity</h2>
          <div className="dash-panel">
            {audits.map((a) => (
              <div key={a.id} className="dash-row dash-row--simple">
                <div>
                  <div className="dash-row-title">{a.action}</div>
                  <div className="dash-row-meta">
                    {a.from && `${a.from}`}{a.to && ` → ${a.to}`}
                    {a.fee ? ` · Fee ${formatPrice(a.fee)}` : ''}
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>
                <span className="text-muted small">{a.byName} · {formatDateTime(a.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReschedule && (
        <div className="lost-form-card" style={{ marginTop: '1.5rem' }}>
          <h3 className="clean-card-title">Reschedule reservation</h3>
          <p className="text-muted small">
            A one-time <strong>R250 reschedule fee</strong> will be added to your bill.
          </p>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="lost-label" htmlFor="NewCheckIn">New check-in</label>
              <input id="NewCheckIn" type="date" className="form-control lost-input" min={todayISO()} value={newCheckIn} onChange={(e) => { setNewCheckIn(e.target.value); setNewCheckOut(addDaysISO(e.target.value, 1)); }} />
            </div>
            <div className="col-md-6">
              <label className="lost-label" htmlFor="NewCheckOut">New check-out</label>
              <input id="NewCheckOut" type="date" className="form-control lost-input" min={newCheckIn || todayISO()} value={newCheckOut} onChange={(e) => setNewCheckOut(e.target.value)} />
            </div>
          </div>
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="lost-btn lost-btn-primary" onClick={doReschedule}>Confirm reschedule</button>
            <button type="button" className="lost-btn lost-btn-outline" onClick={() => setShowReschedule(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="lost-form-card" style={{ marginTop: '1.5rem' }}>
          <h3 className="clean-card-title">Cancel reservation</h3>
          <div className="mb-3">
            <label className="lost-label" htmlFor="CancelReason">Reason</label>
            <input id="CancelReason" className="form-control lost-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional" />
          </div>
          <div className="mb-3">
            <label className="lost-label" htmlFor="Refund">Refund amount (ZAR)</label>
            <input id="Refund" type="number" min="0" className="form-control lost-input" value={refund} onChange={(e) => setRefund(Number(e.target.value) || 0)} />
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="lost-btn" style={{ background: '#a33a2d', borderColor: '#a33a2d', color: '#fff' }} onClick={doCancel}>Confirm cancellation</button>
            <button type="button" className="lost-btn lost-btn-outline" onClick={() => setShowCancel(false)}>Keep reservation</button>
          </div>
        </div>
      )}
    </div>
  );
}
