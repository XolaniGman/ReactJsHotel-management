import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getRoom } from '../services/roomService';
import { formatPrice } from '../lib/utils';
import { amenityIcons, amenityLabels } from '../lib/constants';
import './room-details.css';

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80';

export default function RoomDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await getRoom(id);
      setRoom(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <p className="text-center text-muted py-5">Loading room…</p>;
  }

  if (!room) {
    return (
      <div className="san-shell">
        <div className="san-empty">Room not found.</div>
        <Link to="/Rooms" className="san-back-link" style={{ marginTop: '1rem' }}>
          <i className="bi bi-arrow-left" /> Back to Rooms
        </Link>
      </div>
    );
  }

  return (
    <div className="san-shell">
      <Link to="/Rooms" className="san-back-link">
        <i className="bi bi-arrow-left" /> All Rooms
      </Link>

      <div className="san-hero-grid">
        <div className="san-featured">
          <div className="san-featured-image">
            <img src={room.image || DEFAULT_IMG} alt={room.name} />
            <span className={`san-badge ${room.status.toLowerCase()}`}>{room.status}</span>
          </div>
          <div className="san-featured-body">
            <div>
              <div className="san-meta-row">
                <span className="san-meta">Room {room.number}</span>
                <span className="san-price">{formatPrice(room.price)}</span>
              </div>
              <h1 className="san-card-title">{room.name}</h1>
              <p className="san-desc">{room.overview || room.description}</p>

              <div className="san-capacity">
                <i className="bi bi-people" /> Sleeps {room.capacity}
              </div>

              <div className="san-amenities">
                {(room.amenities || []).map((a) => (
                  <div key={a} className="san-amenity">
                    <i className={`bi ${amenityIcons[a] || 'bi-check2'}`} />
                    <span>{amenityLabels[a] || a}</span>
                  </div>
                ))}
              </div>
            </div>

            {room.status === 'Available' && (
              <button
                type="button"
                className="san-btn-primary"
                style={{ width: '100%' }}
                onClick={() => navigate(`/Reservations/Create?room=${room.id}`)}
              >
                <i className="bi bi-calendar-plus me-2" /> Book this room
              </button>
            )}
            {room.status !== 'Available' && (
              <div className="san-empty">This room is currently {room.status.toLowerCase()}. Please select another room.</div>
            )}
          </div>
        </div>

        <div className="san-sidebar">
          <div className="san-facts">
            <div className="san-fact">
              <span>Type</span>
              <strong>{room.type}</strong>
            </div>
            <div className="san-fact">
              <span>Floor</span>
              <strong>{room.floor}</strong>
            </div>
            <div className="san-fact">
              <span>Size</span>
              <strong>{room.size || '—'}</strong>
            </div>
            <div className="san-fact">
              <span>Beds</span>
              <strong>{room.beds || '—'}</strong>
            </div>
            <div className="san-fact">
              <span>View</span>
              <strong>{room.description || '—'}</strong>
            </div>
            <div className="san-fact">
              <span>Price</span>
              <strong>{formatPrice(room.price)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
