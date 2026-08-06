import { useEffect, useState } from 'react';
import {
  listAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  listAmenityRequests,
  updateAmenityRequestStatus,
} from '../services/amenityService';
import { formatPrice, formatDateTime } from '../lib/utils';
import './admin.css';

export default function AdminAmenities() {
  const [amenities, setAmenities] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [isFree, setIsFree] = useState(true);
  const [icon, setIcon] = useState('bi-star');

  const load = async () => {
    const [a, r] = await Promise.all([listAmenities(), listAmenityRequests()]);
    setAmenities(a);
    setRequests(r);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (a) => {
    setEditing(a.id);
    setName(a.name); setUnitPrice(a.unitPrice || 0); setIsFree(!!a.isFree); setIcon(a.icon || 'bi-star');
  };

  const reset = () => {
    setEditing(null); setName(''); setUnitPrice(0); setIsFree(true); setIcon('bi-star');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = { name, unitPrice: isFree ? 0 : Number(unitPrice) || 0, isFree, icon };
    if (editing) {
      await updateAmenity(editing, data);
      setNotice('Amenity updated.');
    } else {
      await createAmenity(data);
      setNotice('Amenity added.');
    }
    reset();
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this amenity?')) return;
    await deleteAmenity(id);
    load();
  };

  const setRequestStatus = async (id, status) => {
    await updateAmenityRequestStatus(id, status);
    setNotice(`Request marked ${status}.`);
    load();
  };

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Services</div>
            <h1 className="admin-title"><i className="bi bi-bell me-2" />Amenities</h1>
            <p className="meta-text mb-0">Manage amenity catalogue and fulfil guest requests.</p>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-star me-2" />Guest requests</h2>
            </div>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th><th>Guest</th><th>Room</th><th>Qty</th><th>Charge</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-muted py-5">No amenity requests yet.</td></tr>
                  ) : (
                    requests.map((r) => (
                      <tr key={r.id}>
                        <td className="fw-bold">{r.amenityName}</td>
                        <td>{r.guestName}</td>
                        <td>Room {r.roomNumber || '—'}</td>
                        <td>×{r.quantity}</td>
                        <td>{r.unitPrice > 0 ? formatPrice(r.totalPrice) : 'Free'}</td>
                        <td><span className={`status-pill ${r.status === 'Pending' ? 'status-pending' : r.status === 'InProgress' ? 'status-checkedin' : 'status-approved'}`}>{r.status}</span></td>
                        <td>
                          {r.status === 'Pending' && <button type="button" className="btn btn-info btn-sm" onClick={() => setRequestStatus(r.id, 'InProgress')}>Start</button>}
                          {r.status === 'InProgress' && <button type="button" className="btn btn-success btn-sm" onClick={() => setRequestStatus(r.id, 'Completed')}>Complete</button>}
                          {r.status === 'Completed' && <span className="text-success small">{formatDateTime(r.createdAt)}</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-plus-circle me-2" />{editing ? 'Edit amenity' : 'Add amenity'}</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <form onSubmit={submit}>
                <label className="form-label fw-bold small text-uppercase">Name</label>
                <input className="form-control mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Extra Pillow" />
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} id="FreeToggle" />
                  <label className="form-check-label" htmlFor="FreeToggle">Complimentary (free)</label>
                </div>
                {!isFree && (
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-uppercase">Unit price (R)</label>
                    <input type="number" className="form-control" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                  </div>
                )}
                <label className="form-label fw-bold small text-uppercase">Icon</label>
                <select className="form-select mb-3" value={icon} onChange={(e) => setIcon(e.target.value)}>
                  {['bi-star', 'bi-moon-stars', 'bi-droplet-half', 'bi-cup-hot', 'bi-brush', 'bi-plug', 'bi-balloon', 'bi-person', 'bi-layout-text-window', 'bi-cup-straw', 'bi-foot'].map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <div className="d-flex gap-2">
                  <button type="submit" className="admin-btn" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>{editing ? 'Save changes' : 'Add amenity'}</button>
                  {editing && <button type="button" className="admin-btn" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="admin-card mt-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-list-stars me-2" />Amenity catalogue</h2>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Icon</th><th>Name</th><th>Type</th><th>Price</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {amenities.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-muted py-5">No amenities in the catalogue yet.</td></tr>
                ) : (
                  amenities.map((a) => (
                    <tr key={a.id}>
                      <td><i className={`bi ${a.icon || 'bi-star'}`} /></td>
                      <td className="fw-bold">{a.name}</td>
                      <td><span className={`status-pill ${a.isFree ? 'status-approved' : 'status-pending'}`}>{a.isFree ? 'Free' : 'Chargeable'}</span></td>
                      <td>{a.isFree ? '—' : formatPrice(a.unitPrice)}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => startEdit(a)}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(a.id)}><i className="bi bi-trash" /></button>
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
