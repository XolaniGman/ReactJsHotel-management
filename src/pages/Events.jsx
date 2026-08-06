import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listEvents, bookEvent, deleteEvent } from '../services/eventService';
import { listUserReservations } from '../services/reservationService';
import { formatPrice, formatGuestDate } from '../lib/utils';
import './events.css';

const IMG =
  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80';

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);

  const load = async () => setEvents(await listEvents());

  useEffect(() => {
    (async () => { await load(); setLoading(false); })();
  }, []);

  const isAdmin = user?.role === 'admin';

  const book = async (eventId) => {
    setError('');
    setMessage('');
    if (!user) {
      setError('Please sign in to book an event.');
      return;
    }
    const reservations = await listUserReservations(user.uid);
    const active = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));
    try {
      await bookEvent({
        eventId,
        guestUid: user.uid,
        guestName: user.name,
        quantity: qty,
        reservationId: active?.id || '',
      });
      setMessage(
        active
          ? 'Event booked and added to your bill.'
          : 'Event booked. Charges will appear on your bill once you have an active stay.',
      );
    } catch (err) {
      setError(err.message || 'Could not book event.');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await deleteEvent(id);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="events-shell">
      <div className="events-wrap">
        <div className="events-hero">
          <div className="events-hero-body">
            <div className="events-kicker">Experiences</div>
            <h1 className="events-title">Hotel Events</h1>
            <p className="events-subtitle">
              Dinners, wellness retreats and curated experiences — book directly and we&rsquo;ll add
              it to your stay.
            </p>
          </div>
        </div>

        <div className="events-toolbar">
          <h2 className="section-title">Upcoming experiences</h2>
          {isAdmin && (
            <a href="#/Events/Create" className="lux-btn-gold" onClick={(e) => { e.preventDefault(); window.location.hash = ''; window.location.href = '/Events/Create'; }}>
              <i className="bi bi-plus-lg me-2" /> Create Event
            </a>
          )}
        </div>

        {error && <div className="empty-state mb-3" style={{ borderColor: '#f1b0b7', background: '#fff1f1', color: '#842029' }}><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
        {message && <div className="empty-state mb-3" style={{ borderColor: '#a3d9b1', background: '#eef8f1', color: '#2f7d4f' }}><i className="bi bi-check-circle me-2" />{message}</div>}

        {loading ? (
          <p className="text-muted">Loading events…</p>
        ) : events.length === 0 ? (
          <div className="empty-state">No events yet. An admin can create one.</div>
        ) : (
          <div className="event-grid">
            {events.map((ev) => {
              const isPast = ev.date < today;
              return (
                <article key={ev.id} className={`event-card ${isPast ? 'is-inactive' : ''}`}>
                  <div className="event-card-top">
                    <img src={ev.image || IMG} alt={ev.name} />
                    <div className="event-overlay" />
                    <span className={`event-status ${isPast ? 'status-past' : 'status-upcoming'}`}>
                      {isPast ? 'Past' : 'Upcoming'}
                    </span>
                  </div>
                  <div className="event-card-body">
                    <h3 className="event-name">{ev.name}</h3>
                    <p className="event-meta"><i className="bi bi-calendar-event" />{formatGuestDate(ev.date)} · {ev.time}</p>
                    <p className="event-meta"><i className="bi bi-geo-alt" />{ev.location}</p>
                    <p className="event-description">{ev.description}</p>
                    <div className="event-footer">
                      <div className="event-price">
                        {formatPrice(ev.price)} <small>/ person</small>
                      </div>
                      {isAdmin ? (
                        <button type="button" className="lux-btn-gold" onClick={() => remove(ev.id)}>
                          <i className="bi bi-trash me-1" /> Delete
                        </button>
                      ) : !isPast ? (
                        <button type="button" className="lux-btn-gold" onClick={() => { setBookingId(ev.id); setQty(1); book(ev.id); }}>
                          <i className="bi bi-ticket-perforated me-1" /> Book
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
