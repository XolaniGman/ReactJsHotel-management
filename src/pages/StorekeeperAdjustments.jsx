import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts, listTransactions, adjustStock } from '../services/productService';
import './storekeeper.css';

export default function StorekeeperAdjustments() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [notice, setNotice] = useState('');
  const [productId, setProductId] = useState('');
  const [adjustType, setAdjustType] = useState('Damaged');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const load = async () => {
    const [p, m] = await Promise.all([listProducts(), listTransactions()]);
    setProducts(p);
    setMovements(m);
  };

  useEffect(() => { load(); }, []);

  const byName = user?.name || user?.email || 'Staff';

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || !qty) return;
    const p = products.find((x) => x.id === productId);
    const sign = adjustType === 'Damaged' || adjustType === 'Lost' || adjustType === 'Expired' ? -1 : 1;
    await adjustStock({ productId: p.id, productName: p.name, qty: sign * Number(qty), reason: note || adjustType, byName });
    setNotice(`Adjustment recorded for ${p.name}.`);
    setProductId(''); setQty(1); setNote('');
    load();
  };

  const recent = movements.filter((m) => m.type === 'Adjustment').slice(0, 8);

  return (
    <div className="container py-5 storekeeper-page">
      <div className="store-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <nav aria-label="breadcrumb" className="store-breadcrumb mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
              <li className="breadcrumb-item"><Link to="/Storekeeper/Dashboard">Storekeeper</Link></li>
              <li className="breadcrumb-item active" aria-current="page">Stock Adjustments</li>
            </ol>
          </nav>
          <h1 className="store-title h2 mb-1">Stock Adjustments</h1>
          <p className="store-subtitle mb-0">Record damaged, lost, expired or returned stock.</p>
        </div>
        <Link to="/Storekeeper/Dashboard" className="btn btn-store-dark"><i className="bi bi-arrow-left me-2" />Storekeeper Dashboard</Link>
      </div>

      {notice && <div className="lux-alert lux-alert-success mb-4">{notice}</div>}

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon red">!</span>Record Adjustment</div>
            <div className="card-body">
              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select className="form-select" required value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">Select product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} (in stock: {p.storageQty})</option>)}
                  </select>
                </div>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                      <option>Damaged</option><option>Lost</option><option>Expired</option><option>Found</option><option>Returned</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" min="1" value={qty} required onChange={(e) => setQty(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Note</label>
                  <textarea className="form-control" rows="2" placeholder="Reason or approval note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-store-dark w-100 mt-3">Record Adjustment →</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon red">!</span>Recent Adjustments</div>
            <div className="card-body p-0">
              <div className="store-table-card" style={{ boxShadow: 'none', border: 0 }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr><th>Product</th><th>Reason</th><th>Qty</th><th>Date</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-4 text-muted">No adjustments recorded yet.</td></tr>
                    ) : (
                      recent.map((m) => (
                        <tr key={m.id}>
                          <td className="fw-bold">{m.productName}</td>
                          <td>{m.note}</td>
                          <td>{m.qty}</td>
                          <td>{new Date(m.date || 0).toLocaleDateString('en-ZA')}</td>
                          <td>{m.byName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
