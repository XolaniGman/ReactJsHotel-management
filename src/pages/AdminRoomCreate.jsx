import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../services/roomService';
import { fileToDataUrl } from '../lib/utils';
import { ROOM_TYPES, ROOM_STATUSES, amenityLabels } from '../lib/constants';
import './maintenance.css';

const AMENITY_OPTIONS = Object.entries(amenityLabels).map(([key, label]) => ({ key, label }));

export default function AdminRoomCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    number: '', name: '', type: 'Single', price: '', floor: 1, capacity: 1,
    status: 'Available', description: '', beds: '', size: '', overview: '', image: '',
  });
  const [amenities, setAmenities] = useState([]);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleAmenity = (key) =>
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));

  const onImage = async (file) => {
    if (!file) return;
    set('image', await fileToDataUrl(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.number || !form.name || !form.price) return setError('Room number, name and price are required.');
    await createRoom({ ...form, number: Number(form.number), price: Number(form.price), floor: Number(form.floor) || 1, capacity: Number(form.capacity) || 1, amenities });
    navigate('/Rooms');
  };

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Admin</div>
            <h1 className="maint-title">Add Room</h1>
          </div>
        </div>

        {error && <div className="lost-alert lost-alert-danger mb-3">{error}</div>}

        <form onSubmit={submit}>
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="inspection-form-card">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="inspection-label">Room number</label>
                    <input type="number" className="form-control inspection-input" value={form.number} onChange={(e) => set('number', e.target.value)} required />
                  </div>
                  <div className="col-md-3">
                    <label className="inspection-label">Floor</label>
                    <input type="number" className="form-control inspection-input" value={form.floor} onChange={(e) => set('floor', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="inspection-label">Room name</label>
                    <input className="form-control inspection-input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                  </div>
                  <div className="col-md-3">
                    <label className="inspection-label">Type</label>
                    <select className="form-select inspection-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                      {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="inspection-label">Price / night</label>
                    <input type="number" className="form-control inspection-input" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} required />
                  </div>
                  <div className="col-md-3">
                    <label className="inspection-label">Capacity</label>
                    <input type="number" className="form-control inspection-input" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="inspection-label">Status</label>
                    <select className="form-select inspection-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                      {ROOM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="inspection-label">Beds</label>
                    <input className="form-control inspection-input" value={form.beds} onChange={(e) => set('beds', e.target.value)} placeholder="1 King Bed" />
                  </div>
                  <div className="col-md-6">
                    <label className="inspection-label">Size</label>
                    <input className="form-control inspection-input" value={form.size} onChange={(e) => set('size', e.target.value)} placeholder="32 m²" />
                  </div>
                  <div className="col-12">
                    <label className="inspection-label">Overview</label>
                    <textarea className="form-control inspection-input" rows="2" value={form.overview} onChange={(e) => set('overview', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="inspection-label">Room photo</label>
                    <input type="file" accept="image/*" className="form-control inspection-input" onChange={(e) => onImage(e.target.files[0])} />
                    {form.image && <img src={form.image} alt="preview" className="mt-2" style={{ maxHeight: 140, borderRadius: 12 }} />}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="inspection-side-card">
                <div className="inspection-side-body">
                  <h2 className="inspection-card-title">Room amenities</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {AMENITY_OPTIONS.map((a) => (
                      <button
                        type="button"
                        key={a.key}
                        className="inspection-filter-btn"
                        style={amenities.includes(a.key) ? { background: '#775a19', color: '#fff' } : {}}
                        onClick={() => toggleAmenity(a.key)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className="btn-log mt-4 w-100"><i className="bi bi-check-lg me-2" />Save room</button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
