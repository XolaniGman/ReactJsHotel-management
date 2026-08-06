import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listCleaningRequests,
  acceptCleaningRequest,
  completeCleaningRequest,
} from '../services/housekeepingService';
import './housekeeping.css';
import './maintenance.css';

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await listCleaningRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const accept = async (id) => {
    await acceptCleaningRequest(id, user?.name || user?.email);
    setNotice('Task assigned to you.');
    load();
  };

  const complete = async (id) => {
    await completeCleaningRequest(id);
    setNotice('Task completed.');
    load();
  };

  const columns = [
    { status: 'Pending', icon: 'bi-hourglass-split', cls: 'pending' },
    { status: 'InProgress', icon: 'bi-arrow-repeat', cls: 'progressing' },
    { status: 'Completed', icon: 'bi-check2-circle', cls: 'completed' },
  ];

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Housekeeping</div>
            <h1 className="maint-title">Cleaning Requests</h1>
          </div>
          <span className="admin-date">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="hk-mini-grid">
          {columns.map((c) => (
            <div className="hk-mini-card" key={c.status}>
              <span className="hk-mini-icon"><i className={c.icon} /></span>
              <strong>{c.status}</strong>
              <p>{requests.filter((r) => r.status === c.status).length} task{c.status === 'Completed' ? 's completed' : (requests.filter((r) => r.status === c.status).length === 1 ? '' : 's')}</p>
            </div>
          ))}
        </div>

        <div className="hk-hero-banner mb-4">
          <div>
            <h2>Room cleaning kanban</h2>
            <p className="mb-0 opacity-75">Accept pending tasks to start cleaning. Complete tasks once the room is refreshed.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat spin me-2" />Loading…</p>
        ) : (
          <div className="row g-3">
            {columns.map((c) => (
              <div className="col-lg-4" key={c.status}>
                <div className="inv-section h-100">
                  <div className="inv-section-header">
                    <div className="inv-section-title-wrap">
                      <span className={`inv-section-icon ${c.cls === 'pending' ? 'orange' : 'purple'}`}><i className={c.icon} /></span>
                      <div>
                        <div className="inv-section-title">{c.status === 'InProgress' ? 'In Progress' : c.status}</div>
                        <div className="inv-section-subtitle">{requests.filter((r) => r.status === c.status).length} request(s)</div>
                      </div>
                    </div>
                  </div>
                  <div className="inv-section-body">
                    {requests.filter((r) => r.status === c.status).length === 0 ? (
                      <div className="empty-request-state py-4">
                        <i className={c.icon} />
                        <p className="mb-0">Nothing here.</p>
                      </div>
                    ) : (
                      requests
                        .filter((r) => r.status === c.status)
                        .map((r) => (
                          <div className="guest-request-card mb-3" key={r.id} style={{ minHeight: 'auto' }}>
                            <div className="request-card-top">
                              <span className="room-badge">Room {r.roomNumber}</span>
                              <span className={`request-status ${c.cls}`}>{c.status === 'InProgress' ? 'In Progress' : c.status}</span>
                            </div>
                            <div className="request-card-main">
                              <h3>{r.guestName || 'Guest'}</h3>
                              <div className="d-flex flex-wrap gap-1 mb-2">
                                {(r.services || []).map((s) => (
                                  <span key={s} className="badge bg-secondary">{s}</span>
                                ))}
                              </div>
                              <p className="request-description mb-1">
                                {r.preferredDate && <><i className="bi bi-calendar-event me-1" />{r.preferredDate}</>}
                                {r.preferredTime && <> · {r.preferredTime}</>} · {r.priority}
                              </p>
                              <p className="request-meta-row mb-2">
                                <span><i className="bi bi-person-badge me-1" />{r.assignee || 'Unassigned'}</span>
                                <span><i className="bi bi-clock me-1" />{new Date(r.submittedAt || Date.now()).toLocaleString('en-ZA')}</span>
                              </p>
                              <div className="request-actions">
                                {r.status === 'Pending' && (
                                  <button type="button" className="btn-request-start btn-request-done" onClick={() => accept(r.id)}>
                                    Accept task
                                  </button>
                                )}
                                {r.status === 'InProgress' && (
                                  <button type="button" className="btn-request-complete btn-request-done" onClick={() => complete(r.id)}>
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="d-flex gap-2 mt-4">
          <Link to="/Housekeeping/Requests" className="btn-log"><i className="bi bi-list-check me-2" /> All requests</Link>
        </div>
      </div>
    </div>
  );
}
