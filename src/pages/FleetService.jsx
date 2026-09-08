import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCarService, computeFareEstimate, listMyCarServices, listFleetVehicles } from '../services/fleetService';
import { listUserReservations } from '../services/reservationService';
import { formatPrice, formatDateTime, statusTone } from '../lib/utils';
import { CAR_SERVICE_TYPES, PAYMENT_METHODS } from '../lib/constants';
import FleetMap from '../components/FleetMap';
import './guest.css';
import './rooms.css';
import './fleet.css';

export default function FleetService() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [serviceType, setServiceType] = useState(CAR_SERVICE_TYPES[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('09:00');
  const [paymentMethod, setPaymentMethod] = useState('Folio');
  const [reservationId, setReservationId] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  useEffect(() => {
    (async () => {
      const [r, q, f] = await Promise.all([listUserReservations(user.uid), listMyCarServices(user.uid), listFleetVehicles()]);
      setReservations(r);
      setRequests(q);
      setFleet(f);
    })();
  }, [user?.uid]);

  const shuttles = fleet.filter((v) => v.category === 'Shuttle' || v.type === 'Shuttle');
  const selectedVehicle = fleet.find((v) => v.id === vehicleId);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!pickupLocation.trim() || !destination.trim()) return setError('Please provide both pickup and destination.');
    if (!pickupDate) return setError('Please choose a date for the trip.');
    setSubmitting(true);
    await createCarService({
      guestUid: user.uid,
      guestName: user.name,
      serviceType,
      vehicleId,
      vehicleName: selectedVehicle?.name || '',
      pickupLocation,
      destination,
      pickupDate,
      pickupTime,
      paymentMethod,
      reservationId: reservationId || activeRes?.id || '',
      pickupLat,
      pickupLng,
      notes,
    });
    setSubmitting(false);
    setPickupLocation('');
    setDestination('');
    setNotes('');
    setVehicleId('');
    setPickupLat(null);
    setPickupLng(null);
    setShowMap(false);
    setSuccess('Your car service request has been submitted. A driver will be assigned shortly.');
    setRequests(await listMyCarServices(user.uid));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation is not supported in this browser.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(pos.coords.latitude);
        setPickupLng(pos.coords.longitude);
        setPickupLocation(pickupLocation || 'My current location');
        setShowMap(true);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(`Could not read location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Hotel Shuttle &amp; Car Service</div>
          <h1 className="lost-title">Request a point-to-point trip</h1>
          <p className="lost-copy">
            Need an airport transfer or a local trip? Let us know where you’re going and our
            dispatch team will pair you with an available driver.
          </p>
        </div>
        <Link to="/Fleet/Vehicles" className="san-btn-secondary">
          <i className="bi bi-arrow-left me-2" /> Back to fleet
        </Link>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}

      <div className="row g-4">
        <div className="col-lg-7">
          <form className="fleet-form-section" onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="book-label" htmlFor="SType">Trip type</label>
                <select id="SType" className="form-select book-input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                  {CAR_SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="book-label">Estimated fare</label>
                <div className="form-control book-input bg-light" style={{ fontWeight: 800, color: '#775a19' }}>
                  {formatPrice(computeFareEstimate({ serviceType }))}
                </div>
              </div>
              <div className="col-12">
                <label className="book-label">Choose a transfer vehicle</label>
                {shuttles.length === 0 ? (
                  <div className="dash-empty">No shuttle vehicles are listed yet.</div>
                ) : (
                  <div className="vehicle-pick-grid">
                    {shuttles.map((v) => {
                      const active = vehicleId === v.id;
                      return (
                        <button
                          type="button"
                          key={v.id}
                          className={`vehicle-pick ${active ? 'is-selected' : ''} ${v.status !== 'Available' ? 'is-busy' : ''}`}
                          onClick={() => setVehicleId(active ? '' : v.id)}
                        >
                          <img src={v.image} alt={v.name} loading="lazy" />
                          <div className="vehicle-pick-body">
                            <div>
                              <strong>{v.name}</strong>
                              <div className="task-sub">{v.capacity} seats · {v.transmission} · {v.unitNumber || v.plateNumber}</div>
                              <div className="task-sub">{v.status}</div>
                            </div>
                            {active && <i className="bi bi-check-circle-fill vehicle-pick-check" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedVehicle && (
                  <div className="text-muted small mt-2">
                    <i className="bi bi-check2-circle me-1" />Departure vehicle: <strong>{selectedVehicle.name}</strong> · {selectedVehicle.unitNumber || selectedVehicle.plateNumber}
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <label className="book-label" htmlFor="PickupLoc">Pick-up location</label>
                <input id="PickupLoc" className="form-control book-input" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="e.g. Grand Hotel Lobby / OR Tambo Airport" />
              </div>
              <div className="col-md-6">
                <label className="book-label" htmlFor="Dest">Destination</label>
                <input id="Dest" className="form-control book-input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Sandton City Convention Centre" />
              </div>
              <div className="col-12">
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <button type="button" className="btn-log" style={{ background: '#355f8c', padding: '0.5rem 1rem' }} onClick={useMyLocation} disabled={locating}>
                    <i className={`bi ${locating ? 'bi-arrow-repeat spin' : 'bi-crosshair'} me-1`} />Use my location
                  </button>
                  <button type="button" className="btn-log" style={{ background: '#5b51a8', padding: '0.5rem 1rem' }} onClick={() => setShowMap(!showMap)}>
                    <i className="bi bi-geo-alt me-1" />{showMap ? 'Hide map' : 'Pick pickup on map'}
                  </button>
                  {pickupLat && pickupLng && (
                    <span className="task-sub text-primary ms-1">
                      <i className="bi bi-pin-map me-1" />Pinned at {pickupLat.toFixed(4)}, {pickupLng.toFixed(4)}
                    </span>
                  )}
                </div>
                {showMap && (
                  <div className="mt-2">
                    <FleetMap
                      height={280}
                      markers={pickupLat ? [{ lat: pickupLat, lng: pickupLng, color: '#c0392b', label: 'Pickup point' }] : []}
                      onPick={(latlng) => {
                        setPickupLat(latlng.lat);
                        setPickupLng(latlng.lng);
                      }}
                    />
                    <div className="text-muted small mt-2">
                      <i className="bi bi-mouse me-1" />Click anywhere on the map to set the exact pick-up point — dispatchers rank drivers by proximity to it.
                    </div>
                  </div>
                )}
              </div>
              <div className="col-md-6">
                <label className="book-label" htmlFor="SDate">Date</label>
                <input id="SDate" type="date" className="form-control book-input" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="book-label" htmlFor="STime">Requested time</label>
                <input id="STime" type="time" className="form-control book-input" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="book-label" htmlFor="PayMethod">Payment method</label>
                <select id="PayMethod" className="form-select book-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {['Folio', 'Cash', 'Card'].filter((m) => PAYMENT_METHODS.includes(m) || m === 'Folio').map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              {reservations.length > 0 && (
                <div className="col-md-6">
                  <label className="book-label" htmlFor="SFolio">Charge to stay</label>
                  <select id="SFolio" className="form-select book-input" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
                    <option value="">No stay — pay at point of use</option>
                    {reservations.filter((r) => ['Approved', 'CheckedIn'].includes(r.status)).map((r) => (
                      <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-12">
                <label className="book-label" htmlFor="SNotes">Notes (optional)</label>
                <textarea id="SNotes" className="form-control book-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 2 suitcases, baby seat needed…" />
              </div>
            </div>

            {!activeRes && !reservationId && (
              <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                <i className="bi bi-info-circle me-2" />You don’t have an active stay, so this trip is recorded without a room folio.
              </div>
            )}

            <button type="submit" className="book-submit mt-4" disabled={submitting}>
              <i className="bi bi-taxi-front me-2" />{submitting ? 'Submitting…' : 'Submit service request'}
            </button>
          </form>
        </div>

        <div className="col-lg-5">
          {requests.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-taxi-front me-2" />No service requests yet.</div>
          ) : (
            requests.slice(0, 8).map((s) => (
              <div key={s.id} className="dash-row dash-row--simple">
                <div>
                  <div className="dash-row-title">{s.serviceType}{s.vehicleName ? ` · ${s.vehicleName}` : ''} · {s.ref}</div>
                  <div className="dash-row-meta">
                    <span>{s.pickupLocation} → {s.destination}</span>
                    <span>{formatPrice(s.estimatedFare)} · {formatDateTime(s.createdAt)}</span>
                  </div>
                </div>
                <span className={`dash-status-pill ${statusTone(s.status)}`}>{s.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}