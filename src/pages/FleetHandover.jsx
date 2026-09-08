import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCarBooking, recordVehicleHandover } from '../services/fleetService';
import { listVehicleHandovers } from '../services/fleetService';
import DamageCompare from '../components/DamageCompare';
import { formatPrice, formatGuestDate, fileToDataUrl } from '../lib/utils';
import { HANDOVER_ITEMS } from '../lib/constants';
import './guest.css';
import './maintenance.css';
import './fleet.css';

const defaultItems = () =>
  HANDOVER_ITEMS.map((label) => ({ label, condition: 'Good', damaged: false }));

export default function FleetHandover() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') === 'CheckIn' ? 'CheckIn' : 'CheckOut';
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState('');
  const [items, setItems] = useState(defaultItems());
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [signedBy, setSignedBy] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [handovers, setHandovers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [damageResult, setDamageResult] = useState(null);

  const out = booking?.handoverOut;

  useEffect(() => {
    (async () => {
      const b = await getCarBooking(id);
      setBooking(b);
      if (type === 'CheckIn' && b?.handoverOut) {
        setFuelLevel(b.handoverOut.fuelLevel ?? 100);
        setMileage(b.handoverOut.mileage ?? '');
      }
      setHandovers(await listVehicleHandovers());
    })();
  }, [id, type]);

  const setItem = (idx, patch) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await fileToDataUrl(file, 1000);
    setPhotos((prev) => [...prev, data]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!booking) return;
    if (!mileage || Number(mileage) < 0) return setError('Please enter the current odometer reading.');
    setSubmitting(true);
    await recordVehicleHandover({
      bookingId: booking.id,
      handoverType: type,
      unitNumber: booking.unitNumber || '',
      fuelLevel,
      mileage,
      items,
      notes,
      photos,
      signedBy: signedBy || user?.name || 'Front Desk',
      reservationId: booking.reservationId || '',
      damageCheck: damageResult,
    });
    setSubmitting(false);
    setSuccess(
      type === 'CheckOut'
        ? `Vehicle handed out. Guest signed the digital checklist. Booking is now Checked Out.`
        : `Vehicle re-checked. A variance report has been generated against the check-out record.`,
    );
    const b = await getCarBooking(booking.id);
    setBooking(b);
    setHandovers(await listVehicleHandovers());
  };

  if (!booking) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading booking…</p>
      </div></div>
    );
  }

  const damages = (booking.variance?.damages) || [];

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Vehicle Handover</div>
            <h1 className="maint-title">{type === 'CheckOut' ? 'Check-out' : 'Check-in'} · {booking.vehicleName}</h1>
          </div>
          <Link to="/Fleet/Dashboard" className="btn-log" style={{ background: '#355f8c' }}>
            <i className="bi bi-arrow-left me-2" />Fleet Ops
          </Link>
        </div>

        {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
        {success && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{success}</div>}

        <div className="panel-card mb-4">
          <div className="panel-header">
            <h2>Booking {booking.ref}</h2>
            <span className={`fleet-badge fleet-badge-${booking.status}`}>{booking.status}</span>
          </div>
          <div className="p-3">
            <div className="row g-2 text-muted small">
              <div className="col-md-3"><strong className="text-dark d-block">Guest</strong>{booking.guestName}</div>
              <div className="col-md-3"><strong className="text-dark d-block">Unit</strong>{booking.unitNumber || '—'}</div>
              <div className="col-md-3"><strong className="text-dark d-block">Window</strong>{formatGuestDate(booking.pickupDate)} {booking.pickupTime} → {formatGuestDate(booking.dropoffDate)} {booking.dropoffTime}</div>
              <div className="col-md-3"><strong className="text-dark d-block">Estimated total</strong>{formatPrice(booking.estimatedTotal)}</div>
            </div>
            {out && (
              <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                <i className="bi bi-info-circle me-2" />
                Check-out record: fuel <strong>{out.fuelLevel}%</strong> · mileage <strong>{out.mileage} km</strong>
              </div>
            )}
            {damages.length > 0 && (
              <div className="lost-alert lost-alert-danger mt-3" style={{ margin: '1rem 0 0' }}>
                <i className="bi bi-exclamation-triangle me-2" />Variance report — new damages detected: {damages.join(', ')}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="panel-card">
                <div className="panel-header"><h2>Condition checklist</h2></div>
                <div className="table-responsive">
                  <table className="task-table">
                    <thead><tr><th>Item</th><th>Condition</th></tr></thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.label}>
                          <td className="task-name">{it.label}</td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {['Good', 'Damaged', 'N/A'].map((c) => (
                                <button
                                  type="button"
                                  key={c}
                                  className={`btn btn-sm ${it.condition === c ? (c === 'Damaged' ? 'btn-danger' : 'btn-success') : 'btn-outline-secondary'}`}
                                  onClick={() => setItem(idx, { condition: c, damaged: c === 'Damaged' })}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel-card mt-4">
                <div className="panel-header">
                  <h2>Photos ({photos.length}/3)</h2>
                  <span className="panel-actions">{type === 'CheckIn' ? 'compare against the check-out photo' : ''}</span>
                </div>
                <div className="p-3">
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={p} alt={`Vehicle ${i + 1}`} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10 }} />
                        <button type="button" className="btn btn-sm btn-danger" style={{ position: 'absolute', top: -6, right: -6, padding: '0 6px' }} onClick={() => setPhotos(photos.filter((_, x) => x !== i))}>×</button>
                      </div>
                    ))}
                    {photos.length < 3 && (
                      <label className="d-flex align-items-center justify-content-center border rounded-3" style={{ width: 90, height: 90, cursor: 'pointer', color: '#775a19' }}>
                        <i className="bi bi-camera" />
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
                      </label>
                    )}
                  </div>
                  {type === 'CheckIn' && out?.photos?.length > 0 && (
                    <div className="mb-3">
                      <div className="book-label mb-2"><i className="bi bi-ui-checks me-1" />AI damage check (pixel comparison)</div>
                      <DamageCompare onResult={setDamageResult} />
                    </div>
                  )}
                  <label className="book-label" htmlFor="HandoverNotes">Notes</label>
                  <textarea id="HandoverNotes" className="form-control book-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Scuff on rear bumper noted at speed bumps…" />
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="panel-card">
                <div className="panel-header"><h2>Meter &amp; fuel</h2></div>
                <div className="p-3">
                  <label className="book-label" htmlFor="Mileage">Odometer (km)</label>
                  <input id="Mileage" type="number" min="0" className="form-control book-input" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={String(out?.mileage ?? booking.mileage ?? '')} />
                  {booking.mileage !== undefined && (
                    <div className="task-sub mt-1">Vehicle recorded at {Number(booking.mileage)?.toLocaleString?.()} km on file</div>
                  )}
                  <label className="book-label mt-3" htmlFor="Fuel">Fuel level (%)</label>
                  <input id="Fuel" type="range" min="0" max="100" step="5" className="form-range" value={fuelLevel} onChange={(e) => setFuelLevel(Number(e.target.value))} />
                  <div className="d-flex justify-content-between">
                    <span className="task-sub">{fuelLevel}%</span>
                    {out && <span className="task-sub">was {out.fuelLevel}%</span>}
                  </div>
                </div>
              </div>

              <div className="panel-card mt-4">
                <div className="panel-header"><h2>Digital sign-off</h2></div>
                <div className="p-3">
                  <label className="book-label" htmlFor="SignedBy">Signed by</label>
                  <input id="SignedBy" className="form-control book-input" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder={type === 'CheckOut' ? `${booking.guestName} + Front Desk` : 'Front Desk'} />
                  <p className="task-sub mt-2"><i className="bi bi-pencil-square me-1" />Recording a {type === 'CheckOut' ? 'handover' : 'return'} checklist confirms that {type === 'CheckOut' ? 'the guest received' : 'the hotel received'} the vehicle in this condition.</p>
                  <button type="submit" className="book-submit mt-3 w-100" disabled={submitting}>
                    <i className="bi bi-clipboard-check me-2" />{submitting ? 'Saving…' : `Complete ${type === 'CheckOut' ? 'check-out' : 'check-in'}`}
                  </button>
                  <div className="text-muted small mt-2 text-center">
                    {type === 'CheckIn' && 'On check-in, damages, fuel and mileage variances are routed to billing.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {handovers.filter((h) => h.bookingId === booking.id).length > 0 && (
          <div className="panel-card mt-4">
            <div className="panel-header"><h2>Handover history</h2></div>
            {handovers.filter((h) => h.bookingId === booking.id).map((h) => (
              <div className="fleet-row" key={h.id}>
                <span className={`fleet-thumb ${h.handoverType === 'CheckOut' ? '' : ''}`}><i className={h.handoverType === 'CheckOut' ? 'bi bi-car-front' : 'bi bi-box-arrow-in-down'} /></span>
                <div className="flex-grow-1">
                  <div className="task-name">{h.handoverType} · {h.signedBy}</div>
                  <div className="task-sub">Fuel {h.fuelLevel}% · {h.mileage} km · {new Date(h.createdAt).toLocaleString('en-ZA')}</div>
                  {h.notes && <div className="task-sub">{h.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}