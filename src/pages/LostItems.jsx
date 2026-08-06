import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createLostReport, listMyLostReports } from '../services/lostFoundService';
import { listUserReservations } from '../services/reservationService';
import { LOST_ITEM_CATEGORIES } from '../lib/constants';
import { formatDateTime } from '../lib/utils';
import './guest.css';

export default function LostItems() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({
    item: '',
    category: LOST_ITEM_CATEGORIES[0],
    lastSeen: '',
    description: '',
    contactPreference: 'Email',
    urgency: 'Low',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  const load = async () => {
    const [r, l] = await Promise.all([listUserReservations(user.uid), listMyLostReports(user.uid)]);
    setReservations(r);
    setReports(l);
  };

  useEffect(() => { load(); }, [user?.uid]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.item.trim()) return setError('Describe the item you lost.');
    await createLostReport({
      guestUid: user.uid,
      guestName: user.name,
      roomNumber: activeRes?.roomNumber || '',
      ...form,
    });
    setForm({ item: '', category: LOST_ITEM_CATEGORIES[0], lastSeen: '', description: '', contactPreference: 'Email', urgency: 'Low' });
    setSuccess('Report submitted. Our team is searching for your item.');
    load();
  };

  return (
    <div className="lost-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Lost Item Services</div>
          <h1 className="lost-title">Lost something?</h1>
          <p className="lost-copy">
            Report a lost item and our housekeeping team will keep an eye out. You&rsquo;ll be
            notified the moment it&rsquo;s found.
          </p>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}

      <div className="lost-feature-grid">
        <form className="lost-form-card" onSubmit={submit}>
          <h2 className="clean-card-title">Report a lost item</h2>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="lost-label" htmlFor="Item">Item name</label>
              <input id="Item" className="form-control lost-input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Black wallet" />
            </div>
            <div className="col-md-6">
              <label className="lost-label" htmlFor="Category">Category</label>
              <select id="Category" className="form-select lost-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {LOST_ITEM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="lost-label" htmlFor="LastSeen">Where did you last have it?</label>
              <input id="LastSeen" className="form-control lost-input" value={form.lastSeen} onChange={(e) => setForm({ ...form, lastSeen: e.target.value })} placeholder="e.g. Pool area" />
            </div>
            <div className="col-md-6">
              <label className="lost-label" htmlFor="Urgency">Urgency</label>
              <select id="Urgency" className="form-select lost-input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="lost-label" htmlFor="Contact">Contact preference</label>
              <select id="Contact" className="form-select lost-input" value={form.contactPreference} onChange={(e) => setForm({ ...form, contactPreference: e.target.value })}>
                <option>Email</option><option>Phone</option><option>In person</option>
              </select>
            </div>
            <div className="col-12">
              <label className="lost-label" htmlFor="Description">Description</label>
              <textarea id="Description" className="form-control lost-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="book-submit mt-4"><i className="bi bi-search me-2" /> Submit report</button>
        </form>

        <div className="lost-side-card">
          <div className="lost-card-icon"><i className="bi bi-lightbulb" /></div>
          <h3 className="lost-card-title">Good to know</h3>
          <div className="lost-info-row"><i className="bi bi-shield-check" /><span>Items are kept safe for up to 90 days.</span></div>
          <div className="lost-info-row"><i className="bi bi-bell" /><span>You&rsquo;ll see a notification here when your item is found.</span></div>
          <div className="lost-info-row"><i className="bi bi-telephone" /><span>Contact the front desk for urgent items.</span></div>
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel-header"><h2>My reports</h2></div>
        {reports.length === 0 ? (
          <div className="dash-empty"><i className="bi bi-inbox" /> No reports yet.</div>
        ) : (
          reports.map((r) => (
            <div className="lost-report-row" key={r.id}>
              <div>
                <div className="lost-report-item">{r.item}</div>
                <div className="lost-report-meta">{r.category} · {r.lastSeen || '—'} · {formatDateTime(r.createdAt)}</div>
              </div>
              <span className={`dash-status-pill ${r.status === 'Found' ? 'success' : 'warn'}`}>{r.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
