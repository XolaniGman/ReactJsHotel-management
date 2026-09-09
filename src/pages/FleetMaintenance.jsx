import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  subscribeFleetWorkOrders,
  subscribeFleetVehicles,
  listFleetDrivers,
  createFleetWorkOrder,
  advanceFleetWorkOrder,
  updateFleetWorkOrder,
  bookingDisplay,
} from '../services/fleetService';
import { formatPrice, formatDateTime } from '../lib/utils';
import './maintenance.css';
import './guest.css';
import './rooms.css';
import './fleet.css';
import './palm.css';

const APPROVAL_THRESHOLD = 2000;
const RTC_ITEMS = [
  'Repair / cleaning complete — no visible damage',
  'Fluid levels topped up & engine healthy',
  'Tyres inspected — tread & pressure legal',
  'Electronics, AC, lights & wipers working',
  'Road test passed (braking, steering, ride)',
  'Interior cleaned & stock levels restored',
];
const STATUSES = ['All', 'Open', 'AwaitingApproval', 'InProgress', 'AwaitingParts', 'Completed', 'SignedOff'];
const SOURCES = ['Scheduled', 'Predictive', 'Incident', 'Manual'];
const SOURCE_FILTERS = [
  { key: 'Damage', label: 'Damage · check-in & incidents', icon: 'bi-bug-fill' },
  { key: 'All', label: 'All sources', icon: 'bi-collection' },
  { key: 'CheckIn', label: 'Check-in damage', icon: 'bi-box-arrow-in-down' },
  { key: 'Incident', label: 'Incident', icon: 'bi-exclamation-diamond' },
  { key: 'Scheduled', label: 'Scheduled', icon: 'bi-calendar-check' },
  { key: 'Predictive', label: 'Predictive', icon: 'bi-graph-up-arrow' },
  { key: 'Manual', label: 'Manual', icon: 'bi-tools' },
];

const SOURCE_TAG = {
  CheckIn: { label: 'Check-in damage', icon: 'bi-box-arrow-in-down' },
  Incident: { label: 'Incident damage', icon: 'bi-exclamation-diamond' },
  Scheduled: { label: 'Scheduled service', icon: 'bi-calendar-check' },
  Predictive: { label: 'Predictive', icon: 'bi-graph-up-arrow' },
  Manual: { label: 'Manual', icon: 'bi-tools' },
};

export default function FleetMaintenance() {
  const { user } = useAuth();
  const isManager = ['fleetmanager', 'admin', 'system'].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('Damage');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', source: 'Manual', priority: 'Normal', title: '', description: '', technician: '', workshop: '', parts: '', estimatedCost: '' });
  const [rtc, setRtc] = useState(null); // { id, items: {label: bool} }
  const [partDraft, setPartDraft] = useState('');
  const [assignDraft, setAssignDraft] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u1 = subscribeFleetWorkOrders(setOrders);
    const u2 = subscribeFleetVehicles(setVehicles);
    listFleetDrivers().then(setDrivers).catch(() => {});
    return () => {
      u1?.();
      u2?.();
    };
  }, []);

  const filtered = useMemo(() => {
    const byStatus = statusFilter === 'All' ? orders : orders.filter((o) => o.status === statusFilter);
    if (sourceFilter === 'All') return byStatus;
    if (sourceFilter === 'Damage') return byStatus.filter((o) => o.source === 'CheckIn' || o.source === 'Incident');
    return byStatus.filter((o) => (o.source || '') === sourceFilter);
  }, [orders, statusFilter, sourceFilter]);

  const technicianSuggestions = useMemo(() => {
    const names = new Set();
    drivers.forEach((d) => d.name && names.add(d.name));
    orders.forEach((o) => o.technician && names.add(o.technician));
    return [...names].sort();
  }, [drivers, orders]);

  const countBy = (s) => orders.filter((o) => o.status === s).length;

  const doCreate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const v = vehicles.find((x) => x.id === form.vehicleId);
    const res = await createFleetWorkOrder({
      vehicleId: v?.id || '',
      vehicleName: v?.name || '',
      unitNumber: v?.unitNumber || '',
      source: form.source,
      priority: form.priority,
      title: form.title || `${form.source} — ${v?.name || 'vehicle'}`,
      description: form.description,
      technician: form.technician,
      workshop: form.workshop,
      parts: form.parts.split(',').map((p) => p.trim()).filter(Boolean),
      estimatedCost: form.estimatedCost,
      createdBy: user.name,
    });
    setBusy(false);
    if (res?.error) return setError(res.error);
    setNotice(
      res.status === 'AwaitingApproval'
        ? 'Work order created with the vehicle out of service pending manager approval (estimate above the sign-off threshold).'
        : `Work order created — ${v?.unitNumber || v?.name || 'vehicle'} marked In Maintenance.`,
    );
    setShowNew(false);
    setForm({ vehicleId: '', source: 'Manual', priority: 'Normal', title: '', description: '', technician: '', workshop: '', parts: '', estimatedCost: '' });
  };

  const assign = async (wo, technician, workshop) => {
    await updateFleetWorkOrder(wo.id, { patch: { technician, workshop }, by: user.name, note: `Technician ${technician} assigned${workshop ? ` · ${workshop}` : ''}` });
  };

  const start = async (wo) => {
    if (!wo.technician) return setError('Assign a technician before starting the work order.');
    const res = await advanceFleetWorkOrder(wo.id, 'InProgress', { by: user.name });
    if (res?.error) setError(res.error);
  };

  const toParts = async (wo) => {
    const parts = [];
    if (partDraft) {
      parts.push(partDraft);
      setPartDraft('');
    }
    await advanceFleetWorkOrder(wo.id, 'AwaitingParts', { by: user.name, parts, note: parts.length ? `Parts needed: ${parts.join(', ')}` : 'Awaiting parts' });
  };

  const partsArrived = async (wo) => {
    const res = await advanceFleetWorkOrder(wo.id, 'InProgress', { by: user.name, note: 'Parts arrived — work resumed' });
    if (res?.error) setError(res.error);
  };

  const openRtc = (wo) => {
    const v = vehicleOf(wo.vehicleId);
    setRtc({
      id: wo.id,
      items: Object.fromEntries(RTC_ITEMS.map((i) => [i, false])),
      current: wo,
      finalCost: wo.estimatedCost || '',
      odometer: v?.mileage || '',
    });
  };

  const complete = async (wo) => {
    const checklist = rtc.items;
    const allPass = Object.values(checklist).every(Boolean);
    if (!allPass) return setError('Every return-to-service item must pass before the unit can complete.');
    if (!rtc.finalCost || Number(rtc.finalCost) <= 0) return setError('Enter the final repair cost before completing.');
    const res = await advanceFleetWorkOrder(wo.id, 'Completed', {
      by: user.name,
      checklist,
      finalCost: rtc.finalCost,
      mileageAtCompletion: rtc.odometer,
      note: `Repair complete — final cost ${formatPrice(rtc.finalCost)} — awaiting sign-off`,
    });
    if (res?.error) return setError(res.error);
    setRtc(null);
  };

  const signOff = async (wo) => {
    const really = window.confirm(`Sign off ${wo.ref} and return ${wo.vehicleName || 'the unit'} to service? The 180-day maintenance countdown resets.`);
    if (!really) return;
    const res = await advanceFleetWorkOrder(wo.id, 'SignedOff', { by: user.name });
    if (res?.error) setError(res.error);
    else setNotice(`${wo.ref} signed off — unit returned to service and maintenance countdown reset. The front desk has been notified.`);
  };

  const approve = async (wo) => {
    if (!isManager) return setError('Only a Fleet or Hotel Manager can approve estimates above the approval threshold.');
    await updateFleetWorkOrder(wo.id, { patch: { status: 'Open' }, by: user.name, note: `Estimate approved by ${user.name} (${user.role})` });
  };

  const cancelWo = async (wo) => {
    if (!isManager) return setError('Only a Fleet or Hotel Manager can cancel a work order.');
    await updateFleetWorkOrder(wo.id, { patch: { status: 'Cancelled' }, by: user.name, note: 'Work order cancelled' });
  };

  const vehicleOf = (id) => vehicles.find((v) => v.id === id);
  // A vehicle currently out with a guest can't be scheduled for workshop time.
  const outOnRental = (v) => v.status === 'Reserved';
  const eligibleForWorkOrder = vehicles.filter((v) => v.status !== 'OutOfService' && !outOnRental(v));

  return (
    <div className="maint-dash-bg palm-page fleet-manager-page">
      <datalist id="technician-roster">
        {technicianSuggestions.map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className="maint-dash">
        <div
          className="palm-hero fleet-manager-hero"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1600&q=80')" }}
        >
          <div className="palm-hero-badges">
            <span className="palm-hero-pill status"><i className="bi bi-circle-fill me-1" />Workshop</span>
            <span className="palm-hero-pill">{countBy('Open') + countBy('InProgress')} active job(s)</span>
          </div>
          <div className="palm-hero-body">
            <div className="palm-hero-kicker">Fleet · Workshop &amp; Maintenance</div>
            <h1 className="palm-hero-title">Repair &amp; maintenance work orders</h1>
            <p className="palm-hero-copy">
              Track scheduled servicing and incident-driven repairs, order parts, get cost approval, run the
              return-to-service checklist and sign units back on the road.
            </p>
            <div className="palm-hero-actions">
              <button type="button" className="palm-btn palm-btn-primary" onClick={() => setShowNew((v) => !v)}>
                <i className="bi bi-wrench-adjustable" />New work order
              </button>
              <Link to="/Fleet/Incidents" className="palm-btn palm-btn-light"><i className="bi bi-bug" />Incidents</Link>
              <Link to="/Fleet/Manager" className="palm-hero-link">Fleet reports →</Link>
            </div>
          </div>
        </div>

        {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}
        {notice && <div className="palm-alert palm-alert-success"><i className="bi bi-check-circle" />{notice}</div>}

      <div className="metric-grid mb-4">
        {[
          { n: countBy('Open') + countBy('InProgress'), label: 'Open work orders', icon: 'bi-wrench-adjustable', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
          { n: countBy('AwaitingApproval'), label: 'Awaiting approval', icon: 'bi-cash-stack', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
          { n: countBy('AwaitingParts'), label: 'Awaiting parts', icon: 'bi-box-seam', bg: 'linear-gradient(135deg,#5b51a8,#433c7d)' },
          { n: vehicles.filter((v) => v.status === 'InMaintenance').length, label: 'Units in maintenance', icon: 'bi-tools', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
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

      {showNew && (
        <form className="panel-card mb-4" onSubmit={doCreate}>
          <div className="panel-header"><h2>Create work order</h2></div>
          <div className="p-3">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="book-label">Vehicle</label>
                <select className="form-select" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                  <option value="">Select a vehicle…</option>
                  {eligibleForWorkOrder.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} · {v.unitNumber} ({v.status})</option>
                  ))}
                </select>
                <div className="text-muted small mt-1">Units currently out on rental aren&rsquo;t shown — they&rsquo;ll be schedulable once returned.</div>
              </div>
              <div className="col-md-3">
                <label className="book-label">Source</label>
                <select className="form-select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="book-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {['High', 'Normal', 'Low'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="book-label">Title</label>
                <input className="form-control" placeholder="e.g. Front bumper respray" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="book-label">Estimated cost (R)</label>
                <input type="number" min={0} className="form-control" placeholder="0 — estimates above R2 000 need manager approval" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="book-label">Description / diagnosis</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="book-label">Technician</label>
                <input className="form-control" list="technician-roster" placeholder="e.g. in-house tech or workshop name" value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="book-label">Workshop</label>
                <input className="form-control" placeholder="On-site / partner garage" value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="book-label">Parts needed</label>
                <input className="form-control" placeholder="Comma separated" value={form.parts} onChange={(e) => setForm({ ...form, parts: e.target.value })} />
              </div>
              {Number(form.estimatedCost) > APPROVAL_THRESHOLD && (
                <div className="col-12">
                  <div className="palm-alert palm-alert-info"><i className="bi bi-cash-stack" />This estimate exceeds the R{APPROVAL_THRESHOLD} sign-off threshold and will require manager approval before work starts.</div>
                </div>
              )}
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="palm-btn palm-btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="palm-btn palm-btn-primary" disabled={busy}><i className="bi bi-hammer" />{busy ? 'Creating…' : 'Create work order'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="palm-tabs mb-3">
        {SOURCE_FILTERS.map((sf) => (
          <button key={sf.key} type="button" className={`palm-tab ${sourceFilter === sf.key ? 'active' : ''}`} onClick={() => setSourceFilter(sf.key)}>
            <i className={`bi ${sf.icon} me-1`} />{sf.label}
          </button>
        ))}
      </div>

      <div className="palm-tabs">
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`palm-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="panel-card">
        <div className="panel-header"><h2>Work orders ({filtered.length})</h2></div>
        {filtered.length === 0 ? (
          <div className="dash-empty"><i className="bi bi-inboxes me-2" />No work orders match the current filter.</div>
        ) : (
          filtered.map((wo) => {
            const v = vehicleOf(wo.vehicleId);
            return (
              <div key={wo.id} className="fleet-row" style={{ alignItems: 'flex-start' }}>
                <span className="fleet-thumb"><i className="bi bi-wrench-adjustable" /></span>
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-bold">{wo.title || wo.source}</span>
                    <span className="text-muted small">· {wo.ref}</span>
                    <span className={`fleet-badge fleet-badge-${wo.status}`}>{bookingDisplay(wo.status)}</span>
                    <span className={`wo-src wo-src-${wo.source}`}><i className={`bi ${(SOURCE_TAG[wo.source] || { icon: 'bi-tools', label: wo.source }).icon} me-1`} />{(SOURCE_TAG[wo.source] || { label: wo.source }).label}</span>
                    <span className={`sev-chip sev-${wo.priority === 'High' ? 'High' : wo.priority === 'Low' ? 'Low' : 'Medium'}`}>{wo.priority}</span>
                  </div>
                  <div className="dash-row-meta mt-1">
                    <span><i className="bi bi-car-front me-1" />{wo.vehicleName || (v ? `${v.name} · ${v.unitNumber}` : 'Unassigned unit')}</span>
                    {wo.technician && <span><i className="bi bi-person-wrench me-1" />{wo.technician}{wo.workshop ? ` · ${wo.workshop}` : ''}</span>}
                    <span><i className="bi bi-clock me-1" />{formatDateTime(wo.createdAt)}</span>
                  </div>
                  {wo.description && <div className="dash-row-meta small text-muted" style={{ maxWidth: 720 }}>{wo.description}</div>}
                  <div className="dash-row-meta">
                    <span><i className="bi bi-tag me-1" />Est. {formatPrice(wo.estimatedCost)}</span>
                    {wo.finalCost > 0 && <span><i className="bi bi-receipt me-1" />Final {formatPrice(wo.finalCost)}</span>}
                    {wo.parts?.length > 0 && <span><i className="bi bi-box-seam me-1" />Parts: {wo.parts.join(', ')}</span>}
                  </div>

                  <div className="d-flex gap-2 flex-wrap mt-2 align-items-center">
                    {wo.status === 'AwaitingApproval' && (
                      isManager ? (
                        <>
                          <button type="button" className="btn btn-sm btn-success" onClick={() => approve(wo)}><i className="bi bi-check2-circle me-1" />Approve estimate</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => cancelWo(wo)}><i className="bi bi-x-lg me-1" />Reject</button>
                        </>
                      ) : (
                        <span className="fleet-flag fleet-flag-warn"><i className="bi bi-lock me-1" />Awaiting manager sign-off</span>
                      )
                    )}
                    {wo.status === 'Open' && (
                      <>
                        {!wo.technician && (
                          <div className="d-flex gap-1">
                            <input
                              className="form-control form-control-sm" style={{ width: 160 }} list="technician-roster"
                              placeholder="Assign technician…" value={assignDraft[wo.id] || ''}
                              onChange={(e) => setAssignDraft({ ...assignDraft, [wo.id]: e.target.value })}
                            />
                            <button
                              type="button" className="btn btn-sm btn-outline-secondary"
                              disabled={!assignDraft[wo.id]?.trim()}
                              onClick={() => { assign(wo, assignDraft[wo.id].trim(), wo.workshop); setAssignDraft({ ...assignDraft, [wo.id]: '' }); }}
                            >
                              <i className="bi bi-check-lg" />
                            </button>
                          </div>
                        )}
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => start(wo)} disabled={!wo.technician}><i className="bi bi-play-fill me-1" />Start work</button>
                      </>
                    )}
                    {wo.status === 'InProgress' && (
                      <>
                        <div className="d-flex gap-2">
                          <input className="form-control form-control-sm" style={{ width: 'auto' }} placeholder="Part needed…" value={partDraft} onChange={(e) => setPartDraft(e.target.value)} />
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toParts(wo)}><i className="bi bi-box-seam me-1" />Mark awaiting parts</button>
                        </div>
                        <button type="button" className="btn btn-sm btn-success" onClick={() => openRtc(wo)}><i className="bi bi-clipboard-check me-1" />Complete + checklist</button>
                      </>
                    )}
                    {wo.status === 'AwaitingParts' && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => partsArrived(wo)}><i className="bi bi-box-fill me-1" />Parts arrived — resume</button>
                    )}
                    {wo.status === 'Completed' && (
                      <button type="button" className="btn btn-sm btn-success" onClick={() => signOff(wo)}><i className="bi bi-sign-turn-right me-1" />Sign off &amp; return to service</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {rtc && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15,20,35,0.6)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Return-to-service checklist · {rtc.current.ref}</h5>
                <button type="button" className="btn-close" onClick={() => setRtc(null)} />
              </div>
              <div className="modal-body">
                <div className="alert alert-info"><i className="bi bi-clipboard-check me-2" />Verify every item before the unit can be marked completed. Sign-off happens after a final manager review.</div>
                {RTC_ITEMS.map((item) => (
                  <div key={item} className="rtc-item">
                    <span>{item}</span>
                    <input type="checkbox" className="form-check-input" checked={rtc.items[item]} onChange={(e) => setRtc({ ...rtc, items: { ...rtc.items, [item]: e.target.checked } })} />
                  </div>
                ))}
                <div className="row g-3 mt-1">
                  <div className="col-md-6">
                    <label>Final repair cost (R)</label>
                    <input type="number" min="0" className="form-control" placeholder={`Estimated ${formatPrice(rtc.current.estimatedCost)}`} value={rtc.finalCost} onChange={(e) => setRtc({ ...rtc, finalCost: e.target.value })} />
                  </div>
                  <div className="col-md-6">
                    <label>Odometer at completion (km)</label>
                    <input type="number" min="0" className="form-control" value={rtc.odometer} onChange={(e) => setRtc({ ...rtc, odometer: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setRtc(null)}>Close</button>
                <button type="button" className="btn btn-success" onClick={() => complete(rtc.current)}><i className="bi bi-check-lg me-1" />Mark completed</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}