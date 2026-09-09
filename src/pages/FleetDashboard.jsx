import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFleetLive } from '../hooks/useFleetLive';
import {
  confirmCarBooking,
  assignDriverToService,
  updateCarServiceStatus,
  updateServiceLivePosition,
  updateBookingLivePosition,
  finalizePostRentalInspection,
  bookingDisplay,
} from '../services/fleetService';
import { rankDriversForTrip } from '../lib/fleetAlgo';
import FleetMap from '../components/FleetMap';
import HandoverRegister from '../components/HandoverRegister';
import { formatPrice, formatGuestDate } from '../lib/utils';
import './maintenance.css';
import './housekeeping.css';
import './guest.css';
import './fleet.css';

export default function FleetDashboard() {
  const { user } = useAuth();
  const { stats: data, vehicles, bookings, services, drivers, handovers, loading } = useFleetLive();
  const [confirmUnit, setConfirmUnit] = useState({});
  const [overrideNote, setOverrideNote] = useState({});
  const [dispatchMap, setDispatchMap] = useState({});
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('rentals');
  const [liveMapId, setLiveMapId] = useState('');
  const [liveKind, setLiveKind] = useState('');
  const [liveWatch, setLiveWatch] = useState(null);
  const [rentalSearch, setRentalSearch] = useState('');
  const isManager = ['fleetmanager', 'admin', 'system'].includes(user?.role);

  useEffect(() => () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveMapId) return;
    const inServices = services.some((s) => s.id === liveMapId);
    const inBookings = bookings.some((b) => b.id === liveMapId);
    if (!inServices && !inBookings) setLiveMapId('');
  }, [services, bookings, liveMapId]);

  if (loading) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading fleet…</p>
      </div></div>
    );
  }

  const pendingBookings = (bookings || []).filter((b) => b.status === 'PendingConfirmation');
  const rentalBookings = (bookings || []).filter((b) => ['Confirmed', 'CheckedOut', 'PendingInspection', 'CheckedIn'].includes(b.status));
  const pendingServices = (services || []).filter((s) => s.status === 'PendingAssignment');
  const activeTrips = (services || []).filter((s) => ['Assigned', 'EnRoute', 'Arrived'].includes(s.status));
  const bookableVehicles = (vehicles || []).filter((v) => v.status === 'Available');
  const visibleRentals = rentalBookings.filter((b) => {
    const q = rentalSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.guestName, b.ref, b.unitNumber, b.plateNumber, b.licenseNumber, b.vehicleName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const finalizeInspection = async (b) => {
    setNotice('');
    const res = await finalizePostRentalInspection(b.id, { qualifiedBy: user.name });
    if (res?.error) return setNotice(res.error);
    setNotice(`${b.ref}: post-rental inspection passed — vehicle ${res.vehicleStatus}. Return finalized.`);
  };

  const confirm = async (id) => {
    const unit = confirmUnit[id];
    if (!unit) return setNotice('Select a vehicle unit to assign before confirming.');
    const res = await confirmCarBooking(id, { unitNumber: unit, assignedBy: user.name, overrideNote: overrideNote[id] });
    if (res?.error) return setNotice(res.error);
    setNotice('Booking confirmed — vehicle locked for the rental window.');
  };

  const dispatch = async (id) => {
    const d = dispatchMap[id] || {};
    if (!d.driverId) return setNotice('Select a driver to assign.');
    const driver = drivers.find((x) => x.id === d.driverId);
    await assignDriverToService(id, {
      driverId: d.driverId,
      driverName: driver?.name,
      vehicleUnit: d.vehicleUnit || '',
      eta: d.eta || '',
      assignedBy: user.name,
    });
    setNotice(`Driver ${driver?.name} assigned and notified.`);
  };

  const advanceTrip = async (id, status) => {
    await updateCarServiceStatus(id, status, user.name);
    setNotice(`Trip updated to ${bookingDisplay(status)}.`);
  };

  const autoMatch = (id) => {
    const s = services.find((x) => x.id === id);
    const activeCounts = {};
    services
      .filter((t) => ['Assigned', 'EnRoute'].includes(t.status) && t.driverId)
      .forEach((t) => { activeCounts[t.driverId] = (activeCounts[t.driverId] || 0) + 1; });
    const ranked = rankDriversForTrip(drivers, {
      pickupLat: s?.pickupLat,
      pickupLng: s?.pickupLng,
      tripType: s?.serviceType,
      activeCounts,
    });
    if (ranked.length === 0) return setNotice('No available drivers to match.');
    setDispatchMap((m) => ({ ...m, [id]: { driverId: ranked[0].id, vehicleUnit: m[id]?.vehicleUnit || '', eta: m[id]?.eta || '' } }));
    setNotice(`Auto-matched ${ranked[0].name} (match ${ranked[0].matchScore}/100) — ${ranked[0].matchReasons[0] || ''}`);
  };

  const goLive = (target, kind = 'service') => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    const write = kind === 'booking'
      ? (lat, lng) => updateBookingLivePosition(target.id, { lat, lng, on: true })
      : (lat, lng) => updateServiceLivePosition(target.id, { lat, lng });
    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => write(pos.coords.latitude, pos.coords.longitude),
        (err) => setNotice(`Geolocation error: ${err.message}`),
        { enableHighAccuracy: true },
      );
      setLiveWatch(watchId);
      setLiveMapId(target.id);
      setLiveKind(kind);
      setNotice(kind === 'booking'
        ? `Live tracking started for ${target.vehicleName || 'the rented vehicle'} — position streams to the guest's My Trips view.`
        : `Live tracking started for ${target.guestName} — position streams to the guest's trip view.`);
    } catch {
      setNotice('Live tracking unavailable in this browser.');
    }
  };

  const stopLive = () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    if (liveKind === 'booking' && liveMapId) updateBookingLivePosition(liveMapId, { on: false }).catch(() => {});
    setLiveWatch(null);
    setLiveKind('');
    setNotice('Live position stream stopped.');
  };

  const liveTrip = services.find((s) => s.id === liveMapId);

  const liveMapMarkers = [];
  if (liveTrip?.pickupLat && liveTrip?.pickupLng) {
    liveMapMarkers.push({ lat: liveTrip.pickupLat, lng: liveTrip.pickupLng, color: '#c0392b', label: 'Pickup' });
  }
  if (liveTrip?.livePosition) {
    liveMapMarkers.push({ lat: liveTrip.livePosition.lat, lng: liveTrip.livePosition.lng, color: '#355f8c', label: `${liveTrip.guestName} · live vehicle`, follow: true });
  }

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet Operations · Front Desk &amp; Dispatch</div>
            <h1 className="maint-title">Fleet Ops Dashboard</h1>
          </div>
          <div className="d-flex gap-2">
            <Link to="/Fleet/Incidents" className="btn-log" style={{ background: '#7a251b' }}>
              <i className="bi bi-bug me-2" />Incidents {data.openIncidents}
            </Link>
            {isManager && (
              <Link to="/Fleet/Maintenance" className="btn-log" style={{ background: '#433c7d' }}>
                <i className="bi bi-wrench-adjustable me-2" />Maintenance
              </Link>
            )}
            <Link to="/Fleet/Charges" className="btn-log" style={{ background: '#355f8c' }}>
              <i className="bi bi-credit-card me-2" />Charges
            </Link>
            {isManager && (
              <Link to="/Fleet/Manager" className="btn-log" style={{ background: '#2f7d4f' }}>
                <i className="bi bi-graph-up me-2" />Reports
              </Link>
            )}
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="metric-grid">
          {[
            { n: data.pendingConfirmations, label: 'Pending Confirmation', icon: 'bi-hourglass-split', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
            { n: data.confirmedActive, label: 'Confirmed / On Rental', icon: 'bi-car-front', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
            { n: data.pendingServices + data.activeTrips, label: 'Shuttle Trips', icon: 'bi-taxi-front', bg: 'linear-gradient(135deg,#5b51a8,#433c7d)' },
            { n: `${data.availableDrivers}/${data.drivers.length}`, label: 'Drivers Available', icon: 'bi-person-badge', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
            { n: data.openIncidents, label: 'Open Incidents', icon: 'bi-bug', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
            { n: data.openWorkOrders, label: 'Work Orders Open', icon: 'bi-wrench-adjustable', bg: 'linear-gradient(135deg,#433c7d,#2d2e66)' },
          ].map((m) => (
            <div className="metric-card" key={m.label} style={{ background: m.bg }}>
              <div className="metric-content">
                <i className={`bi ${m.icon} metric-icon`} />
                <span className="metric-number">{m.n}</span>
                <span className="metric-label">{m.label}</span>
              </div>
            </div>
          ))}
        </div>

        {(data.documentsNeedingReview > 0 || data.highRiskOverridesPending > 0 || data.chargesAwaitingGuestResponse > 0) && (
          <div className="d-flex gap-2 flex-wrap mb-4">
            {data.documentsNeedingReview > 0 && (
              <span className="fleet-flag fleet-flag-warn"><i className="bi bi-file-earmark-lock me-1" />{data.documentsNeedingReview} document(s) needing review</span>
            )}
            {data.highRiskOverridesPending > 0 && (
              <span className="fleet-flag fleet-flag-danger"><i className="bi bi-shield-exclamation me-1" />{data.highRiskOverridesPending} high-risk override(s) pending</span>
            )}
            {data.chargesAwaitingGuestResponse > 0 && (
              <span className="fleet-flag fleet-flag-warn"><i className="bi bi-hourglass-split me-1" />{data.chargesAwaitingGuestResponse} charge(s) awaiting guest response</span>
            )}
          </div>
        )}

        <div className="panel-card mb-4">
          <div className="panel-header">
            <h2><i className="bi bi-grid me-2" />Fleet status</h2>
            <span className="panel-actions">
              {data.available} available · {data.reserved} reserved · {data.inMaintenance} in maintenance
            </span>
          </div>
          <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '0.65rem' }}>
            {vehicles.map((v) => (
              <div className="d-flex align-items-center justify-content-between gap-2 border rounded-3 p-2" key={v.id}>
                <div className="text-truncate">
                  <div className="task-name text-truncate">{v.name}</div>
                  <div className="task-sub">{v.unitNumber || v.plateNumber} · {v.type}</div>
                </div>
                <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2 mb-3">
          <button type="button" className={`lux-btn ${activeSection === 'rentals' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setActiveSection('rentals')}>
            <i className="bi bi-car-front me-2" />Rental confirmations ({pendingBookings.length + rentalBookings.length})
          </button>
          <button type="button" className={`lux-btn ${activeSection === 'dispatch' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setActiveSection('dispatch')}>
            <i className="bi bi-taxi-front me-2" />Shuttle dispatch ({pendingServices.length + activeTrips.length})
          </button>
          <button type="button" className={`lux-btn ${activeSection === 'handovers' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setActiveSection('handovers')}>
            <i className="bi bi-arrow-left-right me-2" />Handovers &amp; returns ({(handovers || []).length})
          </button>
        </div>

        {activeSection === 'rentals' && (
          <>
            <div className="panel-card mb-4">
              <div className="panel-header">
                <h2>Rental requests queue</h2>
                <span className="panel-actions">sorted by pick-up · {pendingBookings.length} pending</span>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead>
                    <tr><th>Guest</th><th>Vehicle</th><th>Window</th><th>Est. total</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {pendingBookings.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-5 text-muted">No pending confirmations.</td></tr>
                    ) : (
                      pendingBookings.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <div className="task-name">{b.guestName}</div>
                            <div className="task-sub">{b.licenseNumber || 'No licence on file'}</div>
                            {b.documentReviewRequired && <div className="fleet-flag fleet-flag-warn"><i className="bi bi-file-earmark-lock me-1" />Documents need review</div>}
                            {b.riskFlag && <div className="fleet-flag fleet-flag-danger"><i className="bi bi-shield-exclamation me-1" />High-risk — override required</div>}
                          </td>
                          <td>
                            <div className="task-name">{b.vehicleName}</div>
                            <div className="task-sub">{b.vehicleType}</div>
                          </td>
                          <td className="task-sub">{formatGuestDate(b.pickupDate)} {b.pickupTime}<br />→ {formatGuestDate(b.dropoffDate)} {b.dropoffTime}</td>
                          <td>{formatPrice(b.estimatedTotal)}</td>
                          <td><span className={`fleet-badge fleet-badge-${b.status}`}>{bookingDisplay(b.status)}</span></td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              <div className="d-flex gap-1 align-items-center">
                                <select className="form-select form-select-sm" style={{ width: 170 }} value={confirmUnit[b.id] || ''} onChange={(e) => setConfirmUnit({ ...confirmUnit, [b.id]: e.target.value })}>
                                  <option value="">Assign unit…</option>
                                  {bookableVehicles.map((v) => (
                                    <option key={v.id} value={v.unitNumber || v.plateNumber || v.name}>{v.name} · {v.unitNumber || v.plateNumber}</option>
                                  ))}
                                </select>
                                <button type="button" className="btn-request-start btn-request-done" onClick={() => confirm(b.id)}>Confirm</button>
                              </div>
                              {b.riskFlag && (
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Override reason (required, logged)"
                                  value={overrideNote[b.id] || ''}
                                  onChange={(e) => setOverrideNote({ ...overrideNote, [b.id]: e.target.value })}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">
                <h2>Active rentals — check-out / check-in</h2>
                <span className="panel-actions">
                  <input
                    type="search"
                    className="form-control form-control-sm"
                    style={{ width: 230 }}
                    placeholder="Find by unit, plate, guest or ref…"
                    value={rentalSearch}
                    onChange={(e) => setRentalSearch(e.target.value)}
                  />
                  {visibleRentals.length} in handover flow
                </span>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead>
                    <tr><th>Guest</th><th>Vehicle / unit</th><th>Window</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {visibleRentals.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-5 text-muted">{rentalSearch.trim() ? `No rentals match "${rentalSearch}".` : 'No vehicles currently on rent.'}</td></tr>
                    ) : (
                      visibleRentals.map((b) => (
                        <Fragment key={b.id}>
                        <tr>
                          <td>
                            <div className="task-name">{b.guestName}</div>
                            <div className="task-sub">{b.ref}</div>
                          </td>
                          <td>
                            <div className="task-name">{b.vehicleName}</div>
                            <div className="task-sub">{b.unitNumber}</div>
                          </td>
                          <td className="task-sub">{formatGuestDate(b.pickupDate)} {b.pickupTime}<br />→ {formatGuestDate(b.dropoffDate)} {b.dropoffTime}</td>
                          <td><span className={`fleet-badge fleet-badge-${b.status}`}>{bookingDisplay(b.status)}</span></td>
                          <td>
                            <div className="d-flex flex-column gap-1 align-items-start">
                            {b.status === 'Confirmed' && (
                              <Link to={`/Fleet/Handover/${b.id}?type=CheckOut`} className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
                                <i className="bi bi-box-arrow-up-right me-1" />Check out
                              </Link>
                            )}
                            {b.status === 'CheckedOut' && (
                              <>
                                {liveMapId === b.id && liveKind === 'booking' ? (
                                  <button type="button" className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#8a3b2f' }} onClick={stopLive}>
                                    <i className="bi bi-stop-circle me-1" />Stop live
                                  </button>
                                ) : (
                                  <button type="button" className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#2f7d4f' }} onClick={() => goLive(b, 'booking')}>
                                    <i className="bi bi-broadcast me-1" />Go live
                                  </button>
                                )}
                                {b.liveTracking || b.livePosition ? (
                                  <span className={`fleet-badge ${b.livePosition ? 'fleet-badge-SignedOff' : 'fleet-badge-Open'}`}>
                                    <i className={`bi ${b.livePosition ? 'bi-geo-alt-fill' : 'bi-hourglass-split'} me-1`} />{b.livePosition ? 'Live on air' : 'Feed starting'}
                                  </span>
                                ) : null}
                                <Link to={`/Fleet/Handover/${b.id}?type=CheckIn`} className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#2f7d4f', display: 'inline-flex' }}>
                                  <i className="bi bi-box-arrow-in-down me-1" />Check in
                                </Link>
                              </>
                            )}
                            {b.status === 'PendingInspection' && (
                              <div className="d-flex flex-column gap-1 align-items-start">
                                <div className="d-flex gap-1 flex-wrap align-items-center">
                                  <span className="fleet-badge fleet-badge-PendingInspection">Returned — pending inspection</span>
                                  {b.returnTiming && (
                                    <span className={`fleet-badge ${b.returnTiming.status === 'Late' ? 'fleet-badge-Open' : b.returnTiming.status === 'OnTime' ? 'fleet-badge-PendingInspection' : 'fleet-badge-SignedOff'}`}>
                                      {b.returnTiming.status === 'Late' ? `Late · ${b.returnTiming.lateHours}h after grace` : b.returnTiming.status === 'OnTime' ? 'On time' : 'Early return'}
                                    </span>
                                  )}
                                </div>
                                <button type="button" className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#355f8c' }} onClick={() => finalizeInspection(b)}>
                                  <i className="bi bi-clipboard-check me-1" />Complete post-rental inspection
                                </button>
                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { setNotice(`Report an incident for ${b.ref} after the return.`); }}>
                                  <i className="bi bi-bug me-1" />Report incident
                                </button>
                              </div>
                            )}
                            {b.status === 'CheckedIn' && (
                              <div className="d-flex flex-column gap-1 align-items-start">
                                <span className="fleet-badge fleet-badge-CheckedIn">Return completed</span>
                                <Link to={`/Fleet/Incident/Report?type=booking&id=${b.id}`} className="btn btn-sm btn-outline-danger">
                                  <i className="bi bi-bug me-1" />Report incident
                                </Link>
                              </div>
                            )}
                            </div>
                          </td>
                        </tr>
                        {liveMapId === b.id && liveKind === 'booking' && b.livePosition && (
                          <tr>
                            <td colSpan="5" style={{ padding: '0.25rem 0.75rem 0.75rem' }}>
                              <FleetMap
                                height={240}
                                markers={[
                                  { lat: b.livePosition.lat, lng: b.livePosition.lng, color: '#355f8c', label: `${b.vehicleName} · live`, follow: true },
                                ]}
                              />
                              <div className="text-muted small mt-1">
                                <span className="live-pulse" />Streaming {b.vehicleName} for {b.guestName} — position refreshes automatically on the guest's My Trips view.
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeSection === 'dispatch' && (
          <>
            <div className="panel-card mb-4">
              <div className="panel-header">
                <h2>Unassigned shuttles</h2>
                <span className="panel-actions">sorted by urgency · {pendingServices.length} waiting</span>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead>
                    <tr><th>Guest</th><th>Trip</th><th>When</th><th>Fare</th><th>Assign</th></tr>
                  </thead>
                  <tbody>
                    {pendingServices.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-5 text-muted">All shuttle requests have drivers.</td></tr>
                    ) : (
                      pendingServices.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="task-name">{s.guestName}</div>
                            <div className="task-sub">{s.ref}</div>
                          </td>
                          <td>
                            <div className="task-name">{s.serviceType}</div>
                            <div className="task-sub">{s.pickupLocation} → {s.destination}</div>
                          </td>
                          <td className="task-sub">{formatGuestDate(s.pickupDate)} {s.pickupTime}</td>
                          <td>{formatPrice(s.estimatedFare)}</td>
                          <td>
                            <div className="d-flex gap-1 align-items-center flex-wrap">
                              <button type="button" className="btn-log" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#355f8c' }} onClick={() => autoMatch(s.id)}
                                title="Smart-match the closest, least busy, best-rated available driver">
                                <i className="bi bi-lightning-charge me-1" />Auto-match
                              </button>
                              <select className="form-select form-select-sm" style={{ width: 150 }} value={dispatchMap[s.id]?.driverId || ''} onChange={(e) => setDispatchMap({ ...dispatchMap, [s.id]: { ...(dispatchMap[s.id] || {}), driverId: e.target.value } })}>
                                <option value="">Driver…</option>
                                {drivers.filter((d) => d.available !== false).map((d) => (
                                  <option key={d.id} value={d.id}>{d.name} (★{d.rating ?? 5})</option>
                                ))}
                              </select>
                              <input className="form-control form-control-sm" style={{ width: 110 }} placeholder="Vehicle unit" value={dispatchMap[s.id]?.vehicleUnit || ''} onChange={(e) => setDispatchMap({ ...dispatchMap, [s.id]: { ...(dispatchMap[s.id] || {}), vehicleUnit: e.target.value } })} />
                              <input className="form-control form-control-sm" style={{ width: 90 }} placeholder="ETA" value={dispatchMap[s.id]?.eta || ''} onChange={(e) => setDispatchMap({ ...dispatchMap, [s.id]: { ...(dispatchMap[s.id] || {}), eta: e.target.value } })} />
                              <button type="button" className="btn-request-start btn-request-done" onClick={() => dispatch(s.id)}>Assign</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header">
                <h2>Active trips — live status</h2>
                <span className="panel-actions">{activeTrips.length} on the road</span>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead>
                    <tr><th>Trip</th><th>Driver / vehicle</th><th>ETA</th><th>Status</th><th>Advance</th></tr>
                  </thead>
                  <tbody>
                    {activeTrips.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-5 text-muted">No active trips right now.</td></tr>
                    ) : (
                      activeTrips.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="task-name">{s.guestName} · {s.serviceType}</div>
                            <div className="task-sub">{s.pickupLocation} → {s.destination}</div>
                          </td>
                          <td>
                            <div className="task-name">{s.driverName || '—'}</div>
                            <div className="task-sub">{s.vehicleUnit || ''}</div>
                          </td>
                          <td className="task-sub text-primary">{s.eta || '—'}</td>
                          <td><span className={`fleet-badge fleet-badge-${s.status}`}>{bookingDisplay(s.status)}</span></td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap align-items-center">
                              <button type="button" className="btn-log" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#355f8c' }} onClick={() => setLiveMapId(s.id)}>
                                <i className="bi bi-geo-alt me-1" />Map
                              </button>
                              {liveWatch && liveMapId === s.id ? (
                                <button type="button" className="btn-log" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#8a3b2f' }} onClick={stopLive}>
                                  <i className="bi bi-stop-circle me-1" />Stop live
                                </button>
                              ) : (
                                <button type="button" className="btn-log" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#2f7d4f' }} onClick={() => goLive(s)}>
                                  <i className="bi bi-broadcast me-1" />Go live
                                </button>
                              )}
                              {s.status === 'Assigned' && <button type="button" className="btn-request-start btn-request-done" onClick={() => advanceTrip(s.id, 'EnRoute')}>En route</button>}
                              {s.status === 'EnRoute' && <button type="button" className="btn-request-start btn-request-done" onClick={() => advanceTrip(s.id, 'Arrived')}>Arrived</button>}
                              {s.status === 'Arrived' && <button type="button" className="btn-request-complete btn-request-done" onClick={() => advanceTrip(s.id, 'Completed')}>Complete</button>}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel-card mt-4">
              <div className="panel-header">
                <h2><i className="bi bi-broadcast me-2" />Live vehicle tracking</h2>
                <span className="panel-actions">{liveMapId ? `showing ${liveTrip?.guestName || 'trip'}` : 'select a trip map to view'}</span>
              </div>
              <div style={{ padding: '1rem' }}>
                {!liveMapId ? (
                  <p className="text-muted mb-0">
                    Press <span className="fleet-code-tag">Map</span> on an active trip, then{' '}
                    <span className="fleet-code-tag">Go live</span> to stream the vehicle's GPS position here and on the guest's trip view.
                  </p>
                ) : (
                  <div className="row g-3">
                    <div className="col-md-8">
                      <FleetMap markers={liveMapMarkers} height={320} />
                      {!liveMapMarkers.length && (
                        <p className="text-muted mt-2 mb-0 text-center small">No coordinates yet — press <b>Go live</b> to start streaming position.</p>
                      )}
                    </div>
                    <div className="col-md-4">
                      <div className="task-name">{liveTrip?.guestName} · {liveTrip?.serviceType}</div>
                      <div className="task-sub mb-2">{liveTrip?.pickupLocation} → {liveTrip?.destination}</div>
                      {liveTrip?.driverName && <div className="task-sub">Driver: <b>{liveTrip.driverName}</b> {liveTrip.eta ? `· ETA ${liveTrip.eta}` : ''}</div>}
                      <div className="task-sub mb-2"><span className={`fleet-badge fleet-badge-${liveTrip?.status}`}>{bookingDisplay(liveTrip?.status)}</span></div>
                      <div className="d-flex gap-2">
                        {liveWatch && liveMapId === liveTrip?.id ? (
                          <button type="button" className="btn-log" style={{ background: '#8a3b2f' }} onClick={stopLive}>Stop live</button>
                        ) : (
                          <button type="button" className="btn-log" style={{ background: '#2f7d4f' }} onClick={() => goLive(liveTrip)}>Go live</button>
                        )}
                        <button type="button" className="btn-log" style={{ background: '#5b51a8' }} onClick={() => setLiveMapId('')}>Close</button>
                      </div>
                      <p className="text-muted small mt-2 mb-0">
                        <i className="bi bi-info-circle me-1" />Position is written to the service record in real time and appears on the guest trip view too.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeSection === 'dispatch' && (
          <div className="panel-card mt-4">
            <div className="panel-header">
              <h2>Driver roster</h2>
              {isManager && <Link to="/Fleet/Manager#drivers" className="panel-link">Manage drivers</Link>}
            </div>
            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '0.75rem' }}>
              {drivers.map((d) => (
                <div className="fleet-driver-card d-flex align-items-center gap-3" key={d.id}>
                  <span className="avatar">{d.name?.charAt(0).toUpperCase()}</span>
                  <div className="flex-grow-1">
                    <div className="task-name">{d.name}</div>
                    <div className="task-sub">Shift {d.shiftStart}–{d.shiftEnd} · ★{d.rating ?? 5}</div>
                  </div>
                  <span className={`fleet-badge ${d.available !== false ? 'fleet-badge-Available' : 'fleet-badge-OutOfService'}`}>
                    {d.available !== false ? 'Available' : 'Off duty'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      {activeSection === 'handovers' && (
          <div className="panel-card mt-4">
            <div className="panel-header">
              <h2><i className="bi bi-arrow-left-right me-2" />Check-in &amp; check-out records</h2>
              <Link to="/Fleet/Handovers" className="panel-link">Open full register →</Link>
            </div>
            <div className="p-3">
              <HandoverRegister />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}