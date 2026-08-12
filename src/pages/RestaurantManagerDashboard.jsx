import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listOrders,
  listMenuItems,
  listTables,
  listTableReservations,
  listChefs,
} from '../services/restaurantService';
import { formatPrice } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import './admin.css';
import './restaurant.css';

const ACTIVE = ['Queued', 'InPreparation', 'ReadyForCollection'];

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const fmtElapsed = (from, now) => {
  if (!from) return '—';
  const mins = Math.floor((now - from) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const QUICK_LINKS = [
  { to: '/Admin/Restaurant', icon: 'bi-egg-fried', tone: 'amber', label: 'Kitchen Queue', sub: 'Accept, prepare, serve & settle orders' },
  { to: '/Admin/Restaurant/Tables', icon: 'bi-grid', tone: 'blue', label: 'Tables & Reservations', sub: 'Floor plan, add tables, manage bookings' },
  { to: '/Admin/Restaurant/Menu', icon: 'bi-book', tone: 'green', label: 'Menu Catalogue', sub: 'Add, edit & price menu items' },
  { to: '/Admin/Restaurant/Reports', icon: 'bi-graph-up', tone: 'red', label: 'Kitchen Report', sub: 'Revenue, best sellers & peak hours' },
];

export default function RestaurantManagerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const [o, m, t, r, c] = await Promise.all([
      listOrders(),
      listMenuItems(),
      listTables(),
      listTableReservations(),
      listChefs(),
    ]);
    setOrders(o);
    setMenuItems(m);
    setTables(t);
    setReservations(r);
    setChefs(c);
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => ACTIVE.includes(o.status)).length;
    const freeTables = tables.filter((t) => t.status === 'Available').length;
    const today = toISO(new Date());
    const todayReservations = reservations.filter(
      (r) => r.date === today && !['Completed', 'Cancelled', 'NoShow'].includes(r.status),
    ).length;
    const dayStart = startOfToday();
    const todayRevenue = orders
      .filter(
        (o) =>
          o.status === 'Served' &&
          o.payment &&
          (o.payment.paidAt || o.createdAt) >= dayStart,
      )
      .reduce((s, o) => s + (o.payment?.amount || 0), 0);
    return {
      activeOrders,
      freeTables,
      todayReservations,
      todayRevenue,
      menuCount: menuItems.length,
      availableItems: menuItems.filter((m) => m.available !== false).length,
      chefsOnDuty: chefs.filter((c) => c.available !== false).length,
      chefsTotal: chefs.length,
    };
  }, [orders, tables, reservations, menuItems, chefs]);

  const kitchen = useMemo(
    () =>
      orders
        .filter((o) => ACTIVE.includes(o.status))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [orders],
  );

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Restaurant Manager</div>
            <h1 className="admin-title">
              <i className="bi bi-egg-fried me-2" />Manager Overview
            </h1>
            <p className="meta-text mb-0">
              Welcome back{user?.name ? `, ${user.name}` : ''}. Full control of the dining
              operation, just like an admin.
            </p>
          </div>
          <Link to="/Admin/Restaurant" className="lux-btn-gold">
            <i className="bi bi-hourglass-split me-2" /> Open Kitchen Queue
          </Link>
        </div>

        <div className="rest-kpi-grid">
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon amber"><i className="bi bi-hourglass-split" /></span>
            <div><strong>{stats.activeOrders}</strong><span>Active orders</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon green"><i className="bi bi-currency-rand" /></span>
            <div><strong>{formatPrice(stats.todayRevenue)}</strong><span>Revenue today</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon blue"><i className="bi bi-calendar-check" /></span>
            <div><strong>{stats.todayReservations}</strong><span>Bookings today</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon green"><i className="bi bi-grid" /></span>
            <div><strong>{stats.freeTables}</strong><span>Tables available</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon red"><i className="bi bi-book" /></span>
            <div><strong>{stats.availableItems}/{stats.menuCount}</strong><span>Menu items on sale</span></div>
          </div>
          <div className="rest-kpi-card">
            <span className="rest-kpi-icon blue"><i className="bi bi-person-badge" /></span>
            <div><strong>{stats.chefsOnDuty}/{stats.chefsTotal}</strong><span>Chefs on duty</span></div>
          </div>
        </div>

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-grid me-2" />Quick actions</h2>
            </div>
            <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
              {QUICK_LINKS.map((q) => (
                <Link key={q.to} to={q.to} className="admin-link-row">
                  <span className={`rest-kpi-icon ${q.tone}`}><i className={`bi ${q.icon}`} /></span>
                  <span className="flex-grow-1">
                    <strong className="d-block">{q.label}</strong>
                    <span className="text-muted small">{q.sub}</span>
                  </span>
                  <i className="bi bi-chevron-right text-muted" />
                </Link>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-fire me-2" />Currently in the kitchen</h2>
              <Link to="/Admin/Restaurant" className="small fw-bold text-decoration-none">View queue</Link>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {kitchen.length === 0 ? (
                <div className="empty-state mb-0">
                  <i className="bi bi-check2-circle me-2" />No active orders right now.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {kitchen.map((o) => (
                    <div className="order-ticket" key={o.id}>
                      <div className="order-ticket-head">
                        <strong>{o.orderNo}</strong>
                        <span className="order-ticket-table">Table {o.tableNumber}</span>
                      </div>
                      <div className="ticket-meta">
                        {o.items.reduce((s, i) => s + (i.qty || 0), 0)} item(s) ·{' '}
                        {formatPrice(o.total)} · {fmtElapsed(o.createdAt, now)}
                      </div>
                      <div className="ticket-status">
                        {o.status.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
