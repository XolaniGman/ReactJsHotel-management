import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestCleaning, listGuestCleaningRequests } from '../services/housekeepingService';
import { listUserReservations } from '../services/reservationService';
import { HOUSEKEEPING_SERVICES } from '../lib/constants';
import { formatDateTime } from '../lib/utils';
import './guest.css';

export default function Housekeeping() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState([]);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('10:00');
  const [priority, setPriority] = useState('Medium');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  const load = async () => {
    const [r, q] = await Promise.all([listUserReservations(user.uid), listGuestCleaningRequests(user.uid)]);
    setReservations(r);
    setRequests(q);
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  const toggle = (name) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (selected.length === 0) return setError('Select at least one cleaning service.');
    if (!preferredDate) return setError('Choose a preferred date.');
    setSubmitting(true);
    await requestCleaning({
      guestUid: user.uid,
      guestName: user.name,
      reservationId: activeRes?.id || '',
      roomNumber: activeRes?.roomNumber || '',
      services: selected,
      preferredDate,
      preferredTime,
      priority,
    });
    setSubmitting(false);
    setSelected([]);
    setSuccess('Cleaning request submitted. Housekeeping will be on their way.');
    load();
  };

  return (
    <div className="clean-shell">
      <div className="clean-hero">
        <div>
          <div className="clean-kicker">Room Cleaning</div>
          <h1 className="clean-title">Request housekeeping</h1>
        </div>
      </div>

      {error && <div className="clean-alert" style={{ background: '#fff1f1', color: '#a33a2d' }}><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && <div className="clean-alert clean-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}

      {!activeRes && (
        <div className="dash-notice">
          <i className="bi bi-info-circle me-2" /> No active stay found — requests are still recorded.
        </div>
      )}

      <div className="clean-layout">
        <form className="clean-form" onSubmit={submit}>
          <h2 className="clean-card-title">What do you need?</h2>
          <div className="row g-3 mb-3">
            {HOUSEKEEPING_SERVICES.map((s) => (
              <div className="col-md-6" key={s.name}>
                <label className="clean-service">
                  <input type="checkbox" checked={selected.includes(s.name)} onChange={() => toggle(s.name)} />
                  <span className="clean-service-icon"><i className={`bi ${s.icon}`} /></span>
                  <span style={{ fontWeight: 800 }}>{s.name}</span>
                </label>
              </div>
            ))}
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="clean-label" htmlFor="CleanDate">Preferred date</label>
              <input id="CleanDate" type="date" className="form-control clean-input" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="clean-label" htmlFor="CleanTime">Preferred time</label>
              <input id="CleanTime" type="time" className="form-control clean-input" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <label className="clean-label">Priority</label>
            <div className="d-flex gap-2 flex-wrap">
              {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                <button key={p} type="button" className={`btn btn-sm ${priority === p ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setPriority(p)}>{p}</button>
              ))}
            </div>
          </div>

          <button type="submit" className="book-submit mt-4" disabled={submitting}>
            <i className="bi bi-send me-2" /> {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <div className="clean-side-card">
          <div className="clean-side-img" />
          <div className="clean-side-body">
            <h3 className="clean-card-title">My requests</h3>
            {requests.length === 0 ? (
              <div className="dash-empty"><i className="bi bi-inbox" /> No cleaning requests yet.</div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="dash-row dash-row--simple">
                  <div>
                    <div className="dash-row-title">{r.services.join(', ')}</div>
                    <div className="dash-row-meta">
                      <span>{r.preferredDate} {r.preferredTime}</span>
                      <span>{formatDateTime(r.submittedAt)}</span>
                    </div>
                  </div>
                  <span className={`dash-status-pill ${r.status === 'Completed' ? 'success' : r.status === 'InProgress' ? 'info' : 'warn'}`}>{r.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
