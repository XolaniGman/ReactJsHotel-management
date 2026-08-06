import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, listTransactions } from '../services/productService';
import './storekeeper.css';

export default function StorekeeperDashboard() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);

  const load = async () => {
    const [p, m] = await Promise.all([listProducts(), listTransactions()]);
    setProducts(p);
    setMovements(m);
  };

  useEffect(() => { load(); }, []);

  const lowStock = products.filter((p) => p.storageQty > 0 && p.storageQty <= p.lowStockThreshold);
  const outOfStock = products.filter((p) => p.storageQty <= 0);

  return (
    <div className="container py-5 storekeeper-page">
      <div className="store-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <nav aria-label="breadcrumb" className="store-breadcrumb mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
              <li className="breadcrumb-item">Inventory Management</li>
              <li className="breadcrumb-item active" aria-current="page">Storekeeper</li>
            </ol>
          </nav>
          <h1 className="store-title h2 mb-1">Storekeeper Dashboard</h1>
          <p className="store-subtitle mb-0">Stock receiving, room issuing, and inventory adjustments.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <span className="store-pill warning">Low stock: {lowStock.length}</span>
          <span className="store-pill danger">Out of stock: {outOfStock.length}</span>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <Link to="/Storekeeper/StockIn" className="card store-card h-100 text-decoration-none" style={{ color: 'inherit' }}>
            <div className="card-header"><span className="store-icon">+</span>Stock In</div>
            <div className="card-body">
              <p className="store-subtitle">Receive new supplies from suppliers into central storage.</p>
              <span className="btn btn-store-green w-100">Open Stock In →</span>
            </div>
          </Link>
        </div>

        <div className="col-lg-4">
          <Link to="/Storekeeper/IssueToRoom" className="card store-card h-100 text-decoration-none" style={{ color: 'inherit' }}>
            <div className="card-header"><span className="store-icon blue">↗</span>Issue to Room</div>
            <div className="card-body">
              <p className="store-subtitle">Move stock from storage into a room&rsquo;s inventory.</p>
              <span className="btn btn-store-blue w-100">Open Issue to Room →</span>
            </div>
          </Link>
        </div>

        <div className="col-lg-4">
          <Link to="/Storekeeper/Adjustments" className="card store-card h-100 text-decoration-none" style={{ color: 'inherit' }}>
            <div className="card-header"><span className="store-icon red">!</span>Stock Adjustments</div>
            <div className="card-body">
              <p className="store-subtitle">Record damaged, lost, expired, found or returned stock.</p>
              <span className="btn btn-store-dark w-100">Open Stock Adjustments →</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-xl-8">
          <div className="row g-4 h-100">
            <div className="col-md-6">
              <div className="metric-card warning">
                <div className="small text-muted text-uppercase fw-bold mb-2">Low Stock Items</div>
                <div className="display-5 metric-number">{lowStock.length}</div>
                <p className="text-muted mb-0">Products below threshold and needing replenishment.</p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="metric-card danger">
                <div className="small text-muted text-uppercase fw-bold mb-2">Out of Stock</div>
                <div className="display-5 metric-number">{outOfStock.length}</div>
                <p className="text-muted mb-0">Products unavailable in storage.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card store-panel h-100">
            <div className="card-header">Central Inventory</div>
            <div className="card-body">
              <h2 className="h3 fw-bold mb-2">Stock Health</h2>
              <p className="text-white-75 mb-4">Total products tracked: {products.length}</p>
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-white-75">Stocked products</span>
                  <span className="badge bg-white text-dark">{products.length}</span>
                </div>
                <div className="progress rounded-pill" style={{ height: '10px' }}>
                  <div className="progress-bar bg-white" role="progressbar" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-white-75">Stock alerts</span>
                  <span className="badge bg-warning text-dark">{lowStock.length + outOfStock.length}</span>
                </div>
                <div className="progress rounded-pill" style={{ height: '10px' }}>
                  <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${Math.min(100, ((lowStock.length + outOfStock.length) / (products.length || 1)) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5">
        <h2 className="h5 mb-3 fw-bold">Recent Inventory Movements</h2>
        <div className="store-table-card table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Product</th><th>Action</th><th>From</th><th>To</th><th>Qty</th><th>Date</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-4 text-muted">No movements recorded yet.</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td className="fw-bold">{m.productName}</td>
                    <td>{m.type}</td>
                    <td>{m.from}</td>
                    <td>{m.to}</td>
                    <td>{m.qty}</td>
                    <td>{new Date(m.date || 0).toLocaleString('en-ZA')}</td>
                    <td>{m.byName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
