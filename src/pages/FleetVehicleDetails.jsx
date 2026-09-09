import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFleetVehicle } from '../services/fleetService';
import { vehicleRateCard, vehicleRatingInfo } from '../lib/fleetAlgo';
import { formatPrice, todayISO, addDaysISO } from '../lib/utils';
import { CAR_RENTAL_ADDONS, HOURLY_FUEL_SURCHARGE } from '../lib/constants';
import CarViewer3D from '../components/CarViewer3D';
import './guest.css';
import './rooms.css';
import './fleet.css';

const OVERVIEW_ICONS = [
  { key: 'category', icon: 'bi-car-front-fill', label: 'Body' },
  { key: 'type', icon: 'bi-signpost-2-fill', label: 'Type' },
  { key: 'transmission', icon: 'bi-gear-fill', label: 'Transmission' },
  { key: 'fuelType', icon: 'bi-fuel-pump-fill', label: 'Fuel Type' },
  { key: 'capacity', icon: 'bi-people-fill', label: 'Seats' },
  { key: 'mileage', icon: 'bi-speedometer2', label: 'Mileage' },
  { key: 'year', icon: 'bi-calendar3', label: 'Year' },
  { key: 'unit', icon: 'bi-upc-scan', label: 'Unit / Plate' },
];

export default function FleetVehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [pickupTime, setPickupTime] = useState('10:00');
  const [dropoffDate, setDropoffDate] = useState(addDaysISO(todayISO(), 1));
  const [dropoffTime, setDropoffTime] = useState('10:00');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setVehicle(await getFleetVehicle(id));
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const rates = useMemo(() => vehicleRateCard(vehicle || {}), [vehicle]);
  const ratingInfo = useMemo(() => vehicleRatingInfo(vehicle || {}), [vehicle]);

  if (loading) {
    return <p className="text-center text-muted py-5">Loading vehicle…</p>;
  }

  if (!vehicle) {
    return (
      <div className="clean-shell">
        <div className="dash-empty">Vehicle not found.</div>
        <Link to="/Fleet/Vehicles" className="san-btn-secondary" style={{ marginTop: '1rem' }}>
          <i className="bi bi-arrow-left me-2" /> Back to fleet
        </Link>
      </div>
    );
  }

  const busy = vehicle.status !== 'Available';
  const fullStars = Math.round(ratingInfo.rating);
  const overviewValues = {
    category: vehicle.category || vehicle.type || '—',
    type: vehicle.type || '—',
    transmission: vehicle.transmission || '—',
    fuelType: vehicle.fuelType || '—',
    capacity: vehicle.capacity ? `${vehicle.capacity} seats` : '—',
    mileage: vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString()} km` : '—',
    year: vehicle.year || '—',
    unit: vehicle.unitNumber || vehicle.plateNumber || '—',
  };

  const submitBooking = (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim() || !email.trim()) return setFormError('Please enter your name and email.');
    if (!pickupDate || !dropoffDate) return setFormError('Please choose your pick-up and returning dates.');
    if (dropoffDate < pickupDate) return setFormError('Returning date must be after the pick-up date.');
    const params = new URLSearchParams({
      vehicle: vehicle.id,
      pickup: pickupDate,
      dropoff: dropoffDate,
      pickupTime,
      dropoffTime,
      notes: [phone.trim() ? `Phone: ${phone.trim()}` : '', message.trim()].filter(Boolean).join(' — '),
    });
    navigate(`/Fleet/Rent?${params.toString()}`);
  };

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Vehicle Details</div>
          <h1 className="lost-title">{vehicle.name}</h1>
          <p className="lost-copy">{vehicle.description}</p>
        </div>
        <Link to="/Fleet/Vehicles" className="san-btn-secondary">
          <i className="bi bi-arrow-left me-2" /> Back to fleet
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="fleet-form-section mb-4 vdet-hero">
            <div className="vdet-hero-top">
              <span className={`fleet-badge fleet-badge-${vehicle.status}`}>{vehicle.status}</span>
              <span className="fleet-badge category-badge">{vehicle.category || vehicle.type}</span>
              <div className="vdet-stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className={i < fullStars ? 'bi bi-star-fill' : 'bi bi-star'} />
                ))}
                <span>{ratingInfo.reviewCount} review{ratingInfo.reviewCount === 1 ? '' : 's'}{ratingInfo.isPlaceholder ? ' (est.)' : ''}</span>
              </div>
            </div>
            <div className="vdet-viewer">
              <CarViewer3D image={vehicle.image} label={vehicle.name} size={260} />
            </div>
          </div>

          <div className="fleet-form-section mb-4">
            <h3><i className="bi bi-info-circle me-2" />Vehicle Overview</h3>
            <div className="vdet-overview">
              {OVERVIEW_ICONS.map((f) => (
                <div key={f.key} className="vdet-fact">
                  <span className="vdet-fact-icon"><i className={`bi ${f.icon}`} /></span>
                  <div>
                    <strong>{f.label}</strong>
                    <span>{overviewValues[f.key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(vehicle.features || []).length > 0 && (
            <div className="fleet-form-section mb-4">
              <h3><i className="bi bi-check2-square me-2" />Features</h3>
              <div className="flv-features">
                <div>
                  {vehicle.features.slice(0, Math.ceil(vehicle.features.length / 2)).map((f) => (
                    <div key={f}><i className="bi bi-check2" />{f}</div>
                  ))}
                </div>
                <div>
                  {vehicle.features.slice(Math.ceil(vehicle.features.length / 2)).map((f) => (
                    <div key={f}><i className="bi bi-check2" />{f}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="fleet-form-section">
            <h3><i className="bi bi-cash-coin me-2" />Price Details</h3>
            <div className="fleet-quote-row"><span className="text-muted">Rent / Hour</span><strong>{formatPrice(rates.perHour)}</strong></div>
            <div className="text-muted small mt-1 mb-2">+{formatPrice(HOURLY_FUEL_SURCHARGE)}/hour fuel surcharge on hourly rentals</div>
            <div className="fleet-quote-row mt-2"><span className="text-muted">Rent / Day</span><strong>{formatPrice(rates.perDay)}</strong></div>
            <div className="fleet-quote-row mt-2"><span className="text-muted">Rent / Month (Leasing)</span><strong>{formatPrice(rates.perMonth)}</strong></div>
            <div className="fleet-quote-row mt-2"><span className="text-muted">Security Deposit</span><strong>{formatPrice(vehicle.deposit)}</strong></div>
            {CAR_RENTAL_ADDONS.length > 0 && (
              <>
                <div className="text-muted small mt-3 mb-1">Optional add-ons (priced at checkout):</div>
                <div className="d-flex flex-wrap gap-2">
                  {CAR_RENTAL_ADDONS.map((a) => (
                    <span key={a.name} className="vehicle-spec"><i className="bi bi-plus-circle" />{a.name} · {formatPrice(a.price)}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="fleet-form-section vdet-book">
            <h3><i className="bi bi-calendar-check me-2" />Book Now</h3>
            {formError && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{formError}</div>}
            {busy ? (
              <div className="dash-empty">This vehicle is currently {vehicle.status.toLowerCase()}. Please check back or browse other vehicles.</div>
            ) : (
              <form onSubmit={submitBooking}>
                <div className="mb-3">
                  <label className="book-label" htmlFor="BookName">Full Name</label>
                  <input id="BookName" className="form-control book-input" placeholder="Write your name here" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="book-label" htmlFor="BookEmail">Email Address</label>
                  <input id="BookEmail" type="email" className="form-control book-input" placeholder="Write your email here" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="book-label" htmlFor="BookPhone">Phone Number</label>
                  <input id="BookPhone" className="form-control book-input" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="row g-3 mb-1">
                  <div className="col-6">
                    <label className="book-label" htmlFor="BookPickupDate">Pick-up Date</label>
                    <input id="BookPickupDate" type="date" className="form-control book-input" min={todayISO()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="book-label" htmlFor="BookPickupTime">Pick-up Time</label>
                    <input id="BookPickupTime" type="time" className="form-control book-input" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                  </div>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="book-label" htmlFor="BookDropoffDate">Returning Date</label>
                    <input id="BookDropoffDate" type="date" className="form-control book-input" min={pickupDate} value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="book-label" htmlFor="BookDropoffTime">Returning Time</label>
                    <input id="BookDropoffTime" type="time" className="form-control book-input" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="book-label" htmlFor="BookMessage">Your Message</label>
                  <textarea id="BookMessage" className="form-control book-textarea" placeholder="Write your message here" value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                <button type="submit" className="book-submit w-100">
                  <i className="bi bi-calendar-check me-2" />Book
                </button>
                <div className="text-muted small mt-2">
                  <i className="bi bi-info-circle me-1" />You&apos;ll confirm your licence and rental terms on the next step.
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
