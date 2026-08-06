import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listAllReservations,
  approveReservation,
  declineReservation,
} from '../services/reservationService';
import { formatPrice, formatDateRange, statusTone } from '../lib/utils';
import './admin.css';

export default function AdminReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');
  const [declineFor, setDeclineFor] = useState(null);
  const [reason, setReason] = useState('');

  const load = async () => setReservations(await listAllReservations());
  useEffect(() => { load(); }, []);

  const byName = user?.name || user?.email || 'Admin';

  const approve = async (id) => {
    await approveReservation(id, byName);
    setNotice('Reservation approved and the guest can check in.');
    load();
  };

  const decline = async (id) => {
    await declineReservation(id, byName, reason);
    setNotice('Reservation declined.');
    setDeclineFor(null); setReason('');
    load();
  };

  const shown = filter === 'All' ? reservations : reservations.filter((r) => r.status === filter);
  const counts = reservations.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Bookings</div>
            <h1 className="admin-title"><i className="bi bi-calendar-check me-2" />Reservations</h1>
            <p className="meta-text mb-0">Approve or decline pending bookings and review all stay requests.</p>
          </div>
          <Link className="admin-btn" to="/Reservations/Create"><i className="bi bi-plus-lg me-2" />New booking</Link>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="d-flex flex-wrap gap-2 mb-3">
          {['All', 'Pending', 'Approved', 'Declined', 'CheckedIn', 'CheckedOut', 'Cancelled'].map((s) => (
            <button
              type="button"
              key={s}
              className="inspection-filter-btn"
              style={filter === s ? { background: '#775a19', color: '#fff' } : {}}
              onClick={() => setFilter(s)}
            >
              {s === 'All' ? 'All' : s} {s !== 'All' && `(${counts[s] || 0})`}
            </button>
          ))}
        </div>

        <div className="admin-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest</th><th>Room</th><th>Dates</th><th>Nights</th><th>Total</th><th>Status</th><th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted py-5">No reservations found.</td></tr>
                ) : (
                  shown.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="guest-name">{r.guestName}</div>
                        <div className="meta-text">{r.bookingRef}</div>
                      </td>
                      <td>Room {r.roomNumber} <span className="meta-text">({r.roomType})</span></td>
                      <td className="meta-text">{formatDateRange(r.checkInDate, r.checkOutDate)}</td>
                      <td>{r.nights}</td>
                      <td>{formatPrice(r.total)}</td>
                      <td><span className={`status-pill ${statusTone(r.status)}`}>{r.status}</span></td>
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          <Link className="admin-btn" style={{ minHeight: 'auto', padding: '0.35rem 0.7rem' }} to={`/Reservations/Details/${r.id}`}><i className="bi bi-eye me-1" />View</Link>
                          {r.status === 'Pending' && (
                            <>
                              <button type="button" className="btn btn-success btn-sm" onClick={() => approve(r.id)}>Approve</button>
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setDeclineFor(r.id)}>Decline</button>
                            </>
                          )}
                        </div>
                        {declineFor === r.id && (
                          <div className="mt-2">
                            <input className="form-control form-control-sm" placeholder="Reason for declining…" value={reason} onChange={(e) => setReason(e.target.value)} />
                            <button type="button" className="btn btn-danger btn-sm mt-1" onClick={() => decline(r.id)}>Confirm decline</button>
                          </div>
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
