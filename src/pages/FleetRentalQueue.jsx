import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFleetLive } from '../hooks/useFleetLive';
import { confirmCarBooking, bookingDisplay } from '../services/fleetService';
import { formatPrice, formatGuestDate } from '../lib/utils';
import './maintenance.css';
import './guest.css';
import './fleet.css';

export default function FleetRentalQueue() {
  const { user } = useAuth();
  const { vehicles, bookings, loading } = useFleetLive();
  const [confirmUnit, setConfirmUnit] = useState({});
  const [overrideNote, setOverrideNote] = useState({});
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('success');

  if (loading) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading rental requests…</p>
      </div></div>
    );
  }

  const pendingBookings = (bookings || []).filter((b) => b.status === 'PendingConfirmation');
  const bookableVehicles = (vehicles || []).filter((v) => v.status === 'Available');

  const confirm = async (id) => {
    setNotice('');
    setNoticeTone('success');
    const selectedVehicleId = confirmUnit[id];
    if (!selectedVehicleId) return show('Select a vehicle unit to assign before confirming.', 'danger');
    const selectedVehicle = bookableVehicles.find((v) => v.id === selectedVehicleId);
    if (!selectedVehicle) return show('That vehicle is no longer available — pick another.', 'danger');
    const unitNumber = selectedVehicle.unitNumber || selectedVehicle.plateNumber || selectedVehicle.name;
    const res = await confirmCarBooking(id, { unitNumber, vehicleId: selectedVehicle.id, assignedBy: user.name, overrideNote: overrideNote[id] });
    if (res?.error) return show(res.error, 'danger');
    show('Booking confirmed — vehicle locked for the rental window.', 'success');
  };

  const show = (msg, tone) => { setNotice(msg); setNoticeTone(tone); };

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet Operations · Front Desk</div>
            <h1 className="maint-title">Rental Requests Queue</h1>
            <p className="task-sub">Review each request, note any documents or risk flags, assign a unit and confirm the booking.</p>
          </div>
          <Link to="/Fleet/ActiveRentals" className="btn-log" style={{ background: '#355f8c', whiteSpace: 'nowrap' }}>
            <i className="bi bi-car-front me-2" />Active rentals →
          </Link>
        </div>

        {notice && <div className={`lost-alert lost-alert-${noticeTone} mb-3`}><i className="bi bi-info-circle me-2" />{notice}</div>}

        <div className="metric-grid">
          {[
            { n: pendingBookings.length, label: 'Waiting confirmation', icon: 'bi-hourglass-split', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
            { n: bookableVehicles.length, label: 'Available units', icon: 'bi-car-front', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
            { n: pendingBookings.filter((b) => b.documentReviewRequired).length, label: 'Docs to review', icon: 'bi-file-earmark-lock', bg: 'linear-gradient(135deg,#433c7d,#2d2e66)' },
            { n: pendingBookings.filter((b) => b.riskFlag).length, label: 'High-risk to override', icon: 'bi-shield-exclamation', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
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
                  <tr><td colSpan="6" className="text-center py-5 text-muted">
                    <i className="bi bi-check-circle me-2" />No rental requests waiting. New bookings appear here automatically.
                  </td></tr>
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
                                <option key={v.id} value={v.id}>{v.name} · {v.unitNumber || v.plateNumber}</option>
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
      </div>
    </div>
  );
}