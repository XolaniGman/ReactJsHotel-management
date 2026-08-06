import { useEffect, useState } from 'react';
import {
  listTables,
  listTableReservations,
  createTable,
  reserveTable,
  updateTableReservationStatus,
  deleteTableReservation,
} from '../services/restaurantService';
import { todayISO } from '../lib/utils';
import './admin.css';
import './restaurant.css';

const STATUS_TONE = { Available: 'avail', Reserved: 'reserved', Occupied: 'occupied' };
const LOCATIONS = ['Window', 'Outdoor', 'Quiet zone', 'Standard'];

export default function AdminRestaurantTables() {
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [notice, setNotice] = useState('');

  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [preference, setPreference] = useState('No preference');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');

  const [newNumber, setNewNumber] = useState('');
  const [newCapacity, setNewCapacity] = useState(2);
  const [newLocation, setNewLocation] = useState('Standard');

  const load = async () => {
    const [t, r] = await Promise.all([listTables(), listTableReservations()]);
    setTables(t);
    setReservations(r);
  };

  useEffect(() => { load(); }, []);

  const act = async (fn, message) => {
    await fn();
    setNotice(message);
    load();
  };

  const addTable = async (e) => {
    e.preventDefault();
    if (!newNumber || Number(newNumber) <= 0) return setNotice('Enter a table number.');
    await createTable({ number: newNumber, capacity: newCapacity, location: newLocation });
    setNewNumber('');
    setNewCapacity(2);
    setNewLocation('Standard');
    setNotice('Table added.');
    load();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) return setNotice('Enter the guest name.');
    const result = await reserveTable({
      tableNumber: Number(document.querySelector('#ReserveTable')?.value || 0),
      date,
      time,
      partySize,
      preference,
      guestName: guestName.trim(),
      guestContact: guestContact.trim(),
    });
    setNotice(result?.error || `Table reserved (${result.ref}).`);
    load();
  };

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Restaurant</div>
            <h1 className="admin-title"><i className="bi bi-grid me-2" />Tables &amp; Reservations</h1>
            <p className="meta-text mb-0">Live floor plan with reservations and table turnover.</p>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-card mb-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-grid-3x3 me-2" />Floor plan</h2>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <form onSubmit={addTable} className="d-flex flex-wrap gap-2 align-items-end mb-4 p-3" style={{ background: '#fbf4ea', borderRadius: 12 }}>
              <div>
                <label className="form-label fw-bold small text-uppercase mb-1">Table no.</label>
                <input type="number" min="1" className="form-control" style={{ width: 110 }} value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="e.g. 9" />
              </div>
              <div>
                <label className="form-label fw-bold small text-uppercase mb-1">Seats</label>
                <input type="number" min="1" max="20" className="form-control" style={{ width: 90 }} value={newCapacity} onChange={(e) => setNewCapacity(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <label className="form-label fw-bold small text-uppercase mb-1">Location</label>
                <select className="form-select" style={{ width: 150 }} value={newLocation} onChange={(e) => setNewLocation(e.target.value)}>
                  {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <button type="submit" className="admin-btn" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>
                <i className="bi bi-plus-lg me-1" /> Add table
              </button>
            </form>

            {tables.length === 0 ? (
              <div className="empty-state">No tables yet. Add one above or run Seed demo data.</div>
            ) : (
              <div className="table-floor">
                {tables.map((t) => (
                  <div className="table-tile" key={t.id}>
                    <span className={`tile-status ${STATUS_TONE[t.status] || 'avail'}`}>{t.status}</span>
                    <i className={`bi bi-${t.status === 'Occupied' ? 'people-fill' : 'door-closed-fill'} tile-icon`} />
                    <p className="tile-number">Table {t.number}</p>
                    <div className="tile-meta">
                      Seats {t.capacity} · {t.location}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-calendar-plus me-2" />Reserve a table</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <form onSubmit={submit}>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Table</label>
                    <select id="ReserveTable" className="form-select">
                      {tables.map((t) => (
                        <option key={t.id} value={t.number}>Table {t.number} (seats {t.capacity})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Party size</label>
                    <input type="number" min="1" className="form-control" value={partySize} onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Date</label>
                    <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Time</label>
                    <select className="form-select" value={time} onChange={(e) => setTime(e.target.value)}>
                      {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Preference</label>
                    <select className="form-select" value={preference} onChange={(e) => setPreference(e.target.value)}>
                      {['No preference', 'Window', 'Outdoor', 'Quiet zone'].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Guest name</label>
                    <input className="form-control" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold small text-uppercase">Contact</label>
                    <input className="form-control" value={guestContact} onChange={(e) => setGuestContact(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="admin-btn mt-3" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>
                  <i className="bi bi-calendar-check me-2" /> Reserve table
                </button>
              </form>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-calendar-week me-2" />Reservations</h2>
            </div>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ref</th><th>Table</th><th>Guest</th><th>When</th><th>Party</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted py-5">No table reservations yet.</td></tr>
                  ) : (
                    reservations.map((r) => (
                      <tr key={r.id}>
                        <td className="fw-bold">{r.ref}</td>
                        <td>Table {r.tableNumber}</td>
                        <td>{r.guestName}</td>
                        <td>{r.date} · {r.time}</td>
                        <td>×{r.partySize}</td>
                        <td><span className={`status-pill ${r.status === 'Reserved' ? 'status-pending' : r.status === 'CheckedIn' ? 'status-checkedin' : r.status === 'Completed' ? 'status-approved' : 'status-cancelled'}`}>{r.status}</span></td>
                        <td>
                          {r.status === 'Reserved' && (
                            <button type="button" className="btn btn-success btn-sm" onClick={() => act(() => updateTableReservationStatus(r.id, 'CheckedIn'), `${r.ref} checked in.`)}>
                              Check in
                            </button>
                          )}
                          {r.status === 'CheckedIn' && (
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => act(() => updateTableReservationStatus(r.id, 'Completed'), `${r.ref} completed — table released.`)}>
                              Complete
                            </button>
                          )}
                          {r.status === 'Reserved' && (
                            <>
                              <button type="button" className="btn btn-sm btn-outline-warning ms-1" onClick={() => act(() => updateTableReservationStatus(r.id, 'NoShow'), 'Marked no-show.')}>
                                No-show
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-danger ms-1" onClick={() => act(() => updateTableReservationStatus(r.id, 'Cancelled'), 'Reservation cancelled.')}>
                                Cancel
                              </button>
                            </>
                          )}
                          {r.status === 'Completed' && (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => act(() => deleteTableReservation(r.id), 'Reservation deleted.')}>
                              <i className="bi bi-trash" />
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
    </div>
  );
}
