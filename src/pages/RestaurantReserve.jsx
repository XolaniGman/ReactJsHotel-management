import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listTables, reserveTable } from '../services/restaurantService';
import { todayISO } from '../lib/utils';
import './events.css';
import './restaurant.css';

const OPEN_TIME = '07:00';
const CLOSE_TIME = '21:30';
const STATUS_TONE = { Available: 'avail', Reserved: 'reserved', Occupied: 'occupied' };

const timeOptions = () => {
  const options = [];
  for (let h = 7; h < 22; h += 1) {
    options.push(`${String(h).padStart(2, '0')}:00`);
    options.push(`${String(h).padStart(2, '0')}:30`);
  }
  return options.filter((t) => t <= CLOSE_TIME);
};

export default function RestaurantReserve() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);

  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [preference, setPreference] = useState('No preference');
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestContact, setGuestContact] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    (async () => {
      setTables(await listTables());
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(() => [...tables].sort((a, b) => a.number - b.number), [tables]);
  const canPick = useMemo(() => (t) => t.status === 'Available' && t.capacity >= partySize, [partySize]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (date < todayISO()) return setError('Pick a date today or later.');
    if (!selected) return setError('Please choose a table.');
    if (!guestName.trim()) return setError('Please enter your name.');
    const result = await reserveTable({
      tableNumber: selected.number,
      date,
      time,
      partySize,
      preference,
      guestUid: user?.uid || '',
      guestName: guestName.trim(),
      guestContact: guestContact.trim(),
    });
    if (result?.error) return setError(result.error);
    setBooking({ ...result, table: selected.number, date, time, partySize, preference });
  };

  return (
    <div className="rest-shell">
      <div className="rest-hero">
        <div className="rest-hero-body">
          <div className="rest-kicker">Reservations</div>
          <h1 className="rest-title">Reserve a table</h1>
          <p className="rest-subtitle mb-0">
            Pick a table from the dining floor, then confirm your details. Reservations are held
            for 15 minutes after the booked time.
          </p>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      {booking ? (
        <div className="rest-success">
          <div className="rest-success-icon"><i className="bi bi-calendar-check" /></div>
          <h2>Table reserved</h2>
          <p>Show this reference when you arrive to check in at the host desk.</p>
          <div className="rest-success-row">
            <div><span>Reference</span><strong>{booking.ref}</strong></div>
            <div><span>Table</span><strong>Table {booking.table}</strong></div>
            <div><span>When</span><strong>{booking.date} · {booking.time}</strong></div>
          </div>
          <div className="rest-success-row">
            <div><span>Party size</span><strong>{booking.partySize}</strong></div>
            <div><span>Preference</span><strong>{booking.preference}</strong></div>
            <div><span>Held until</span><strong>{booking.time.slice(0, 2)}:{booking.time.slice(3)} + 15 min</strong></div>
          </div>

          <Link to={`/Restaurant?table=${booking.table}`} className="rest-cta mt-4">
            <i className="bi bi-egg-fried me-2" /> Order from the menu now
          </Link>
          <button type="button" className="rest-btn-link mt-2" onClick={() => { setBooking(null); setStep(1); }}>
            <i className="bi bi-arrow-left me-2" /> Make another reservation
          </button>
        </div>
      ) : loading ? (
        <div className="rest-success" style={{ textAlign: 'left' }}>
          <p className="text-muted mb-0">Loading tables…</p>
        </div>
      ) : step === 1 ? (
        <div className="rest-success" style={{ textAlign: 'left' }}>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="book-label fw-bold small text-uppercase">Date</label>
              <input type="date" className="form-control" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="book-label fw-bold small text-uppercase">Time</label>
              <select className="form-select" value={time} onChange={(e) => setTime(e.target.value)}>
                {timeOptions().map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="book-label fw-bold small text-uppercase">Party size</label>
              <input type="number" className="form-control" min="1" max="12" value={partySize} onChange={(e) => { setPartySize(Math.max(1, Number(e.target.value) || 1)); setSelected(null); }} />
            </div>
            <div className="col-md-3">
              <label className="book-label fw-bold small text-uppercase">Seating preference</label>
              <select className="form-select" value={preference} onChange={(e) => setPreference(e.target.value)}>
                {['No preference', 'Window', 'Outdoor', 'Quiet zone'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between mt-4 mb-3">
            <h2 className="admin-card-title mb-0"><i className="bi bi-grid me-2" />Choose your table</h2>
            <span className="small text-muted">Tap an available table</span>
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-info-circle me-2" />No tables are set up yet. Please check back later.
            </div>
          ) : (
            <div className="table-floor">
              {sorted.map((t) => {
                const pickable = canPick(t);
                const isSelected = selected?.number === t.number;
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`table-tile tile-btn ${pickable ? 'tile-selectable' : 'tile-disabled'} ${isSelected ? 'selected' : ''}`}
                    disabled={!pickable}
                    onClick={() => setSelected(t)}
                  >
                    <span className="tile-icon"><i className="bi bi-people" /></span>
                    <h3 className="tile-number">Table {t.number}</h3>
                    <div className="tile-meta">Seats {t.capacity} · {t.location}</div>
                    {t.status !== 'Available' && (
                      <span className={`tile-status ${STATUS_TONE[t.status] || 'occupied'}`}>{t.status}</span>
                    )}
                    {pickable && isSelected && (
                      <span className="tile-status avail"><i className="bi bi-check-lg" /> Selected</span>
                    )}
                    {pickable && !isSelected && <span className="tile-status avail">Available</span>}
                  </button>
                );
              })}
            </div>
          )}

          {sorted.some((t) => t.status === 'Available') && !sorted.some((t) => canPick(t)) && (
            <div className="lost-alert lost-alert-danger mt-3">
              <i className="bi bi-exclamation-triangle me-2" />No available table seats a party of {partySize}. Try a smaller group.
            </div>
          )}

          <button type="button" className="rest-cta mt-4" disabled={!selected} onClick={() => setStep(2)}>
            <i className="bi bi-arrow-right me-2" /> Continue with Table {selected ? selected.number : ''}
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="rest-success" style={{ textAlign: 'left' }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="admin-card-title mb-0"><i className="bi bi-pencil-square me-2" />Booking details</h2>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>
                <i className="bi bi-arrow-left me-1" /> Change table
              </button>
            </div>

            <div className="order-ticket">
              <div className="order-ticket-head">
                <strong>Table {selected.number}</strong>
                <span className="order-ticket-table">Seats {selected.capacity} · {selected.location}</span>
              </div>
              <div className="ticket-meta mb-0">
                {selected.number && selected.capacity >= partySize
                  ? `Fits a party of ${partySize} perfectly.`
                  : `Fits up to ${selected.capacity} guests — reduce your party size.`}
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Date</label>
                <input type="date" className="form-control" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Time</label>
                <select className="form-select" value={time} onChange={(e) => setTime(e.target.value)}>
                  {timeOptions().map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Party size</label>
                <input type="number" className="form-control" min="1" max={selected.capacity} value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Seating preference</label>
                <select className="form-select" value={preference} onChange={(e) => setPreference(e.target.value)}>
                  {['No preference', 'Window', 'Outdoor', 'Quiet zone'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Name</label>
                <input className="form-control" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="col-md-6">
                <label className="book-label fw-bold small text-uppercase">Contact (optional)</label>
                <input className="form-control" value={guestContact} onChange={(e) => setGuestContact(e.target.value)} placeholder="Phone / email" />
              </div>
            </div>

            <div className="small text-muted mt-3">
              Operating hours {OPEN_TIME} – {CLOSE_TIME}. The table is held for 15 minutes after the booked time.
            </div>

            <button type="submit" className="rest-cta mt-4">
              <i className="bi bi-calendar-check me-2" /> Confirm reservation for Table {selected.number}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
