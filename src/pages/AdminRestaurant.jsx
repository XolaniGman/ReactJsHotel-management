import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listOrders,
  listChefs,
  updateOrderStatus,
  reassignOrder,
  settleOrder,
} from '../services/restaurantService';
import { formatPrice, formatDateTime } from '../lib/utils';
import './admin.css';
import './restaurant.css';

const COLUMNS = [
  { status: 'Queued', title: 'Queued', icon: 'bi-hourglass-split', tone: 'amber' },
  { status: 'InPreparation', title: 'In Preparation', icon: 'bi-fire', tone: 'blue' },
  { status: 'ReadyForCollection', title: 'Ready for Collection', icon: 'bi-bell', tone: 'green' },
  { status: 'Served', title: 'Served', icon: 'bi-check2-circle', tone: 'dark' },
];

const fmtElapsed = (from, now) => {
  if (!from) return '—';
  const mins = Math.floor((now - from) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function AdminRestaurant() {
  const [orders, setOrders] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const [o, c] = await Promise.all([listOrders(), listChefs()]);
    setOrders(o);
    setChefs(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const act = async (fn, message) => {
    try {
      await fn();
      setNotice(message);
      load();
    } catch (err) {
      setNotice(`Something went wrong: ${err.message}`);
    }
  };

  const settle = async (id, method) => {
    try {
      const result = await settleOrder(id, method);
      if (result?.error) return setNotice(result.error);
      setNotice(method === 'RoomCharge' ? 'Charged to the guest’s room folio.' : `Payment recorded (${method}).`);
      load();
    } catch (err) {
      setNotice(`Could not settle: ${err.message}`);
    }
  };

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Restaurant</div>
            <h1 className="admin-title"><i className="bi bi-egg-fried me-2" />Kitchen Order Queue</h1>
            <p className="meta-text mb-0">Live view of all dine-in orders, from queued to served.</p>
          </div>
          <Link to="/Admin/Restaurant/Menu" className="lux-btn-gold">
            <i className="bi bi-list-ul me-2" /> Manage Menu
          </Link>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="rest-kpi-grid">
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon amber"><i className="bi bi-hourglass-split" /></span>
            <div><strong>{orders.filter((o) => o.status === 'Queued').length}</strong><span>Queued</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon blue"><i className="bi bi-fire" /></span>
            <div><strong>{orders.filter((o) => o.status === 'InPreparation').length}</strong><span>In preparation</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon green"><i className="bi bi-bell" /></span>
            <div><strong>{orders.filter((o) => o.status === 'ReadyForCollection').length}</strong><span>Ready to serve</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon red"><i className="bi bi-credit-card" /></span>
            <div><strong>{orders.filter((o) => o.status === 'Served' && !o.payment).length}</strong><span>Awaiting settlement</span></div>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat spin me-2" />Loading…</p>
        ) : orders.length === 0 ? (
          <div className="empty-state">No orders yet. Orders placed from the guest menu will appear here.</div>
        ) : (
          <div className="queue-grid">
            {COLUMNS.map((col) => (
              <div className="queue-col" key={col.status}>
                <div className="queue-col-head">
                  <strong><i className={`bi ${col.icon} me-2`} />{col.title}</strong>
                  <span>{orders.filter((o) => o.status === col.status).length}</span>
                </div>
                {orders.filter((o) => o.status === col.status).map((o) => {
                  const start = col.status === 'InPreparation' ? o.acceptedAt : o.createdAt;
                  const elapsed = start ? (now - start) / 60000 : 0;
                  const overdue = col.status !== 'Served' && o.estimateMinutes && elapsed > o.estimateMinutes;
                  return (
                    <div className={`order-ticket ${overdue ? 'red' : ''}`} key={o.id}>
                      <div className="order-ticket-head">
                        <strong>{o.orderNo}</strong>
                        <span className="order-ticket-table">Table {o.tableNumber}</span>
                      </div>
                      <div className="ticket-meta">
                        <i className="bi bi-person me-1" />{o.guestName} · {formatDateTime(o.createdAt)}
                      </div>
                      <ul className="ticket-items">
                        {o.items.map((it, i) => (
                          <li key={i}>
                            <span>×{it.qty} {it.name}</span>
                            <span>{formatPrice(it.unitPrice * it.qty)}</span>
                          </li>
                        ))}
                      </ul>
                      {(o.items || []).some((it) => it.notes) && (
                        <div className="ticket-notes">
                          {o.items.filter((it) => it.notes).map((it) => (
                            <div key={it.menuItemId}><strong>{it.name}:</strong> {it.notes}</div>
                          ))}
                        </div>
                      )}
                      <div className="ticket-meta">
                        <i className="bi bi-person-badge me-1" />{o.assignedChef || 'Unassigned'} · est. {o.estimateMinutes || '—'} min · <span className={overdue ? 'text-danger fw-bold' : ''}><i className="bi bi-clock me-1" />{fmtElapsed(start, now)}</span>
                      </div>
                      <div className="ticket-foot">
                        <span>Total</span>
                        <span>{formatPrice(o.total)}</span>
                      </div>
                      <div className="ticket-actions">
                        {col.status === 'Queued' && (
                          <>
                            <select
                              className="form-select form-select-sm"
                              value={o.chefId || ''}
                              onChange={(e) => {
                                const chef = chefs.find((c) => c.id === e.target.value);
                                if (chef) act(() => reassignOrder(o.id, chef.id, chef.name), `Order reassigned to ${chef.name}.`);
                              }}
                            >
                              <option value="">Assign chef…</option>
                              {chefs.filter((c) => c.available !== false).map((c) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.station})</option>
                              ))}
                            </select>
                            <button type="button" className="ticket-btn blue" onClick={() => act(() => updateOrderStatus(o.id, 'InPreparation'), 'Order accepted — in preparation.')}>
                              Accept
                            </button>
                            <button type="button" className="ticket-btn red" onClick={() => act(() => updateOrderStatus(o.id, 'Cancelled'), 'Order cancelled.')}>
                              Cancel
                            </button>
                          </>
                        )}
                        {col.status === 'InPreparation' && (
                          <button type="button" className="ticket-btn green" onClick={() => act(() => updateOrderStatus(o.id, 'ReadyForCollection'), 'Marked ready for collection.')}>
                            <i className="bi bi-bell me-1" />Mark ready
                          </button>
                        )}
                        {col.status === 'ReadyForCollection' && (
                          <button type="button" className="ticket-btn dark" onClick={() => act(() => updateOrderStatus(o.id, 'Served'), 'Order served to table.')}>
                            <i className="bi bi-check2 me-1" />Confirm served
                          </button>
                        )}
                        {col.status === 'Served' && !o.payment && (
                          <>
                            <button type="button" className="ticket-btn amber" onClick={() => settle(o.id, 'RoomCharge')}>
                              <i className="bi bi-house me-1" />Room charge
                            </button>
                            <button type="button" className="ticket-btn green" onClick={() => settle(o.id, 'Card')}>
                              <i className="bi bi-credit-card me-1" />Card
                            </button>
                            <button type="button" className="ticket-btn dark" onClick={() => settle(o.id, 'Cash')}>
                              <i className="bi bi-cash me-1" />Cash
                            </button>
                          </>
                        )}
                        {col.status === 'Served' && o.payment && (
                          <span className="badge bg-success"><i className="bi bi-check2 me-1" />Settled · {o.payment.method} · {formatPrice(o.payment.amount)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
