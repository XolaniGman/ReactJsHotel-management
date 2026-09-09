import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  subscribeCarBooking,
  subscribeHandoverForBooking,
  markGuestArrived,
  submitGuestSignature,
} from '../services/fleetService';
import { branchById } from '../lib/fleetAlgo';
import { formatGuestDate, formatDateTime, formatPrice } from '../lib/utils';
import './guest.css';
import './fleet.css';

const TRACKER_STEPS = [
  { key: 'verification', label: 'Licence verification', icon: 'bi-person-badge', pending: 'Waiting for the front desk to verify your licence', active: 'Verifying your licence…' },
  { key: 'inspection', label: 'Vehicle inspection', icon: 'bi-search', pending: 'The front desk will inspect the vehicle with you', active: 'The front desk is inspecting the vehicle with you…' },
  { key: 'signature', label: 'Your signature', icon: 'bi-pencil', pending: 'You will review and sign the condition report on your phone', active: 'Your signature is needed' },
  { key: 'complete', label: 'Keys issued', icon: 'bi-key', pending: 'You will drive off once the keys are handed over', active: 'Keys handed over — have a great trip!' },
];

export default function GuestCollectionFlow() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [handover, setHandover] = useState(null);
  const [arriving, setArriving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [ack, setAck] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeCarBooking(id, setBooking), [id]);
  useEffect(() => subscribeHandoverForBooking(id, setHandover), [id]);

  const stepKey = booking?.collectionProgress?.step || (booking?.guestArrived ? 'arrived' : 'prep');
  const signedByGuest = !!(handover?.guestSignature || booking?.guestAcknowledgedAt);
  const swapped = !!booking?.replacementVehicleId || !!booking?.notRoadworthySwap;

  const view = useMemo(() => {
    if (!booking) return 'loading';
    if (booking.status === 'Cancelled') return 'unavailable';
    if (signedByGuest) return 'complete';
    if (handover) return 'sign';
    if (booking.guestArrived || ['verification', 'inspection'].includes(stepKey)) return 'tracker';
    return 'prep';
  }, [booking, handover, signedByGuest, stepKey]);

  const activeStepIdx = useMemo(() => {
    if (stepKey === 'verification') return 0;
    if (stepKey === 'inspection') return 1;
    if (stepKey === 'signature') return 2;
    if (stepKey === 'complete') return 3;
    if (booking?.guestArrived) return 0;
    return -1;
  }, [stepKey, booking?.guestArrived]);

  const branch = branchById(booking?.pickupBranchId);

  const doArrive = async () => {
    setArriving(true);
    setError('');
    const res = await markGuestArrived(id);
    setArriving(false);
    if (res?.error) setError(res.error);
    else setNotice('You are marked as arrived. The front desk can now see you in their queue.');
  };

  const doSign = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!ack) return setError('Please confirm that the vehicle condition matches before signing.');
    if (!signatureText.trim()) return setError('Please type your full name to sign.');
    setSigning(true);
    const res = await submitGuestSignature(id, { signatureText });
    setSigning(false);
    if (res?.error) return setError(res.error);
    setNotice('Thank you — your signature has been recorded on the same record the front desk uses.');
  };

  if (view === 'loading') {
    return (
      <div className="clean-shell">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading your collection…</p>
      </div>
    );
  }

  if (view === 'unavailable') {
    return (
      <div className="clean-shell">
        <div className="lost-alert lost-alert-danger"><i className="bi bi-x-circle me-2" />This booking is no longer active.</div>
        <Link to="/Fleet/MyTrips" className="san-btn-secondary"><i className="bi bi-arrow-left me-2" />Back to my trips</Link>
      </div>
    );
  }

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Vehicle Collection</div>
          <h1 className="lost-title">{booking.vehicleName} <span className="text-muted">· {booking.ref}</span></h1>
          <p className="lost-copy">
            {view === 'prep' && 'Everything you need before you pick up your car.'}
            {view === 'tracker' && 'Watch your collection happen at the front desk — no action needed from you right now.'}
            {view === 'sign' && 'Review what the front desk recorded and sign to get your keys.'}
            {view === 'complete' && 'Your car is ready — you are all set to drive off.'}
          </p>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      {view === 'prep' && (
        <>
          <div className="dash-panel">
            <div className="dash-panel-header"><h2>Your pick-up details</h2></div>
            <div className="p-3">
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-calendar-event me-2" />Pick-up</span><strong>{formatGuestDate(booking.pickupDate)} {booking.pickupTime}</strong></div>
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-geo-alt me-2" />Collection point</span><strong>{branch?.name || 'Main branch'}</strong></div>
              {booking.dropoffDate && (
                <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-box-arrow-in-down me-2" />Planned return</span><strong>{formatGuestDate(booking.dropoffDate)} {booking.dropoffTime}</strong></div>
              )}
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-tag me-2" />Assigned vehicle</span><strong>{booking.unitNumber ? `Unit ${booking.unitNumber}` : 'To be assigned at the desk'}</strong></div>
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-card-text me-2" />Total charged</span><strong>{formatPrice(booking.estimatedTotal || 0)}</strong></div>
            </div>
          </div>

          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-bag-check me-2" />What to bring</h2></div>
            <div className="p-3">
              <ul className="mb-0" style={{ paddingLeft: '1.1rem' }}>
                <li className="task-sub mb-2">Your <strong>valid physical driver's licence</strong> — a photo or copy cannot be accepted.</li>
                <li className="task-sub mb-2">Arrive by your pick-up time of <strong>{booking.pickupTime}</strong> to keep your assigned car.</li>
                <li className="task-sub mb-2">If you are running late, the cancellation / no-show policy on your booking still applies.</li>
              </ul>
            </div>
          </div>

          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-send me-2" />Ready when you are</h2></div>
            <div className="p-3">
              <p className="task-sub mb-3">Let the front desk know you have arrived. Your collection will start on the next screen, and you can watch it live from your phone.</p>
              <button type="button" className="book-submit w-100" disabled={arriving} onClick={doArrive}>
                <i className="bi bi-geo-alt-fill me-2" />{arriving ? 'Notifying the desk…' : "I've arrived"}
              </button>
              <p className="text-muted small mt-2 text-center mb-0">You can also collect the car at the desk without your phone — this is optional.</p>
            </div>
          </div>
        </>
      )}

      {view === 'tracker' && (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2><i className="bi bi-broadcast me-2" />Live collection status</h2></div>
          <div className="p-3">
            {swapped && (
              <div className="lost-alert lost-alert-warning mb-3">
                <i className="bi bi-arrow-repeat me-2" />We're just swapping you to another vehicle — the front desk will be with you in a moment.
              </div>
            )}
            <ol className="list-unstyled mb-3">
              {TRACKER_STEPS.map((s, i) => {
                const done = activeStepIdx > i;
                const active = activeStepIdx === i;
                return (
                  <li key={s.key} className="d-flex gap-3 mb-3">
                    <span className={`fleet-trip-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}><span className="step-dot" /></span>
                    <div>
                      <div className={`fw-semibold ${active ? '' : 'text-muted'}`}><i className={`bi ${s.icon} me-2`} />{s.label}</div>
                      <div className="task-sub">{done ? 'Done' : active ? s.active : s.pending}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="lost-alert lost-alert-success" style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem' }}>
              <i className="bi bi-phone me-2" />You can relax — the desk is handling the paperwork. We'll prompt you here when your signature is needed.
            </p>
          </div>
        </div>
      )}

      {view === 'sign' && (
        <form onSubmit={doSign}>
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h2><i className="bi bi-clipboard-check me-2" />Review your condition report</h2>
              <span className="panel-actions">recorded {formatDateTime(handover?.createdAt || Date.now())}</span>
            </div>
            <div className="p-3">
              <div className="row g-3 mb-3">
                <div className="col-6"><div className="book-label">Odometer (km)</div><div className="fw-semibold">{Number(handover?.mileage || booking?.mileage || 0).toLocaleString()}</div></div>
                <div className="col-6"><div className="book-label">Fuel level</div><div className="fw-semibold">{handover?.fuelLevel ?? '100'}%</div></div>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead><tr><th>Checklist item</th><th>Condition</th></tr></thead>
                  <tbody>
                    {(handover?.items || []).map((it) => (
                      <tr key={it.label || it.name}>
                        <td className="task-name">{it.label || it.name}</td>
                        <td>
                          <span className={`fleet-badge ${it.condition === 'Damaged' || it.damaged ? 'fleet-badge-Cancelled' : it.condition === 'N/A' ? 'category-badge' : 'fleet-badge-SignedOff'}`}>
                            {it.condition === 'Damaged' || it.damaged ? 'Damaged' : it.condition || 'Good'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(handover?.photos || []).length > 0 && (
                <div className="d-flex gap-2 flex-wrap mt-3">
                  {handover.photos.map((p, i) => (
                    <img key={i} src={p} alt={`Vehicle photo ${i + 1}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #eee6da' }} />
                  ))}
                </div>
              )}
              {handover?.notes && (
                <div className="task-sub mt-3"><i className="bi bi-chat-left-text me-1" />{handover.notes}</div>
              )}
            </div>
          </div>

          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-pencil-square me-2" />Sign the condition report</h2></div>
            <div className="p-3">
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="AckCondition" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <label className="form-check-label" htmlFor="AckCondition">I have reviewed every checklist item above, and this matches what we walked around together.</label>
              </div>
              <label className="book-label" htmlFor="GuestSig">Sign with your typed full name</label>
              <input id="GuestSig" className="form-control book-input" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder={booking.guestName} autoComplete="off" />
              <button type="submit" className="book-submit mt-3 w-100" disabled={signing}>
                <i className="bi bi-pen me-2" />{signing ? 'Saving signature…' : 'Sign & request the keys'}
              </button>
              <p className="text-muted small mt-2 text-center mb-0">Your signature is written to the same handover record the front desk reads — one record, two views.</p>
            </div>
          </div>
        </form>
      )}

      {view === 'complete' && (
        <>
          <div className="dash-panel">
            <div className="dash-panel-header"><h2><i className="bi bi-box-arrow-right me-2" />You're on the road</h2></div>
            <div className="p-3 text-center">
              <div className="mb-3"><i className="bi bi-key-fill" style={{ fontSize: '2.4rem', color: '#2f7d4f' }} /></div>
              <p className="lost-copy">The keys have been handed over for your <strong>{booking.vehicleName}</strong>{booking.unitNumber ? ` (unit ${booking.unitNumber})` : ''}.</p>
              <p className="task-sub mb-3">
                {handover?.guestSignature ? `Condition report signed by ${handover.guestSignature}` : booking?.guestSignature ? `Condition report signed by ${booking.guestSignature}` : 'Condition report acknowledged'} ·
                {handover?.createdAt ? ` ${formatDateTime(handover.createdAt)}` : ''}
              </p>
              {(handover?.items || []).some((i) => i.condition === 'Damaged' || i.damaged) && (
                <p className="task-sub mb-3">Damage was noted at handover — the desk has a record for reference at return.</p>
              )}
              <Link to="/Fleet/MyTrips" className="san-btn-primary">
                <i className="bi bi-geo-alt me-2" />Track my trip
              </Link>
            </div>
          </div>
          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-receipt me-2" />Rental agreement</h2></div>
            <div className="p-3">
              <p className="task-sub mb-3">Your rental agreement and any exit gate pass are shared with the front desk's handover record automatically — no extra paperwork needed.</p>
              <Link to="/Fleet/MyTrips" className="san-btn-secondary w-100 text-center"><i className="bi bi-arrow-left me-2" />Back to my trips</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}