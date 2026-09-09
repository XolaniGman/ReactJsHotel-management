import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeCarBooking,
  subscribeHandoverForBooking,
  listFleetIncidents,
  advanceReturnStep,
  finalizeVehicleReturn,
} from '../services/fleetService';
import DamageCompare from '../components/DamageCompare';
import { formatPrice, formatGuestDate, formatDateTime, fileToDataUrl, round } from '../lib/utils';
import { FLEET_BRANCHES, LIABILITIES, LATE_RETURN_GRACE_HOURS, HANDOVER_ITEMS } from '../lib/constants';
import { lateReturnCharges, fuelVarianceCharge, oneWayFee, accidentAdminFee, computeReturnSettlement } from '../lib/fleetAlgo';
import './fleet.css';
import './maintenance.css';
import './guest.css';

const STEPS = [
  { key: 'RETURN_LOGGED', label: 'Return logging', icon: 'bi-geo-alt' },
  { key: 'INSPECTION_IN_PROGRESS', label: 'Post-rental inspection', icon: 'bi-search' },
  { key: 'LIABILITY_PENDING', label: 'Liability', icon: 'bi-shield-exclamation' },
  { key: 'CHARGES_REVIEW', label: 'Charges review', icon: 'bi-receipt' },
];

const defaultItems = (pre) =>
  (pre?.items?.length ? pre.items : HANDOVER_ITEMS).map((it) => ({
    label: it.label || it.name,
    condition: 'Good',
    damaged: false,
  }));

const nowStamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowHHMM = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FleetReturnFlow() {
  const { id } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [outHandover, setOutHandover] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [step, setStep] = useState(0);
  const [returnDate, setReturnDate] = useState(nowStamp());
  const [returnTime, setReturnTime] = useState(nowHHMM());
  const [returnBranchId, setReturnBranchId] = useState('');
  const [items, setItems] = useState([]);
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState(100);
  const [photos, setPhotos] = useState([]);
  const [damageResult, setDamageResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [liability, setLiability] = useState('Undetermined');
  const [liabilityNote, setLiabilityNote] = useState('');
  const [chargeLines, setChargeLines] = useState([{ label: '', amount: '' }]);
  const [signedBy, setSignedBy] = useState('');
  const [ackReview, setAckReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const out = booking?.handoverOut;
  const dataGap = !out && !outHandover;

  useEffect(() => {
    const u1 = subscribeCarBooking(id, setBooking);
    const u2 = subscribeHandoverForBooking(id, (h) => {
      setOutHandover((h && h.handoverType === 'CheckOut') ? h : null);
    });
    return () => {
      u1?.();
      u2?.();
    };
  }, [id]);

  useEffect(() => {
    if (!booking) return;
    setItems((prev) => (prev.length ? prev : defaultItems(outHandover)));
    setReturnBranchId((prev) => prev || booking.returnBranchId || booking.pickupBranchId || 'main');
    if (out?.fuelLevel != null) setFuelLevel((prev) => (prev === 100 ? Number(out.fuelLevel) : prev));
    if (out?.mileage != null) setMileage((prev) => prev || String(out.mileage));
  }, [booking, outHandover, out?.fuelLevel, out?.mileage]);

  useEffect(() => {
    if (booking?.status !== 'CheckedOut') return;
    listFleetIncidents()
      .then((all) => setIncidents(all.filter((i) => i.bookingId === id)))
      .catch(() => {});
  }, [id, booking?.status]);

  const openIncidents = useMemo(
    () => incidents.filter((i) => !['Resolved', 'Cancelled'].includes(i.status)),
    [incidents],
  );

  const preItems = useMemo(() => (outHandover?.items || []).filter((it) => it && (it.label || it.name)), [outHandover]);
  const preByLabel = (label) => preItems.find((it) => (it.label || it.name) === label);

  const changedItems = useMemo(
    () =>
      items.filter((it) => {
        const pre = preByLabel(it.label);
        return it.condition === 'Damaged' && (pre?.condition || 'Good') !== 'Damaged';
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, preItems],
  );
  const mileageDelta = useMemo(() => {
    if (!out?.mileage || mileage === '') return 0;
    return Math.max(0, (Number(mileage) || 0) - (Number(out.mileage) || 0));
  }, [out, mileage]);
  const fuelDelta = useMemo(() => {
    if (!out?.fuelLevel) return 0;
    return Math.max(0, (Number(out.fuelLevel) || 0) - (Number(fuelLevel) || 0));
  }, [out, fuelLevel]);

  const needsLiability = useMemo(
    () => changedItems.length > 0 || damageResult?.flagged === true || openIncidents.length > 0,
    [changedItems, damageResult, openIncidents],
  );

  const returnTs = useMemo(() => {
    if (!returnDate) return Date.now();
    const d = new Date(`${returnDate}T${returnTime || '00:00'}`);
    return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  }, [returnDate, returnTime]);

  const summary = useMemo(() => {
    if (!booking) return null;
    const late = lateReturnCharges({
      scheduledDropoff: booking.dropoffDate,
      scheduledDropoffTime: booking.dropoffTime,
      actualReturn: returnTs,
      dailyRate: booking.days ? round(booking.basePrice / booking.days) : 0,
      graceHours: LATE_RETURN_GRACE_HOURS,
    });
    const fuel = fuelVarianceCharge({
      fuelOutPct: out?.fuelLevel,
      fuelInPct: fuelLevel,
      tankLitres: booking.tankLitres,
    });
    const oneWay = oneWayFee(booking.pickupBranchId, returnBranchId || booking.pickupBranchId);
    const damageSub = round(
      (chargeLines || []).reduce((s, l) => s + (Number(l.amount) > 0 ? Number(l.amount) : 0), 0),
    );
    const guestLiable = liability === 'Guest fault';
    const damageAdmin = guestLiable && damageSub > 0 ? accidentAdminFee(damageSub) : 0;
    const guestDamage = guestLiable ? round(damageSub + damageAdmin) : 0;

    const stamp = Date.now();
    const heldCharges = [];
    if (late.total > 0) {
      heldCharges.push({ id: `late-day-${stamp}`, type: 'LateReturn', description: `Extra day(s) — ${late.lateDays} day(s) over`, amount: late.extraDayFee, status: 'Held' });
      heldCharges.push({ id: `late-fee-${stamp}`, type: 'LateFee', description: `Late-return fee — ${late.lateDays} × R${Math.round(late.dailyLateFee / late.lateDays)}/day`, amount: late.dailyLateFee, status: 'Held' });
    }
    if (fuel.total > 0) {
      heldCharges.push({ id: `fuel-${stamp}`, type: 'Fuel', description: `Fuel shortfall — ${fuel.shortfallLitres}L at return`, amount: fuel.fuelCost, status: 'Held' });
      heldCharges.push({ id: `refuel-${stamp}`, type: 'RefuelFee', description: 'Refuelling service fee', amount: fuel.serviceFee, status: 'Held' });
    }
    if (oneWay > 0) {
      heldCharges.push({ id: `oneway-${stamp}`, type: 'OneWay', description: `One-way fee (${booking.pickupBranchId} → ${returnBranchId || booking.pickupBranchId})`, amount: oneWay, status: 'Held' });
    }
    if (guestDamage > 0) {
      heldCharges.push({ id: `damage-${stamp}`, type: 'DamageRepair', description: 'Damage charges — guest-fault liability', amount: guestDamage, status: 'Held' });
    }
    const deposit = Number(booking.authorisationHoldAmount) || Number(booking.deposit) || 0;
    const settlement = computeReturnSettlement({ authorisationHoldAmount: deposit, pendingCharges: heldCharges });
    return { late, fuel, oneWay, damageSub, damageAdmin, guestDamage, heldCharges, total: round(heldCharges.reduce((s, c) => s + c.amount, 0)), deposit, settlement };
  }, [booking, returnTs, out?.fuelLevel, fuelLevel, returnBranchId, chargeLines, liability]);

  const doAdvance = async (stepKey, next) => {
    await advanceReturnStep(id, stepKey, { by: signedBy || user?.name || 'Front Desk' }).catch(() => {});
    setStep(next);
  };

  const touchInspection = () => {
    if (booking?.returnProgress?.step === 'INSPECTION_IN_PROGRESS') return;
    advanceReturnStep(id, 'INSPECTION_IN_PROGRESS', { by: user?.name, note: 'Return inspection started at the desk' }).catch(() => {});
  };

  const setItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await fileToDataUrl(file, 1000);
    setPhotos((prev) => [...prev, data]);
  };

  const setLine = (idx, patch) =>
    setChargeLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const finalize = async () => {
    setSubmitting(true);
    setError('');
    const res = await finalizeVehicleReturn(booking.id, {
      unitNumber: booking.unitNumber || '',
      fuelLevel,
      mileage,
      items,
      notes,
      photos,
      signedBy: signedBy || user?.name || 'Front Desk',
      returnedAt: returnTs,
      returnBranchId,
      liability,
      liabilityNote,
      chargeLines: chargeLines.filter((l) => (l.label || '').trim() && Number(l.amount) > 0),
    });
    setSubmitting(false);
    if (res?.error) return setError(res.error);
    setResult(res);
  };

  const view = useMemo(() => {
    if (!booking) return 'loading';
    if (result) return 'complete';
    if (booking.status === 'CheckedIn') return 'already';
    if (booking.status === 'PendingInspection') return 'pendingInspection';
    if (booking.status !== 'CheckedOut') return 'blocked';
    return 'wizard';
  }, [booking, result]);

  const stepsDone = useMemo(() => {
    if (booking?.returnProgress?.step === 'COMPLETE') return 5;
    if (booking?.returnProgress?.step === 'CHARGES_REVIEW') return 4;
    if (booking?.returnProgress?.step === 'LIABILITY_PENDING') return 3;
    if (booking?.returnProgress?.step === 'INSPECTION_IN_PROGRESS') return 2;
    if (booking?.returnProgress?.step === 'RETURN_LOGGED') return 1;
    return 0;
  }, [booking]);

  if (view === 'loading') {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading return flow…</p>
      </div></div>
    );
  }

  if (view === 'blocked') {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <div className="lost-alert lost-alert-warning mb-3">
          <i className="bi bi-info-circle me-2" />This booking is {booking?.status} — a return can only be processed for a vehicle currently checked out.
        </div>
        <Link to="/Fleet/ActiveRentals" className="btn-log" style={{ background: '#355f8c' }}>
          <i className="bi bi-arrow-left me-2" />Back to Active Rentals
        </Link>
      </div></div>
    );
  }

  if (view === 'pendingInspection') {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <div className="lost-alert lost-alert-warning mb-3">
          <i className="bi bi-hourglass-split me-2" />The vehicle has been re-checked and is awaiting the post-rental inspection sign-off. Finalize it from Active Rentals.
        </div>
        <div className="d-flex gap-2">
          <Link to="/Fleet/ActiveRentals" className="btn-log" style={{ background: '#355f8c' }}>
            <i className="bi bi-arrow-left me-2" />Back to Active Rentals
          </Link>
        </div>
      </div></div>
    );
  }

  if (view === 'already' || view === 'complete') {
    const r = result || booking;
    const wo = result?.workOrder;
    const inc = result?.incident;
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Vehicle Return · Check-in</div>
            <h1 className="maint-title">{booking.vehicleName} <span className="text-muted">· {booking.ref}</span></h1>
          </div>
          <Link to="/Fleet/ActiveRentals" className="btn-log" style={{ background: '#355f8c' }}>
            <i className="bi bi-arrow-left me-2" />Active Rentals
          </Link>
        </div>

        <div className="panel-card mt-4">
          <div className="panel-header">
            <h2><i className="bi bi-check-circle me-2" />Return finalized</h2>
            <span className="panel-actions">receipt issued {formatDateTime(r.finalizedAt || r.returnReceiptIssuedAt)}</span>
          </div>
          <div className="p-3">
            <div className="row g-2 text-muted small">
              <div className="col-md-3"><strong className="text-dark d-block">Booking status</strong><span className="fleet-badge fleet-badge-CheckedIn">Checked in</span></div>
              <div className="col-md-3"><strong className="text-dark d-block">Vehicle status</strong><span className={`fleet-badge ${(r.finalizedVehicleStatus || r.vehicleStatus || 'Available') === 'Available' ? 'fleet-badge-Available' : 'fleet-badge-InMaintenance'}`}>{(r.finalizedVehicleStatus || r.vehicleStatus) === 'InMaintenance' ? 'Maintenance' : 'Available'}</span></div>
              <div className="col-md-3"><strong className="text-dark d-block">Finalized by</strong>{r.finalizedBy || 'Front Desk'}</div>
              <div className="col-md-3"><strong className="text-dark d-block">Audit trail</strong>appended to booking history</div>
            </div>

            {result?.settlement && (
              <div className="mt-4">
                <div className="book-label mb-1">Settlement against deposit</div>
                <div className="fleet-quote-row"><span className="text-muted">Deposit held</span><strong>{formatPrice(result.settlement.depositHeld)}</strong></div>
                <div className="fleet-quote-row"><span className="text-muted">Charges held for review</span><strong>{formatPrice(result.settlement.charges)}</strong></div>
                <div className="fleet-quote-total mt-2">
                  <span>{result.settlement.refundDue > 0 ? 'Refund due' : result.settlement.amountDue > 0 ? 'Amount due' : 'Deposit fully released'}</span>
                  <span className="amount">{result.settlement.refundDue > 0 ? formatPrice(result.settlement.refundDue) : result.settlement.amountDue > 0 ? formatPrice(result.settlement.amountDue) : formatPrice(0)}</span>
                </div>
              </div>
            )}

            {(result?.charges || []).length > 0 && (
              <div className="mt-4">
                <div className="book-label mb-1">Itemized charges (held pending guest review)</div>
{result.charges.map((c) => (
                      <div className="fleet-charge-item" key={c.id}>
                        <div>
                          <div className="task-sub">{c.description}</div>
                          <strong>{formatPrice(c.amount)}</strong> <span className={`fleet-charge-status ${c.status}`}>{c.status}</span>
                        </div>
                      </div>
                    ))}
              </div>
            )}

            <div className="mt-4 d-flex gap-2 flex-wrap">
              <button type="button" className="btn-log" style={{ background: '#355f8c' }} onClick={() => window.print()}>
                <i className="bi bi-printer me-2" />Print return receipt
              </button>
              {wo?.id && (
                <Link to="/Fleet/Maintenance?src=CheckIn" className="btn-log" style={{ background: '#8a640e' }}>
                  <i className="bi bi-wrench-adjustable me-2" />Open work order {wo.ref}
                </Link>
              )}
              {inc?.id && (
                <Link to="/Fleet/Incidents" className="btn-log" style={{ background: '#433c7d' }}>
                  <i className="bi bi-shield-exclamation me-2" />Incident {inc.ref} · {inc.status}
                </Link>
              )}
              <Link to="/Fleet/Charges" className="btn-log" style={{ background: '#2f7d4f' }}>
                <i className="bi bi-credit-card me-2" />Charges &amp; payments
              </Link>
            </div>
            {r.finalizedNotes && <p className="task-sub mt-3 mb-0"><i className="bi bi-note me-1" />{r.finalizedNotes}</p>}
          </div>
        </div>
      </div></div>
    );
  }

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet Operations · Front Desk</div>
            <h1 className="maint-title">Check In the Car · {booking.vehicleName}</h1>
            <p className="task-sub">{booking.guestName} · {booking.ref} · due back {formatGuestDate(booking.dropoffDate)} {booking.dropoffTime}</p>
          </div>
          <Link to="/Fleet/ActiveRentals" className="btn-log" style={{ background: '#355f8c' }}>
            <i className="bi bi-arrow-left me-2" />Active Rentals
          </Link>
        </div>

        {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
        {dataGap && (
          <div className="lost-alert lost-alert-warning mb-3">
            <i className="bi bi-exclamation-triangle me-2" />No pre-rental (check-out) inspection record was found for this booking. The comparison column is hidden — this return is flagged for review. The checklist below stands alone.
          </div>
        )}

        <div className="d-flex gap-2 flex-wrap mb-3">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`fleet-badge ${step === i ? 'fleet-badge-Available' : stepsDone > i ? 'fleet-badge-SignedOff' : 'fleet-badge-Open'}`}
              style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
            >
              {stepsDone > i && <i className="bi bi-check-lg me-1" />}
              <i className={`bi ${s.icon} me-1`} />{s.label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="panel-card">
            <div className="panel-header"><h2><i className="bi bi-geo-alt me-2" />Return logging</h2></div>
            <div className="p-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="book-label" htmlFor="ReturnDate">Return date</label>
                  <input id="ReturnDate" type="date" className="form-control book-input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="book-label" htmlFor="ReturnTime">Return time</label>
                  <input id="ReturnTime" type="time" className="form-control book-input" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="book-label" htmlFor="ReturnBranch">Return branch</label>
                  <select id="ReturnBranch" className="form-select book-input" value={returnBranchId} onChange={(e) => setReturnBranchId(e.target.value)}>
                    {FLEET_BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {summary?.late.total > 0 ? (
                <div className="lost-alert lost-alert-danger mt-3">
                  <i className="bi bi-exclamation-triangle me-2" />
                  Return is <strong>late</strong> — {summary.late.lateHours}h after the {summary.late.graceHours}h grace period. Late-return policy applies: {summary.late.lateDays} extra day(s) at {formatPrice(summary.late.extraDayFee)} + daily late fee {formatPrice(summary.late.dailyLateFee)}.
                </div>
              ) : (
                <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                  <i className="bi bi-check-circle me-2" />Return timing: {summary?.late.status}. Within the {LATE_RETURN_GRACE_HOURS}h grace — no late-return fee.
                </div>
              )}

              <div className="mt-4">
                <button type="button" className="book-submit" onClick={() => doAdvance('RETURN_LOGGED', 1)}>
                  <i className="bi bi-send me-2" />Log return · start inspection
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="panel-card">
              <div className="panel-header">
                <h2><i className="bi bi-search me-2" />Post-rental inspection — side-by-side with pick-up</h2>
                <span className="panel-actions">auto-flags anything that changed</span>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead>
                    <tr><th>Item</th><th>At pick-up</th><th>At return</th><th>Flag</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const pre = preByLabel(it.label);
                      const isNewDamage = it.condition === 'Damaged' && (pre?.condition || 'Good') !== 'Damaged';
                      const isPreExisting = it.condition === 'Damaged' && (pre?.condition || 'Good') === 'Damaged';
                      return (
                        <tr key={it.label} className={isNewDamage ? 'return-changed-row' : ''}>
                          <td className="task-name">{it.label}</td>
                          <td className="task-sub">{pre ? (pre.condition === 'Damaged' ? 'Damaged (pre-existing)' : pre.condition) : '—'}</td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {['Good', 'Damaged', 'N/A'].map((c) => (
                                <button
                                  type="button"
                                  key={c}
                                  className={`btn btn-sm ${it.condition === c ? (c === 'Damaged' ? 'btn-danger' : 'btn-success') : 'btn-outline-secondary'}`}
                                  onClick={() => { setItem(idx, { condition: c, damaged: c === 'Damaged' }); touchInspection(); }}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            {isNewDamage && <span className="fleet-badge fleet-badge-Suspended"><i className="bi bi-exclamation-triangle me-1" />NEW DAMAGE — auto-flagged</span>}
                            {isPreExisting && <span className="fleet-badge fleet-badge-Open">Pre-existing</span>}
                            {!isNewDamage && !isPreExisting && <span className="task-sub">OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row g-4 mt-1">
              <div className="col-lg-5">
                <div className="panel-card">
                  <div className="panel-header"><h2>Meter &amp; fuel — compare to pick-up</h2></div>
                  <div className="p-3">
                    <label className="book-label" htmlFor="ReturnMileage">Odometer at return (km)</label>
                    <input id="ReturnMileage" type="number" min="0" className="form-control book-input" value={mileage} onChange={(e) => { setMileage(e.target.value); touchInspection(); }} />
                    {out?.mileage != null && (
                      <div className="task-sub mt-1">Pick-up: {Number(out.mileage).toLocaleString()} km {mileageDelta > 0 ? `· drove ${mileageDelta.toLocaleString()} km` : ''}</div>
                    )}
                    <label className="book-label mt-3" htmlFor="ReturnFuel">Fuel at return (%)</label>
                    <input id="ReturnFuel" type="range" min="0" max="100" step="5" className="form-range" value={fuelLevel} onChange={(e) => { setFuelLevel(Number(e.target.value)); touchInspection(); }} />
                    <div className="d-flex justify-content-between">
                      <span className="task-sub">{fuelLevel}%</span>
                      {out != null && <span className="task-sub">pick-up was {out.fuelLevel}%</span>}
                    </div>
                    {fuelDelta > 0 && <div className="text-danger small mt-1"><i className="bi bi-exclamation-triangle me-1" />Returned {fuelDelta}% below the agreed level — fuel shortfall charge applies.</div>}

                    <label className="book-label mt-3" htmlFor="ReturnNotes">Notes</label>
                    <textarea id="ReturnNotes" className="form-control book-textarea" value={notes} onChange={(e) => { setNotes(e.target.value); touchInspection(); }} placeholder="e.g. Scuff on rear bumper noted at speed bumps…" />
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="panel-card">
                  <div className="panel-header">
                    <h2>Photos ({photos.length}/3) + AI damage check</h2>
                    <span className="panel-actions">{outHandover?.photos?.[0] ? 'compare against the check-out photo' : ''}</span>
                  </div>
                  <div className="p-3">
                    {outHandover?.photos?.[0] && (
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <img src={outHandover.photos[0]} alt="Check-out photo" style={{ width: 104, height: 78, objectFit: 'cover', borderRadius: 10, border: '1px solid #eee6da' }} />
                        <div className="small text-muted">
                          <strong className="text-dark d-block">Photo at pick-up</strong>
                          Compare the unit against this when taking your return pictures.
                        </div>
                      </div>
                    )}
                    <div className="d-flex gap-2 flex-wrap mb-3">
                      {photos.map((p, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p} alt={`Vehicle ${i + 1}`} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10 }} />
                          <button type="button" className="btn btn-sm btn-danger" style={{ position: 'absolute', top: -6, right: -6, padding: '0 6px' }} onClick={() => setPhotos(photos.filter((_, x) => x !== i))} disabled={submitting}>×</button>
                        </div>
                      ))}
                      {photos.length < 3 && (
                        <label className="d-flex align-items-center justify-content-center border rounded-3" style={{ width: 90, height: 90, cursor: 'pointer', color: '#775a19' }}>
                          <i className="bi bi-camera" />
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
                        </label>
                      )}
                    </div>
                    {outHandover?.photos?.length > 0 && (
                      <div>
                        <div className="book-label mb-2"><i className="bi bi-ui-checks me-1" />AI damage check (pixel comparison)</div>
                        <DamageCompare onResult={(r) => { setDamageResult(r); touchInspection(); }} />
                      </div>
                    )}
                    {changedItems.length > 0 && (
                      <div className="lost-alert lost-alert-danger mt-3">
                        <div className="fw-bold"><i className="bi bi-exclamation-triangle me-2" />Discrepancies auto-flagged</div>
                        <div className="small mt-1">{changedItems.map((c) => c.label).join(', ')}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between mt-4">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(0)}><i className="bi bi-arrow-left me-1" />Back</button>
              <button
                type="button"
                className="book-submit"
                onClick={() => (needsLiability ? doAdvance('LIABILITY_PENDING', 2) : doAdvance('CHARGES_REVIEW', 3))}
                disabled={mileage === '' || Number(mileage) < 0}
              >
                <i className="bi bi-arrow-right me-2" />{needsLiability ? 'Continue to liability' : 'Continue to charges review'}
              </button>
            </div>
          </>
        )}

        {step === 2 && needsLiability && (
          <div className="panel-card">
            <div className="panel-header">
              <h2><i className="bi bi-shield-exclamation me-2" />Liability determination — reuses the Incident Register model</h2>
              <span className="panel-actions">resolve here, not separately</span>
            </div>
            <div className="p-3">
              {openIncidents.length > 0 && (
                <div className="lost-alert lost-alert-warning mb-3">
                  <i className="bi bi-bug me-2" />
                  This trip already has an open incident({openIncidents.map((i) => `${i.ref} · ${i.status}`).join(', ')}) — it will be resolved as part of this return.
                </div>
              )}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="book-label" htmlFor="Liability">Liability</label>
                  <select id="Liability" className="form-select book-input" value={liability} onChange={(e) => setLiability(e.target.value)}>
                    {LIABILITIES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <p className="task-sub mt-1">
                    {liability === 'Guest fault' ? 'Damage charges below will be billed to the guest (against the deposit).' : 'No guest charge — damage still routes to maintenance.'}
                  </p>
                </div>
                <div className="col-md-6">
                  <label className="book-label" htmlFor="LiabilityNote">Outcome / note</label>
                  <textarea id="LiabilityNote" className="form-control book-textarea" value={liabilityNote} onChange={(e) => setLiabilityNote(e.target.value)} placeholder="e.g. Rear bumper scuff — guest acknowledged at the desk; estimated repair…" />
                </div>
              </div>

              <div className="mt-4">
                <div className="book-label mb-2">Damage charges — line-by-line</div>
                {chargeLines.map((l, i) => (
                  <div className="d-flex gap-2 mb-2" key={i}>
                    <input
                      className="form-control book-input"
                      value={l.label}
                      onChange={(e) => setLine(i, { label: e.target.value })}
                      placeholder="Description (e.g. Rear bumper scuff)"
                    />
                    <input
                      className="form-control book-input"
                      style={{ maxWidth: 150 }}
                      type="number"
                      min="0"
                      value={l.amount}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                      placeholder="Amount R"
                    />
                    {chargeLines.length > 1 && (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setChargeLines(chargeLines.filter((_, x) => x !== i))} disabled={submitting}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setChargeLines([...chargeLines, { label: '', amount: '' }])} disabled={submitting}>
                  <i className="bi bi-plus-lg me-1" />Add damage line
                </button>
              </div>
            </div>

            <div className="p-3 d-flex justify-content-between" style={{ borderTop: '1px dashed #e7ddcd' }}>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="bi bi-arrow-left me-1" />Back</button>
              <button type="button" className="book-submit" onClick={() => doAdvance('CHARGES_REVIEW', 3)}>
                <i className="bi bi-arrow-right me-2" />Review charges
              </button>
            </div>
          </div>
        )}

        {step === 2 && !needsLiability && (
          <div className="d-flex justify-content-between mt-4">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="bi bi-arrow-left me-1" />Back</button>
            <button type="button" className="book-submit" onClick={() => doAdvance('CHARGES_REVIEW', 3)}>
              <i className="bi bi-arrow-right me-2" />Continue to charges review
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="panel-card">
            <div className="panel-header"><h2><i className="bi bi-receipt me-2" />Charge calculation summary</h2></div>
            <div className="p-3">
              <div className="row g-4">
                <div className="col-lg-6">
                  <div className="book-label mb-1">Auto-compiled charges</div>
                  {summary?.total === 0 && <p className="task-sub mb-0"><i className="bi bi-check-circle me-1" />No late, fuel, one-way or damage charges — nothing held for review.</p>}
                  {summary?.late?.total > 0 && (
                    <div className="lost-alert lost-alert-danger"><i className="bi bi-clock me-2" />Late return — {summary.late.lateHours}h after grace</div>
                  )}
                  <div className="fleet-quote-row"><span className="text-muted">Return timing</span><strong>{summary?.late.status} {summary?.late.lateHours > 0 ? `· ${summary.late.lateHours}h late` : ''}</strong></div>
                  {summary?.late.total > 0 && (
                    <>
                      <div className="fleet-quote-row"><span className="text-muted">Extra day(s) — {summary.late.lateDays}</span><strong>{formatPrice(summary.late.extraDayFee)}</strong></div>
                      <div className="fleet-quote-row"><span className="text-muted">Late-return fee</span><strong>{formatPrice(summary.late.dailyLateFee)}</strong></div>
                    </>
                  )}
                  {summary?.fuel.total > 0 && (
                    <>
                      <div className="fleet-quote-row"><span className="text-muted">Fuel shortfall — {summary.fuel.shortfallLitres}L</span><strong>{formatPrice(summary.fuel.fuelCost)}</strong></div>
                      <div className="fleet-quote-row"><span className="text-muted">Refuelling service fee</span><strong>{formatPrice(summary.fuel.serviceFee)}</strong></div>
                    </>
                  )}
                  {summary?.oneWay > 0 && (
                    <div className="fleet-quote-row"><span className="text-muted">One-way fee</span><strong>{formatPrice(summary.oneWay)}</strong></div>
                  )}
                  {summary?.damageSub > 0 && (
                    <>
                      <div className="fleet-quote-row"><span className="text-muted">Damage line-items {liability === 'Guest fault' ? '(guest fault)' : `(${liability}, not billed)`}</span><strong>{formatPrice(summary.damageSub)}</strong></div>
                      {liability === 'Guest fault' && <div className="fleet-quote-row"><span className="text-muted">Incident admin fee</span><strong>{formatPrice(summary.damageAdmin)}</strong></div>}
                    </>
                  )}
                  {summary?.guestDamage > 0 && (
                    <div className="fleet-quote-total mt-2"><span>Damage total (billed)</span><span className="amount">{formatPrice(summary.guestDamage)}</span></div>
                  )}
                  {summary?.total > 0 && (
                    <div className="fleet-quote-total mt-2"><span>Total held for review</span><span className="amount">{formatPrice(summary.total)}</span></div>
                  )}
                </div>
                <div className="col-lg-6">
                  <div className="book-label mb-1">Settlement vs deposit</div>
                  <div className="fleet-quote-row"><span className="text-muted">Deposit held</span><strong>{formatPrice(summary?.deposit)}</strong></div>
                  <div className="fleet-quote-row"><span className="text-muted">Charges</span><strong>{formatPrice(summary?.settlement?.charges)}</strong></div>
                  {summary?.settlement?.disputedCharges > 0 && (
                    <div className="fleet-quote-row"><span className="text-muted">Under review</span><strong>{formatPrice(summary.settlement.disputedCharges)}</strong></div>
                  )}
                  <div className="fleet-quote-total mt-2">
                    <span>{summary?.settlement?.refundDue > 0 ? 'Refund due' : summary?.settlement?.amountDue > 0 ? 'Additional amount owed' : 'Deposit released'}</span>
                    <span className="amount">{formatPrice(summary?.settlement?.refundDue > 0 ? summary.settlement.refundDue : summary.settlement.amountDue)}</span>
                  </div>
                </div>
              </div>

              {summary?.damageSub > 0 && (
                <div className="lost-alert lost-alert-warning mt-3">
                  <i className="bi bi-shield-exclamation me-2" />
                  Damage was flagged — the vehicle will be routed to maintenance regardless. The liability choice above decides whether these charges reach the guest bill.
                </div>
              )}

              <div className="mt-4 row g-3">
                <div className="col-md-6">
                  <label className="book-label" htmlFor="SignedByReturn">Finalized by (staff name)</label>
                  <input id="SignedByReturn" className="form-control book-input" value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Front Desk" />
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="AckReview" checked={ackReview} onChange={(e) => setAckReview(e.target.checked)} />
                    <label className="form-check-label" htmlFor="AckReview">I reviewed this summary with the guest — the same data appears on their charges-review screen.</label>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(needsLiability ? 2 : 1)}><i className="bi bi-arrow-left me-1" />Back</button>
                <button
                  type="button"
                  className="book-submit"
                  disabled={submitting || !ackReview || !(signedBy.trim() || user?.name)}
                  onClick={finalize}
                >
                  <i className="bi bi-box-arrow-in-down me-2" />{submitting ? 'Finalizing return…' : 'Finalize return · confirm check-in'}
                </button>
              </div>
              {!ackReview && (
                <p className="task-sub mt-2 text-center mb-0"><i className="bi bi-info-circle me-1" />Tick the review acknowledgement to enable finalize.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}