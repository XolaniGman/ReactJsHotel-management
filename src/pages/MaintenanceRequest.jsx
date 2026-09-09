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
import './palm.css';

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
    <div className="palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Maintenance</div>
          <h1 className="palm-page-title">Report an issue</h1>
          <p className="palm-page-copy">
            Something not working in your room? Tell us what&rsquo;s wrong and our maintenance team will
            resolve it.
          </p>
        </div>
      </div>

      {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {success && <div className="palm-alert palm-alert-success"><i className="bi bi-check-circle" />{success}</div>}

      <form className="palm-card" onSubmit={submit}>
        <div className="palm-card-body pt-4">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="Category">Category</label>
              <select id="Category" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {MAINTENANCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label>Priority</label>
              <div className="palm-priority-grid">
                {MAINTENANCE_PRIORITIES.map((p) => (
                  <label key={p} className={`palm-priority ${priority === p ? 'selected' : ''}`}>
                    <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="Description">Describe the issue</label>
            <textarea id="Description" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Air conditioning is not cooling the room." />
          </div>

          <div className="mt-3">
            <label>Photo (optional)</label>
            <label className="palm-upload">
              {photo ? (
                <img src={photo} alt="Issue" />
              ) : (
                <>
                  <i className="bi bi-camera" style={{ fontSize: '1.6rem' }} />
                  Tap to add a photo
                </>
              )}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
            </label>
          </div>

          <button type="submit" className="palm-btn palm-btn-primary mt-4" disabled={submitting}>
            <i className="bi bi-tools" /> {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>

      {requests.length > 0 && (
        <div className="palm-card" style={{ marginTop: '1.25rem' }}>
          <div className="palm-card-header"><span className="palm-card-title">My requests</span></div>
          <div className="palm-card-body">
            {requests.map((r) => (
              <div key={r.id} className="palm-list-row">
                <div>
                  <div className="palm-list-title">{r.category} · {r.priority}</div>
                  <div className="palm-list-meta">
                    <span>{r.description}</span>
                    <span>{formatDateTime(r.createdAt)}</span>
                  </div>
                </div>
                <span className={`palm-status-chip ${statusTone(r.status)}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
