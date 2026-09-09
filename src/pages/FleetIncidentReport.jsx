import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createFleetIncident,
  evidenceChecksum,
  listMyCarBookings,
  listCarServices,
  listFleetVehicles,
} from '../services/fleetService';
import { fileToDataUrl } from '../lib/utils';
import './guest.css';
import './rooms.css';
import './fleet.css';

const CATEGORIES = ['Accident/Collision', 'Breakdown/Mechanical Fault', 'Theft/Break-in', 'Cosmetic Damage', 'Other'];
const toLocalInput = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FleetIncidentReport() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    category: '',
    description: '',
    occurredAt: toLocalInput(),
    injuries: false,
    undriveable: false,
    thirdPartyInvolved: false,
    otherPartyDetails: '',
    policeRef: '',
    insuranceRef: '',
    lat: '',
    lng: '',
    locationLabel: '',
  });
  const [context, setContext] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const type = params.get('type');
    const id = params.get('id');
    if (!id) return;
    let cancelled = false;
    (async () => {
      let ctx = { type, id };
      if (type === 'booking') {
        const bs = await listMyCarBookings(user.uid);
        const b = bs.find((x) => x.id === id);
        if (b) {
          const vehicle = (await listFleetVehicles()).find((item) => item.id === b.vehicleId);
          ctx = { ...ctx, bookingId: b.id, vehicleId: b.vehicleId, vehicleName: b.vehicleName, vehicleImage: vehicle?.image || b.vehicleImage || '', unitNumber: b.unitNumber, hint: `${b.ref} · ${b.vehicleName || 'rental'}` };
        }
      } else if (type === 'service') {
        const ss = await listCarServices();
        const s = ss.find((x) => x.id === id);
        if (s) ctx = { ...ctx, serviceId: s.id, vehicleUnit: s.vehicleUnit, hint: `${s.ref} · ${s.serviceType} · ${s.pickupLocation} → ${s.destination}` };
      } else if (type === 'vehicle') {
        const vs = await listFleetVehicles();
        const v = vs.find((x) => x.id === id);
        if (v) ctx = { ...ctx, vehicleId: v.id, vehicleName: v.name, vehicleImage: v.image || '', unitNumber: v.unitNumber, hint: `Unit ${v.unitNumber} · ${v.name}` };
      }
      if (!cancelled) setContext(ctx);
    })();
    return () => {
      cancelled = true;
    };
  }, [params, user?.uid]);

  const isFleetUser = ['fleet', 'fleetmanager', 'admin'].includes(user?.role);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    const next = [];
    for (const f of files) {
      const dataUrl = await fileToDataUrl(f, 1200, 0.8);
      next.push({ name: f.name, dataUrl, checksum: evidenceChecksum(dataUrl) });
    }
    setEvidence((prev) => [...prev, ...next].slice(0, 6));
  };

  const locate = () => {
    if (!navigator.geolocation) return setError('Geolocation is not available in this browser.');
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6), locationLabel: 'Captured device location' })),
      (err) => setError(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const result = await createFleetIncident({
      reporterUid: user.uid,
      reporterName: user.name || user.email || 'Guest',
      reporterRole: isFleetUser ? 'staff' : 'guest',
      ...form,
      occurredAt: form.occurredAt ? new Date(form.occurredAt).getTime() : Date.now(),
      lat: form.lat,
      lng: form.lng,
      bookingId: context?.bookingId || '',
      serviceId: context?.serviceId || '',
      vehicleId: context?.vehicleId || '',
      vehicleName: context?.vehicleName || '',
      vehicleImage: context?.vehicleImage || '',
      evidence,
    });
    setBusy(false);
    if (result?.error) return setError(result.error);
    setSubmitted(result);
    if (result.escalated) {
      setNotice('High-severity incident — Fleet & Hôtel Management have been notified and the trip is suspended pending review.');
    } else {
      setNotice(`Incident ${result.ref} recorded. The fleet team will review and confirm the outcome.`);
    }
  };

  if (submitted) {
    return (
      <div className="clean-shell">
        <div className={`incident-hero ${submitted.severity.toLowerCase()}`}>
          <i className="bi bi-shield-check" style={{ fontSize: '2rem' }} />
          <div>
            <div className="lost-kicker" style={{ color: 'rgba(255,255,255,0.75)' }}>Incident Report</div>
            <h1 className="lost-title" style={{ color: '#fff' }}>{submitted.ref} recorded</h1>
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>Reference &amp; next steps</h2></div>
          <div className="p-3">
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className={`sev-chip sev-${submitted.severity}`}>{submitted.severity} severity</span>
              <span className={`fleet-badge ${submitted.escalated ? 'fleet-badge-Suspended' : 'fleet-badge-UnderReview'}`}>
                {submitted.escalated ? 'Suspended · escalated' : 'Under review'}
              </span>
            </div>
            <ul className="mb-4" style={{ lineHeight: 2 }}>
              <li>Reference <strong>{submitted.ref}</strong> can be used in any follow-up enquiry.</li>
              <li>{submitted.escalated
                ? 'Because of the severity, the trip/rental has been flagged as Suspended and Fleet + Hôtel Management were notified. Evidence files were checksum-stamped for dispute resolution.'
                : 'The fleet team has been notified and will inspect the vehicle and confirm the outcome. Evidence files were checksum-stamped for dispute resolution.'}
              </li>
              {submitted.flags?.length > 0 && <li><strong>Flags:</strong> {submitted.flags.join(' · ')}</li>}
            </ul>
            <div className="d-flex gap-2">
              <Link to="/Fleet/MyTrips" className="san-btn-primary"><i className="bi bi-signpost-split me-2" />Back to my trips</Link>
              <Link to="/Fleet/Vehicles" className="san-btn-secondary"><i className="bi bi-car-front me-2" />Vehicles</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Incident Reporting</div>
          <h1 className="lost-title">Report a vehicle incident</h1>
          <p className="lost-copy">
            Report accidents, breakdowns, theft, or damage during a rental or shuttle trip. High-severity reports
            are escalated to Fleet Management and the trip is suspended pending review.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/Fleet/MyTrips" className="san-btn-primary"><i className="bi bi-signpost-split me-2" />My trips</Link>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {notice && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{notice}</div>}

      {context?.hint && (
        <div className="dash-notice mb-3" style={{ margin: '1rem 0' }}>
          <i className="bi bi-info-circle me-2" />Reporting for: <strong>{context.hint}</strong>
        </div>
      )}

      <form className="dash-panel" onSubmit={submit}>
        <div className="dash-panel-header"><h2>Incident details</h2></div>
        <div className="p-3">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="book-label">Incident type</label>
              <select className="form-select" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="book-label">Date &amp; time</label>
              <input type="datetime-local" className="form-control" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="book-label">Description</label>
              <textarea className="form-control" rows={3} required placeholder="What happened? Include anything a reviewer needs to know…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="book-label">Location</label>
              <div className="input-group">
                <input className="form-control" placeholder="Latitude" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                <input className="form-control" placeholder="Longitude" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
              </div>
            </div>
            <div className="col-md-6 d-flex align-items-end">
              <button type="button" className="san-btn-secondary w-100" onClick={locate}><i className="bi bi-geo-alt me-2" />Use my location</button>
            </div>
            <div className="col-12">
              <label className="book-label">Location note (optional)</label>
              <input className="form-control" placeholder="e.g. Near OR Tambo, exit 4" value={form.locationLabel} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} />
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-12">
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="injuries" checked={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.checked })} />
                <label className="form-check-label" htmlFor="injuries">Injuries involved</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="undriveable" checked={form.undriveable} onChange={(e) => setForm({ ...form, undriveable: e.target.checked })} />
                <label className="form-check-label" htmlFor="undriveable">Vehicle undriveable</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="thirdParty" checked={form.thirdPartyInvolved} onChange={(e) => setForm({ ...form, thirdPartyInvolved: e.target.checked })} />
                <label className="form-check-label" htmlFor="thirdParty">Third party / other vehicle involved</label>
              </div>
            </div>
            {form.thirdPartyInvolved && (
              <div className="col-md-8">
                <label className="book-label">Third party details</label>
                <input className="form-control" placeholder="Reg plate, driver, vehicle type / insurer / contact" value={form.otherPartyDetails} onChange={(e) => setForm({ ...form, otherPartyDetails: e.target.value })} />
              </div>
            )}
            <div className="col-md-4">
              <label className="book-label">Police reference (optional)</label>
              <input className="form-control" placeholder="Case number if reported" value={form.policeRef} onChange={(e) => setForm({ ...form, policeRef: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="book-label">Insurance reference (optional)</label>
              <input className="form-control" placeholder="Claim / policy reference" value={form.insuranceRef} onChange={(e) => setForm({ ...form, insuranceRef: e.target.value })} />
            </div>
            <div className="col-md-8">
              <label className="book-label">Photo / video evidence (up to 6)</label>
              <input type="file" className="form-control" accept="image/*" multiple onChange={onFiles} />
              <div className="small text-muted mt-1" style={{ margin: '0.35rem 0 0' }}>
                Each file is checksum-stamped (FNV-1a) at capture so tampering can be proven later.
              </div>
            </div>
          </div>

          {evidence.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {evidence.map((e, i) => (
                <div key={`${e.name}-${i}`} className="d-flex align-items-center gap-2 border rounded-3 p-2">
                  <img src={e.dataUrl} alt={e.name} className="evidence-thumb" />
                  <div className="small">
                    <div className="fw-bold">{e.name}</div>
                    <div className="text-muted">SHA·FNV <code>{e.checksum}</code></div>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setEvidence(evidence.filter((_, j) => j !== i))}><i className="bi bi-x" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
            <i className="bi bi-shield-exclamation me-2" />If the incident involves injuries, theft, or the vehicle is undriveable, the report is
            automatically <strong>escalated</strong> and the affected trip/rental is flagged <strong>Suspended</strong>.
            Fleet will reach out with a replacement if you are still mid-journey.
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Link to="/Fleet/MyTrips" className="btn btn-light"><i className="bi bi-x-lg me-2" />Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <i className="bi bi-bug me-2" />{busy ? 'Submitting…' : 'Submit incident report'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}