import { useEffect, useState } from 'react';
import {
  listCleanerSchedules,
  createCleanerSchedule,
  updateCleanerSchedule,
  deleteCleanerSchedule,
} from '../services/adminService';
import { listRooms } from '../services/roomService';
import './admin.css';

export default function AdminCleanerSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState('');
  const [shift, setShift] = useState('Morning');
  const [roomNumbers, setRoomNumbers] = useState('');

  const load = async () => {
    const [s, r] = await Promise.all([listCleanerSchedules(), listRooms()]);
    setSchedules(s);
    setRooms(r);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setStaffName(''); setDate(''); setShift('Morning'); setRoomNumbers('');
  };

  const startEdit = (s) => {
    setEditing(s.id); setStaffName(s.staffName); setDate(s.date); setShift(s.shift); setRoomNumbers((s.roomNumbers || []).join(', '));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!staffName || !date) return;
    const data = { staffName, date, shift, roomNumbers: roomNumbers.split(',').map((x) => x.trim()).filter(Boolean).map(Number) };
    if (editing) {
      await updateCleanerSchedule(editing, data);
      setNotice('Schedule updated.');
    } else {
      await createCleanerSchedule(data);
      setNotice('Schedule created.');
    }
    reset();
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    await deleteCleanerSchedule(id);
    load();
  };

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Housekeeping</div>
            <h1 className="admin-title"><i className="bi bi-calendar-week me-2" />Cleaner Schedules</h1>
            <p className="meta-text mb-0">Assign cleaners to rooms per shift.</p>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-plus-circle me-2" />{editing ? 'Edit schedule' : 'New schedule'}</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <form onSubmit={submit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Cleaner name</label>
                    <input className="form-control" value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Date</label>
                    <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Shift</label>
                    <select className="form-select" value={shift} onChange={(e) => setShift(e.target.value)}>
                      <option>Morning</option><option>Afternoon</option><option>Night</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Rooms (comma separated)</label>
                    <input className="form-control" value={roomNumbers} onChange={(e) => setRoomNumbers(e.target.value)} placeholder="101, 102, 103" />
                  </div>
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button type="submit" className="admin-btn" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>{editing ? 'Save changes' : 'Create schedule'}</button>
                  {editing && <button type="button" className="admin-btn" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-door-open me-2" />Rooms</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div className="d-flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <span key={r.id} className="admin-date" style={{ padding: '0.4rem 0.7rem' }}>
                    {r.number} <span className={`status-pill ${r.status === 'Available' ? 'status-approved' : r.status === 'Dirty' ? 'status-pending' : r.status === 'Occupied' ? 'status-checkedin' : 'status-default'}`}>{r.status}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card mt-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-list-check me-2" />Schedules</h2>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cleaner</th><th>Date</th><th>Shift</th><th>Rooms</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted py-5">No schedules yet.</td></tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id}>
                      <td className="fw-bold">{s.staffName}</td>
                      <td>{s.date}</td>
                      <td><span className={`status-pill ${s.shift === 'Morning' ? 'status-approved' : s.shift === 'Afternoon' ? 'status-checkedin' : 'status-default'}`}>{s.shift}</span></td>
                      <td>{(s.roomNumbers || []).map((n) => `Room ${n}`).join(', ') || '—'}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => startEdit(s)}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(s.id)}><i className="bi bi-trash" /></button>
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
