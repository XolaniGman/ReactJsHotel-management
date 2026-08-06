import { useEffect, useState } from 'react';
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setMenuItemAvailability,
  seedRestaurantData,
} from '../services/restaurantService';
import { formatPrice } from '../lib/utils';
import './admin.css';
import './restaurant.css';

const CATEGORIES = ['Breakfast', 'Starters', 'Light Bites', 'Grills & Mains', 'Seafood', 'Desserts', 'Beverages'];
const DIETARY = ['Vegan', 'Vegetarian', 'Halal', 'Gluten-Free'];
const PREP_TIMES = [5, 10, 15, 20, 25, 30, 45];

const PRESET_IMAGES = [
  { label: 'Breakfast', url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pancakes', url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80' },
  { label: 'Starter', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80' },
  { label: 'Salad', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80' },
  { label: 'Bowl', url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80' },
  { label: 'Tacos', url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Curry', url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80' },
  { label: 'Grill', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80' },
  { label: 'Rice dish', url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=800&q=80' },
  { label: 'Seafood', url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80' },
  { label: 'Prawns', url: 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Dessert', url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pudding', url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80' },
  { label: 'Coffee', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80' },
  { label: 'Tea', url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80' },
  { label: 'Drink', url: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=80' },
];

const empty = {
  name: '',
  description: '',
  category: 'Grills & Mains',
  price: 0,
  prepTime: 15,
  image: '',
  dietary: [],
  available: true,
};

export default function AdminRestaurantMenu() {
  const [menu, setMenu] = useState([]);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => setMenu(await listMenuItems());

  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDiet = (tag) =>
    setForm((f) => ({
      ...f,
      dietary: f.dietary.includes(tag) ? f.dietary.filter((d) => d !== tag) : [...f.dietary, tag],
    }));

  const startEdit = (m) => {
    setEditing(m.id);
    setForm({
      name: m.name,
      description: m.description || '',
      category: m.category || 'Grills & Mains',
      price: m.price || 0,
      prepTime: m.prepTime || 15,
      image: m.image || '',
      dietary: m.dietary || [],
      available: m.available !== false,
    });
  };

  const reset = () => {
    setEditing(null);
    setForm(empty);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editing) {
      await updateMenuItem(editing, form);
      setNotice('Menu item updated.');
    } else {
      await createMenuItem(form);
      setNotice('Menu item added.');
    }
    reset();
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this menu item?')) return;
    await deleteMenuItem(id);
    load();
  };

  const toggleAvailable = async (m) => {
    await setMenuItemAvailability(m.id, m.available === false);
    load();
  };

  const populate = async () => {
    if (!window.confirm('Create the full demo menu, tables and chefs? This adds duplicate items if run again.')) return;
    setNotice('');
    const result = await seedRestaurantData();
    setNotice(`${result.menuItems} menu items, ${result.tables} tables and ${result.chefs} chefs created.`);
    load();
  };

  const grouped = CATEGORIES.map((c) => ({ category: c, items: menu.filter((m) => m.category === c) }));

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Restaurant</div>
            <h1 className="admin-title"><i className="bi bi-book me-2" />Menu Catalogue</h1>
            <p className="meta-text mb-0">Add, edit and publish menu items with photos, prices and dietary tags.</p>
          </div>
          <button type="button" className="lux-btn-gold" onClick={populate}>
            <i className="bi bi-magic me-2" /> Populate demo menu
          </button>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-plus-circle me-2" />{editing ? 'Edit menu item' : 'Add menu item'}</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <form onSubmit={submit}>
                <label className="form-label fw-bold small text-uppercase">Name</label>
                <input className="form-control mb-3" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Grilled Karoo Lamb Chops" />

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Category</label>
                    <select className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Prep time</label>
                    <select className="form-select" value={form.prepTime} onChange={(e) => set('prepTime', e.target.value)}>
                      {PREP_TIMES.map((t) => <option key={t} value={t}>{t} min</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Price (R)</label>
                    <input type="number" min="0" step="5" className="form-control" value={form.price} onChange={(e) => set('price', e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-bold small text-uppercase">Available</label>
                    <div className="form-check form-switch mt-2">
                      <input className="form-check-input" type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} id="AvailToggle" />
                      <label className="form-check-label" htmlFor="AvailToggle">Sold on menu</label>
                    </div>
                  </div>
                </div>

                <label className="form-label fw-bold small text-uppercase">Photo — pick an image</label>
                <div className="menu-img-grid mb-2">
                  {PRESET_IMAGES.map((img) => (
                    <button
                      type="button"
                      key={img.url}
                      className={`menu-img-option ${form.image === img.url ? 'active' : ''}`}
                      title={img.label}
                      onClick={() => set('image', img.url)}
                    >
                      <img src={img.url} alt={img.label} />
                      <span>{img.label}</span>
                    </button>
                  ))}
                </div>
                <label className="form-label fw-bold small text-uppercase mt-2">…or paste a photo URL</label>
                <input className="form-control mb-3" value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://images.unsplash.com/…" />

                <label className="form-label fw-bold small text-uppercase">Description</label>
                <textarea className="form-control mb-3" rows="2" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description of the dish." />

                <label className="form-label fw-bold small text-uppercase">Dietary tags</label>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {DIETARY.map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={`rest-diet ${form.dietary.includes(d) ? 'active' : ''}`}
                      onClick={() => toggleDiet(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="admin-btn" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>{editing ? 'Save changes' : 'Add menu item'}</button>
                  {editing && <button type="button" className="admin-btn" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-list-stars me-2" />Catalogue ({menu.length})</h2>
            </div>
            {grouped.map(({ category, items }) => (
              <div key={category}>
                <div className="admin-section-label">{category}</div>
                {items.length === 0 ? (
                  <div className="text-muted small py-2 px-3">No items in this category.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Dish</th><th>Price</th><th>Prep</th><th>Dietary</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((m) => (
                          <tr key={m.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                {m.image && <img src={m.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />}
                                <strong>{m.name}</strong>
                              </div>
                            </td>
                            <td>{formatPrice(m.price)}</td>
                            <td>{m.prepTime || '—'} min</td>
                            <td>
                              {(m.dietary || []).map((d) => <span key={d} className="menu-diet-tag me-1">{d}</span>)}
                            </td>
                            <td>
                              <button type="button" className={`status-pill ${m.available === false ? 'status-pending' : 'status-approved'}`} onClick={() => toggleAvailable(m)}>
                                {m.available === false ? 'Sold out' : 'Available'}
                              </button>
                            </td>
                            <td>
                              <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => startEdit(m)}><i className="bi bi-pencil" /></button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(m.id)}><i className="bi bi-trash" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
