import { useEffect, useState } from 'react';
import { listCheckIns, checkout } from '../services/checkinService';
import { formatDateTime } from '../lib/utils';
import './admin.css';

export default function AdminCheckIns() {
  const [checkins, setCheckins] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => setCheckins(await listCheckIns());
  useEffect(() => { load(); }, []);

  const doCheckout = async (id) => {
    if (!window.confirm('Check this guest out? The room will be marked Dirty for cleaning.')) return;
    await checkout(id);
    setNotice('Guest checked out. Room marked for cleaning.');
    load();
  };

  const active = checkins.filter((c) => !c.isCheckedOut);

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Front Desk</div>
            <h1 className="admin-title"><i className="bi bi-door-closed me-2" />Check-Ins</h1>
            <p className="meta-text mb-0">{active.length} guest(s) currently in-house.</p>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest</th><th>Room</th><th>Method</th><th>Checked in</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {checkins.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-5">No check-ins recorded yet.</td></tr>
                ) : (
                  checkins.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="guest-name">{c.guestName}</div>
                        <div className="meta-text">{c.bookingRef}</div>
                      </td>
                      <td>Room {c.roomNumber}</td>
                      <td>
                        <span className={`checkin-badge ${c.method === 'self' ? 'self' : 'staff'}`}>
                          {c.method === 'self' ? 'Self Check-In' : 'Front Desk'}
                        </span>
                      </td>
                      <td className="meta-text">{formatDateTime(c.createdAt)}</td>
                      <td>
                        <span className={`status-pill ${c.isCheckedOut ? 'status-cancelled' : 'status-checkedin'}`}>
                          {c.isCheckedOut ? 'Checked Out' : 'In House'}
                        </span>
                      </td>
                      <td>
                        {!c.isCheckedOut && (
                          <button type="button" className="btn btn-warning btn-sm" onClick={() => doCheckout(c.reservationId)}>
                            <i className="bi bi-box-arrow-right me-1" />Check out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
