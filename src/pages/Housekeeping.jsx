import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestCleaning, listGuestCleaningRequests } from '../services/housekeepingService';
import { listUserReservations } from '../services/reservationService';
import { HOUSEKEEPING_SERVICES } from '../lib/constants';
import { formatDateTime } from '../lib/utils';
import './guest.css';
import './palm.css';

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
    <div className="palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Room Cleaning</div>
          <h1 className="palm-page-title">Request housekeeping</h1>
        </div>
      </div>

      {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {success && <div className="palm-alert palm-alert-success"><i className="bi bi-check-circle" />{success}</div>}

      {!activeRes && (
        <div className="palm-alert palm-alert-info">
          <i className="bi bi-info-circle" /> No active stay found — requests are still recorded.
        </div>
      )}

      <div className="palm-grid">
        <form className="palm-card" onSubmit={submit}>
          <div className="palm-card-body pt-4">
            <h2 className="palm-card-title mb-3">What do you need?</h2>
            <div className="row g-3 mb-3">
              {HOUSEKEEPING_SERVICES.map((s) => (
                <div className="col-md-6" key={s.name}>
                  <label className={`palm-choice-row ${selected.includes(s.name) ? 'is-selected' : ''}`} style={{ cursor: 'pointer' }}>
                    <span className="d-flex align-items-center gap-2">
                      <span className="palm-quick-icon"><i className={`bi ${s.icon}`} /></span>
                      <strong style={{ fontSize: '0.85rem' }}>{s.name}</strong>
                    </span>
                    <input type="checkbox" checked={selected.includes(s.name)} onChange={() => toggle(s.name)} />
                  </label>
                </div>
              ))}
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="CleanDate">Preferred date</label>
                <input id="CleanDate" type="date" className="form-control" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label htmlFor="CleanTime">Preferred time</label>
                <input id="CleanTime" type="time" className="form-control" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <label>Priority</label>
              <div className="palm-priority-grid">
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                  <label key={p} className={`palm-priority ${priority === p ? 'selected' : ''}`}>
                    <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="palm-btn palm-btn-primary mt-4" disabled={submitting}>
              <i className="bi bi-send" /> {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>

        <div className="palm-card">
          <div className="palm-card-header"><span className="palm-card-title">My requests</span></div>
          <div className="palm-card-body">
            {requests.length === 0 ? (
              <div className="palm-empty"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.4rem' }} />No cleaning requests yet.</div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="palm-list-row">
                  <div>
                    <div className="palm-list-title">{r.services.join(', ')}</div>
                    <div className="palm-list-meta">
                      <span>{r.preferredDate} {r.preferredTime}</span>
                      <span>{formatDateTime(r.submittedAt)}</span>
                    </div>
                  </div>
                  <span className={`palm-status-chip ${r.status === 'Completed' ? 'success' : r.status === 'InProgress' ? 'info' : 'warn'}`}>{r.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
