import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createLostReport, listMyLostReports } from '../services/lostFoundService';
import { listUserReservations } from '../services/reservationService';
import { LOST_ITEM_CATEGORIES } from '../lib/constants';
import { formatDateTime } from '../lib/utils';
import './guest.css';
import './palm.css';

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
    <div className="palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Lost Item Services</div>
          <h1 className="palm-page-title">Lost something?</h1>
          <p className="palm-page-copy">
            Report a lost item and our housekeeping team will keep an eye out. You&rsquo;ll be
            notified the moment it&rsquo;s found.
          </p>
        </div>
      </div>

      {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {success && <div className="palm-alert palm-alert-success"><i className="bi bi-check-circle" />{success}</div>}

      <div className="palm-grid">
        <form className="palm-card" onSubmit={submit}>
          <div className="palm-card-body pt-4">
            <h2 className="palm-card-title mb-3">Report a lost item</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="Item">Item name</label>
                <input id="Item" className="form-control" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Black wallet" />
              </div>
              <div className="col-md-6">
                <label htmlFor="Category">Category</label>
                <select id="Category" className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {LOST_ITEM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label htmlFor="LastSeen">Where did you last have it?</label>
                <input id="LastSeen" className="form-control" value={form.lastSeen} onChange={(e) => setForm({ ...form, lastSeen: e.target.value })} placeholder="e.g. Pool area" />
              </div>
              <div className="col-md-6">
                <label htmlFor="Urgency">Urgency</label>
                <select id="Urgency" className="form-select" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
              <div className="col-md-6">
                <label htmlFor="Contact">Contact preference</label>
                <select id="Contact" className="form-select" value={form.contactPreference} onChange={(e) => setForm({ ...form, contactPreference: e.target.value })}>
                  <option>Email</option><option>Phone</option><option>In person</option>
                </select>
              </div>
              <div className="col-12">
                <label htmlFor="Description">Description</label>
                <textarea id="Description" className="form-control" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="palm-btn palm-btn-primary mt-4"><i className="bi bi-search" /> Submit report</button>
          </div>
        </form>

        <div className="palm-card">
          <div className="palm-card-body pt-4">
            <span className="palm-quick-icon mb-2"><i className="bi bi-lightbulb" /></span>
            <h3 className="palm-card-title mb-2">Good to know</h3>
            <div className="palm-list-row" style={{ border: 'none', padding: '0.4rem 0' }}><span className="palm-list-meta"><i className="bi bi-shield-check" />Items are kept safe for up to 90 days.</span></div>
            <div className="palm-list-row" style={{ border: 'none', padding: '0.4rem 0' }}><span className="palm-list-meta"><i className="bi bi-bell" />You&rsquo;ll see a notification here when your item is found.</span></div>
            <div className="palm-list-row" style={{ border: 'none', padding: '0.4rem 0' }}><span className="palm-list-meta"><i className="bi bi-telephone" />Contact the front desk for urgent items.</span></div>
          </div>
        </div>
      </div>

      <div className="palm-card">
        <div className="palm-card-header"><span className="palm-card-title">My reports</span></div>
        <div className="palm-card-body">
          {reports.length === 0 ? (
            <div className="palm-empty"><i className="bi bi-inbox d-block mb-2" style={{ fontSize: '1.4rem' }} />No reports yet.</div>
          ) : (
            reports.map((r) => (
              <div className="palm-list-row" key={r.id}>
                <div>
                  <div className="palm-list-title">{r.item}</div>
                  <div className="palm-list-meta"><span>{r.category} · {r.lastSeen || '—'} · {formatDateTime(r.createdAt)}</span></div>
                </div>
                <span className={`palm-status-chip ${r.status === 'Found' ? 'success' : 'warn'}`}>{r.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
