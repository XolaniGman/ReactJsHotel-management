import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeCarBooking,
  subscribeHandoverForBooking,
  markGuestReturning,
  acknowledgeReturnSummary,
  reviewPendingCharge,
  resolveIncidentReview,
  listFleetIncidents,
} from '../services/fleetService';
import { branchById, dropoffPreview, computeReturnSettlement } from '../lib/fleetAlgo';
import { formatGuestDate, formatDateTime, formatPrice } from '../lib/utils';
import './guest.css';
import './fleet.css';

const TRACKER_STEPS = [
  { key: 'returning', label: 'Return logged', icon: 'bi-geo-alt', pending: "Let the front desk know when you're heading back", active: "You're on your way back" },
  { key: 'inspection', label: 'Vehicle inspection', icon: 'bi-search', pending: 'The front desk will inspect the vehicle with you', active: 'The front desk is inspecting the vehicle with you…' },
  { key: 'charges', label: 'Charges review', icon: 'bi-receipt', pending: 'Any final charges will appear here for you to review', active: 'Reviewing your final charges…' },
  { key: 'complete', label: 'Return complete', icon: 'bi-check-circle', pending: 'A confirmation appears here once everything is settled', active: 'All settled — thanks for returning safely!' },
];

const LIABILITY_DETERMINED = ['PendingGuestReview', 'Adjudicating', 'Resolved'];

export default function GuestReturnFlow() {
  const { id } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [handover, setHandover] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [returning, setReturning] = useState(false);
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeCarBooking(id, setBooking), [id]);
  useEffect(() => subscribeHandoverForBooking(id, setHandover), [id]);

  useEffect(() => {
    (async () => {
      const all = await listFleetIncidents();
      setIncidents(all.filter((i) => i.bookingId === id));
    })();
  }, [id, booking?.status]);

  const stepKey = booking?.returnProgress?.step || (booking?.guestReturning ? 'RETURN_LOGGED' : 'scheduled');

  const view = useMemo(() => {
    if (!booking) return 'loading';
    if (booking.status === 'Cancelled') return 'unavailable';
    if (!['CheckedOut', 'PendingInspection', 'CheckedIn'].includes(booking.status)) return 'notYet';
    if (booking.status === 'CheckedIn') return 'complete';
    if (booking.status === 'PendingInspection') return 'charges';
    if (booking.guestReturning || ['RETURN_LOGGED', 'INSPECTION_IN_PROGRESS', 'LIABILITY_PENDING', 'CHARGES_REVIEW'].includes(stepKey)) return 'tracker';
    return 'prep';
  }, [booking, stepKey]);

  const activeStepIdx = useMemo(() => {
    if (stepKey === 'RETURN_LOGGED' || stepKey === 'returning') return 0;
    if (stepKey === 'INSPECTION_IN_PROGRESS' || stepKey === 'inspection') return 1;
    if (stepKey === 'LIABILITY_PENDING') return 1;
    if (stepKey === 'CHARGES_REVIEW' || stepKey === 'charges') return 2;
    if (stepKey === 'COMPLETE' || stepKey === 'complete') return 3;
    return -1;
  }, [stepKey]);

  const branch = branchById(booking?.returnBranchId || booking?.pickupBranchId);
  const dropoff = booking ? dropoffPreview({ dropoffDate: booking.dropoffDate, dropoffTime: booking.dropoffTime }) : null;
  const settlement = booking ? computeReturnSettlement(booking) : null;
  const heldCharges = (booking?.pendingCharges || []).filter((c) => c.status === 'Held');
  const postedCharges = (booking?.pendingCharges || []).filter((c) => c.status === 'Posted');
  const disputedCharges = (booking?.pendingCharges || []).filter((c) => c.status === 'Disputed');
  const guestIncident = incidents.find((i) => i.status === 'PendingGuestReview');
  const determinedIncidents = incidents.filter((i) => i.id !== guestIncident?.id && LIABILITY_DETERMINED.includes(i.status));
  const undeterminedIncidents = incidents.filter((i) => i.id !== guestIncident?.id && !LIABILITY_DETERMINED.includes(i.status));

  const doReturning = async () => {
    setReturning(true);
    setError('');
    const res = await markGuestReturning(id);
    setReturning(false);
    if (res?.error) setError(res.error);
    else setNotice("You're marked as heading back — the front desk will be ready for you.");
  };

  const doAck = async () => {
    setAcking(true);
    setError('');
    const res = await acknowledgeReturnSummary(id, { by: user?.name });
    setAcking(false);
    if (res?.error) return setError(res.error);
    setAcked(true);
    setNotice('Thanks — noted. The front desk can finalize your return at any time.');
  };

  const doReviewCharge = async (item, action) => {
    const res = await reviewPendingCharge(id, item.id, { action, by: user?.name });
    if (res?.error) return setError(res.error);
    setError('');
    setNotice(action === 'accept' ? `You accepted the charge: ${item.description}.` : `You flagged for review: ${item.description} — it's been sent to the Fleet Manager.`);
  };

  const doReviewIncident = async (incident, action) => {
    const res = await resolveIncidentReview(incident.id, { action, by: user?.name, reservationId: booking?.reservationId });
    if (res?.error) return setError(res.error);
    setError('');
    setNotice(action === 'accept' ? 'You accepted the liability determination.' : 'You flagged the liability determination for review by the Fleet Manager.');
  };

  if (view === 'loading') {
    return (
      <div className="clean-shell">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading your return…</p>
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

  if (view === 'notYet') {
    return (
      <div className="clean-shell">
        <div className="dash-empty"><i className="bi bi-info-circle me-2" />There's nothing to return yet for this booking.</div>
        <Link to="/Fleet/MyTrips" className="san-btn-secondary mt-3"><i className="bi bi-arrow-left me-2" />Back to my trips</Link>
      </div>
    );
  }

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Vehicle Return</div>
          <h1 className="lost-title">{booking.vehicleName} <span className="text-muted">· {booking.ref}</span></h1>
          <p className="lost-copy">
            {view === 'prep' && 'Everything you need before you bring the car back.'}
            {view === 'tracker' && 'Watch your return happen at the front desk — no action needed from you right now.'}
            {view === 'charges' && 'Review exactly what the front desk recorded and any final charges.'}
            {view === 'complete' && 'Your return is settled — thanks for renting with us.'}
          </p>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      {view === 'prep' && (
        <>
          <div className="dash-panel">
            <div className="dash-panel-header"><h2>Your return details</h2></div>
            <div className="p-3">
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-calendar-event me-2" />Return by</span><strong>{formatGuestDate(booking.dropoffDate)} {booking.dropoffTime}</strong></div>
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-geo-alt me-2" />Return point</span><strong>{branch?.name || 'Main branch'}</strong></div>
              {booking.handoverOut && (
                <>
                  <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-fuel-pump me-2" />Agreed fuel level</span><strong>Return at {booking.handoverOut.fuelLevel}% (as collected)</strong></div>
                  <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-speedometer2 me-2" />Odometer at pick-up</span><strong>{Number(booking.handoverOut.mileage || 0).toLocaleString()} km</strong></div>
                </>
              )}
              <div className="fleet-quote-row"><span className="text-muted"><i className="bi bi-shield-lock me-2" />Deposit held</span><strong>{formatPrice(booking.authorisationHoldAmount || booking.deposit || 0)}</strong></div>
            </div>
          </div>

          {dropoff?.hoursUntilDropoff != null && (
            <div className={`lost-alert mt-4 ${dropoff.isOverdue ? 'lost-alert-danger' : 'lost-alert-warning'}`}>
              <i className={`bi ${dropoff.isOverdue ? 'bi-exclamation-triangle' : 'bi-clock'} me-2`} />
              {dropoff.isOverdue
                ? `This rental was due back ${formatGuestDate(booking.dropoffDate)} ${booking.dropoffTime} — please return it as soon as possible.`
                : dropoff.hoursUntilDropoff > 24
                  ? `${Math.floor(dropoff.hoursUntilDropoff / 24)}d ${Math.round(dropoff.hoursUntilDropoff % 24)}h until your return is due.`
                  : `${Math.round(dropoff.hoursUntilDropoff)}h until your return is due.`}
            </div>
          )}

          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-send me-2" />Heading back?</h2></div>
            <div className="p-3">
              <p className="task-sub mb-3">Let the front desk know you're on your way. Your return will start on the next screen, and you can watch it live from your phone.</p>
              <button type="button" className="book-submit w-100" disabled={returning} onClick={doReturning}>
                <i className="bi bi-geo-alt-fill me-2" />{returning ? 'Notifying the desk…' : "I'm heading back"}
              </button>
              <p className="text-muted small mt-2 text-center mb-0">Optional — you can also return the car at the desk without your phone.</p>
            </div>
          </div>
        </>
      )}

      {view === 'tracker' && (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2><i className="bi bi-broadcast me-2" />Live return status</h2></div>
          <div className="p-3">
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
              <i className="bi bi-phone me-2" />You can relax — the desk is handling the walkaround. We'll show you the charges review here as soon as it's ready.
            </p>
          </div>
        </div>
      )}

      {view === 'charges' && (
        <>
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h2><i className="bi bi-clipboard-check me-2" />Inspection summary</h2>
              <span className="panel-actions">recorded {formatDateTime(handover?.createdAt || booking.handoverIn?.at || Date.now())}</span>
            </div>
            <div className="p-3">
              <div className="row g-3 mb-3">
                <div className="col-6"><div className="book-label">Odometer at return</div><div className="fw-semibold">{Number(handover?.mileage || booking.handoverIn?.mileage || 0).toLocaleString()} km</div></div>
                <div className="col-6">
                  <div className="book-label">Fuel at return</div>
                  <div className="fw-semibold">
                    {handover?.fuelLevel ?? booking.handoverIn?.fuelLevel ?? '—'}%
                    {booking.handoverOut && (handover?.fuelLevel ?? booking.handoverIn?.fuelLevel) < booking.handoverOut.fuelLevel && (
                      <span className="text-muted"> — below the agreed {booking.handoverOut.fuelLevel}% return level</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead><tr><th>Checklist item</th><th>Condition at return</th></tr></thead>
                  <tbody>
                    {(handover?.items || []).map((it) => {
                      const isDamaged = it.condition === 'Damaged' || it.damaged;
                      return (
                        <tr key={it.label || it.name}>
                          <td className="task-name">{it.label || it.name}</td>
                          <td>
                            <span className={`fleet-badge ${isDamaged ? 'fleet-badge-Cancelled' : it.condition === 'N/A' ? 'category-badge' : 'fleet-badge-SignedOff'}`}>
                              {isDamaged ? 'New issue flagged' : it.condition || 'Unchanged'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(handover?.photos || []).length > 0 && (
                <div className="mt-3">
                  <div className="book-label mb-2">Photos captured at return</div>
                  <div className="d-flex gap-2 flex-wrap">
                    {handover.photos.map((p, i) => (
                      <img key={i} src={p} alt={`Vehicle photo ${i + 1}`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #eee6da' }} />
                    ))}
                  </div>
                </div>
              )}
              {guestIncident && (
                <div className="lost-alert lost-alert-warning mt-3">
                  <i className="bi bi-shield-exclamation me-2" />
                  Incident {guestIncident.ref}: liability determined as <strong>{guestIncident.liability}</strong>
                  {guestIncident.chargeAmount > 0 ? ` — proposed charge ${formatPrice(guestIncident.chargeAmount)}` : ' — no charge'}.
                  <div className="d-flex gap-1 mt-2">
                    <button type="button" className="btn btn-sm btn-success" onClick={() => doReviewIncident(guestIncident, 'accept')}>Accept</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => doReviewIncident(guestIncident, 'dispute')}>Flag for review</button>
                  </div>
                </div>
              )}
              {determinedIncidents.map((incident) => (
                <div className="lost-alert lost-alert-warning mt-3" key={incident.id}>
                  <i className="bi bi-shield-check me-2" />
                  Incident {incident.ref}: liability determined as <strong>{incident.liability}</strong>
                  {incident.chargeAmount > 0 ? ` — charge ${formatPrice(incident.chargeAmount)}` : ' — no charge'}.
                  {incident.status === 'Adjudicating' && ' Still under Fleet Manager review after your dispute.'}
                  {incident.status === 'Resolved' && ' Resolved.'}
                </div>
              ))}
              {undeterminedIncidents.length > 0 && (
                <div className="task-sub mt-3"><i className="bi bi-hourglass-split me-1" />An incident is on file for this return — liability is still under review.</div>
              )}
            </div>
          </div>

          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-receipt-cutoff me-2" />Charges review</h2></div>
            <div className="p-3">
              {heldCharges.length === 0 && postedCharges.length === 0 ? (
                <p className="task-sub mb-0"><i className="bi bi-check-circle me-1" />No late, fuel or damage charges — nothing else is due.</p>
              ) : (
                [...heldCharges, ...postedCharges].map((item) => (
                  <div className="fleet-charge-item" key={item.id}>
                    <div>
                      <div className="task-sub">{item.description}</div>
                      <strong>{formatPrice(item.amount)}</strong>{' '}
                      <span className={`fleet-charge-status ${item.status}`}>{item.status}</span>
                    </div>
                    {item.status === 'Held' && (
                      <div className="d-flex gap-1">
                        <button type="button" className="btn btn-sm btn-success" onClick={() => doReviewCharge(item, 'accept')}>Accept</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => doReviewCharge(item, 'dispute')}>Flag for review</button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {disputedCharges.map((item) => (
                <div className="fleet-charge-item" key={item.id}>
                  <div>
                    <div className="task-sub">{item.description}</div>
                    <strong>{formatPrice(item.amount)}</strong>{' '}
                    <span className="fleet-charge-status Disputed">Under review</span>
                  </div>
                </div>
              ))}

              {settlement && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px dashed #e7ddcd' }}>
                  <div className="fleet-quote-row"><span className="text-muted">Deposit held</span><strong>{formatPrice(settlement.depositHeld)}</strong></div>
                  <div className="fleet-quote-row mt-1"><span className="text-muted">Charges</span><strong>{formatPrice(settlement.charges)}</strong></div>
                  {settlement.disputedCharges > 0 && (
                    <div className="fleet-quote-row mt-1"><span className="text-muted">Under review (not yet included)</span><strong>{formatPrice(settlement.disputedCharges)}</strong></div>
                  )}
                  <div className="fleet-quote-total mt-2">
                    <span>{settlement.refundDue > 0 ? 'Refund due' : 'Amount due'}</span>
                    <span className="amount">{formatPrice(settlement.refundDue > 0 ? settlement.refundDue : settlement.amountDue)}</span>
                  </div>
                </div>
              )}

              <button type="button" className="san-btn-secondary w-100 mt-3" disabled={acking || acked} onClick={doAck}>
                <i className="bi bi-check2-circle me-2" />{acked ? 'Marked as looks correct' : acking ? 'Saving…' : 'Looks correct'}
              </button>
              <p className="text-muted small mt-2 text-center mb-0">
                <i className="bi bi-info-circle me-1" />This is just an acknowledgement — the front desk can finalize your return whether or not you respond here.
              </p>
            </div>
          </div>
        </>
      )}

      {view === 'complete' && (
        <>
          <div className="dash-panel">
            <div className="dash-panel-header"><h2><i className="bi bi-check-circle me-2" />Return complete</h2></div>
            <div className="p-3 text-center">
              <div className="mb-3"><i className="bi bi-check-circle-fill" style={{ fontSize: '2.4rem', color: '#2f7d4f' }} /></div>
              <p className="lost-copy">Your <strong>{booking.vehicleName}</strong>{booking.unitNumber ? ` (unit ${booking.unitNumber})` : ''} has been checked in and your rental is closed out.</p>
              {settlement && (
                <p className="task-sub mb-3">
                  {settlement.refundDue > 0
                    ? `Refund due: ${formatPrice(settlement.refundDue)}`
                    : settlement.amountDue > 0
                      ? `Amount due: ${formatPrice(settlement.amountDue)}`
                      : 'Deposit fully released — nothing further is due.'}
                </p>
              )}
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                <button type="button" className="san-btn-secondary" onClick={() => window.print()}>
                  <i className="bi bi-printer me-2" />Print return receipt
                </button>
                <Link to="/Fleet/MyTrips" className="san-btn-primary">
                  <i className="bi bi-receipt me-2" />View charges &amp; payments
                </Link>
              </div>
            </div>
          </div>
          <div className="panel-card mt-4">
            <div className="panel-header"><h2><i className="bi bi-receipt me-2" />Return receipt</h2></div>
            <div className="p-3">
              <div className="row g-2 text-muted small">
                <div className="col-md-4"><strong className="text-dark d-block">Booking ref</strong>{booking.ref}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Checked in</strong>{formatDateTime(booking.finalizedAt)}</div>
                <div className="col-md-4"><strong className="text-dark d-block">Finalized by</strong>{booking.finalizedBy || 'Front Desk'}</div>
              </div>
              <p className="text-muted small mt-3 mb-0">
                <i className="bi bi-info-circle me-1" />Generated in-app — this demo has no email/SMS backend to deliver it automatically.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
