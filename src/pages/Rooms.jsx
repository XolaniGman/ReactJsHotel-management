import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listRooms, deleteRoom } from '../services/roomService';
import { formatPrice } from '../lib/utils';
import { ROOM_TYPES, ROOM_STATUSES, amenityIcons, amenityLabels } from '../lib/constants';
import './rooms.css';

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80';

export default function Rooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    const data = await listRooms();
    setRooms(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rooms.filter(
        (r) => (type === 'All' || r.type === type) && (status === 'All' || r.status === status),
      ),
    [rooms, type, status],
  );

  const remove = async (id) => {
    if (!window.confirm('Delete this room?')) return;
    await deleteRoom(id);
    load();
  };

  return (
    <div className="san-shell">
      <div className="san-header">
        <div className="san-kicker">Stay With Us</div>
        <h1 className="san-title">Rooms &amp; Suites</h1>
        <p className="san-intro">
          Choose from our thoughtfully designed rooms. Every stay includes Wi-Fi, climate control
          and our signature hospitality.
        </p>
      </div>

      <div className="san-filter-card">
        <div className="san-filter-header">
          <div>
            <h2 className="san-filter-title">Find your room</h2>
            <p className="san-filter-sub">Filter by room type and current availability.</p>
          </div>
          {isAdmin && (
            <Link to="/Rooms/Create" className="san-btn-primary">
              <i className="bi bi-plus-lg me-2" /> Add Room
            </Link>
          )}
        </div>
        <div className="san-filter-body">
          <div className="filter-row">
            <div>
              <label className="san-label" htmlFor="Type">Room Type</label>
              <select
                id="Type"
                className="san-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="All">All types</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="san-label" htmlFor="Status">Availability</label>
              <select
                id="Status"
                className="san-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="All">All statuses</option>
                {ROOM_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="filter-actions">
              <button type="button" className="san-btn-secondary" onClick={() => { setType('All'); setStatus('All'); }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="san-empty">{error}</div>}

      {loading ? (
        <p className="text-center text-muted py-5">Loading rooms…</p>
      ) : filtered.length === 0 ? (
        <div className="san-empty">No rooms match your filters. Try a different combination.</div>
      ) : (
        <div className="san-room-grid">
          {filtered.map((room) => (
            <article key={room.id} className={`san-room-card ${room.status !== 'Available' ? 'is-muted' : ''}`}>
              <div className="san-room-image">
                <img src={room.image || DEFAULT_IMG} alt={room.name} />
                <span className={`san-room-badge ${room.status.toLowerCase()}`}>{room.status}</span>
              </div>
              <div className="san-room-body">
                <div className="san-room-meta">
                  <span>Room {room.number} · {room.floor}</span>
                  <strong>{room.type}</strong>
                </div>
                <h3>{room.name}</h3>
                <p className="san-room-copy">{room.overview || room.description}</p>

                {room.amenities?.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {room.amenities.map((a) => (
                      <span key={a} className="badge bg-light text-dark border">
                        <i className={`bi ${amenityIcons[a] || 'bi-check2'} me-1`} />
                        {amenityLabels[a] || a}
                      </span>
                    ))}
                  </div>
                )}

                <div className="san-room-price">
                  {formatPrice(room.price)} <small>/ night</small>
                </div>

                <div className="san-room-actions">
                  <Link to={`/Rooms/Details/${room.id}`} className="san-btn-primary">
                    View Room
                  </Link>
                  {room.status === 'Available' && (
                    <button
                      type="button"
                      className="san-btn-secondary"
                      onClick={() => navigate(`/Reservations/Create?room=${room.id}`)}
                    >
                      Book This Room
                    </button>
                  )}
                  {isAdmin && (
                    <div className="d-flex gap-2">
                      <Link to={`/Rooms/Edit/${room.id}`} className="san-btn-secondary" style={{ flex: 1 }}>
                        <i className="bi bi-pencil me-1" /> Edit
                      </Link>
                      <button type="button" className="san-btn-secondary" style={{ color: '#9b3d30', flex: 1 }} onClick={() => remove(room.id)}>
                        <i className="bi bi-trash me-1" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
