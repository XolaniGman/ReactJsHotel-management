import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeCarBookings, subscribeVehicleHandovers, bookingDisplay } from '../services/fleetService';
import { formatGuestDate, formatDateTime } from '../lib/utils';
import './guest.css';
import './fleet.css';
import './maintenance.css';

const TABS = [
  { key: 'booked', label: 'Booked cars', icon: 'bi-calendar-check' },
  { key: 'checkedout', label: 'Checked-out cars', icon: 'bi-box-arrow-right' },
  { key: 'checkedin', label: 'Checked-in cars', icon: 'bi-box-arrow-in-down' },
  { key: 'damaged', label: 'Damaged cars', icon: 'bi-exclamation-triangle' },
];

export default function FleetRecords() {
  const [bookings, setBookings] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [tab, setTab] = useState('booked');

  useEffect(() => subscribeCarBookings(setBookings), []);
  useEffect(() => subscribeVehicleHandovers(setHandovers), []);

  const bookingById = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { map[b.id] = b; });
    return map;
  }, [bookings]);

  const checkOuts = useMemo(
    () => handovers.filter((h) => h.handoverType === 'CheckOut').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [handovers],
  );
  const checkIns = useMemo(
    () => handovers.filter((h) => h.handoverType === 'CheckIn').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [handovers],
  );

  const damagedRows = useMemo(() => {
    const rows = [];
    handovers.forEach((h) => {
      const booking = bookingById[h.bookingId];
      const preExisting = (h.items || []).filter((it) => it.condition === 'Damaged' || it.damaged);
      const returnVariance = h.variance?.damages || [];
      if (h.handoverType === 'CheckOut' && preExisting.length > 0) {
        rows.push({
          id: `${h.id}-out`,
          when: h.createdAt,
          stage: 'Pre-existing · at checkout',
          vehicle: booking?.vehicleName || h.unitNumber || '—',
          unitNumber: h.unitNumber || '—',
          guestName: booking?.guestName || '—',
          recordedBy: h.signedBy || '—',
          items: preExisting.map((i) => i.label || i.name),
          override: h.damageOverride || null,
        });
      }
      if (h.handoverType === 'CheckIn' && (returnVariance.length > 0 || h.damageCheck?.flagged)) {
        rows.push({
          id: `${h.id}-in`,
          when: h.createdAt,
          stage: 'Found at check-in',
          vehicle: booking?.vehicleName || h.unitNumber || '—',
          unitNumber: h.unitNumber || '—',
          guestName: booking?.guestName || '—',
          recordedBy: h.signedBy || '—',
          items: returnVariance.length > 0 ? returnVariance : ['Pixel-compare flagged'],
          override: null,
        });
      }
    });
    return rows.sort((a, b) => (b.when || 0) - (a.when || 0));
  }, [handovers, bookingById]);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => (b.history?.[0]?.at || 0) - (a.history?.[0]?.at || 0)),
    [bookings],
  );

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet · Vehicle Records</div>
            <h1 className="maint-title">Booked, checked-out, checked-in &amp; damaged cars</h1>
          </div>
          <div className="d-flex gap-2">
            <Link to="/Fleet/Dashboard" className="btn-log" style={{ background: '#355f8c' }}><i className="bi bi-kanban me-2" />Fleet Ops</Link>
            <Link to="/Fleet/Handovers" className="btn-log" style={{ background: '#433c7d' }}><i className="bi bi-arrow-left-right me-2" />Handover Register</Link>
          </div>
        </div>

        <div className="metric-grid mb-4">
          {[
            { n: bookings.length, label: 'Total bookings', icon: 'bi-calendar-check', bg: 'linear-gradient(135deg,#8a6d1f,#6b5216)' },
            { n: checkOuts.length, label: 'Cars checked out', icon: 'bi-box-arrow-right', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
            { n: checkIns.length, label: 'Cars checked in', icon: 'bi-box-arrow-in-down', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
            { n: damagedRows.length, label: 'Damage records', icon: 'bi-exclamation-triangle', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
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

        <div className="d-flex gap-2 mb-3 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`lux-btn ${tab === t.key ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'booked' && (
          <div className="panel-card">
            <div className="panel-header">
              <h2><i className="bi bi-calendar-check me-2" />Booked cars</h2>
              <span className="panel-actions">{bookings.length} booking(s) on file</span>
            </div>
            <div className="table-responsive">
              <table className="task-table">
                <thead>
                  <tr><th>Ref</th><th>Vehicle / unit</th><th>Guest</th><th>Window</th><th>Status</th><th>Confirmed by</th></tr>
                </thead>
                <tbody>
                  {sortedBookings.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-5 text-muted">No bookings yet.</td></tr>
                  ) : (
                    sortedBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="task-sub">{b.ref}</td>
                        <td>
                          <div className="task-name">{b.vehicleName}</div>
                          <div className="task-sub">{b.unitNumber || '—'}</div>
                        </td>
                        <td className="task-sub">{b.guestName}</td>
                        <td className="task-sub">{formatGuestDate(b.pickupDate)} {b.pickupTime}<br />→ {formatGuestDate(b.dropoffDate)} {b.dropoffTime}</td>
                        <td><span className={`fleet-badge fleet-badge-${b.status}`}>{bookingDisplay(b.status)}</span></td>
                        <td className="task-sub">{b.assignedBy || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'checkedout' && (
          <div className="panel-card">
            <div className="panel-header">
              <h2><i className="bi bi-box-arrow-right me-2" />Checked-out cars</h2>
              <span className="panel-actions">{checkOuts.length} checkout(s) on file</span>
            </div>
            <div className="table-responsive">
              <table className="task-table">
                <thead>
                  <tr><th>Vehicle / unit</th><th>Guest</th><th>Checked out by</th><th>Fuel / mileage</th><th>Guest signature</th><th>When</th></tr>
                </thead>
                <tbody>
                  {checkOuts.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-5 text-muted">No check-outs recorded yet.</td></tr>
                  ) : (
                    checkOuts.map((h) => {
                      const booking = bookingById[h.bookingId];
                      return (
                        <tr key={h.id}>
                          <td>
                            <div className="task-name">{booking?.vehicleName || '—'}</div>
                            <div className="task-sub">{h.unitNumber || '—'}</div>
                          </td>
                          <td className="task-sub">{booking?.guestName || '—'}</td>
                          <td className="task-sub">{h.signedBy || '—'}</td>
                          <td className="task-sub">{h.fuelLevel}% · {Number(h.mileage || 0).toLocaleString()} km</td>
                          <td className="task-sub">{h.guestSignature || '—'}</td>
                          <td className="task-sub">{formatDateTime(h.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'checkedin' && (
          <div className="panel-card">
            <div className="panel-header">
              <h2><i className="bi bi-box-arrow-in-down me-2" />Checked-in cars</h2>
              <span className="panel-actions">{checkIns.length} check-in(s) on file</span>
            </div>
            <div className="table-responsive">
              <table className="task-table">
                <thead>
                  <tr><th>Vehicle / unit</th><th>Guest</th><th>Checked in by</th><th>Fuel / mileage</th><th>Damage found</th><th>When</th></tr>
                </thead>
                <tbody>
                  {checkIns.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-5 text-muted">No check-ins recorded yet.</td></tr>
                  ) : (
                    checkIns.map((h) => {
                      const booking = bookingById[h.bookingId];
                      const flagged = (h.variance?.damages?.length || 0) > 0 || h.damageCheck?.flagged;
                      return (
                        <tr key={h.id}>
                          <td>
                            <div className="task-name">{booking?.vehicleName || '—'}</div>
                            <div className="task-sub">{h.unitNumber || '—'}</div>
                          </td>
                          <td className="task-sub">{booking?.guestName || '—'}</td>
                          <td className="task-sub">{h.signedBy || '—'}</td>
                          <td className="task-sub">{h.fuelLevel}% · {Number(h.mileage || 0).toLocaleString()} km</td>
                          <td>
                            {flagged ? (
                              <span className="fleet-badge fleet-badge-Cancelled"><i className="bi bi-exclamation-triangle me-1" />Yes</span>
                            ) : (
                              <span className="fleet-badge fleet-badge-SignedOff">No</span>
                            )}
                          </td>
                          <td className="task-sub">{formatDateTime(h.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'damaged' && (
          <div className="panel-card">
            <div className="panel-header">
              <h2><i className="bi bi-exclamation-triangle me-2" />Damaged cars</h2>
              <span className="panel-actions">{damagedRows.length} damage record(s) on file</span>
            </div>
            <div className="table-responsive">
              <table className="task-table">
                <thead>
                  <tr><th>Stage</th><th>Vehicle / unit</th><th>Guest</th><th>Recorded by</th><th>Damage</th><th>Override reason</th><th>When</th></tr>
                </thead>
                <tbody>
                  {damagedRows.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-5 text-muted">No damage recorded yet.</td></tr>
                  ) : (
                    damagedRows.map((d) => (
                      <tr key={d.id}>
                        <td className="task-sub">{d.stage}</td>
                        <td>
                          <div className="task-name">{d.vehicle}</div>
                          <div className="task-sub">{d.unitNumber}</div>
                        </td>
                        <td className="task-sub">{d.guestName}</td>
                        <td className="task-sub">{d.recordedBy}</td>
                        <td className="task-sub">{d.items.join(', ')}</td>
                        <td className="task-sub">
                          {d.override ? (
                            <>
                              <div>{d.override.reason}</div>
                              <div className="text-muted">by {d.override.byName} ({d.override.byRole})</div>
                            </>
                          ) : '—'}
                        </td>
                        <td className="task-sub">{formatDateTime(d.when)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
