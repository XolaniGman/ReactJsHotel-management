import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getCarBooking,
  subscribeCarBooking,
  recordVehicleHandover,
  getFleetVehicleForBooking,
  listFleetVehicles,
  updateHandoverStep,
  verifyDriverLicence,
  overrideLicenceVerification,
  acquireCheckoutLock,
  releaseCheckoutLock,
  reassignBookingVehicle,
} from '../services/fleetService';
import { listVehicleHandovers } from '../services/fleetService';
import DamageCompare from '../components/DamageCompare';
import CarViewer3D from '../components/CarViewer3D';
import { formatPrice, formatGuestDate, formatDateTime, fileToDataUrl, round } from '../lib/utils';
import { HANDOVER_ITEMS, FLEET_BRANCHES, HIGH_RISK_EXTRA_HOLD } from '../lib/constants';
import { branchById, lateReturnCharges, fuelVarianceCharge, oneWayFee } from '../lib/fleetAlgo';
import './guest.css';
import './maintenance.css';
import './fleet.css';

const defaultItems = () =>
  HANDOVER_ITEMS.map((label) => ({ label, condition: 'Good', damaged: false }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const [guestSignature, setGuestSignature] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [handovers, setHandovers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [damageResult, setDamageResult] = useState(null);
  const [waiveExtraHold, setWaiveExtraHold] = useState(false);
  const [waiveNote, setWaiveNote] = useState('');
  const [returnBranchId, setReturnBranchId] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const [guestSignsOnPhone, setGuestSignsOnPhone] = useState(() => false);
  const [agreementIssuedAt, setAgreementIssuedAt] = useState(null);

  // ---- Gate 1: licence verification (simulated service, real local checks) ----
  const [licenceChecking, setLicenceChecking] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  // ---- Gate 2 fallout: reassign a different unit after a damage block ----
  const [allVehicles, setAllVehicles] = useState([]);
  const [reassignVehicleId, setReassignVehicleId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // ---- Concurrency lock ----
  const [lockInfo, setLockInfo] = useState(null);

  const out = booking?.handoverOut;

  useEffect(() => {
    const unsub = subscribeCarBooking(id, setBooking);
    (async () => {
      setHandovers(await listVehicleHandovers());
      setAllVehicles(await listFleetVehicles());
      const b = await getCarBooking(id);
      if (type === 'CheckIn' && b?.handoverOut) {
        setFuelLevel(b.handoverOut.fuelLevel ?? 100);
        setMileage(b.handoverOut.mileage ?? '');
        setReturnBranchId(b.returnBranchId || b.pickupBranchId || 'main');
      }
      if (b) setVehicle(await getFleetVehicleForBooking(b));
      if (type === 'CheckOut' && b?.status === 'Confirmed') {
        updateHandoverStep(b.id, 'verification').catch(() => {});
        acquireCheckoutLock(b.id, { by: user?.name, uid: user?.uid }).then(setLockInfo).catch(() => {});
      }
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);

  useEffect(() => () => {
    if (type === 'CheckOut') releaseCheckoutLock(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takeOverLock = async () => {
    const res = await acquireCheckoutLock(id, { by: user?.name, uid: user?.uid, force: true });
    setLockInfo(res);
  };

  const licenceStatus = booking?.licenceVerification?.status || null;
  const licenceGatePassed = licenceStatus === 'Verified' || licenceStatus === 'Overridden';

  const runVerification = async () => {
    setError('');
    setLicenceChecking(true);
    await sleep(1200);
    const res = await verifyDriverLicence(id, { checkedBy: user?.name || 'Front Desk' });
    setLicenceChecking(false);
    if (res?.error) setError(res.error);
    setShowOverride(false);
    setOverrideNote('');
  };

  const submitOverride = async () => {
    setError('');
    if (!overrideNote.trim()) return setError('An override reason is required and will be logged.');
    const res = await overrideLicenceVerification(id, { by: user?.name || 'Front Desk', note: overrideNote });
    if (res?.error) return setError(res.error);
    setShowOverride(false);
    setOverrideNote('');
  };

  const hasDamage = type === 'CheckOut' && items.some((it) => it.condition === 'Damaged');

  const doReassign = async () => {
    setError('');
    if (!reassignVehicleId) return setError('Choose a replacement vehicle first.');
    setReassigning(true);
    const res = await reassignBookingVehicle(id, { vehicleId: reassignVehicleId, by: user?.name || 'Front Desk' });
    setReassigning(false);
    if (res?.error) return setError(res.error);
    setItems(defaultItems());
    setPhotos([]);
    setNotes('');
    setDamageResult(null);
    setMileage('');
    setFuelLevel(100);
    setReassignVehicleId('');
    const freshBooking = await getCarBooking(id);
    if (freshBooking) setVehicle(await getFleetVehicleForBooking(freshBooking));
    setSuccess(`Reassigned to ${res.vehicleName} (${res.unitNumber}) — continue the inspection on the new unit.`);
  };

  const setItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    if (type === 'CheckOut' && patch.condition) {
      updateHandoverStep(id, 'inspection').catch(() => {});
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await fileToDataUrl(file, 1000);
    setPhotos((prev) => [...prev, data]);
    if (type === 'CheckOut') updateHandoverStep(id, 'inspection').catch(() => {});
  };

  const canSubmit =
    !submitting &&
    mileage !== '' &&
    Number(mileage) >= 0 &&
    (type !== 'CheckOut' ||
      (licenceGatePassed && !hasDamage && signedBy.trim() && (guestSignsOnPhone || guestSignature.trim())));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!booking) return;
    if (!mileage || Number(mileage) < 0) return setError('Please enter the current odometer reading.');
    if (type === 'CheckOut' && !licenceGatePassed) return setError('Licence verification must pass (or be overridden) before check-out.');
    if (type === 'CheckOut' && hasDamage) return setError('Pre-existing damage marked — reassign a different vehicle before check-out.');
    if (type === 'CheckOut' && !guestSignsOnPhone && !guestSignature.trim()) return setError('Guest co-signature is required, or choose “Guest signs on their phone”.');
    setSubmitting(true);
    const res = await recordVehicleHandover({
      bookingId: booking.id,
      handoverType: type,
      unitNumber: booking.unitNumber || '',
      fuelLevel,
      mileage,
      items,
      notes,
      photos,
      signedBy: signedBy || user?.name || 'Front Desk',
      guestSignature: guestSignsOnPhone ? '' : guestSignature,
      guestSignsOnPhone,
      reservationId: booking.reservationId || '',
      damageCheck: damageResult,
      returnBranchId,
      waiveExtraHold,
      waiveNote,
    });
    setSubmitting(false);
    if (res?.error) return setError(res.error);
    if (type === 'CheckOut') setAgreementIssuedAt(res.agreementIssuedAt || Date.now());
    setSuccess(
      type === 'CheckOut'
        ? guestSignsOnPhone
          ? `Vehicle handed out. Booking is Checked Out — ${booking.guestName} can review & sign the condition report on their phone.`
          : `Vehicle handed out. Guest signed the digital checklist. Booking is now Checked Out.`
        : res.returnTiming
          ? `Vehicle re-checked (return ${res.returnTiming.status.toLowerCase()}). Booking moved to Returned — Pending Inspection; the unit stays blocked until the post-rental inspection is completed.${res.damageDetected ? ` Work order ${res.workOrder?.ref || ''} queued for the workshop.` : ''} Charges are held for review before any posting.`
          : res.damageDetected
            ? `Vehicle re-checked and moved to maintenance because damage was detected.${res.workOrder ? ` Work order ${res.workOrder.ref} opened for the workshop.` : ''} Itemized charges are held for guest & staff review before posting.`
            : `Vehicle re-checked and returned to the available fleet. Itemized charges are held for guest & staff review before posting.`,
    );
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
  const pickupBranch = branchById(booking.pickupBranchId);
  const isHighRiskPickup = type === 'CheckOut' && pickupBranch?.highRisk;
  const lockedByOther = type === 'CheckOut' && lockInfo?.error && lockInfo?.lockedBy && lockInfo.lockedBy !== (user?.name || '');
  const availableReplacements = allVehicles.filter((v) => v.status === 'Available' && v.id !== vehicle?.id);

  const checkInPreview =
    type === 'CheckIn'
      ? (() => {
          const late = lateReturnCharges({
            scheduledDropoff: booking.dropoffDate,
            scheduledDropoffTime: booking.dropoffTime,
            actualReturn: Date.now(),
            dailyRate: booking.days ? round(booking.basePrice / booking.days) : 0,
            graceHours: 2,
          });
          const fuel = fuelVarianceCharge({ fuelOutPct: out?.fuelLevel, fuelInPct: fuelLevel, tankLitres: booking.tankLitres });
          const oneWay = oneWayFee(booking.pickupBranchId, returnBranchId || booking.pickupBranchId);
          return { late, fuel, oneWay, total: round(late.total + fuel.total + oneWay) };
        })()
      : null;

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

        {lockedByOther && (
          <div className="lost-alert lost-alert-warning mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <i className="bi bi-lock me-2" />
              Being handled by <strong>{lockInfo.lockedBy}</strong> since {formatDateTime(lockInfo.lockedAt)}.
            </div>
            <button type="button" className="btn btn-sm btn-outline-dark" onClick={takeOverLock}>
              <i className="bi bi-arrow-repeat me-1" />Take over
            </button>
          </div>
        )}

        {agreementIssuedAt && (
          <div className="panel-card mb-3">
            <div className="panel-header">
              <h2><i className="bi bi-file-earmark-check me-2" />Rental agreement &amp; gate pass</h2>
              <span className="panel-actions">Generated {formatDateTime(agreementIssuedAt)}</span>
            </div>
            <div className="p-3">
              <div className="row g-2 text-muted small">
                <div className="col-md-4"><strong className="text-dark d-block">Guest</strong>{booking.guestName}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Vehicle / unit</strong>{booking.vehicleName} · {booking.unitNumber}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Rental window</strong>{formatGuestDate(booking.pickupDate)} → {formatGuestDate(booking.dropoffDate)}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Staff signed by</strong>{signedBy || user?.name}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Guest signature</strong>{guestSignature || (guestSignsOnPhone ? 'Pending — guest will sign on phone' : '—')}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Booking ref</strong>{booking.ref}</div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={() => window.print()}>
                <i className="bi bi-printer me-1" />Print agreement
              </button>
              <div className="text-muted small mt-2">
                <i className="bi bi-info-circle me-1" />Generated in-app — this demo has no email/SMS backend to deliver it automatically.
              </div>
            </div>
          </div>
        )}

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
              <div className="lost-alert lost-alert-danger mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ margin: '1rem 0 0' }}>
                <div>
                  <div className="fw-bold"><i className="bi bi-exclamation-triangle me-2" />Variance report — new damages detected</div>
                  <div className="small mt-1">{damages.join(', ')}</div>
                </div>
                <Link to="/Fleet/Maintenance" className="btn btn-sm btn-danger">
                  <i className="bi bi-wrench-adjustable me-1" />Assign to maintenance
                </Link>
              </div>
            )}
          </div>
        </div>

        {type === 'CheckOut' && (
          <div className="panel-card mb-4">
            <div className="panel-header">
              <h2><i className="bi bi-person-badge me-2" />Licence verification</h2>
              {licenceGatePassed ? (
                <span className="fleet-badge fleet-badge-Available">
                  <i className="bi bi-check-circle me-1" />{licenceStatus === 'Verified' ? 'VERIFIED' : 'OVERRIDDEN'}
                </span>
              ) : licenceStatus === 'Failed' ? (
                <span className="fleet-badge fleet-badge-OutOfService"><i className="bi bi-x-circle me-1" />FAILED</span>
              ) : (
                <span className="fleet-badge fleet-badge-PendingConfirmation">PENDING</span>
              )}
            </div>
            <div className="p-3">
              <div className="row g-2 text-muted small mb-3">
                <div className="col-md-4"><strong className="text-dark d-block">Licence number</strong>{booking.licenseNumber || '—'}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Expiry</strong>{booking.licenseExpiry || '—'}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Date of birth</strong>{booking.driverDob || '—'}</div>
              </div>

              {!licenceGatePassed && licenceStatus !== 'Failed' && (
                <button type="button" className="btn-log" style={{ background: '#355f8c' }} disabled={licenceChecking} onClick={runVerification}>
                  <i className={`bi ${licenceChecking ? 'bi-arrow-repeat spin' : 'bi-shield-check'} me-1`} />
                  {licenceChecking ? 'Contacting verification service…' : 'Run verification'}
                </button>
              )}

              {licenceStatus === 'Failed' && (
                <div className="lost-alert lost-alert-danger">
                  <div className="fw-bold mb-1"><i className="bi bi-x-circle me-2" />Verification failed</div>
                  <ul className="mb-2 small">
                    {(booking.licenceVerification?.reasons || []).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                  {!showOverride ? (
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-dark" disabled={licenceChecking} onClick={runVerification}>
                        <i className="bi bi-arrow-repeat me-1" />Re-run verification
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setShowOverride(true)}>
                        <i className="bi bi-pencil-square me-1" />Manual override
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <label className="book-label" htmlFor="OverrideNote">Override reason (required, logged)</label>
                      <input id="OverrideNote" className="form-control book-input" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="e.g. Verification service unreachable — licence checked visually against booking name" />
                      <div className="d-flex gap-2 mt-2">
                        <button type="button" className="btn btn-sm btn-dark" onClick={submitOverride}>
                          <i className="bi bi-check-lg me-1" />Override &amp; continue
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setShowOverride(false); setOverrideNote(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {licenceGatePassed && (
                <div className="text-muted small">
                  {licenceStatus === 'Verified'
                    ? `Verified by ${booking.licenceVerification?.checkedBy || 'Front Desk'} at ${formatDateTime(booking.licenceVerification?.checkedAt)}.`
                    : `Overridden by ${booking.licenceVerification?.overrideBy || 'Front Desk'} — ${booking.licenceVerification?.overrideNote}`}
                </div>
              )}
            </div>
          </div>
        )}

        {vehicle?.image && (
          <div className="panel-card mb-4">
            <div className="panel-header">
              <h2><i className="bi bi-box-arrow-up-right me-2" />Vehicle preview — inspect every side</h2>
              <span className="panel-actions">{vehicle.name} · {vehicle.unitNumber} · drag to rotate 360°</span>
            </div>
            <div className="p-3">
              <div className="row g-3 align-items-center">
                <div className="col-md-5 col-lg-4">
                  <CarViewer3D image={vehicle.image} label={vehicle.name} size={250} auto />
                </div>
                <div className="col-md-7 col-lg-8">
                  <div className="row g-2 text-muted small">
                    <div className="col-md-6"><strong className="text-dark d-block">Type</strong>{vehicle.type} · {vehicle.transmission}</div>
                    <div className="col-md-6"><strong className="text-dark d-block">Capacity</strong>{vehicle.capacity} seats · {vehicle.fuelType}</div>
                    <div className="col-md-6"><strong className="text-dark d-block">Plate</strong>{vehicle.plateNumber || '—'} · year {vehicle.year}</div>
                    <div className="col-md-6"><strong className="text-dark d-block">Rate</strong>{formatPrice(vehicle.pricePerDay)} / day</div>
                  </div>
                  <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                    <i className="bi bi-hand-index-thumb me-2" />The photo below is the car picture on file — rotate it to inspect the front, both flanks and the rear before {type === 'CheckOut' ? 'handing the keys over' : 'accepting the return'}. The pictures you capture form the official record.
                  </div>
                  {type === 'CheckIn' && out?.photos?.[0] && (
                    <div className="d-flex align-items-center gap-3 mt-3">
                      <img src={out.photos[0]} alt="Check-out photo" style={{ width: 104, height: 78, objectFit: 'cover', borderRadius: 10, border: '1px solid #eee6da' }} />
                      <div className="small text-muted">
                        <strong className="text-dark d-block">Photo at check-out</strong>
                        Compare the unit against this when taking your return pictures below.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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

              {hasDamage && (
                <div className="lost-alert lost-alert-danger mt-4">
                  <div className="fw-bold mb-1"><i className="bi bi-exclamation-triangle me-2" />Pre-existing damage marked — this unit is not roadworthy</div>
                  <p className="small mb-2">Handover is blocked; return to Front Desk to reassign a different vehicle to this booking.</p>
                  <div className="d-flex gap-2 flex-wrap align-items-center">
                    <select className="form-select form-select-sm" style={{ width: 260 }} value={reassignVehicleId} onChange={(e) => setReassignVehicleId(e.target.value)}>
                      <option value="">Choose a replacement vehicle…</option>
                      {availableReplacements.map((v) => (
                        <option key={v.id} value={v.id}>{v.name} · {v.unitNumber || v.plateNumber}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm btn-dark" disabled={reassigning} onClick={doReassign}>
                      <i className="bi bi-arrow-left-right me-1" />{reassigning ? 'Reassigning…' : 'Reassign vehicle'}
                    </button>
                  </div>
                </div>
              )}

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

              {type === 'CheckIn' && checkInPreview && (
                <div className="panel-card mt-4">
                  <div className="panel-header"><h2>Pending charges preview</h2></div>
                  <div className="p-3">
                    {checkInPreview.late.status === 'Early' && (
                      <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-check-circle me-1" />Return timing</span><strong>Early · {formatPrice(0)}</strong></div>
                    )}
                    {checkInPreview.late.status === 'OnTime' && (
                      <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-check-circle me-1" />Return timing</span><strong>On time (within 2h grace)</strong></div>
                    )}
                    {checkInPreview.total === 0 ? (
                      <p className="task-sub mb-0">No late, fuel or one-way charges — nothing will be held for review.</p>
                    ) : (
                      <>
                        {checkInPreview.late.total > 0 && (
                          <>
                            <div className="fleet-quote-row"><span className="text-muted">Return timing</span><strong className="text-danger">Late · {checkInPreview.late.lateHours}h after 2h grace</strong></div>
                            <div className="fleet-quote-row"><span className="text-muted">Extra day(s) — {checkInPreview.late.lateDays} day(s) over</span><strong>{formatPrice(checkInPreview.late.extraDayFee)}</strong></div>
                            <div className="fleet-quote-row mt-1"><span className="text-muted">Late-return fee</span><strong>{formatPrice(checkInPreview.late.dailyLateFee)}</strong></div>
                          </>
                        )}
                        {checkInPreview.fuel.total > 0 && (
                          <>
                            <div className="fleet-quote-row mt-1"><span className="text-muted">Fuel shortfall — {checkInPreview.fuel.shortfallLitres}L</span><strong>{formatPrice(checkInPreview.fuel.fuelCost)}</strong></div>
                            <div className="fleet-quote-row mt-1"><span className="text-muted">Refuelling service fee</span><strong>{formatPrice(checkInPreview.fuel.serviceFee)}</strong></div>
                          </>
                        )}
                        {checkInPreview.oneWay > 0 && (
                          <div className="fleet-quote-row mt-1"><span className="text-muted">One-way fee</span><strong>{formatPrice(checkInPreview.oneWay)}</strong></div>
                        )}
                        <div className="fleet-quote-total mt-2"><span>Held pending review</span><span className="amount">{formatPrice(checkInPreview.total)}</span></div>
                      </>
                    )}
                    <div className="mt-3">
                      <label className="book-label" htmlFor="ReturnBranch">Return branch</label>
                      <select id="ReturnBranch" className="form-select book-input" value={returnBranchId} onChange={(e) => setReturnBranchId(e.target.value)}>
                        {FLEET_BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="panel-card mt-4">
                <div className="panel-header"><h2>Digital sign-off</h2></div>
                <div className="p-3">
                  {isHighRiskPickup && (
                    <div className="lost-alert lost-alert-warning mb-3">
                      <i className="bi bi-shield-exclamation me-2" />
                      High-risk branch — an extra {formatPrice(HIGH_RISK_EXTRA_HOLD)} hold applies automatically.
                      <div className="form-check mt-2">
                        <input className="form-check-input" type="checkbox" id="WaiveHold" checked={waiveExtraHold} onChange={(e) => setWaiveExtraHold(e.target.checked)} />
                        <label className="form-check-label" htmlFor="WaiveHold">Waive extra hold (loyalty member / same-day boarding pass)</label>
                      </div>
                      {waiveExtraHold && (
                        <input className="form-control book-input mt-2" placeholder="Reason for waiving (logged)" value={waiveNote} onChange={(e) => setWaiveNote(e.target.value)} />
                      )}
                    </div>
                  )}
                  {type === 'CheckOut' && !licenceGatePassed && (
                    <div className="text-muted small mb-2"><i className="bi bi-lock me-1" />Complete licence verification above to unlock sign-off.</div>
                  )}
                  <label className="book-label" htmlFor="SignedBy">Staff signed by</label>
                  <input id="SignedBy" className="form-control book-input" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Front Desk" />
                  {type === 'CheckOut' && (
                    <>
                      <label className="book-label mt-3" htmlFor="GuestSignature">Guest signature (type full name)</label>
                      <input id="GuestSignature" className="form-control book-input" disabled={guestSignsOnPhone} value={guestSignature} onChange={(e) => setGuestSignature(e.target.value)} placeholder={booking.guestName} />
                      <div className="form-check mt-3">
                        <input className="form-check-input" type="checkbox" id="GuestSignsOnPhone" checked={guestSignsOnPhone} onChange={(e) => { setGuestSignsOnPhone(e.target.checked); if (e.target.checked) setGuestSignature(''); }} />
                        <label className="form-check-label" htmlFor="GuestSignsOnPhone">Guest will review &amp; sign the condition report on their own phone instead</label>
                      </div>
                      {guestSignature.trim() && guestSignature === booking.guestSignature && (
                        <div className="text-muted small mt-2"><i className="bi bi-phone me-1" />Signature received live from the guest's device.</div>
                      )}
                    </>
                  )}
                  <p className="task-sub mt-2"><i className="bi bi-pencil-square me-1" />Recording a {type === 'CheckOut' ? 'handover' : 'return'} checklist confirms that {type === 'CheckOut' ? 'the guest received' : 'the hotel received'} the vehicle in this condition.</p>
                  <button
                    type="submit"
                    className="book-submit mt-3 w-100"
                    disabled={!canSubmit}
                  >
                    <i className="bi bi-clipboard-check me-2" />{submitting ? 'Saving…' : `Complete ${type === 'CheckOut' ? 'check-out' : 'check-in'}`}
                  </button>
                  {type === 'CheckOut' && !canSubmit && !submitting && (
                    <div className="text-muted small mt-2 text-center">
                      Still needed: {[
                        !licenceGatePassed && 'licence verification',
                        hasDamage && 'resolve pre-existing damage',
                        !signedBy.trim() && 'staff name',
                        !(guestSignsOnPhone || guestSignature.trim()) && 'guest signature',
                        (!mileage || Number(mileage) < 0) && 'odometer reading',
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="text-muted small mt-2 text-center">
                    {type === 'CheckIn' && 'Late, fuel and one-way charges are held for guest & staff review before posting.'}
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
