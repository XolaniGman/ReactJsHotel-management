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
import { formatPrice, formatDateTime, todayISO, addDaysISO } from '../lib/utils';
import './guest.css';
import './rooms.css';
import './fleet.css';

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

export default function FleetMaintenance() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ vehicleId: '', source: 'Manual', priority: 'Normal', title: '', description: '', technician: '', workshop: '', parts: '', estimatedCost: '' });
  const [rtc, setRtc] = useState(null); // { id, items: {label: bool} }
  const [partDraft, setPartDraft] = useState('');
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

  const serviceDue = useMemo(
    () =>
      (vehicles || [])
        .filter((v) => v.status !== 'OutOfService' && v.nextServiceDate && new Date(v.nextServiceDate) <= new Date(addDaysISO(todayISO(), 30)))
        .sort((a, b) => new Date(a.nextServiceDate) - new Date(b.nextServiceDate)),
    [vehicles],
  );

  const filtered = useMemo(() => (statusFilter === 'All' ? orders : orders.filter((o) => o.status === statusFilter)), [orders, statusFilter]);

  const countBy = (s) => orders.filter((o) => o.status === s).length;

  const prefillScheduled = (v) => {
    setForm({
      vehicleId: v.id,
      source: 'Scheduled',
      priority: 'High',
      title: 'Scheduled service',
      description: `Service due ${formatDateTime(v.nextServiceDate)} — ${v.name} unit ${v.unitNumber}.`,
      technician: '',
      workshop: '',
      parts: '',
      estimatedCost: '',
    });
    setShowNew(true);
  };

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
    setRtc({ id: wo.id, items: Object.fromEntries(RTC_ITEMS.map((i) => [i, false])), current: wo });
  };

  const complete = async (wo) => {
    const checklist = rtc.items;
    const allPass = Object.values(checklist).every(Boolean);
    if (!allPass) return setError('Every return-to-service item must pass before the unit can complete.');
    const res = await advanceFleetWorkOrder(wo.id, 'Completed', { by: user.name, checklist, note: 'Repair complete — awaiting sign-off' });
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
    await updateFleetWorkOrder(wo.id, { patch: { status: 'Open' }, by: user.name, note: 'Estimate approved by manager' });
  };

  const cancelWo = async (wo) => {
    await updateFleetWorkOrder(wo.id, { patch: { status: 'Cancelled' }, by: user.name, note: 'Work order cancelled' });
  };

  const vehicleOf = (id) => vehicles.find((v) => v.id === id);

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Fleet · Workshop &amp; Maintenance</div>
          <h1 className="lost-title">Repair &amp; maintenance work orders</h1>
          <p className="lost-copy">
            Track scheduled servicing and incident-driven repairs, order parts, get cost approval, run the
            return-to-service checklist and sign units back on the road.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="san-btn-primary" onClick={() => setShowNew((v) => !v)}>
            <i className="bi bi-wrench-adjustable me-2" />New work order
          </button>
          <Link to="/Fleet/Incidents" className="san-btn-secondary"><i className="bi bi-bug me-2" />Incidents</Link>
          <Link to="/Fleet/Manager" className="san-btn-secondary"><i className="bi bi-graph-up me-2" />Reports</Link>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

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

      {serviceDue.length > 0 && (
        <div className="dash-panel mb-4">
          <div className="dash-panel-header"><h2>Due for service · next 30 days</h2></div>
          <div className="d-flex flex-wrap gap-2 p-3">
            {serviceDue.map((v) => (
              <button key={v.id} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => prefillScheduled(v)}>
                <i className="bi bi-calendar-event me-1" />{v.unitNumber} · {v.name} — due {formatDateTime(v.nextServiceDate)}
              </button>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <form className="dash-panel mb-4" onSubmit={doCreate}>
          <div className="dash-panel-header"><h2>Create work order</h2></div>
          <div className="p-3">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="book-label">Vehicle</label>
                <select className="form-select" required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                  <option value="">Select a vehicle…</option>
                  {vehicles.filter((v) => v.status !== 'OutOfService').map((v) => (
                    <option key={v.id} value={v.id}>{v.name} · {v.unitNumber} ({v.status})</option>
                  ))}
                </select>
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
                <select className="form-select" value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })}>
                  <option value="">Select technician…</option>
                  {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
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
                  <div className="dash-notice"><i className="bi bi-cash-stack me-2" />This estimate exceeds the R{APPROVAL_THRESHOLD} sign-off threshold and will require manager approval before work starts.</div>
                </div>
              )}
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-light" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}><i className="bi bi-hammer me-2" />{busy ? 'Creating…' : 'Create work order'}</button>
            </div>
          </div>
        </form>
      )}

      <div className="d-flex gap-2 flex-wrap mb-3">
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`lux-btn ${statusFilter === s ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="dash-panel">
        <div className="dash-panel-header"><h2>Work orders ({filtered.length})</h2></div>
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
                    <span className="fleet-badge">{wo.source}</span>
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
                      <>
                        <button type="button" className="btn btn-sm btn-success" onClick={() => approve(wo)}><i className="bi bi-check2-circle me-1" />Approve estimate</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => cancelWo(wo)}><i className="bi bi-x-lg me-1" />Reject</button>
                      </>
                    )}
                    {wo.status === 'Open' && (
                      <>
                        {!wo.technician && (
                          <select className="form-select form-select-sm" style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && assign(wo, e.target.value, wo.workshop)}>
                            <option value="">Assign technician…</option>
                            {drivers.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                          </select>
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
  );
}