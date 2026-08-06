import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts, listTransactions, stockIn } from '../services/productService';
import './storekeeper.css';

export default function StorekeeperStockIn() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [notice, setNotice] = useState('');
  const [productId, setProductId] = useState('');
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
    await stockIn({
      productId: p.id,
      productName: p.name,
      qty: Number(qty),
      byName,
      from: note ? `Supplier: ${note}` : 'Supplier',
    });
    setNotice(`${p.name} × ${qty} added to storage.`);
    setProductId(''); setQty(1); setNote('');
    load();
  };

  const recent = movements.filter((m) => m.type === 'StockIn').slice(0, 8);

  return (
    <div className="container py-5 storekeeper-page">
      <div className="store-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <nav aria-label="breadcrumb" className="store-breadcrumb mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
              <li className="breadcrumb-item"><Link to="/Storekeeper/Dashboard">Storekeeper</Link></li>
              <li className="breadcrumb-item active" aria-current="page">Stock In</li>
            </ol>
          </nav>
          <h1 className="store-title h2 mb-1">Stock In</h1>
          <p className="store-subtitle mb-0">Receive new supplies into central storage.</p>
        </div>
        <Link to="/Storekeeper/Dashboard" className="btn btn-store-dark"><i className="bi bi-arrow-left me-2" />Storekeeper Dashboard</Link>
      </div>

      {notice && <div className="lux-alert lux-alert-success mb-4">{notice}</div>}

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon">+</span>Add Stock</div>
            <div className="card-body">
              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select className="form-select" required value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">Select product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} (in stock: {p.storageQty})</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Quantity</label>
                  <input type="number" className="form-control" min="1" value={qty} required onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Note</label>
                  <textarea className="form-control" rows="2" placeholder="Purchase or delivery note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-store-green w-100">Add Stock →</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon">+</span>Recent Stock In Movements</div>
            <div className="card-body p-0">
              <div className="store-table-card" style={{ boxShadow: 'none', border: 0 }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr><th>Product</th><th>From</th><th>Qty</th><th>Date</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-4 text-muted">No stock-ins recorded yet.</td></tr>
                    ) : (
                      recent.map((m) => (
                        <tr key={m.id}>
                          <td className="fw-bold">{m.productName}</td>
                          <td>{m.from}</td>
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
