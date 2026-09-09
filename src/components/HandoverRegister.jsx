import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFleetLive } from '../hooks/useFleetLive';
import { createFleetWorkOrder, bookingDisplay } from '../services/fleetService';
import { formatDateTime, formatGuestDate } from '../lib/utils';
import CarViewer3D from './CarViewer3D';
import '../pages/fleet.css';

const TABS = [
  { key: 'all', label: 'All', icon: 'bi-archive' },
  { key: 'out', label: 'Checked Out', icon: 'bi-box-arrow-right' },
  { key: 'in', label: 'Checked In', icon: 'bi-box-arrow-in-down' },
  { key: 'damaged', label: 'Damaged', icon: 'bi-exclamation-triangle' },
];

export default function HandoverRegister() {
  const { user } = useAuth();
  const { handovers, bookings, vehicles, workOrders } = useFleetLive();
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState('');
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const list = useMemo(() => {
    const bs = Array.isArray(bookings) ? bookings : [];
    const vs = Array.isArray(vehicles) ? vehicles : [];
    return (Array.isArray(handovers) ? handovers : []).map((h) => {
      const booking = bs.find((b) => b.id === h.bookingId);
      const byBookingVehicle = booking?.vehicleId ? vs.find((v) => v.id === booking.vehicleId) : null;
      const vehicle = byBookingVehicle || vs.find((v) => v.unitNumber === h.unitNumber);
      const wo = (Array.isArray(workOrders) ? workOrders : []).find((w) => w.handoverId === h.id);
      const damages = h.variance?.damages || [];
      const damaged = damages.length > 0 || h.damageCheck?.flagged === true || h.notesDamage;
      return { ...h, booking, vehicle, damages, damaged, workOrder: wo };
    });
  }, [handovers, bookings, vehicles, workOrders]);

  const filtered = list.filter((h) => {
    if (tab === 'out') return h.handoverType === 'CheckOut';
    if (tab === 'in') return h.handoverType === 'CheckIn';
    if (tab === 'damaged') return h.damaged;
    return true;
  });

  const assignToMaintenance = async (h) => {
    setError('');
    setNotice('');
    setBusyId(h.id);
    const res = await createFleetWorkOrder({
      source: 'CheckIn',
      title: `Damage at check-in — ${h.vehicle?.name || h.booking?.vehicleName || 'vehicle'}`,
      description: [
        (h.damages?.length ? `Damages recorded on check-in: ${h.damages.join(', ')}` : 'Damage flagged at check-in (pixel comparison).'),
        h.notes ? `Notes: ${h.notes}` : '',
      ].filter(Boolean).join(' · '),
      vehicleId: h.vehicle?.id || h.booking?.vehicleId || '',
      vehicleName: h.vehicle?.name || h.booking?.vehicleName || '',
      unitNumber: h.unitNumber || '',
      priority: h.damageCheck?.flagged ? 'High' : 'Normal',
      handoverId: h.id,
      handoverType: 'CheckIn',
      createdBy: user?.name || 'Front Desk',
    });
    setBusyId('');
    if (res?.error) return setError(res.error);
    setNotice(`Unit assigned to maintenance — work order ${res.ref} opened and the vehicle is off the road.`);
  };

  const openExpand = (id) => setExpanded(expanded === id ? '' : id);

  return (
    <div>
      {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

      <div className="d-flex gap-2 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`lux-btn ${tab === t.key ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setTab(t.key)}>
            <i className={`bi ${t.icon} me-2`} />{t.label} ({t.key === 'all' ? list.length : t.key === 'out' ? list.filter((h) => h.handoverType === 'CheckOut').length : t.key === 'in' ? list.filter((h) => h.handoverType === 'CheckIn').length : list.filter((h) => h.damaged).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="dash-empty"><i className="bi bi-inboxes me-2" />No handover records in this view yet.</div>
      ) : (
        filtered.map((h) => (
          <div key={h.id} className="handover-card mb-2">
            <div className="fleet-row" style={{ alignItems: 'flex-start' }}>
              <button type="button" className="btn p-0 border-0" onClick={() => setPreview({ src: h.photos?.[0] || (h.vehicle?.image || ''), title: `${h.vehicle?.name || h.unitNumber || 'Car'} — ${h.handoverType}` })}>
                {h.photos?.[0] ? (
                  <img src={h.photos[0]} alt="Captured" className="handover-photo-img" />
                ) : h.vehicle?.image ? (
                  <img src={h.vehicle.image} alt={h.vehicle.name} className="handover-photo-img" />
                ) : (
                  <span className="fleet-thumb"><i className={h.handoverType === 'CheckOut' ? 'bi bi-car-front' : 'bi bi-box-arrow-in-down'} /></span>
                )}
              </button>
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className={`fleet-badge ${h.handoverType === 'CheckOut' ? 'fleet-badge-CheckedOut' : 'fleet-badge-CheckedIn'}`}>{h.handoverType}</span>
                  <span className="fw-bold">{h.vehicle?.name || h.booking?.vehicleName || 'Vehicle'}</span>
                  <span className="text-muted small">unit {h.unitNumber || '—'}</span>
                  {h.booking && <span className="text-muted small">{h.booking.ref}</span>}
                  {h.handoverType === 'CheckIn' && h.damaged ? (
                    <span className="fleet-badge fleet-badge-Cancelled"><i className="bi bi-exclamation-triangle me-1" />Damage → maintenance</span>
                  ) : h.handoverType === 'CheckIn' ? (
                    <span className="fleet-badge fleet-badge-SignedOff">Returned clean</span>
                  ) : null}
                  {h.workOrder && (
                    <Link to="/Fleet/Maintenance" className="text-decoration-none">
                      <span className="fleet-badge fleet-badge-InProgress"><i className="bi bi-wrench me-1" />{h.workOrder.ref} · {bookingDisplay(h.workOrder.status)}</span>
                    </Link>
                  )}
                </div>
                <div className="dash-row-meta mt-1">
                  <span><i className="bi bi-person me-1" />{h.booking?.guestName || '—'}</span>
                  <span><i className="bi bi-pencil me-1" />{h.signedBy || 'Front Desk'}</span>
                  <span><i className="bi bi-clock me-1" />{formatDateTime(h.createdAt)}</span>
                </div>
                <div className="dash-row-meta flex-wrap">
                  <span><i className="bi bi-fuel-pump me-1" />Fuel {h.fuelLevel}%</span>
                  <span><i className="bi bi-speedometer me-1" />{Number(h.mileage || 0).toLocaleString()} km</span>
                  {h.booking?.pickupDate && <span><i className="bi bi-calendar me-1" />{formatGuestDate(h.booking.pickupDate)}</span>}
                  {h.handoverType === 'CheckIn' && h.variance && (
                    <>
                      {h.variance.fuelDelta > 0 && <span className="text-muted">fuel −{h.variance.fuelDelta}%</span>}
                      {h.variance.mileageDelta > 0 && <span className="text-muted">+{h.variance.mileageDelta.toLocaleString()} km</span>}
                    </>
                  )}
                </div>
                {h.damages.length > 0 && (
                  <div className="d-flex gap-1 flex-wrap mt-1">
                    {h.damages.map((d) => (
                      <span key={d} className="lint-tag" style={{ background: '#fff1f1', color: '#a33a2d' }}><i className="bi bi-exclamation-triangle me-1" />{d}</span>
                    ))}
                    {h.damageCheck?.flagged && <span className="lint-tag" style={{ background: '#fff1f1', color: '#a33a2d' }}>Pixel compare flagged</span>}
                  </div>
                )}
                {h.notes && <div className="dash-row-meta small text-muted" style={{ maxWidth: 680 }}>{h.notes}</div>}

                <div className="d-flex gap-2 flex-wrap mt-2">
                  {h.booking && (
                    <Link
                      to={`/Fleet/Handover/${h.booking.id}?type=${h.handoverType === 'CheckOut' ? 'CheckOut' : 'CheckIn'}`}
                      className="btn btn-sm btn-outline-dark"
                    >
                      <i className="bi bi-box-arrow-up-right me-1" />Open handover record
                    </Link>
                  )}
                  {h.damaged && h.handoverType === 'CheckIn' && !h.workOrder && (
                    <button type="button" className="btn btn-sm btn-danger" disabled={busyId === h.id} onClick={() => assignToMaintenance(h)}>
                      <i className="bi bi-wrench-adjustable me-1" />Assign to maintenance
                    </button>
                  )}
                  {(h.photos?.length > 0 || (h.vehicle?.image && h.damaged)) && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openExpand(h.id)}>
                      <i className={`bi ${expanded === h.id ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`} />{expanded === h.id ? 'Hide' : 'Photos & 3D view'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {expanded === h.id && (
              <div className="p-3 border-top">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="book-label mb-2"><i className="bi bi-camera me-1" />Captured photos ({h.photos?.length || 0})</div>
                    {h.photos?.length ? (
                      <div className="d-flex flex-wrap gap-2">
                        {h.photos.map((p, i) => (
                          <button key={i} type="button" className="btn p-0 border-0" onClick={() => setPreview({ src: p, title: `Captured photo ${i + 1}` })}>
                            <img src={p} alt="Captured" className="handover-photo-img" style={{ width: 90, height: 90, margin: 0 }} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="task-sub mb-0">No photos captured at this handover.</p>
                    )}
                  </div>
                  <div className="col-md-6">
                    {h.vehicle?.image ? (
                      <>
                        <div className="book-label mb-2"><i className="bi bi-box-arrow-up-right me-1" />3D view · {h.vehicle.name}</div>
                        <CarViewer3D image={h.vehicle.image} label={h.vehicle.name} size={230} />
                      </>
                    ) : (
                      <p className="task-sub mb-0">No gallery photo on file for this unit.</p>
                    )}
                  </div>
                </div>
                {h.handoverType === 'CheckIn' && h.workOrder && (
                  <div className="dash-notice mt-2" style={{ margin: '0.75rem 0 0' }}>
                    <i className="bi bi-wrench me-2" />Linked work order <strong>{h.workOrder.ref}</strong> — status {bookingDisplay(h.workOrder.status)}. <Link to="/Fleet/Maintenance" className="text-decoration-none fw-bold">Open work orders →</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {preview && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15,20,35,0.75)' }} onClick={() => setPreview(null)}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h5 className="modal-title">{preview.title}</h5>
                <button type="button" className="btn-close" onClick={() => setPreview(null)} />
              </div>
              <div className="modal-body p-0">
                <img src={preview.src} alt={preview.title} className="w-100" style={{ maxHeight: '70vh', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}