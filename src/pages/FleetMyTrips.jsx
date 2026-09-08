import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listMyCarBookings,
  cancelCarBooking,
  modifyCarBooking,
  cancelServiceRequest,
  bookingDisplay,
  listFleetVehicles,
  subscribeCarServices,
} from '../services/fleetService';
import { cancellationPreview } from '../lib/fleetAlgo';
import FleetMap from '../components/FleetMap';
import { formatPrice, formatGuestDate, statusTone, todayISO } from '../lib/utils';
import './guest.css';
import './rooms.css';
import './fleet.css';

const SERVICE_STEPS = ['PendingAssignment', 'Assigned', 'EnRoute', 'Arrived', 'Completed'];

export default function FleetMyTrips() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState('rentals');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setBookings(await listMyCarBookings(user.uid));
    setVehicles(await listFleetVehicles());
  };

  useEffect(() => {
    if (user?.uid) load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeCarServices((all) => setServices(all.filter((s) => s.guestUid === user.uid)));
  }, [user?.uid]);

  const doCancel = async (id) => {
    if (!window.confirm('Cancel this rental booking? A fee may apply inside the 48h window.')) return;
    setError('');
    setNotice('');
    setBusyId(id);
    const result = await cancelCarBooking(id, { byName: user.name });
    setBusyId('');
    if (result?.error) return setError(result.error);
    setNotice(result.fee > 0 ? `Booking cancelled. A cancellation fee of ${formatPrice(result.fee)} applies.` : 'Booking cancelled within the free cancellation window.');
    await load();
  };

  const doCancelService = async (id) => {
    if (!window.confirm('Cancel this car service request?')) return;
    setError('');
    setNotice('');
    setBusyId(id);
    const result = await cancelServiceRequest(id, user.name);
    setBusyId('');
    if (result?.error) return setError(result.error);
    setNotice('Service request cancelled.');
    await load();
  };

  const doModify = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const result = await modifyCarBooking(editing.id, {
      pickupDate: editing.pickupDate,
      dropoffDate: editing.dropoffDate,
      pickupTime: editing.pickupTime,
      dropoffTime: editing.dropoffTime,
      vehicleId: editing.vehicleId,
    }, user.name);
    if (result?.error) return setError(result.error);
    setNotice(editing.vehicleId ? 'Booking modified. A confirmation of the change has been sent.' : 'Booking dates updated.');
    setEditing(null);
    await load();
  };

  const activeEdit = bookings.find((b) => b.id === editing?.id);

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Your Trips</div>
          <h1 className="lost-title">Vehicle &amp; trip tracking</h1>
          <p className="lost-copy">
            Track live status of your rental bookings and shuttle trips, and cancel or modify them
            subject to the cancellation policy.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/Fleet/Vehicles" className="san-btn-secondary"><i className="bi bi-car-front me-2" />Rent a vehicle</Link>
          <Link to="/Fleet/Service" className="san-btn-primary"><i className="bi bi-taxi-front me-2" />Request a shuttle</Link>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      <div className="d-flex gap-2 mb-3">
        <button type="button" className={`lux-btn ${tab === 'rentals' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setTab('rentals')}>
          <i className="bi bi-car-front me-2" /> Rental bookings ({bookings.length})
        </button>
        <button type="button" className={`lux-btn ${tab === 'shuttles' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setTab('shuttles')}>
          <i className="bi bi-taxi-front me-2" /> Shuttle trips ({services.length})
        </button>
      </div>

      {tab === 'rentals' && (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>My rental bookings</h2></div>
          {bookings.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-car-front me-2" />No rental bookings yet.</div>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="fleet-row">
                <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                <div className="flex-grow-1">
                  <div className="dash-row-title">{b.vehicleName} <span className="text-muted">· {b.ref}</span></div>
                  <div className="dash-row-meta">
                    <span>{formatGuestDate(b.pickupDate)} {b.pickupTime} → {formatGuestDate(b.dropoffDate)} {b.dropoffTime}</span>
                    <span>{b.days} day(s) · {formatPrice(b.estimatedTotal)}</span>
                  </div>
                  {b.unitNumber && b.status !== 'PendingConfirmation' && (
                    <div className="dash-row-meta">
                      <span><i className="bi bi-tag me-1" />Assigned unit: <strong>{b.unitNumber}</strong></span>
                    </div>
                  )}
                  {!['CheckedOut', 'CheckedIn', 'Cancelled'].includes(b.status) && (() => {
                    const p = cancellationPreview({ pickupDate: b.pickupDate, pickupTime: b.pickupTime });
                    const label = p.hoursUntilPickup > 24
                      ? `${Math.floor(p.hoursUntilPickup / 24)}d ${p.hoursUntilPickup % 24}h to pickup`
                      : `${Math.round(p.hoursUntilPickup)}h to pickup`;
                    return (
                      <div className="dash-row-meta">
                        <span>
                          <i className={`bi ${p.free ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-1`} />
                          {p.free
                            ? `Free cancellation · ${label}`
                            : `Cancellation fee ${formatPrice(p.fee)} applies now · ${label}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className={`fleet-badge fleet-badge-${b.status}`}>{bookingDisplay(b.status)}</span>
                  {!['Cancelled'].includes(b.status) && (
                    <Link to={`/Fleet/Incident/Report?type=booking&id=${b.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-bug me-1" />Report incident
                    </Link>
                  )}
                  {['PendingConfirmation', 'Confirmed'].includes(b.status) && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing({ id: b.id, vehicleId: b.vehicleId, pickupDate: b.pickupDate, dropoffDate: b.dropoffDate, pickupTime: b.pickupTime, dropoffTime: b.dropoffTime })}>
                      <i className="bi bi-pencil me-1" />Modify
                    </button>
                  )}
                  {!['CheckedOut', 'CheckedIn', 'Cancelled'].includes(b.status) && (
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === b.id} onClick={() => doCancel(b.id)}>
                      <i className="bi bi-x-lg me-1" />Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'shuttles' && (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>My shuttle &amp; car services</h2></div>
          {services.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-taxi-front me-2" />No shuttle trips yet.</div>
          ) : (
            services.map((s) => {
              const stepIndex = SERVICE_STEPS.indexOf(s.status);
              const isCompleted = s.status === 'Completed';
              return (
                <div key={s.id} className="fleet-row">
                  <span className="fleet-thumb"><i className="bi bi-taxi-front" /></span>
                  <div className="flex-grow-1">
                    <div className="dash-row-title">{s.serviceType} <span className="text-muted">· {s.ref}</span></div>
                    <div className="dash-row-meta">
                      <span>{s.pickupLocation} → {s.destination}</span>
                      <span>{formatGuestDate(s.pickupDate)} {s.pickupTime} · {formatPrice(s.estimatedFare)}</span>
                    </div>
                    {s.driverName && (
                      <div className="dash-row-meta">
                        <span><i className="bi bi-person-badge me-1" />{s.driverName}{s.vehicleUnit ? ` · ${s.vehicleUnit}` : ''}</span>
                        {s.eta && <span><i className="bi bi-clock me-1" />ETA {s.eta}</span>}
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2 mt-2">
                      {stepIndex >= 0 && SERVICE_STEPS.map((step) => (
                        <span key={step} className={`fleet-trip-step ${stepIndex >= 0 && stepIndex >= SERVICE_STEPS.indexOf(step) && !isCompleted ? 'is-done' : ''} ${stepIndex === SERVICE_STEPS.indexOf(step) ? 'is-active' : ''}`}>
                          <span className="step-dot" />
                        </span>
                      ))}
                      <span className={`dash-status-pill ${statusTone(s.status)}`}>{bookingDisplay(s.status)}</span>
                    </div>
                    {(s.pickupLat || s.livePosition) && ['Assigned', 'EnRoute', 'Arrived'].includes(s.status) && (
                      <div className="fleet-trip-map">
                        <FleetMap
                          height={170}
                          markers={[
                            ...(s.pickupLat && s.pickupLng ? [{ lat: s.pickupLat, lng: s.pickupLng, color: '#c0392b', label: 'Pickup' }] : []),
                            ...(s.livePosition ? [{ lat: s.livePosition.lat, lng: s.livePosition.lng, color: '#355f8c', label: 'Live vehicle', follow: true }] : []),
                          ]}
                        />
                        {s.livePosition && (
                          <div className="text-muted small mt-1">
                            <span className="live-pulse" />Driver is live — position refreshes automatically.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {['Assigned', 'EnRoute', 'Arrived'].includes(s.status) && (
                    <Link to={`/Fleet/Incident/Report?type=service&id=${s.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-bug me-1" />Report
                    </Link>
                  )}
                  {!['Completed', 'Cancelled'].includes(s.status) && s.status !== 'Arrived' && (
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === s.id} onClick={() => doCancelService(s.id)}>
                      <i className="bi bi-x-lg me-1" />Cancel
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {editing && activeEdit && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15,20,35,0.6)' }}>
          <div className="modal-dialog modal-lg">
            <form className="modal-content" onSubmit={doModify}>
              <div className="modal-header">
                <h5 className="modal-title">Modify booking · {activeEdit.ref}</h5>
                <button type="button" className="btn-close" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="book-label">Pick-up date</label>
                    <input type="date" className="form-control" min={todayISO()} value={editing.pickupDate} onChange={(e) => setEditing({ ...editing, pickupDate: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label">Pick-up time</label>
                    <input type="time" className="form-control" value={editing.pickupTime} onChange={(e) => setEditing({ ...editing, pickupTime: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label">Drop-off date</label>
                    <input type="date" className="form-control" min={editing.pickupDate} value={editing.dropoffDate} onChange={(e) => setEditing({ ...editing, dropoffDate: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label">Drop-off time</label>
                    <input type="time" className="form-control" value={editing.dropoffTime} onChange={(e) => setEditing({ ...editing, dropoffTime: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label">Vehicle</label>
                    <select className="form-select" value={editing.vehicleId} onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value })}>
                      {vehicles.filter((v) => v.status === 'Available' || v.id === activeEdit.vehicleId).map((v) => (
                        <option key={v.id} value={v.id}>{v.name} · {formatPrice(v.pricePerDay)}/day</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                  <i className="bi bi-info-circle me-2" />Modifications are re-quoted and any change is re-confirmed by the front desk. A fee may apply if a change reduces your rental window.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>Close</button>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-check-lg me-1" />Confirm change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}