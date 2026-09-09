import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFleetLive } from '../hooks/useFleetLive';
import {
  finalizePostRentalInspection,
  updateBookingLivePosition,
  bookingDisplay,
} from '../services/fleetService';
import FleetMap from '../components/FleetMap';
import { formatGuestDate } from '../lib/utils';
import './maintenance.css';
import './guest.css';
import './fleet.css';

export default function FleetActiveRentals() {
  const { user } = useAuth();
  const { bookings, loading } = useFleetLive();
  const [notice, setNotice] = useState('');
  const [rentalSearch, setRentalSearch] = useState('');
  const [liveMapId, setLiveMapId] = useState('');
  const [liveWatch, setLiveWatch] = useState(null);

  useEffect(() => () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!liveMapId) return;
    if (!bookings.some((b) => b.id === liveMapId)) setLiveMapId('');
  }, [bookings, liveMapId]);

  if (loading) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading active rentals…</p>
      </div></div>
    );
  }

  const rentalBookings = (bookings || []).filter((b) => ['Confirmed', 'CheckedOut', 'PendingInspection', 'CheckedIn'].includes(b.status));
  const visibleRentals = rentalBookings.filter((b) => {
    const q = rentalSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.guestName, b.ref, b.unitNumber, b.plateNumber, b.licenseNumber, b.vehicleName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const byStatus = {
    Confirmed: rentalBookings.filter((b) => b.status === 'Confirmed').length,
    CheckedOut: rentalBookings.filter((b) => b.status === 'CheckedOut').length,
    PendingInspection: rentalBookings.filter((b) => b.status === 'PendingInspection').length,
    CheckedIn: rentalBookings.filter((b) => b.status === 'CheckedIn').length,
  };

  const finalizeInspection = async (b) => {
    setNotice('');
    const res = await finalizePostRentalInspection(b.id, { qualifiedBy: user.name });
    if (res?.error) return setNotice(res.error);
    setNotice(`${b.ref}: post-rental inspection passed — vehicle ${res.vehicleStatus}. Return finalized.`);
  };

  const goLive = (target) => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => updateBookingLivePosition(target.id, { lat: pos.coords.latitude, lng: pos.coords.longitude, on: true }),
        (err) => setNotice(`Geolocation error: ${err.message}`),
        { enableHighAccuracy: true },
      );
      setLiveWatch(watchId);
      setLiveMapId(target.id);
      setNotice(`Live tracking started for ${target.vehicleName || 'the rented vehicle'} — position streams to the guest's My Trips view.`);
    } catch {
      setNotice('Live tracking unavailable in this browser.');
    }
  };

  const stopLive = () => {
    if (liveWatch) navigator.geolocation.clearWatch(liveWatch);
    if (liveMapId) updateBookingLivePosition(liveMapId, { on: false }).catch(() => {});
    setLiveWatch(null);
    setNotice('Live position stream stopped.');
  };

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet Operations · Front Desk</div>
            <h1 className="maint-title">Active Rentals — Check-out / Check-in</h1>
            <p className="task-sub">Hand vehicles out, follow live returns, and complete post-rental inspections from one place.</p>
          </div>
          <Link to="/Fleet/RentalQueue" className="btn-log" style={{ background: '#8a640e', whiteSpace: 'nowrap' }}>
            <i className="bi bi-hourglass-split me-2" />Rental queue →
          </Link>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="metric-grid">
          {[
            { n: byStatus.Confirmed, label: 'Awaiting check-out', icon: 'bi-box-arrow-up-right', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
            { n: byStatus.CheckedOut, label: 'On rental', icon: 'bi-car-front', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
            { n: byStatus.PendingInspection, label: 'Pending inspection', icon: 'bi-clipboard-check', bg: 'linear-gradient(135deg,#433c7d,#2d2e66)' },
            { n: byStatus.CheckedIn, label: 'Returned', icon: 'bi-box-arrow-in-down', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
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

        <div className="panel-card mt-4">
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
                        <div className="task-name">{b.guestName} {b.guestArrived && <span className={`fleet-badge ${b.guestArrived ? 'fleet-badge-SignedOff' : ''}`} style={{ marginLeft: 6 }}><i className="bi bi-person-check-fill me-1" />Arrived</span>}</div>
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
                            {liveMapId === b.id ? (
                              <button type="button" className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#8a3b2f' }} onClick={stopLive}>
                                <i className="bi bi-stop-circle me-1" />Stop live
                              </button>
                            ) : (
                              <button type="button" className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#2f7d4f' }} onClick={() => goLive(b)}>
                                <i className="bi bi-broadcast me-1" />Go live
                              </button>
                            )}
                            {b.liveTracking || b.livePosition ? (
                              <span className={`fleet-badge ${b.livePosition ? 'fleet-badge-SignedOff' : 'fleet-badge-Open'}`}>
                                <i className={`bi ${b.livePosition ? 'bi-geo-alt-fill' : 'bi-hourglass-split'} me-1`} />{b.livePosition ? 'Live on air' : 'Feed starting'}
                              </span>
                            ) : null}
                            <Link to={`/Fleet/ReturnFlow/${b.id}`} className="btn-log" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#2f7d4f', display: 'inline-flex' }}>
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
                            <Link to={`/Fleet/Incident/Report?type=booking&id=${b.id}`} className="btn btn-sm btn-outline-danger">
                              <i className="bi bi-bug me-1" />Report incident
                            </Link>
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
                    {liveMapId === b.id && b.livePosition && (
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
      </div>
    </div>
  );
}