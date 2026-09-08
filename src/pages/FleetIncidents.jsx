import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeFleetIncidents,
  listFleetWorkOrders,
  openWorkOrderFromIncident,
  determineIncidentLiability,
  updateFleetIncident,
  bookingDisplay,
} from '../services/fleetService';
import { formatDateTime } from '../lib/utils';
import './guest.css';
import './rooms.css';
import './fleet.css';

const SEVERITIES = ['All', 'High', 'Medium', 'Low'];
const STATUS_FILTERS = ['All', 'Open', 'UnderReview', 'Adjudicating', 'Suspended', 'Resolved'];
const LIABILITIES = ['Guest fault', 'Normal wear & tear', 'Third party', 'Mechanical failure', 'Undetermined'];

export default function FleetIncidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [sev, setSev] = useState('All');
  const [status, setStatus] = useState('All');
  const [expanded, setExpanded] = useState('');
  const [liabDraft, setLiabDraft] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeFleetIncidents(setIncidents);
    listFleetWorkOrders().then(setWorkOrders).catch(() => {});
    return () => unsub && unsub();
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
    setNotice(`Work order ${res.ref || res.id} opened and vehicle marked in maintenance.`);
    setWorkOrders(await listFleetWorkOrders());
  };

  const doResolve = async (incident) => {
    const d = liabDraft[incident.id] || {};
    if (!d.liability) return setError(`Select a liability determination for ${incident.ref}.`);
    const res = await determineIncidentLiability(incident.id, {
      liability: d.liability,
      charge: d.charge || 0,
      description: d.note || incident.description,
      byName: user.name,
      reservationId: d.reservationId || '',
    });
    if (res?.error) return setError(res.error);
    setNotice(`${incident.ref} resolved · liability: ${d.liability}${res.chargeAmount ? ` · charged ${res.chargeAmount}` : ' · no charge'}.`);
    setLiabDraft((m) => ({ ...m, [incident.id]: undefined }));
  };

  const doReview = async (incident, to) => {
    await updateFleetIncident(incident.id, { patch: { status: to }, by: user.name, note: `Moved to ${to} by ${user.name}` });
  };

  const woById = (id) => workOrders.find((w) => w.id === id);

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Fleet · Incident Register</div>
          <h1 className="lost-title">Incident &amp; damage management</h1>
          <p className="lost-copy">
            Triage reported incidents, open repair work orders, determine liability and adjudicate disputes.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/Fleet/Incident/Report" className="san-btn-primary"><i className="bi bi-bug me-2" />New report</Link>
          <Link to="/Fleet/Dashboard" className="san-btn-secondary"><i className="bi bi-kanban me-2" />Ops</Link>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      <div className="metric-grid mb-4">
        {[
          { n: openOrders.length, label: 'Open incidents', icon: 'bi-bug', bg: 'linear-gradient(135deg,#8a3d2f,#6b241b)' },
          { n: highOpen.length, label: 'High severity open', icon: 'bi-exclamation-octagon', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
          { n: incidents.filter((i) => i.status === 'Resolved').length, label: 'Resolved', icon: 'bi-check2-circle', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
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

      <div className="d-flex gap-2 flex-wrap mb-3">
        {SEVERITIES.map((s) => (
          <button key={s} type="button" className={`lux-btn ${sev === s ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setSev(s)}>{s}</button>
        ))}
        <span className="vr mx-2" />
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" className={`lux-btn ${status === s ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>

      <div className="dash-panel">
        <div className="dash-panel-header"><h2>Incidents ({filtered.length})</h2></div>
        {filtered.length === 0 ? (
          <div className="dash-empty"><i className="bi bi-inboxes me-2" />No incidents match the current filters.</div>
        ) : (
          filtered.map((inc) => (
            <div key={inc.id} className="fleet-row" style={{ alignItems: 'flex-start' }}>
              <span className="fleet-thumb"><i className="bi bi-bug" /></span>
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className={`sev-chip sev-${inc.severity}`}>{inc.severity}</span>
                  <span className="fw-bold">{inc.category}</span>
                  <span className="text-muted small">· {inc.ref}</span>
                  <span className={`fleet-badge fleet-badge-${inc.status}`}>{bookingDisplay(inc.status)}</span>
                  {inc.flags?.map((f) => <span key={f} className="lint-tag"><i className="bi bi-flag me-1" />{f}</span>)}
                </div>
                <div className="dash-row-meta mt-1">
                  <span><i className="bi bi-person me-1" />{inc.reporterName} ({inc.reporterRole})</span>
                  <span><i className="bi bi-clock me-1" />{formatDateTime(inc.createdAt)}</span>
                </div>
                <div className="dash-row-meta">
                  {inc.vehicleName ? <span><i className="bi bi-car-front me-1" />{inc.vehicleName}</span> : null}
                  {inc.bookingId && <span><i className="bi bi-ticket me-1" />Booking</span>}
                  {inc.serviceId && <span><i className="bi bi-taxi-front me-1" />Shuttle</span>}
                  {inc.location?.label && <span><i className="bi bi-geo-alt me-1" />{inc.location.label}</span>}
                  {inc.liability && <span><i className="bi bi-shield-check me-1" />Liability: {inc.liability}</span>}
                  {inc.chargeAmount > 0 && <span><i className="bi bi-credit-card me-1" />Charged {inc.chargeAmount}</span>}
                  {woById(inc.linkedWorkOrderId) && (
                    <Link to="/Fleet/Maintenance" className="text-decoration-none"><span className="fleet-badge fleet-badge-InProgress"><i className="bi bi-wrench me-1" />{woById(inc.linkedWorkOrderId).ref}</span></Link>
                  )}
                </div>
                <div className="dash-row-meta small text-muted" style={{ maxWidth: 720 }}>{inc.description}</div>

                <div className="d-flex gap-2 flex-wrap mt-2">
                  {!['Resolved', 'Cancelled'].includes(inc.status) && inc.vehicleId && !inc.linkedWorkOrderId && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => doOpenWorkOrder(inc)}><i className="bi bi-wrench me-1" />Open work order</button>
                  )}
                  {['Suspended', 'Open'].includes(inc.status) && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => doReview(inc, 'UnderReview')}><i className="bi bi-search me-1" />Mark under review</button>
                  )}
                  {inc.status === 'UnderReview' && (
                    <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => doReview(inc, 'Adjudicating')}><i className="bi bi-balance-scale me-1" />Adjudicate dispute</button>
                  )}
                  {!['Resolved', 'Cancelled'].includes(inc.status) && (
                    <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setExpanded(expanded === inc.id ? '' : inc.id)}>
                      <i className="bi bi-chevron-down me-1" />{expanded === inc.id ? 'Collapse' : 'Inspect & resolve'}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-link" onClick={() => setExpanded(expanded === inc.id ? '' : inc.id)}>
                    {expanded === inc.id ? 'Hide details' : 'Show details'}
                  </button>
                </div>

                {expanded === inc.id && (
                  <div className="border rounded-3 mt-3 p-3">
                    <div className="d-flex flex-wrap gap-3 mb-2">
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
                    </div>
                    <div className="mt-3">
                      <strong className="d-block mb-2">Liability &amp; resolution</strong>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-3">
                          <select className="form-select form-select-sm" value={liabDraft[inc.id]?.liability || ''} onChange={(e) => setLiabDraft((m) => ({ ...m, [inc.id]: { ...(m[inc.id] || {}), liability: e.target.value } }))}>
                            <option value="">Liability…</option>
                            {LIABILITIES.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div className="col-md-2">
                          <input type="number" className="form-control form-control-sm" placeholder="Charge (R)" value={liabDraft[inc.id]?.charge || ''} onChange={(e) => setLiabDraft((m) => ({ ...m, [inc.id]: { ...(m[inc.id] || {}), charge: e.target.value } }))} />
                        </div>
                        <div className="col-md-3">
                          <input className="form-control form-control-sm" placeholder="Note / outcome" value={liabDraft[inc.id]?.note || ''} onChange={(e) => setLiabDraft((m) => ({ ...m, [inc.id]: { ...(m[inc.id] || {}), note: e.target.value } }))} />
                        </div>
                        <div className="col-md-2">
                          <input className="form-control form-control-sm" placeholder="Reservation id (optional)" value={liabDraft[inc.id]?.reservationId || ''} onChange={(e) => setLiabDraft((m) => ({ ...m, [inc.id]: { ...(m[inc.id] || {}), reservationId: e.target.value } }))} />
                        </div>
                        <div className="col-md-2 d-flex gap-2">
                          <button type="button" className="btn btn-sm btn-success flex-grow-1" disabled={!liabDraft[inc.id]?.liability} onClick={() => doResolve(inc)}><i className="bi bi-check-lg me-1" />Resolve</button>
                        </div>
                      </div>
                    </div>
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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}