import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listTables, reserveTable } from '../services/restaurantService';
import { todayISO } from '../lib/utils';
import './events.css';
import './restaurant.css';
import './palm.css';

const OPEN_TIME = '07:00';
const CLOSE_TIME = '21:30';
const STATUS_TONE = { Available: 'avail', Reserved: 'reserved', Occupied: 'occupied' };
const STATUS_PRIORITY = { Occupied: 2, Reserved: 1, Available: 0 };

const TABLE_PRESENTATIONS = {
  1: {
    zone: 'Window Side',
    note: 'Ideal for couples',
    description: 'Uninterrupted sunset vistas overlooking the city gardens with gentle candlelight.',
    tags: ['Panoramic View', 'Romantic'],
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=700&q=80',
  },
  2: {
    zone: 'Main Salon',
    note: 'Banquette A',
    description: 'Deep forest-green curved banquette with acoustic privacy fabric, near the grand entrance.',
    tags: ['Quiet Alcove', 'Wine Cellar View'],
    image: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=700&q=80',
  },
  3: {
    zone: 'Library Wing',
    note: 'Next slot: 21:30',
    description: 'Currently committed for a private tasting menu until late evening service.',
    tags: [],
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80',
  },
  4: {
    zone: 'Conservatory',
    note: 'Climate Controlled',
    description: 'Surrounded by exotic greenery and heated glass domes, an airy garden retreat.',
    tags: ['Botanical Garden', 'Heated'],
    image: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=700&q=80',
  },
  5: {
    zone: 'Culinary Theater',
    note: 'Tasting Exclusive',
    description: 'Watch our chefs curate signature fire-roasted dishes live at the counter.',
    tags: ['Live Cooking', 'Omakase Style'],
    image: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=700&q=80',
  },
  6: {
    zone: 'Center Floor',
    note: 'In Service',
    description: 'Currently seated for a multi-course pairing service.',
    tags: [],
    image: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=700&q=80',
  },
  7: {
    zone: 'Window Side',
    note: 'Corner Vantage',
    description: 'Discreet corner positioning along the glass facade with stunning night views.',
    tags: ['Corner Privacy', 'Skyline'],
    image: 'https://images.unsplash.com/photo-1560624052-449f5ddf0c31?auto=format&fit=crop&w=700&q=80',
  },
  8: {
    zone: 'Center Floor',
    note: 'Under Chandelier',
    description: 'Spacious round table located beneath a statement chandelier centerpiece.',
    tags: ['Grand Chandelier', 'Social'],
    image: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=700&q=80',
  },
};

const FALLBACK_TABLE_IMAGES = [
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80',
];

const getTablePresentation = (t) => TABLE_PRESENTATIONS[t.number] || {
  zone: t.location || 'Dining Room',
  note: '',
  description: `A comfortable table in the ${t.location || 'dining room'}.`,
  tags: [],
  image: FALLBACK_TABLE_IMAGES[t.number % FALLBACK_TABLE_IMAGES.length],
};

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

  const sorted = useMemo(() => {
    const byNumber = new Map();
    for (const t of tables) {
      const existing = byNumber.get(t.number);
      if (!existing) {
        byNumber.set(t.number, t);
        continue;
      }
      const existingRank = STATUS_PRIORITY[existing.status] ?? 0;
      const candidateRank = STATUS_PRIORITY[t.status] ?? 0;
      if (candidateRank > existingRank) {
        byNumber.set(t.number, t);
      } else if (candidateRank === existingRank && (t.createdAt || 0) < (existing.createdAt || 0)) {
        byNumber.set(t.number, t);
      }
    }
    return [...byNumber.values()].sort((a, b) => a.number - b.number);
  }, [tables]);
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
    <div className="rest-shell palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Reservations</div>
          <h1 className="palm-page-title">Reserve a table</h1>
          <p className="palm-page-copy">
            Pick a table from the dining floor, then confirm your details. Reservations are held
            for 15 minutes after the booked time.
          </p>
        </div>
      </div>

      {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}

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

          <Link to={`/Restaurant?table=${booking.table}`} className="palm-btn palm-btn-primary mt-4">
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
        <div className="rest-booking-step">
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

          <div className="table-floor-header mt-4 mb-3">
            <div>
              <h2 className="table-floor-title">Choose your dining table</h2>
              <p className="table-floor-subtitle">Select any highlighted card below to preview vantage point and finalize reservation.</p>
            </div>
            <span className="table-floor-count-pill">Showing {sorted.length} real-time tables for {time}</span>
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-info-circle me-2" />No tables are set up yet. Please check back later.
            </div>
          ) : (
            <div className="table-photo-grid">
              {sorted.map((t) => {
                const pickable = canPick(t);
                const isSelected = selected?.number === t.number;
                const tooSmall = t.status === 'Available' && !pickable;
                const info = getTablePresentation(t);
                const buttonLabel = isSelected
                  ? 'Selected'
                  : t.status === 'Occupied'
                    ? 'Occupied'
                    : t.status === 'Reserved'
                      ? `Unavailable at ${time}`
                      : tooSmall
                        ? 'Too small for party'
                        : 'Select table';

                return (
                  <div
                    key={t.id}
                    className={`table-photo-card ${pickable ? 'is-selectable' : 'is-disabled'} ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => pickable && setSelected(t)}
                  >
                    <div className="table-photo-wrap">
                      <img src={info.image} alt={`Table ${t.number}`} loading="lazy" />
                      <span className="table-photo-zone">Zone: {info.zone}</span>
                      {t.status !== 'Available' ? (
                        <span className={`table-photo-status ${STATUS_TONE[t.status] || 'occupied'}`}>
                          <i className={`bi ${t.status === 'Reserved' ? 'bi-clock-history' : 'bi-lock-fill'} me-1`} />{t.status}
                        </span>
                      ) : isSelected ? (
                        <span className="table-photo-status selected"><i className="bi bi-check-circle-fill me-1" />Selected</span>
                      ) : tooSmall ? (
                        <span className="table-photo-status full"><i className="bi bi-exclamation-circle me-1" />Too small</span>
                      ) : (
                        <span className="table-photo-status avail"><i className="bi bi-circle-fill me-1" />Available</span>
                      )}
                      <h3 className="table-photo-number">Table {String(t.number).padStart(2, '0')}</h3>
                    </div>

                    <div className="table-photo-body">
                      <div className="table-photo-meta">
                        <span><i className="bi bi-people me-1" />Seats {t.capacity}{tooSmall ? ' (too few)' : ''}</span>
                        {info.note && <span className="table-photo-note">{info.note}</span>}
                      </div>
                      <p className="table-photo-desc">{info.description}</p>
                      {info.tags.length > 0 && (
                        <div className="table-photo-tags">
                          {info.tags.map((tag) => <span key={tag} className="table-photo-tag">{tag}</span>)}
                        </div>
                      )}
                      <button
                        type="button"
                        className={`table-select-btn ${isSelected ? 'is-selected' : ''}`}
                        disabled={!pickable}
                        onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                      >
                        {buttonLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sorted.some((t) => t.status === 'Available') && !sorted.some((t) => canPick(t)) && (
            <div className="palm-alert palm-alert-danger mt-3">
              <i className="bi bi-exclamation-triangle" />No available table seats a party of {partySize}. Try a smaller group.
            </div>
          )}

          <button type="button" className="palm-btn palm-btn-primary mt-4" disabled={!selected} onClick={() => setStep(2)}>
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

            <button type="submit" className="palm-btn palm-btn-primary mt-4">
              <i className="bi bi-calendar-check me-2" /> Confirm reservation for Table {selected.number}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
