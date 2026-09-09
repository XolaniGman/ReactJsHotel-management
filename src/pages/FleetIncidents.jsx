import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeFleetIncidents,
  subscribeFleetWorkOrders,
  listCarBookings,
  listFleetVehicles,
  openWorkOrderFromIncident,
  determineIncidentLiability,
  updateFleetIncident,
  allocateReplacementVehicle,
  bookingDisplay,
} from '../services/fleetService';
import { formatDateTime, formatPrice, round } from '../lib/utils';
import { accidentAdminFee } from '../lib/fleetAlgo';
import './guest.css';
import './rooms.css';
import './fleet.css';

const SEVERITIES = ['All', 'High', 'Medium', 'Low'];
const STATUS_FILTERS = ['All', 'Open', 'UnderReview', 'PendingGuestReview', 'Adjudicating', 'Suspended', 'Resolved'];
const LIABILITIES = ['Guest fault', 'Normal wear & tear', 'Third party', 'Mechanical failure', 'Undetermined'];
const MANAGER_ROLES = ['fleetmanager', 'admin', 'system'];

export default function FleetIncidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [sev, setSev] = useState('All');
  const [status, setStatus] = useState('All');
  const [expanded, setExpanded] = useState('');
  const [liabDraft, setLiabDraft] = useState({});
  const [allocDrafts, setAllocDrafts] = useState({});
  const [allocBusy, setAllocBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isManager = MANAGER_ROLES.includes(user.role);

  useEffect(() => {
    const incidentsUnsub = subscribeFleetIncidents(setIncidents);
    const workOrdersUnsub = subscribeFleetWorkOrders(setWorkOrders);
    listCarBookings().then(setBookings).catch(() => {});
    listFleetVehicles().then(setVehicles).catch(() => {});
    return () => {
      incidentsUnsub?.();
      workOrdersUnsub?.();
    };
  }, []);

  const filtered = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (sev === 'All' || i.severity === sev) &&
          (status === 'All' || i.status === status),
      ),
    [incidents, sev, status],
  );

  const openOrders = incidents.filter((i) => !['Resolved', 'Cancelled'].includes(i.status));
  const highOpen = incidents.filter((i) => i.severity === 'High' && i.status !== 'Resolved');

  const doOpenWorkOrder = async (incident) => {
    setError('');
    setNotice('');
    const res = await openWorkOrderFromIncident(incident.id, { createdBy: user.name });
    if (res?.error) return setError(res.error);
    setNotice(res.existing
      ? `Work order ${res.id} is already linked to this incident.`
      : `Work order ${res.ref || res.id} opened for vehicle repair.`);
  };

  const doResolve = async (incident) => {
    const d = liabDraft[incident.id];
    if (!d?.liability) return setError(`Select a liability determination for ${incident.ref}.`);
    const res = await determineIncidentLiability(incident.id, {
      liability: d.liability,
      repairEstimate: d.lines?.reduce((s, l) => s + Number(l.amount || 0), 0) || 0,
      chargeLines: d.lines || [],
      description: d.note || incident.description,
      byName: user.name,
    });
    if (res?.error) return setError(res.error);
    setNotice(`${incident.ref}: liability determined (${d.liability})${res.chargeAmount ? ` · proposed charge ${formatPrice(res.chargeAmount)}` : ' · no guest charge'} — awaiting guest review.`);
    setLiabDraft((m) => ({ ...m, [incident.id]: undefined }));
  };

  const doReview = async (incident, to) => {
    await updateFleetIncident(incident.id, { patch: { status: to }, by: user.name, note: `Moved to ${to} by ${user.name}` });
  };

  const woById = (id) => workOrders.find((w) => w.id === id);
  const bookingById = (id) => bookings.find((b) => b.id === id);
  const vehicleById = (id) => vehicles.find((v) => v.id === id);

  const setAllocDraft = (id, patch) => setAllocDrafts((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
  const availableVehicles = (inc) => vehicles.filter((v) => v.status === 'Available' && v.id !== inc.vehicleId);

  const doAllocate = async (incident) => {
    const d = allocDrafts[incident.id];
    if (!incident.bookingId) return setError('This incident has no rental booking to allocate a replacement to.');
    if (!d?.vehicleId) return setError('Pick a replacement unit first.');
    setError('');
    setNotice('');
    setAllocBusy(true);
    const res = await allocateReplacementVehicle(incident.bookingId, {
      vehicleId: d.vehicleId,
      incidentId: incident.id,
      by: user.name,
      reason: d.reason || 'Damaged unit — replacement allocated by fleet management',
    });
    setAllocBusy(false);
    if (res?.error) return setError(res.error);
    setNotice(`${incident.ref}: replacement ${res.vehicleName} (${res.unitNumber}) allocated to the guest. Booking re-quoted at ${formatPrice(res.estimatedTotal)} and ready for a fresh check-out.`);
    setAllocDrafts((m) => ({ ...m, [incident.id]: undefined }));
  };

  const STEP_FLOW = ['Open', 'UnderReview', 'PendingGuestReview', 'Adjudicating', 'Resolved'];
  const statusStep = (st) => STEP_FLOW.indexOf(st);
  const nextStep = (st) => STEP_FLOW[Math.min(STEP_FLOW.length - 1, statusStep(st) + 1)];

  const stepLabel = (st) =>
    st === 'Open' ? 'Reported'
      : st === 'UnderReview' ? 'Under review'
        : st === 'PendingGuestReview' ? 'Guest review'
          : st === 'Adjudicating' ? 'Adjudicating'
            : 'Resolved';

  const chargeBreakdown = (inc) => {
    const list = [];
    if (inc.chargeLines?.length) {
      inc.chargeLines.forEach((l) => list.push({ label: l.label, amount: Number(l.amount) }));
    } else if (inc.repairEstimate > 0) {
      list.push({ label: 'Vehicle damage repair', amount: inc.repairEstimate });
    }
    if (inc.adminFee > 0) list.push({ label: 'Accident admin fee', amount: inc.adminFee });
    return list;
  };

  const setDraft = (id, patch) => setLiabDraft((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
  const setLine = (id, idx, field, val) => {
    const lines = [...(liabDraft[id]?.lines || [{ label: '', amount: '' }])];
    lines[idx] = { ...lines[idx], [field]: val };
    setDraft(id, { lines });
  };
  const addLine = (id) => setDraft(id, { lines: [...(liabDraft[id]?.lines || [{ label: '', amount: '' }]), { label: '', amount: '' }] });
  const removeLine = (id, idx) => setDraft(id, { lines: (liabDraft[id]?.lines || []).filter((_, i) => i !== idx) });

  return (
    <div className="clean-shell fleet-incident-page">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Fleet · Incident Register</div>
          <h1 className="lost-title">Incident &amp; damage management</h1>
          <p className="lost-copy">
            See the vehicle, every reported damage and the exact amount the guest is being charged — then triage, repair and resolve.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/Fleet/Incident/Report" className="san-btn-primary"><i className="bi bi-bug me-2" />New report</Link>
          <Link to="/Fleet/Dashboard" className="san-btn-secondary"><i className="bi bi-kanban me-2" />Ops</Link>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      <div className="fleet-analytics-grid mb-4">
        {[
          {
            value: openOrders.length,
            label: 'Open incident load',
            detail: `${highOpen.length} high-priority case${highOpen.length === 1 ? '' : 's'} need attention`,
            icon: 'bi-exclamation-octagon',
            tone: 'danger',
            progress: incidents.length ? (openOrders.length / incidents.length) * 100 : 0,
            progressLabel: incidents.length ? `${Math.round((openOrders.length / incidents.length) * 100)}% active` : 'No cases yet',
          },
          {
            value: workOrders.filter((w) => !['SignedOff', 'Cancelled'].includes(w.status)).length,
            label: 'Repair pipeline',
            detail: `${workOrders.filter((w) => w.status === 'InProgress').length} in progress · ${vehicles.filter((v) => v.status === 'InMaintenance').length} vehicles held`,
            icon: 'bi-wrench-adjustable',
            tone: 'amber',
            progress: workOrders.length ? (workOrders.filter((w) => !['SignedOff', 'Cancelled'].includes(w.status)).length / workOrders.length) * 100 : 0,
            progressLabel: `${workOrders.filter((w) => w.status === 'InProgress').length} active now`,
          },
          {
            value: incidents.filter((i) => i.status === 'PendingGuestReview').length,
            label: 'Guest reviews waiting',
            detail: `${incidents.filter((i) => i.chargeAmount > 0).length} case${incidents.filter((i) => i.chargeAmount > 0).length === 1 ? '' : 's'} with proposed charges`,
            icon: 'bi-hourglass-split',
            tone: 'blue',
            progress: incidents.length ? (incidents.filter((i) => i.status === 'PendingGuestReview').length / incidents.length) * 100 : 0,
            progressLabel: 'Awaiting response',
          },
          {
            value: incidents.length ? `${Math.round((incidents.filter((i) => i.status === 'Resolved').length / incidents.length) * 100)}%` : '0%',
            label: 'Resolution rate',
            detail: `${incidents.filter((i) => i.status === 'Resolved').length} resolved of ${incidents.length} total cases`,
            icon: 'bi-check2-circle',
            tone: 'green',
            progress: incidents.length ? (incidents.filter((i) => i.status === 'Resolved').length / incidents.length) * 100 : 0,
            progressLabel: 'Closed cases',
          },
        ].map((card) => (
          <div className={`fleet-analytics-card fleet-analytics-${card.tone}`} key={card.label}>
            <div className="fleet-analytics-topline">
              <span className="fleet-analytics-icon"><i className={`bi ${card.icon}`} /></span>
              <span className="fleet-analytics-label">{card.label}</span>
              <i className="bi bi-arrow-up-right fleet-analytics-arrow" />
            </div>
            <div className="fleet-analytics-value">{card.value}</div>
            <div className="fleet-analytics-detail">{card.detail}</div>
            <div className="fleet-analytics-progress"><span style={{ width: `${Math.min(100, card.progress)}%` }} /></div>
            <div className="fleet-analytics-foot"><span>{card.progressLabel}</span><span>{Math.round(card.progress)}%</span></div>
          </div>
        ))}
      </div>

      <div className="d-flex gap-2 flex-wrap mb-3">
        {SEVERITIES.map((s) => (
          <button key={s} type="button" className={`lux-btn ${sev === s ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setSev(s)}>{s}</button>
        ))}
        <span className="vr mx-2" />
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" className={`lux-btn ${status === s ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <strong className="text-muted small text-uppercase tracking">Case register · {filtered.length} incident{filtered.length === 1 ? '' : 's'}</strong>
      </div>

      {filtered.length === 0 ? (
        <div className="dash-panel"><div className="dash-empty"><i className="bi bi-inboxes me-2" />No incidents match the current filters.</div></div>
      ) : (
        <div className="case-cards">
          {filtered.map((inc) => {
            const v = vehicleById(inc.vehicleId);
            const wo = woById(inc.linkedWorkOrderId);
            const woJobCost = wo ? (Number(wo.finalCost) || Number(wo.estimatedCost) || 0) : 0;
            const lines = chargeBreakdown(inc);
            const hasCharge = (inc.chargeAmount || 0) > 0;
            const d = liabDraft[inc.id];
            const draftLines = (d?.lines || []).filter((l) => (l.label || '').trim() && Number(l.amount) > 0);
            const draftTotal = draftLines.reduce((s, l) => s + Number(l.amount), 0);
            const previewFee = d?.liability === 'Guest fault' && draftTotal > 0 ? accidentAdminFee(draftTotal) : 0;
            const previewCharge = round(draftTotal + previewFee);
            const isClosed = ['Resolved', 'Cancelled'].includes(inc.status);

            return (
              <article className={`case-card ${inc.status === 'Suspended' ? 'case-card-suspended' : ''}`} key={inc.id}>
                <header className="case-header">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className={`sev-chip sev-${inc.severity}`}>{inc.severity} risk</span>
                    <h3 className="case-title">{inc.category}</h3>
                    <span className="text-muted small">{inc.ref}</span>
                    <span className={`fleet-badge fleet-badge-${inc.status}`}>{bookingDisplay(inc.status)}</span>
                    {inc.escalationTier === 'FleetManager+HotelManager' && (
                      <span className="fleet-flag fleet-flag-danger"><i className="bi bi-people-fill me-1" />Fleet + Hotel Manager notified</span>
                    )}
                    {inc.status === 'PendingGuestReview' && (
                      <span className="fleet-flag fleet-flag-warn"><i className="bi bi-hourglass-split me-1" />Awaiting guest response</span>
                    )}
                  </div>
                  <span className="case-time"><i className="bi bi-clock me-1" />{formatDateTime(inc.createdAt)}</span>
                </header>

                <div className="case-meta">
                  <span><i className="bi bi-person me-1" />{inc.reporterName} ({inc.reporterRole})</span>
                  {inc.bookingId && <span><i className="bi bi-ticket me-1" />Booking · {bookingById(inc.bookingId)?.status || 'linked'}</span>}
                  {inc.serviceId && <span><i className="bi bi-taxi-front me-1" />Shuttle</span>}
                  {inc.location?.label && <span><i className="bi bi-geo-alt me-1" />{inc.location.label}</span>}
                  {inc.flags?.map((f) => <span key={f} className="lint-tag"><i className="bi bi-flag me-1" />{f}</span>)}
                </div>

                <div className="case-body">
                  <div className="case-car">
                    {(v?.image || inc.vehicleImage)
                      ? <img src={v?.image || inc.vehicleImage} alt={v?.name || inc.vehicleName || 'Vehicle'} className="case-car-img" loading="lazy" />
                      : (
                        <div className="case-car-ph"><i className="bi bi-car-front" /></div>
                      )}
                    <div className="case-car-info">
                      <div className="task-name">{v?.name || inc.vehicleName || 'Unknown vehicle'}</div>
                      <div className="task-sub">
                        {v?.unitNumber && <span>{v.unitNumber}</span>}{v?.plateNumber ? <span> · {v.plateNumber}</span> : null}
                      </div>
                      {v && <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>}
                      {!v && inc.vehicleName && <span className="task-sub">No vehicle record linked</span>}
                    </div>
                  </div>

                  <div className="case-charges">
                    <div className="case-charges-head"><i className="bi bi-receipt me-2" />Damage &amp; guest charges</div>
                    {lines.length > 0 && lines.map((l, i) => (
                      <div className="charge-line" key={i}><span>{l.label}</span><strong>{formatPrice(l.amount)}</strong></div>
                    ))}
                    {hasCharge && (
                      <div className="charge-line charge-line-total">
                        <span className="fw-bold">Proposed charge to guest</span>
                        <strong className="charge-amount">{formatPrice(inc.chargeAmount)}</strong>
                      </div>
                    )}
                    {inc.liability && !hasCharge && (
                      <div className="charge-line-charge-free">
                        <i className="bi bi-shield-check me-1" />No guest charge · liability: {inc.liability}
                      </div>
                    )}
                    {!lines.length && !hasCharge && !inc.liability && (
                      <div className="charge-empty">
                        {wo
                          ? (<><i className="bi bi-wrench me-1" />Repair job {wo.ref} opened (est. {formatPrice(woJobCost)}) — liability & charge not determined yet.</>)
                          : (<><i className="bi bi-hourglass-split me-1" />No charges yet — open a work order and resolve liability to propose an amount.</>)}
                      </div>
                    )}
                    {wo && <div className="charge-wo"><i className="bi bi-gear me-1" />Fleet repair job {wo.ref} · {wo.status}</div>}
                  </div>
                </div>

                <div className="case-stage">
                  {STEP_FLOW.map((s, i) => (
                    <span key={s} className="step-seg" style={{ opacity: statusStep(inc.status) === -1 ? 0.35 : 1 }}>
                      <span className={`step-dot ${statusStep(inc.status) >= i ? 'step-dot-on' : ''}`} />
                      <span className={`small ${i === statusStep(inc.status) ? 'fw-bold' : 'text-muted'}`}>{stepLabel(s)}</span>
                      {i < STEP_FLOW.length - 1 && <i className="bi bi-chevron-right step-arrow" />}
                    </span>
                  ))}
                  {inc.status === 'Suspended' && (
                    <span className="fleet-flag fleet-flag-danger ms-2"><i className="bi bi-pause-circle me-1" />Suspended — booking/service auto-put on hold</span>
                  )}
                  {inc.status !== 'Suspended' && statusStep(inc.status) !== -1 && statusStep(inc.status) < STEP_FLOW.length - 1 && (
                    <button type="button" className="btn btn-sm btn-link p-0 ms-1 text-decoration-none" onClick={() => doReview(inc, nextStep(inc.status))}>
                      Advance to {stepLabel(nextStep(inc.status))} →</button>
                  )}
                </div>

                {inc.evidence?.length > 0 && (
                  <div className="case-strip">
                    {inc.evidence.map((e, i) => <img key={i} src={e.dataUrl} alt={e.name} className="evidence-thumb" title={e.name} />)}
                    <span className="small text-muted"><i className="bi bi-camera me-1" />{inc.evidence.length} photo{inc.evidence.length === 1 ? '' : 's'}</span>
                  </div>
                )}

                <div className="case-actions">
                  {!isClosed && inc.vehicleId && !inc.linkedWorkOrderId && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => doOpenWorkOrder(inc)}>
                      <i className="bi bi-wrench-adjustable me-1" />Assign to maintenance now
                    </button>
                  )}
                  {inc.linkedWorkOrderId && wo && (
                    <Link to="/Fleet/Maintenance" className="btn btn-sm btn-outline-warning">
                      <i className="bi bi-wrench me-1" />{wo.ref} · {wo.status}
                    </Link>
                  )}
                  {bookingById(inc.bookingId)?.status === 'CheckedOut' && (
                    <Link to={`/Fleet/Handover/${inc.bookingId}?type=CheckIn`} className="btn btn-sm btn-outline-success">
                      <i className="bi bi-box-arrow-in-down me-1" />Complete check-in
                    </Link>
                  )}
                  {bookingById(inc.bookingId)?.status === 'PendingInspection' && (
                    <span className="fleet-flag fleet-flag-warn"><i className="bi bi-clipboard-check me-1" />Returned — awaiting post-rental inspection (complete it on Fleet Ops)</span>
                  )}
                  {bookingById(inc.bookingId)?.status === 'Confirmed' && (
                    <Link to={`/Fleet/Handover/${inc.bookingId}?type=CheckOut`} className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-box-arrow-up-right me-1" />Complete check-out
                    </Link>
                  )}
                  {['Suspended', 'Open'].includes(inc.status) && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => doReview(inc, 'UnderReview')}><i className="bi bi-search me-1" />Mark under review</button>
                  )}
                  {inc.status === 'UnderReview' && (
                    <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => doReview(inc, 'Adjudicating')}><i className="bi bi-balance-scale me-1" />Adjudicate dispute</button>
                  )}
                  <button type="button" className={`btn btn-sm ${expanded === inc.id ? 'btn-secondary' : 'btn-outline-dark'}`} onClick={() => setExpanded(expanded === inc.id ? '' : inc.id)}>
                    <i className={`bi ${expanded === inc.id ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`} />{expanded === inc.id ? 'Collapse' : 'Inspect & resolve'}
                  </button>
                </div>

                {expanded === inc.id && (
                  <div className="case-expand">
                    <div className="d-flex flex-wrap gap-3 mb-3">
                      {inc.evidence?.map((e, i) => (
                        <div key={i}>
                          <img src={e.dataUrl} alt={e.name} className="evidence-thumb" style={{ width: 96, height: 96 }} />
                          <div className="small text-muted mt-1"><code>{e.checksum}</code></div>
                        </div>
                      ))}
                    </div>

                    <div className="row g-2 small">
                      <div className="col-md-6"><strong>Date/time:</strong> {formatDateTime(inc.occurredAt)}</div>
                      <div className="col-md-6"><strong>Flags:</strong> {inc.flags?.length ? inc.flags.join(' · ') : 'None'}</div>
                      <div className="col-md-6"><strong>Third party:</strong> {inc.thirdPartyInvolved ? (inc.otherPartyDetails || 'Yes') : 'No'}</div>
                      <div className="col-md-6"><strong>Police ref:</strong> {inc.policeRef || '-'} · <strong>Insurance:</strong> {inc.insuranceRef || '-'}</div>
                      <div className="col-md-6"><strong>Undriveable:</strong> {inc.undriveable ? 'Yes' : 'No'} · <strong>Injuries:</strong> {inc.injuries ? 'Yes' : 'No'}</div>
                      {inc.location?.lat && <div className="col-md-6"><strong>Location:</strong> {inc.location.lat}, {inc.location.lng}</div>}
                      <div className="col-12"><strong>Description:</strong> {inc.description}</div>
                    </div>

                    <div className="case-resolve mt-3">
                      <strong className="d-block mb-2">Liability &amp; guest charge</strong>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-3">
                          <select className="form-select form-select-sm" value={d?.liability || ''} onChange={(e) => setDraft(inc.id, { liability: e.target.value })}>
                            <option value="">Liability…</option>
                            {LIABILITIES.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div className="col-md-9">
                          <input className="form-control form-control-sm" placeholder="Note / outcome" value={d?.note || ''} onChange={(e) => setDraft(inc.id, { note: e.target.value })} />
                        </div>
                      </div>

                      <div className="line-editor mt-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small text-muted">Damage charges line-by-line (only billed to the guest when liability is &quot;Guest fault&quot;)</span>
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addLine(inc.id)}><i className="bi bi-plus-lg me-1" />Add damage</button>
                        </div>
                        {(d?.lines || [{ label: '', amount: '' }]).map((ln, idx) => (
                          <div className="line-editor-row" key={idx}>
                            <input className="form-control form-control-sm" placeholder="Damage — e.g. Front bumper scrape" value={ln.label} onChange={(e) => setLine(inc.id, idx, 'label', e.target.value)} />
                            <input type="number" min="0" className="form-control form-control-sm" placeholder="R amount" value={ln.amount} onChange={(e) => setLine(inc.id, idx, 'amount', e.target.value)} />
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => removeLine(inc.id, idx)}><i className="bi bi-x" /></button>
                          </div>
                        ))}
                        {d?.liability === 'Guest fault' && (
                          <div className="charge-recap mt-2">
                            Damage total <strong>{formatPrice(draftTotal)}</strong>
                            + accident admin fee <strong>{formatPrice(previewFee)}</strong>
                            = <strong className="charge-amount">proposed {formatPrice(previewCharge)}</strong>
                          </div>
                        )}
                        {d?.liability && d.liability !== 'Guest fault' && (
                          <div className="charge-recap charge-recap-free mt-2"><i className="bi bi-shield-check me-1" />Liability outside the guest — no charge to the guest. Minimal admin fee may apply for guest-liable items only.</div>
                        )}
                        <div className="d-flex gap-2 mt-2">
                          <button type="button" className="btn btn-sm btn-success" disabled={!d?.liability} onClick={() => doResolve(inc)}>
                            <i className="bi bi-check-lg me-1" />Send to guest for review
                          </button>
                        </div>
                        <div className="text-muted small mt-1">
                          R500 admin fee (or R150 for jobs under R300) is added automatically. The guest must accept before anything posts.
                        </div>
                      </div>
                    </div>

                    {inc.bookingId && (
                      <div className="case-resolve mt-3">
                        <strong className="d-block mb-1"><i className="bi bi-arrow-repeat me-1" />Guest relief — allocate a replacement rental car</strong>
                        <span className="small text-muted d-block mb-2">
                          For {bookingById(inc.bookingId)?.guestName || 'the guest'} · booking {bookingById(inc.bookingId)?.ref || inc.bookingId}. Picks an available unit, re-quotes the rental and — if the incident suspended it — reactivates the booking so the guest can continue.
                        </span>
                        {isManager ? (
                          <>
                            {bookingById(inc.bookingId)?.replacementVehicleName && (
                              <div className="charge-recap charge-recap-free mb-2">
                                <i className="bi bi-check-circle me-1" />Replacement already allocated: <strong>{bookingById(inc.bookingId)?.replacementVehicleName}</strong>{bookingById(inc.bookingId)?.replacementBy ? ` by ${bookingById(inc.bookingId)?.replacementBy}` : ''} — you can swap it again below.
                              </div>
                            )}
                            <div className="row g-2 align-items-end">
                              <div className="col-md-4">
                                <select className="form-select form-select-sm" value={allocDrafts[inc.id]?.vehicleId || ''} onChange={(e) => setAllocDraft(inc.id, { vehicleId: e.target.value })}>
                                  <option value="">Pick an available unit…</option>
                                  {availableVehicles(inc).map((v) => (
                                    <option key={v.id} value={v.id}>{v.name} · {v.unitNumber || v.plateNumber} — {formatPrice(v.pricePerDay)}/day</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-6">
                                <input className="form-control form-control-sm" placeholder="Reason (e.g. damaged unit taken out of service)" value={allocDrafts[inc.id]?.reason || ''} onChange={(e) => setAllocDraft(inc.id, { reason: e.target.value })} />
                              </div>
                              <div className="col-md-2">
                                <button type="button" className="btn btn-sm btn-success w-100" disabled={allocBusy || !allocDrafts[inc.id]?.vehicleId} onClick={() => doAllocate(inc)}>
                                  <i className="bi bi-arrow-repeat me-1" />Allocate
                                </button>
                              </div>
                            </div>
                            {availableVehicles(inc).length === 0 && (
                              <div className="text-muted small mt-1"><i className="bi bi-info-circle me-1" />No available units right now — check one in or sign off a maintenance repair first.</div>
                            )}
                          </>
                        ) : (
                          <div className="small text-muted"><i className="bi bi-shield-lock me-1" />Only Fleet Managers and Admins can allocate a replacement unit.</div>
                        )}
                      </div>
                    )}

                    <div className="small text-muted mt-3">
                      <strong>Audit trail</strong>
                      <ul className="mb-0 mt-1 ps-3">
                        {inc.history?.map((h, i) => (
                          <li key={i}>{formatDateTime(h.at)} — {h.to} by {h.by}: {h.note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}