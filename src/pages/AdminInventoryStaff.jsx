import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTransactions, listProducts } from '../services/productService';
import { formatDateTime, formatPrice } from '../lib/utils';
import './admin.css';

export default function AdminInventoryStaff() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      const [t, p] = await Promise.all([listTransactions(), listProducts()]);
      setTransactions(t);
      setProducts(p);
    })();
  }, []);

  const low = products.filter((p) => p.storageQty > 0 && p.storageQty <= p.lowStockThreshold);
  const out = products.filter((p) => p.storageQty <= 0);

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Operations</div>
            <h1 className="admin-title"><i className="bi bi-person-gear me-2" />Inventory Staff</h1>
            <p className="meta-text mb-0">Stock movements and supply alerts across departments.</p>
          </div>
          <div className="d-flex gap-2">
            <Link className="admin-btn" to="/Storekeeper/Dashboard"><i className="bi bi-box-seam me-2" />Storekeeper</Link>
            <Link className="admin-btn" to="/Laundry/Dashboard"><i className="bi bi-washing-machine me-2" />Laundry</Link>
          </div>
        </div>

        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="kpi-card"><span className="kpi-icon"><i className="bi bi-box-seam" /></span><div className="kpi-value">{products.length}</div><div className="kpi-label">Products tracked</div></div>
          <div className="kpi-card"><span className="kpi-icon"><i className="bi bi-exclamation-triangle" /></span><div className="kpi-value" style={{ color: '#8a640e' }}>{low.length}</div><div className="kpi-label">Low stock</div></div>
          <div className="kpi-card"><span className="kpi-icon"><i className="bi bi-x-octagon" /></span><div className="kpi-value" style={{ color: '#a33a2d' }}>{out.length}</div><div className="kpi-label">Out of stock</div></div>
        </div>

        <div className="admin-card mt-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-arrow-left-right me-2" />Recent movements</h2>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th><th>Action</th><th>From</th><th>To</th><th>Qty</th><th>Value</th><th>By</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-5">No movements recorded yet.</td></tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="fw-bold">{t.productName}</td>
                      <td><span className={`status-pill ${t.type === 'StockIn' ? 'status-approved' : t.type === 'IssuedToRoom' ? 'status-checkedin' : t.type === 'ReturnedToStorage' ? 'status-approved' : 'status-default'}`}>{t.type}</span></td>
                      <td>{t.from}</td>
                      <td>{t.to}</td>
                      <td>{t.qty}</td>
                      <td>{formatPrice((t.qty || 0) * (products.find((p) => p.id === t.productId)?.unitPrice || 0))}</td>
                      <td>{t.byName}</td>
                      <td className="meta-text">{formatDateTime(t.date)}</td>
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
