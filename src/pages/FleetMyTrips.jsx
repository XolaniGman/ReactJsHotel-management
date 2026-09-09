import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  cancelCarBooking,
  modifyCarBooking,
  cancelServiceRequest,
  bookingDisplay,
  listFleetVehicles,
  subscribeCarServices,
  subscribeCarBookings,
  reviewPendingCharge,
  listFleetIncidents,
  resolveIncidentReview,
  updateBookingLivePosition,
  recordBookingPayment,
} from '../services/fleetService';
import { cancellationPreview, rentalCancellationPenalty, serviceCancellationPenalty } from '../lib/fleetAlgo';
import FleetMap from '../components/FleetMap';
import StripeCheckoutModal from '../components/StripeCheckoutModal';
import { formatPrice, formatGuestDate, formatDateTime, statusTone, todayISO } from '../lib/utils';
import './guest.css';
import './rooms.css';
import './fleet.css';

const SERVICE_STEPS = ['PendingAssignment', 'Assigned', 'EnRoute', 'Arrived', 'Completed'];
const BOOKING_STEPS = ['PendingConfirmation', 'Confirmed', 'CheckedOut', 'CheckedIn'];
const STAFF_ROLES = ['fleet', 'fleetmanager', 'admin', 'system'];

export default function FleetMyTrips() {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [tab, setTab] = useState('rentals');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [liveWatch, setLiveWatch] = useState(null);
  const [liveBookingId, setLiveBookingId] = useState('');
  const [historyOpenId, setHistoryOpenId] = useState('');
  const [payModal, setPayModal] = useState(null);

  const bookingBalanceDue = (b) =>
    Math.max(0, Number(b.estimatedTotal || 0) + Number(b.finalCharges || 0) - Number(b.paidAmount || 0));

  const confirmStripePayment = async () => {
    const res = await recordBookingPayment(payModal.bookingId, {
      amount: payModal.amount,
      byName: user.name,
      method: 'Stripe',
    });
    if (res?.error) throw new Error(res.error);
  };

  useEffect(() => () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
  }, [liveWatch]);

  const goLive = (booking) => {
    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => updateBookingLivePosition(booking.id, { lat: pos.coords.latitude, lng: pos.coords.longitude, on: true }),
        (err) => setError(`Geolocation error: ${err.message}`),
        { enableHighAccuracy: true },
      );
      setLiveWatch(watchId);
      setLiveBookingId(booking.id);
      setNotice(`Live tracking started for ${booking.vehicleName} — position streams to this view.`);
    } catch {
      setError('Live tracking unavailable in this browser.');
    }
  };

  const stopLive = () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    if (liveBookingId) updateBookingLivePosition(liveBookingId, { on: false }).catch(() => {});
    setLiveWatch(null);
    setLiveBookingId('');
    setNotice('Live position stream stopped.');
  };

  const load = async () => {
    setVehicles(await listFleetVehicles());
    const allIncidents = await listFleetIncidents();
    setIncidents(allIncidents.filter((i) => i.reporterUid === user.uid));
  };

  useEffect(() => {
    if (user?.uid) load();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeCarServices((all) => setServices(isStaff ? all : all.filter((s) => s.guestUid === user.uid)));
  }, [user?.uid, isStaff]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeCarBookings((all) => setBookings(isStaff ? all : all.filter((b) => b.guestUid === user.uid)));
  }, [user?.uid, isStaff]);

  const doCancel = async (id) => {
    if (!window.confirm('Cancel this rental booking? A cancellation fee may apply — see the policy shown below the booking.')) return;
    setError('');
    setNotice('');
    setBusyId(id);
    const result = await cancelCarBooking(id, { byName: user.name });
    setBusyId('');
    if (result?.error) return setError(result.error);
    setNotice(result.fee > 0 ? `Booking cancelled (${result.tier}). A cancellation fee of ${formatPrice(result.fee)} applies.` : 'Booking cancelled — no fee applies.');
    await load();
  };

  const doCancelService = async (id) => {
    if (!window.confirm('Cancel this car service request? A cancellation fee may apply depending on notice given.')) return;
    setError('');
    setNotice('');
    setBusyId(id);
    const result = await cancelServiceRequest(id, user.name);
    setBusyId('');
    if (result?.error) return setError(result.error);
    setNotice(result.fee > 0 ? `Service request cancelled (${result.tier}). A cancellation fee of ${formatPrice(result.fee)} applies.` : 'Service request cancelled — no fee applies.');
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

  const reviewCharge = async (bookingId, item, action) => {
    const result = await reviewPendingCharge(bookingId, item.id, { action, by: user.name });
    if (result?.error) return setError(result.error);
    setError('');
    setNotice(action === 'accept' ? `You accepted the charge: ${item.description}.` : `You disputed the charge: ${item.description} — it's been sent to the Fleet Manager.`);
    await load();
  };

  const reviewIncident = async (incident, action) => {
    const result = await resolveIncidentReview(incident.id, { action, by: user.name, reservationId: bookings.find((b) => b.id === incident.bookingId)?.reservationId });
    if (result?.error) return setError(result.error);
    setError('');
    setNotice(action === 'accept' ? 'You accepted the liability determination.' : 'You disputed the liability determination — it has been sent to the Fleet Manager for adjudication.');
    await load();
  };

  const activeEdit = bookings.find((b) => b.id === editing?.id);

  const dueBack = (b) => {
    if (!b.dropoffDate) return null;
    const t = todayISO();
    if (b.status === 'CheckedOut') {
      if (String(b.dropoffDate) < t) return { kind: 'overdue', label: `Your rental was due back on ${formatGuestDate(b.dropoffDate)} ${b.dropoffTime || ''} — fleet is expecting the car back now.` };
      if (String(b.dropoffDate) === t) return { kind: 'today', label: `Your rental is due back TODAY at ${b.dropoffTime || 'returned'} — please return the car when ready.` };
    }
    if (b.status === 'Confirmed' && String(b.pickupDate) === t) {
      return { kind: 'pickup', label: `Your car is ready for pick-up today at ${b.pickupTime || ''} — collect it at the front desk.` };
    }
    return null;
  };

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">{isStaff ? 'Fleet Trips' : 'Your Trips'}</div>
          <h1 className="lost-title">{isStaff ? 'All rental & trip activity' : 'Vehicle & trip tracking'}</h1>
          <p className="lost-copy">
            {isStaff
              ? 'Live status of every rental booking and shuttle trip across the fleet, including cars currently checked out.'
              : 'Track live status of your rental bookings and shuttle trips, and cancel or modify them subject to the cancellation policy.'}
          </p>
        </div>
        {!isStaff && (
          <div className="d-flex gap-2">
            <Link to="/Fleet/Vehicles" className="san-btn-secondary"><i className="bi bi-car-front me-2" />Rent a vehicle</Link>
            <Link to="/Fleet/Service" className="san-btn-primary"><i className="bi bi-taxi-front me-2" />Request a shuttle</Link>
          </div>
        )}
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
          <div className="dash-panel-header"><h2>{isStaff ? 'All rental bookings' : 'My rental bookings'}</h2></div>
          {bookings.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-car-front me-2" />No rental bookings yet.</div>
          ) : (
            bookings.map((b) => {
              const stepIndex = BOOKING_STEPS.indexOf(b.status);
              const isCompleted = b.status === 'CheckedIn';
              return (
              <div key={b.id} className="fleet-row">
                <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                <div className="flex-grow-1">
                  <div className="dash-row-title">{b.vehicleName} <span className="text-muted">· {b.ref}</span></div>
                  <div className="dash-row-meta">
                    <span><i className="bi bi-box-arrow-up-right me-1" />Check-out (pick-up): <strong>{formatGuestDate(b.pickupDate)} {b.pickupTime}</strong></span>
                    <span><i className="bi bi-box-arrow-in-down me-1" />Check-in (return): <strong>{formatGuestDate(b.dropoffDate)} {b.dropoffTime}</strong></span>
                    <span>{b.days} day(s) · {formatPrice(b.estimatedTotal)}</span>
                    {isStaff && b.guestName && <span><i className="bi bi-person me-1" />{b.guestName}</span>}
                  </div>
                  {!isStaff && b.status !== 'Cancelled' && (
                    bookingBalanceDue(b) > 0 ? (
                      <div className="dash-row-meta">
                        <span className="fleet-flag fleet-flag-warn"><i className="bi bi-credit-card me-1" />Balance due: {formatPrice(bookingBalanceDue(b))}</span>
                      </div>
                    ) : (
                      <div className="dash-row-meta">
                        <span className="fleet-flag" style={{ background: '#edf8f1', color: '#2f7d4f' }}><i className="bi bi-check-circle me-1" />Paid in full{b.paymentMethod ? ` · ${b.paymentMethod}` : ''}</span>
                      </div>
                    )
                  )}
                  {!isStaff && (() => {
                    const due = dueBack(b);
                    if (!due) return null;
                    const cls = due.kind === 'overdue' ? 'lost-alert-danger' : due.kind === 'today' ? 'lost-alert-warning' : 'lost-alert-success';
                    const icon = due.kind === 'overdue' ? 'bi-exclamation-triangle' : due.kind === 'today' ? 'bi-bell' : 'bi-box-arrow-in-down';
                    return (
                      <div className={`lost-alert ${cls} mt-2`} style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}>
                        <i className={`bi ${icon} me-2`} />{due.label}
                      </div>
                    );
                  })()}
                  {b.status === 'PendingInspection' && (
                    <div className="lost-alert lost-alert-warning mt-2" style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}>
                      <i className="bi bi-clipboard-check me-2" />You have returned the vehicle. It is now undergoing its <strong>post-rental inspection</strong>. Any final charges are subject to the completed inspection.
                    </div>
                  )}
                  {b.unitNumber && b.status !== 'PendingConfirmation' && (
                    <div className="dash-row-meta">
                      <span><i className="bi bi-tag me-1" />Assigned unit: <strong>{b.unitNumber}</strong></span>
                      {b.replacementVehicleId && b.replacementVehicleName && (
                        <span className="fleet-badge fleet-badge-SignedOff"><i className="bi bi-arrow-repeat me-1" />Replacement provided</span>
                      )}
                    </div>
                  )}
                  {!isStaff && !['CheckedOut', 'PendingInspection', 'CheckedIn', 'Cancelled'].includes(b.status) && (() => {
                    const p = cancellationPreview({ pickupDate: b.pickupDate, pickupTime: b.pickupTime });
                    const label = p.hoursUntilPickup > 24
                      ? `${Math.floor(p.hoursUntilPickup / 24)}d ${p.hoursUntilPickup % 24}h to pickup`
                      : `${Math.round(p.hoursUntilPickup)}h to pickup`;
                    const penalty = rentalCancellationPenalty({
                      paidAmount: b.paidAmount || 0,
                      dailyRate: b.days ? b.basePrice / b.days : 0,
                      hoursUntilPickup: p.hoursUntilPickup,
                      isDayOf: new Date().toDateString() === new Date(`${b.pickupDate}T00:00:00`).toDateString(),
                    });
                    return (
                      <div className="dash-row-meta">
                        <span>
                          <i className={`bi ${penalty.fee === 0 ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-1`} />
                          {penalty.fee === 0
                            ? `Free cancellation · ${label}`
                            : `Cancellation fee up to ${formatPrice(penalty.fee)} (${penalty.tier}) · ${label}`}
                        </span>
                      </div>
                    );
                  })()}
                  {!isStaff && (b.pendingCharges || []).length > 0 && (
                    <div className="mt-2">
                      {b.pendingCharges.map((item) => (
                        <div className="fleet-charge-item" key={item.id}>
                          <div>
                            <div className="task-sub">{item.description}</div>
                            <strong>{formatPrice(item.amount)}</strong>{' '}
                            <span className={`fleet-charge-status ${item.status}`}>{item.status}</span>
                          </div>
                          {item.status === 'Held' && (
                            <div className="d-flex gap-1">
                              <button type="button" className="btn btn-sm btn-success" onClick={() => reviewCharge(b.id, item, 'accept')}>Accept</button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => reviewCharge(b.id, item, 'dispute')}>Dispute</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isStaff && incidents.filter((i) => i.bookingId === b.id && i.status === 'PendingGuestReview').map((incident) => (
                    <div className="lost-alert lost-alert-warning mt-2" key={incident.id}>
                      <i className="bi bi-shield-exclamation me-2" />
                      Incident {incident.ref}: liability determined as <strong>{incident.liability}</strong>
                      {incident.chargeAmount > 0 ? ` — proposed charge ${formatPrice(incident.chargeAmount)}` : ' — no charge'}.
                      <div className="d-flex gap-1 mt-2">
                        <button type="button" className="btn btn-sm btn-success" onClick={() => reviewIncident(incident, 'accept')}>Accept</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => reviewIncident(incident, 'dispute')}>Dispute</button>
                      </div>
                    </div>
                  ))}
                  <div className="d-flex align-items-center gap-2 mt-2">
                    {stepIndex >= 0 && BOOKING_STEPS.map((step) => (
                      <span key={step} className={`fleet-trip-step ${stepIndex >= 0 && stepIndex >= BOOKING_STEPS.indexOf(step) && !isCompleted ? 'is-done' : ''} ${stepIndex === BOOKING_STEPS.indexOf(step) ? 'is-active' : ''}`}>
                        <span className="step-dot" />
                      </span>
                    ))}
                    <span className={`dash-status-pill ${statusTone(b.status)}`}>{bookingDisplay(b.status)}</span>
                  </div>
                  {b.status === 'CheckedOut' && (
                    <div className="fleet-trip-map">
                      {b.livePosition ? (
                        <FleetMap
                          height={190}
                          markers={[{ lat: b.livePosition.lat, lng: b.livePosition.lng, color: '#355f8c', label: `${isStaff ? b.vehicleName : 'Your car'} · live`, follow: true }]}
                        />
                      ) : (
                        <div className="dash-empty" style={{ minHeight: 150, borderRadius: 12 }}>
                          <i className="bi bi-geo-alt me-2" />
                          {b.liveTracking
                            ? 'Fleet is connecting the live feed…'
                            : isStaff
                              ? 'No live feed yet — use "Go live" to start streaming this vehicle\'s position.'
                              : 'Your car is out on rental. Live location appears here when the front desk starts tracking.'}
                        </div>
                      )}
                      {b.livePosition && (
                        <div className="text-muted small mt-1">
                          <span className="live-pulse" />{isStaff ? `${b.vehicleName} is live` : 'Your car is live'} — position refreshes automatically.
                        </div>
                      )}
                    </div>
                  )}
                  {historyOpenId === b.id && (
                    <div className="dash-notice mt-2" style={{ margin: '0.5rem 0 0' }}>
                      <div className="book-label mb-2"><i className="bi bi-clock-history me-1" />Booking history</div>
                      {(b.history || []).length === 0 ? (
                        <p className="task-sub mb-0">No history recorded yet.</p>
                      ) : (
                        [...b.history].reverse().map((h, idx) => (
                          <div key={idx} className="dash-row-meta" style={{ marginBottom: 4 }}>
                            <span className="text-muted small">{formatDateTime(h.at)}</span>
                            <span><strong>{bookingDisplay(h.to)}</strong> — {h.note || 'Status updated'} <span className="text-muted">({h.by || 'System'})</span></span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {!isStaff && b.status === 'Confirmed' && (
                    <Link to={`/Fleet/Collection/${b.id}`} className="btn btn-sm btn-success">
                      <i className="bi bi-box-arrow-right me-1" />Start pickup
                    </Link>
                  )}
                  {!isStaff && b.status === 'CheckedOut' && !b.guestAcknowledgedAt && (
                    <Link to={`/Fleet/Collection/${b.id}`} className="btn btn-sm btn-outline-success">
                      <i className="bi bi-pen me-1" />Review &amp; sign
                    </Link>
                  )}
                  {!isStaff && b.status !== 'Cancelled' && bookingBalanceDue(b) > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={() => setPayModal({ bookingId: b.id, amount: bookingBalanceDue(b), vehicleName: b.vehicleName })}
                    >
                      <i className="bi bi-credit-card me-1" />Pay {formatPrice(bookingBalanceDue(b))}
                    </button>
                  )}
                  {!isStaff && !['Cancelled', 'PendingInspection', 'CheckedIn'].includes(b.status) && (
                    <Link to={`/Fleet/Incident/Report?type=booking&id=${b.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-bug me-1" />Report incident
                    </Link>
                  )}
                  {!isStaff && ['PendingConfirmation', 'Confirmed'].includes(b.status) && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing({ id: b.id, vehicleId: b.vehicleId, pickupDate: b.pickupDate, dropoffDate: b.dropoffDate, pickupTime: b.pickupTime, dropoffTime: b.dropoffTime })}>
                      <i className="bi bi-pencil me-1" />Modify
                    </button>
                  )}
                  {!isStaff && !['CheckedOut', 'PendingInspection', 'CheckedIn', 'Cancelled'].includes(b.status) && (
                    <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === b.id} onClick={() => doCancel(b.id)}>
                      <i className="bi bi-x-lg me-1" />Cancel
                    </button>
                  )}
                  {isStaff && b.status === 'CheckedOut' && (
                    liveBookingId === b.id ? (
                      <button type="button" className="btn btn-sm btn-danger" onClick={stopLive}>
                        <i className="bi bi-stop-circle me-1" />Stop live
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-success" onClick={() => goLive(b)}>
                        <i className="bi bi-broadcast me-1" />Go live
                      </button>
                    )
                  )}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setHistoryOpenId(historyOpenId === b.id ? '' : b.id)}>
                    <i className="bi bi-clock-history me-1" />{historyOpenId === b.id ? 'Hide history' : 'View history'}
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'shuttles' && (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>{isStaff ? 'All shuttle & car services' : 'My shuttle & car services'}</h2></div>
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
                      {isStaff && s.guestName && <span><i className="bi bi-person me-1" />{s.guestName}</span>}
                    </div>
                    {s.driverName && (
                      <div className="dash-row-meta">
                        <span><i className="bi bi-person-badge me-1" />{s.driverName}{s.vehicleUnit ? ` · ${s.vehicleUnit}` : ''}</span>
                        {s.eta && <span><i className="bi bi-clock me-1" />ETA {s.eta}</span>}
                      </div>
                    )}
                    {!['Completed', 'Cancelled'].includes(s.status) && s.status !== 'Arrived' && (() => {
                      const pickup = new Date(`${s.pickupDate}T${s.pickupTime || '00:00'}`);
                      const hoursUntilPickup = Number.isNaN(pickup.getTime()) ? 0 : Math.max(0, (pickup.getTime() - Date.now()) / 3600000);
                      const penalty = serviceCancellationPenalty({ confirmedBookingAmount: s.confirmedBookingAmount || s.estimatedFare, hoursUntilPickup });
                      return (
                        <div className="dash-row-meta">
                          <span>
                            <i className={`bi ${penalty.fee === 0 ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-1`} />
                            {penalty.fee === 0 ? `Free cancellation (${penalty.tier})` : `Cancellation fee ${formatPrice(penalty.fee)} (${penalty.tier})`}
                          </span>
                        </div>
                      );
                    })()}
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
                  {!isStaff && ['Assigned', 'EnRoute', 'Arrived'].includes(s.status) && (
                    <Link to={`/Fleet/Incident/Report?type=service&id=${s.id}`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-bug me-1" />Report
                    </Link>
                  )}
                  {!isStaff && !['Completed', 'Cancelled'].includes(s.status) && s.status !== 'Arrived' && (
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

      {payModal && (
        <StripeCheckoutModal
          amount={payModal.amount}
          description={`Rental booking · ${payModal.vehicleName}`}
          onConfirm={confirmStripePayment}
          onDone={() => {
            setPayModal(null);
            setNotice(`Payment of ${formatPrice(payModal.amount)} received via Stripe.`);
          }}
          onCancel={() => setPayModal(null)}
        />
      )}
    </div>
  );
}