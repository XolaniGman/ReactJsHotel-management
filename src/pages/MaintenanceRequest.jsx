import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createMaintenanceRequest,
  listMyMaintenanceRequests,
} from '../services/maintenanceService';
import { listUserReservations } from '../services/reservationService';
import { MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES } from '../lib/constants';
import { fileToDataUrl, formatDateTime, statusTone } from '../lib/utils';
import './guest.css';

export default function MaintenanceRequest() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [category, setCategory] = useState(MAINTENANCE_CATEGORIES[0]);
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  useEffect(() => {
    (async () => {
      const [r, q] = await Promise.all([listUserReservations(user.uid), listMyMaintenanceRequests(user.uid)]);
      setReservations(r);
      setRequests(q);
    })();
  }, [user?.uid]);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(await fileToDataUrl(file, 900));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!description.trim()) return setError('Please describe the issue.');
    setSubmitting(true);
    await createMaintenanceRequest({
      guestUid: user.uid,
      guestName: user.name,
      roomNumber: activeRes?.roomNumber || '',
      category,
      priority,
      description,
      photo,
      submittedBy: user.name,
    });
    setSubmitting(false);
    setDescription('');
    setPhoto('');
    setSuccess('Maintenance request submitted. The team has been notified.');
    const q = await listMyMaintenanceRequests(user.uid);
    setRequests(q);
  };

  return (
    <div className="maint-shell">
      <div className="maint-kicker">Maintenance</div>
      <h1 className="maint-title">Report an issue</h1>
      <p className="maint-intro">
        Something not working in your room? Tell us what&rsquo;s wrong and our maintenance team will
        resolve it.
      </p>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}

      <form className="maint-card" onSubmit={submit}>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="maint-label" htmlFor="Category">Category</label>
            <select id="Category" className="form-select maint-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {MAINTENANCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="maint-label">Priority</label>
            <div className="maint-priority-grid">
              {MAINTENANCE_PRIORITIES.map((p) => (
                <label key={p} className={`maint-priority ${priority === p ? 'selected' : ''}`}>
                  <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="maint-label" htmlFor="Description">Describe the issue</label>
          <textarea id="Description" className="form-control maint-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Air conditioning is not cooling the room." />
        </div>

        <div className="mt-3">
          <label className="maint-label">Photo (optional)</label>
          <label className="maint-upload">
            {photo ? (
              <img src={photo} alt="Issue" />
            ) : (
              <>
                <i className="bi bi-camera" style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }} />
                Tap to add a photo
              </>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
          </label>
        </div>

        <button type="submit" className="book-submit mt-4" disabled={submitting}>
          <i className="bi bi-tools me-2" /> {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      {requests.length > 0 && (
        <div className="dash-panel" style={{ marginTop: '1.5rem' }}>
          <div className="dash-panel-header"><h2>My requests</h2></div>
          {requests.map((r) => (
            <div key={r.id} className="dash-row dash-row--simple">
              <div>
                <div className="dash-row-title">{r.category} · {r.priority}</div>
                <div className="dash-row-meta">
                  <span>{r.description}</span>
                  <span>{formatDateTime(r.createdAt)}</span>
                </div>
              </div>
              <span className={`dash-status-pill ${statusTone(r.status)}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
