import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listTables, reserveTable } from '../services/restaurantService';
import { todayISO } from '../lib/utils';
import './events.css';
import './restaurant.css';

const OPEN_TIME = '07:00';
const CLOSE_TIME = '21:30';

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

  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [preference, setPreference] = useState('No preference');
  const [tableNumber, setTableNumber] = useState('');
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

  const candidates = useMemo(
    () =>
      tables
        .filter((t) => t.status === 'Available' && t.capacity >= partySize)
        .sort((a, b) => {
          const aMatch = a.location === preference ? 0 : 1;
          const bMatch = b.location === preference ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return a.capacity - b.capacity;
        }),
    [tables, partySize, preference],
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (date < todayISO()) return setError('Pick a date today or later.');
    const target = tableNumber ? tables.find((t) => t.number === Number(tableNumber)) : null;
    const table = target || candidates[0];
    if (!table) return setError('No table matches this party size. Try a smaller group or another time.');
    if (!guestName.trim()) return setError('Please enter your name.');
    const result = await reserveTable({
      tableNumber: table.number,
      date,
      time,
      partySize,
      preference,
      guestUid: user?.uid || '',
      guestName: guestName.trim(),
      guestContact: guestContact.trim(),
    });
    if (result?.error) return setError(result.error);
    setBooking({ ...result, table: table.number, date, time, partySize, preference });
  };

  return (
    <div className="rest-shell">
      <div className="rest-hero">
        <div className="rest-hero-body">
          <div className="rest-kicker">Reservations</div>
          <h1 className="rest-title">Reserve a table</h1>
          <p className="rest-subtitle mb-0">
            Pick a time and party size — we&rsquo;ll suggest the best table for you. Reservations are
            held for 15 minutes after the booked time.
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
          <button type="button" className="rest-cta mt-4" onClick={() => setBooking(null)}>
            <i className="bi bi-arrow-left me-2" /> Make another reservation
          </button>
        </div>
      ) : (
        <div className="rest-success" style={{ textAlign: 'left' }}>
          {loading ? (
            <p className="text-muted mb-0">Loading tables…</p>
          ) : (
            <form onSubmit={submit}>
              <div className="row g-3">
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
                  <input type="number" className="form-control" min="1" max="12" value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))} />
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
                <div className="col-12">
                  <label className="book-label fw-bold small text-uppercase">Suggested table</label>
                  <select className="form-select" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}>
                    <option value="">Auto-select best match</option>
                    {candidates.map((t) => (
                      <option key={t.id} value={t.number}>Table {t.number} — seats {t.capacity} ({t.location})</option>
                    ))}
                  </select>
                  {candidates.length === 0 && (
                    <div className="lost-alert lost-alert-danger mt-2"><i className="bi bi-exclamation-triangle me-2" />No available table for this party size.</div>
                  )}
                  {candidates[0] && !tableNumber && (
                    <div className="small text-muted mt-2">
                      <i className="bi bi-lightbulb me-1" />Recommended: Table {candidates[0].number} — seats {candidates[0].capacity} ({candidates[0].location})
                    </div>
                  )}
                </div>
              </div>
              <div className="small text-muted mt-3">
                Operating hours {OPEN_TIME} – {CLOSE_TIME}.
              </div>
              <button type="submit" className="rest-cta mt-4">
                <i className="bi bi-calendar-check me-2" /> Confirm reservation
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
