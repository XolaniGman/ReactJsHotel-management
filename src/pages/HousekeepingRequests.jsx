import { useEffect, useState } from 'react';
import { listCleaningRequests } from '../services/housekeepingService';
import { formatDateTime } from '../lib/utils';
import './housekeeping.css';

export default function HousekeepingRequests() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    listCleaningRequests().then(setRequests);
  }, []);

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Housekeeping</div>
            <h1 className="maint-title">All Cleaning Requests</h1>
            <p className="meta-text mb-0">Full list of guest cleaning requests.</p>
          </div>
        </div>

        <div className="san-table-card table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Room</th><th>Guest</th><th>Services</th><th>Preferred</th><th>Priority</th><th>Assignee</th><th>Status</th><th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-5">
                    <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.6rem' }} />
                    No cleaning requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-bold">Room {r.roomNumber}</td>
                    <td>{r.guestName}</td>
                    <td>{(r.services || []).join(', ')}</td>
                    <td>{r.preferredDate}{r.preferredTime ? ` · ${r.preferredTime}` : ''}</td>
                    <td><span className={`badge ${r.priority === 'High' || r.priority === 'Urgent' ? 'bg-danger' : r.priority === 'Medium' ? 'bg-warning text-dark' : 'bg-secondary'}`}>{r.priority}</span></td>
                    <td>{r.assignee || 'Unassigned'}</td>
                    <td><span className={`request-status ${r.status === 'Completed' ? 'completed' : r.status === 'InProgress' ? 'progressing' : 'pending'}`}>{r.status}</span></td>
                    <td className="meta-text">{formatDateTime(r.submittedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
