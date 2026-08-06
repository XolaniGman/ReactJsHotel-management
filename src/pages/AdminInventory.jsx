import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  recordLostItem,
} from '../services/productService';
import { PRODUCT_CATEGORIES } from '../lib/constants';
import { formatPrice } from '../lib/utils';
import './admin.css';

export default function AdminInventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Consumable');
  const [unitPrice, setUnitPrice] = useState(0);
  const [storageQty, setStorageQty] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const load = async () => setProducts(await listProducts());
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setName(''); setCode(''); setCategory('Consumable');
    setUnitPrice(0); setStorageQty(0); setLowStockThreshold(10);
  };

  const startEdit = (p) => {
    setEditing(p.id); setName(p.name); setCode(p.code || ''); setCategory(p.category || 'Consumable');
    setUnitPrice(p.unitPrice || 0); setStorageQty(p.storageQty || 0); setLowStockThreshold(p.lowStockThreshold || 10);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      await updateProduct(editing, { name, code, category, unitPrice, lowStockThreshold });
      setNotice('Product updated.');
    } else {
      await createProduct({ name, code, category, unitPrice, storageQty, lowStockThreshold });
      setNotice('Product added.');
    }
    reset();
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await deleteProduct(id);
    load();
  };

  const markLost = async (p) => {
    if (!window.confirm(`Record ${p.name} as lost/disposed (-1)?`)) return;
    await recordLostItem({ productId: p.id, productName: p.name, qty: 1, byName: user?.name || user?.email });
    setNotice(`${p.name} recorded as lost.`);
    load();
  };

  const low = products.filter((p) => p.storageQty <= p.lowStockThreshold);
  const out = products.filter((p) => p.storageQty <= 0);

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Stock</div>
            <h1 className="admin-title"><i className="bi bi-box-seam me-2" />Inventory</h1>
            <p className="meta-text mb-0">Central product catalogue and stock levels.</p>
          </div>
          <div className="d-flex gap-2">
            <span className="admin-date" style={{ color: '#8a640e' }}>Low: {low.length}</span>
            <span className="admin-date" style={{ color: '#a33a2d' }}>Out: {out.length}</span>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-plus-circle me-2" />{editing ? 'Edit product' : 'Add product'}</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <form onSubmit={submit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Name</label>
                    <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-uppercase">Code</label>
                    <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-uppercase">Category</label>
                    <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-uppercase">Unit price (R)</label>
                    <input type="number" className="form-control" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-uppercase">Low stock threshold</label>
                    <input type="number" className="form-control" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                  </div>
                  {!editing && (
                    <div className="col-md-4">
                      <label className="form-label fw-bold small text-uppercase">Opening stock</label>
                      <input type="number" className="form-control" min="0" value={storageQty} onChange={(e) => setStorageQty(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button type="submit" className="admin-btn" style={{ background: '#775a19', color: '#fff', borderColor: '#775a19' }}>{editing ? 'Save changes' : 'Add product'}</button>
                  {editing && <button type="button" className="admin-btn" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-graph-up me-2" />Stock health</h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                <div>
                  <div className="guest-name">{products.length}</div>
                  <div className="meta-text">Total products</div>
                </div>
                <div>
                  <div className="guest-name" style={{ color: '#8a640e' }}>{low.length}</div>
                  <div className="meta-text">Low stock</div>
                </div>
                <div>
                  <div className="guest-name" style={{ color: '#a33a2d' }}>{out.length}</div>
                  <div className="meta-text">Out of stock</div>
                </div>
              </div>
              {low.slice(0, 5).map((p) => (
                <div className="d-flex justify-content-between align-items-center py-2 border-bottom" key={p.id}>
                  <span className="fw-bold">{p.name}</span>
                  <span className={p.storageQty <= 0 ? 'text-danger fw-bold' : 'text-warning fw-bold'}>{p.storageQty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-card mt-4">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-list me-2" />Product catalogue</h2>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Code</th><th>Category</th><th>Price</th><th>In storage</th><th>Threshold</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted py-5">No products yet.</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-bold">{p.name}</td>
                      <td>{p.code || '—'}</td>
                      <td>{p.category}</td>
                      <td>{formatPrice(p.unitPrice)}</td>
                      <td>
                        <span className={`fw-bold ${p.storageQty <= 0 ? 'text-danger' : p.storageQty <= p.lowStockThreshold ? 'text-warning' : 'text-success'}`}>{p.storageQty}</span>
                      </td>
                      <td>{p.lowStockThreshold}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => startEdit(p)}><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-sm btn-outline-warning me-1" title="Record 1 lost" onClick={() => markLost(p)}><i className="bi bi-x-circle" /></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(p.id)}><i className="bi bi-trash" /></button>
                      </td>
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
