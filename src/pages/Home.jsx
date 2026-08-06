import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listRooms } from '../services/roomService';
import { listEvents } from '../services/eventService';
import { formatPrice, todayISO } from '../lib/utils';
import './home.css';

export default function Home() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);

  useEffect(() => {
    (async () => {
      const [r, e] = await Promise.all([listRooms(), listEvents()]);
      setRooms(r.filter((x) => x.status === 'Available').slice(0, 3));
      setEvents(e.slice(0, 3));
    })();
  }, []);

  const search = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', guests);
    navigate(`/Rooms?${params.toString()}`);
  };

  return (
    <div className="lumina-page">
      <div className="lumina-hero">
        <div className="lumina-nav">
          <div className="lumina-nav-inner">
            <span className="lumina-brand">Grand Hotel</span>
            <div className="lumina-links">
              <Link to="/Rooms">Rooms</Link>
              <Link to="/Events">Experiences</Link>
              <Link to="/Restaurant">Dining</Link>
              <Link to="/Amenities/Request">Services</Link>
              <Link to="/Account/Login">Sign In</Link>
            </div>
          </div>
        </div>

        <div className="hero-inner">
          <span className="eyebrow">Seaside Escape</span>
          <h1 className="hero-title">Where the coast feels like home</h1>
          <p className="hero-text">Rest, reconnect, and let the ocean set your pace.</p>
        </div>

        <div className="availability-card">
          <input type="date" value={checkIn} min={todayISO()} onChange={(e) => setCheckIn(e.target.value)} />
          <input type="date" value={checkOut} min={checkIn || todayISO()} onChange={(e) => setCheckOut(e.target.value)} />
          <select value={guests} onChange={(e) => setGuests(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
          </select>
          <button type="button" className="btn-gold" onClick={search}>Check availability</button>
        </div>
      </div>

      <section className="sanctuary-section">
        <div className="lumina-shell">
          <div className="section-kicker">The Rooms</div>
          <div className="section-header-row">
            <h2 className="section-title">Featured rooms</h2>
            <Link to="/Rooms" className="text-link">View all rooms →</Link>
          </div>
          <div className="d-flex flex-column flex-md-row gap-4">
            {rooms.length === 0 ? (
              <p className="section-copy">Rooms will appear here once the admin adds them.</p>
            ) : (
              rooms.map((room) => (
                <div key={room.id} className="card border-0 shadow-sm flex-fill" style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <img src={room.image || 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80'} alt={room.name} style={{ height: 220, width: '100%', objectFit: 'cover' }} />
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-baseline mb-2">
                      <h3 className="h5 mb-0" style={{ fontFamily: "'Noto Serif', serif" }}>{room.name}</h3>
                      <strong style={{ color: '#775a19' }}>{formatPrice(room.price)}</strong>
                    </div>
                    <p className="text-muted small mb-3">{room.type} · Room {room.number} · Sleeps {room.capacity}</p>
                    <Link to={`/Rooms/Details/${room.id}`} className="btn-gold" style={{ width: '100%' }}>View room</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="experiences-section">
        <div className="lumina-shell">
          <div className="section-header-row">
            <div>
              <div className="section-kicker">Experiences</div>
              <h2 className="section-title">Make memories</h2>
            </div>
            <Link to="/Events" className="text-link">Explore all events →</Link>
          </div>
          <div className="row g-4">
            {events.map((ev) => (
              <div className="col-md-4" key={ev.id}>
                <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <img src={ev.image || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'} alt={ev.name} style={{ height: 180, width: '100%', objectFit: 'cover' }} />
                  <div className="card-body">
                    <h3 className="h5" style={{ fontFamily: "'Noto Serif', serif" }}>{ev.name}</h3>
                    <p className="text-muted small mb-2"><i className="bi bi-calendar-event me-1" />{ev.date} · {ev.time}</p>
                    <p className="small">{ev.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="world-section">
        <div className="lumina-shell">
          <div className="section-kicker">Stay with us</div>
          <h2 className="section-title">Plan your coastal getaway</h2>
          <p className="section-copy">Book directly for the best rates and a personalised stay.</p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <Link to="/Reservations/Create" className="btn-gold" style={{ background: '#fff', color: '#172033', borderColor: '#fff' }}>Book a room</Link>
            <Link to="/Events" className="btn-gold">View experiences</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
