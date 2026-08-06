import { useEffect, useState } from 'react';
import { listGuests, updateUser } from '../services/userService';
import './admin.css';

const ROLES = ['guest', 'housekeeping', 'laundry', 'storekeeper', 'maintenance', 'admin'];

export default function AdminGuests() {
  const [guests, setGuests] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => setGuests(await listGuests());
  useEffect(() => { load(); }, []);

  const setRole = async (uid, role) => {
    await updateUser(uid, { role });
    setNotice('Role updated.');
    load();
  };

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Users</div>
            <h1 className="admin-title"><i className="bi bi-people me-2" />Guests</h1>
            <p className="meta-text mb-0">Registered guest accounts. Roles are normally set in the Firebase Console.</p>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Set role</th>
                </tr>
              </thead>
              <tbody>
                {guests.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted py-5">No registered guests yet.</td></tr>
                ) : (
                  guests.map((g) => (
                    <tr key={g.uid}>
                      <td><div className="guest-name">{g.name || g.email}</div></td>
                      <td>{g.email}</td>
                      <td><span className={`status-pill ${g.role === 'guest' ? 'status-approved' : 'status-checkedin'}`}>{g.role}</span></td>
                      <td className="meta-text">{g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-ZA') : '—'}</td>
                      <td>
                        <select className="form-select form-select-sm" value={g.role} onChange={(e) => setRole(g.uid, e.target.value)}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
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
