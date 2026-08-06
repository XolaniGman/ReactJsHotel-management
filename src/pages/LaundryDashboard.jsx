import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listLaundryRequests,
  updateLaundryRequestStatus,
} from '../services/amenityService';
import { listProducts } from '../services/productService';
import { listAmenities } from '../services/amenityService';
import './laundry.css';

export default function LaundryDashboard() {
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [r, p, a] = await Promise.all([listLaundryRequests(), listProducts(), listAmenities()]);
    setRequests(r);
    setProducts(p);
    setAmenities(a);
  };

  useEffect(() => {
    load();
  }, []);

  const advance = async (id, next) => {
    await updateLaundryRequestStatus(id, next);
    setNotice(`Request marked as ${next}.`);
    load();
  };

  const reusable = products.filter((p) => p.category === 'Reusable');
  const lowStock = products.filter((p) => p.storageQty <= p.lowStockThreshold);
  const outOfStock = products.filter((p) => p.storageQty <= 0);

  return (
    <div className="container py-5 laundry-page">
      <div className="laundry-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <nav aria-label="breadcrumb" className="laundry-breadcrumb mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
              <li className="breadcrumb-item active" aria-current="page">Laundry Services</li>
            </ol>
          </nav>
          <h1 className="laundry-title h2 mb-1">Laundry Dashboard</h1>
          <p className="laundry-subtitle mb-0">
            Process guest laundry requests from pick-up through delivery.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <span className="laundry-pill warning">Low stock: {lowStock.length}</span>
          <span className="laundry-pill danger">Out of stock: {outOfStock.length}</span>
        </div>
      </div>

      {notice && <div className="lux-alert lux-alert-success mb-4">{notice}</div>}

      <div className="row g-4 mb-4">
        {['Pending', 'InProgress', 'Completed'].map((s) => {
          const count = requests.filter((r) => r.status === s).length;
          return (
            <div className="col-md-4" key={s}>
              <div className={`card laundry-card h-100 ${s === 'InProgress' ? '' : ''}`}>
                <div className="card-header">
                  <span className={`laundry-icon ${s === 'Pending' ? '' : s === 'Completed' ? 'green' : ''}`}>
                    {s === 'Pending' ? <i className="bi bi-inbox" /> : s === 'InProgress' ? <i className="bi bi-arrow-repeat" /> : <i className="bi bi-check2-circle" />}
                  </span>
                  {s === 'InProgress' ? 'In Progress' : s}
                </div>
                <div className="card-body">
                  <div className="display-4 fw-bold mb-1" style={{ color: '#172033' }}>{count}</div>
                  <p className="text-muted mb-0">request{s === 1 ? '' : 's'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="laundry-table-card table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-4 text-muted">No laundry requests yet.</td></tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-bold">{r.guestName}</td>
                      <td>Room {r.roomNumber}</td>
                      <td>
                        <span className="badge bg-secondary">{r.items.length} item(s)</span>
                        <div className="text-muted small">{r.items.map((i) => i.name).join(', ')}</div>
                      </td>
                      <td><span className={`badge ${r.status === 'Pending' ? 'bg-warning text-dark' : r.status === 'InProgress' ? 'bg-info' : 'bg-success'}`}>{r.status}</span></td>
                      <td>
                        {r.status === 'Pending' && (
                          <button type="button" className="btn btn-laundry-blue btn-sm" onClick={() => advance(r.id, 'InProgress')}>Start</button>
                        )}
                        {r.status === 'InProgress' && (
                          <button type="button" className="btn btn-laundry-green btn-sm" onClick={() => advance(r.id, 'Completed')}>Complete</button>
                        )}
                        {r.status === 'Completed' && <span className="text-success small"><i className="bi bi-check-lg me-1" />Delivered</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card laundry-panel h-100">
            <div className="card-header">Linen Supply</div>
            <div className="card-body">
              <h2 className="h3 fw-bold mb-2">Reusable Linen</h2>
              <p className="text-white-75 mb-4">Current stock levels in central storage.</p>
              <div className="row g-3">
                {reusable.slice(0, 6).map((p) => (
                  <div className="col-6" key={p.id}>
                    <div className="laundry-metric-box text-center">
                      <div className="small text-white-75">{p.name}</div>
                      <div className="h4 mb-0 fw-bold">{p.storageQty}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-5">
        <h2 className="h5 mb-3 fw-bold">Amenities</h2>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
          {amenities.map((a) => (
            <div className="col" key={a.id}>
              <div className="card amenity-card h-100">
                <div className="card-body">
                  <i className={`bi ${a.icon || 'bi-star'} me-2 ${a.isFree ? 'text-success' : 'text-warning'}`} />
                  <h6 className="card-title d-inline fw-bold">{a.name}</h6>
                  <p className={a.isFree ? 'text-success mb-2' : 'text-muted mb-2'}>
                    <small>{a.isFree ? 'Free item' : `Charge: R${a.unitPrice}`}</small>
                  </p>
                  <span className={`badge ${a.isFree ? 'bg-success' : 'bg-warning text-dark'}`}>{a.isFree ? 'Complimentary' : 'Chargeable'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
