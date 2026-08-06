import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createFoundReport,
  listFoundReports,
  listLostReports,
  matchFoundToLost,
  updateFoundReportStatus,
} from '../services/lostFoundService';
import { LOST_ITEM_CATEGORIES } from '../lib/constants';
import { fileToDataUrl } from '../lib/utils';
import './maintenance.css';
import './housekeeping.css';

export default function FoundItems() {
  const { user } = useAuth();
  const [found, setFound] = useState([]);
  const [lost, setLost] = useState([]);
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [item, setItem] = useState('');
  const [category, setCategory] = useState(LOST_ITEM_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [f, l] = await Promise.all([listFoundReports(), listLostReports()]);
    setFound(f);
    setLost(l);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!item.trim()) return setError('Describe the item.');
    await createFoundReport({
      item,
      category,
      description,
      foundBy: user?.name || user?.email || 'Staff',
      foundDate: new Date().toISOString(),
      location,
      image,
    });
    setNotice(`${item} recorded as found.`);
    setShowForm(false); setItem(''); setDescription(''); setLocation(''); setImage('');
    load();
  };

  const onImage = async (file) => {
    if (!file) return;
    setImage(await fileToDataUrl(file));
  };

  const match = async (foundId) => {
    const openLost = lost.filter((l) => l.status === 'Searching');
    if (openLost.length === 0) {
      setNotice('No open lost reports to match against.');
      return;
    }
    const target = openLost.find((l) => l.category === found.find((f) => f.id === foundId)?.category) || openLost[0];
    await matchFoundToLost(foundId, target.id, user?.name || user?.email);
    setNotice(`Matched to lost report "${target.item}" and the guest was notified.`);
    load();
  };

  const openLostCount = lost.filter((l) => l.status === 'Searching').length;

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Lost &amp; Found</div>
            <h1 className="maint-title">Found Items</h1>
          </div>
          <button type="button" className="btn-log" onClick={() => setShowForm((s) => !s)}>
            <i className="bi bi-plus-lg me-2" />{showForm ? 'Close form' : 'Log found item'}
          </button>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="found-mini-grid mb-4">
          <div className="found-mini-card">
            <span className="found-mini-icon"><i className="bi bi-inbox" /></span>
            <strong>{found.length}</strong>
            <p>Items logged as found</p>
          </div>
          <div className="found-mini-card">
            <span className="found-mini-icon"><i className="bi bi-search" /></span>
            <strong>{openLostCount}</strong>
            <p>Open lost reports</p>
          </div>
          <div className="found-mini-card">
            <span className="found-mini-icon"><i className="bi bi-check2-circle" /></span>
            <strong>{found.filter((f) => f.status === 'Claimed').length}</strong>
            <p>Matched &amp; claimed</p>
          </div>
        </div>

        {showForm && (
          <form className="inspection-form-card mb-4" onSubmit={submit}>
            {error && <div className="lost-alert lost-alert-danger mb-3">{error}</div>}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="inspection-label">Item</label>
                <input className="form-control inspection-input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Black leather wallet" />
              </div>
              <div className="col-md-6">
                <label className="inspection-label">Category</label>
                <select className="form-select inspection-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {LOST_ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="inspection-label">Found location</label>
                <input className="form-control inspection-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pool deck" />
              </div>
              <div className="col-md-6">
                <label className="inspection-label">Photo</label>
                <input type="file" accept="image/*" className="form-control inspection-input" onChange={(e) => onImage(e.target.files[0])} />
              </div>
              <div className="col-12">
                <label className="inspection-label">Description</label>
                <textarea className="form-control inspection-input" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-log mt-3"><i className="bi bi-save me-2" />Save found item</button>
          </form>
        )}

        <div className="found-services-grid">
          <div className="found-service-card">
            <h2>Found items log</h2>
            {found.length === 0 ? (
              <div className="empty-request-state mt-3"><i className="bi bi-box" /><p>No found items recorded.</p></div>
            ) : (
              <div className="table-responsive mt-3">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Category</th><th>Location</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div className="task-name">{f.item}</div>
                          <div className="task-sub">{f.description}</div>
                        </td>
                        <td>{f.category}</td>
                        <td>{f.location || '—'}</td>
                        <td><span className={`inspection-status ${f.status === 'Claimed' ? 'passed' : f.status === 'Returned' ? 'completed' : 'pending'}`}>{f.status}</span></td>
                        <td>
                          {f.status === 'Unclaimed' && (
                            <button type="button" className="btn-request-start btn-request-done" onClick={() => match(f.id)}>Match to lost</button>
                          )}
                          {f.status === 'Claimed' && (
                            <button type="button" className="btn-request-complete btn-request-done" onClick={() => updateFoundReportStatus(f.id, 'Returned').then(load)}>Mark returned</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="found-info-card">
            <h3>Open lost reports</h3>
            {lost.filter((l) => l.status === 'Searching').length === 0 ? (
              <p className="mt-3">No open lost reports.</p>
            ) : (
              lost.filter((l) => l.status === 'Searching').map((l) => (
                <div className="lost-item-card" key={l.id}>
                  <strong>{l.item}</strong>
                  <div className="text-muted small">{l.category} · Room {l.roomNumber || '—'} · {l.urgency}</div>
                  <div className="text-muted small mt-1">{l.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
