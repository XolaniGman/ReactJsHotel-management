import { useEffect, useMemo, useState } from 'react';
import { listOrders } from '../services/restaurantService';
import { formatPrice } from '../lib/utils';
import './admin.css';
import './restaurant.css';

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return toISO(d);
};

export default function AdminRestaurantReports() {
  const [orders, setOrders] = useState([]);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(toISO(new Date()));

  useEffect(() => {
    (async () => setOrders(await listOrders()))();
  }, []);

  const settled = useMemo(
    () => orders.filter((o) => o.status === 'Served' && o.payment),
    [orders],
  );

  const inRange = useMemo(() => {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59`).getTime();
    return settled.filter((o) => {
      const t = o.createdAt || 0;
      return t >= start && t <= end;
    });
  }, [settled, from, to]);

  const revenue = inRange.reduce((s, o) => s + (o.payment?.amount || 0), 0);
  const avgOrder = inRange.length ? revenue / inRange.length : 0;
  const avgPerTable = inRange.length
    ? revenue / new Set(inRange.map((o) => o.tableNumber)).size
    : 0;

  const bestSellers = useMemo(() => {
    const map = {};
    inRange.forEach((o) =>
      (o.items || []).forEach((it) => {
        map[it.name] = map[it.name] || { qty: 0, revenue: 0 };
        map[it.name].qty += it.qty;
        map[it.name].revenue += (it.unitPrice || 0) * it.qty;
      }),
    );
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [inRange]);
  const maxQty = bestSellers.length ? bestSellers[0].qty : 0;

  const byMethod = useMemo(() => {
    const map = {};
    inRange.forEach((o) => {
      const m = o.payment?.method || 'Unknown';
      map[m] = (map[m] || 0) + (o.payment?.amount || 0);
    });
    return Object.entries(map)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [inRange]);
  const maxMethod = byMethod.length ? byMethod[0].amount : 0;

  const peakHours = useMemo(() => {
    const map = {};
    inRange.forEach((o) => {
      const hour = new Date(o.createdAt || Date.now()).getHours();
      map[hour] = (map[hour] || 0) + 1;
    });
    return Object.entries(map)
      .map(([hour, count]) => ({ hour: Number(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  }, [inRange]);
  const maxHour = peakHours.length ? Math.max(...peakHours.map((p) => p.count)) : 0;

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Restaurant</div>
            <h1 className="admin-title"><i className="bi bi-graph-up-arrow me-2" />Kitchen Report</h1>
            <p className="meta-text mb-0">Revenue, best-selling meals and peak service hours for settled orders.</p>
          </div>
        </div>

        <div className="admin-card mb-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-calendar-range me-2" />Reporting period</h2>
          </div>
          <div className="d-flex flex-wrap gap-3 align-items-end" style={{ padding: '1.25rem' }}>
            <div>
              <label className="form-label fw-bold small text-uppercase">From</label>
              <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label fw-bold small text-uppercase">To</label>
              <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="text-muted small pb-2">{inRange.length} settled order(s) in period</div>
          </div>
        </div>

        {inRange.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-info-circle me-2" />No settled order data for the selected period. Widen the date range.
          </div>
        ) : (
          <>
            <div className="rest-kpi-grid">
              <div className="rest-kpi-card">
                <span className="rest-kpi-icon green"><i className="bi bi-currency-rand" /></span>
                <div><strong>{formatPrice(revenue)}</strong><span>Total revenue</span></div>
              </div>
              <div className="rest-kpi-card">
                <span className="rest-kpi-icon blue"><i className="bi bi-receipt" /></span>
                <div><strong>{inRange.length}</strong><span>Orders settled</span></div>
              </div>
              <div className="rest-kpi-card">
                <span className="rest-kpi-icon amber"><i className="bi bi-basket" /></span>
                <div><strong>{formatPrice(avgOrder)}</strong><span>Avg order value</span></div>
              </div>
              <div className="rest-kpi-card">
                <span className="rest-kpi-icon red"><i className="bi bi-people" /></span>
                <div><strong>{formatPrice(avgPerTable)}</strong><span>Avg spend per table</span></div>
              </div>
            </div>

            <div className="admin-main-grid">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title"><i className="bi bi-trophy me-2" />Best-selling meals</h2>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  {bestSellers.map((b) => (
                    <div className="report-bar" key={b.name}>
                      <div className="report-label">
                        <span><strong>{b.name}</strong> · {b.qty} sold</span>
                        <span>{formatPrice(b.revenue)}</span>
                      </div>
                      <div className="report-track">
                        <div className="report-fill" style={{ width: `${(b.qty / maxQty) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title"><i className="bi bi-credit-card me-2" />Revenue by payment method</h2>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  {byMethod.map((m) => (
                    <div className="report-bar" key={m.method}>
                      <div className="report-label">
                        <span><strong>{m.method}</strong></span>
                        <span>{formatPrice(m.amount)}</span>
                      </div>
                      <div className="report-track">
                        <div className="report-fill" style={{ width: `${(m.amount / maxMethod) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-card mt-4">
              <div className="admin-card-header">
                <h2 className="admin-card-title"><i className="bi bi-clock-history me-2" />Peak service hours</h2>
              </div>
              <div style={{ padding: '1.25rem' }}>
                {peakHours.map((p) => (
                  <div className="report-bar" key={p.hour}>
                    <div className="report-label">
                      <span>{String(p.hour).padStart(2, '0')}:00 – {String(p.hour).padStart(2, '0')}:59</span>
                      <span>{p.count} order(s)</span>
                    </div>
                    <div className="report-track">
                      <div className="report-fill" style={{ width: `${(p.count / maxHour) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
