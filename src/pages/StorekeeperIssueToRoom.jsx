import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listProducts, listTransactions, issueToRoom } from '../services/productService';
import { listRooms } from '../services/roomService';
import './storekeeper.css';

export default function StorekeeperIssueToRoom() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [movements, setMovements] = useState([]);
  const [notice, setNotice] = useState('');
  const [productId, setProductId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const load = async () => {
    const [p, r, m] = await Promise.all([listProducts(), listRooms(), listTransactions()]);
    setProducts(p);
    setRooms(r);
    setMovements(m);
  };

  useEffect(() => { load(); }, []);

  const byName = user?.name || user?.email || 'Staff';

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || !roomId || !qty) return;
    const p = products.find((x) => x.id === productId);
    const room = rooms.find((x) => x.id === roomId);
    await issueToRoom({ productId: p.id, productName: p.name, roomNumber: room?.number, qty: Number(qty), byName });
    setNotice(`${p.name} × ${qty} issued to Room ${room?.number}.`);
    setProductId(''); setRoomId(''); setQty(1); setNote('');
    load();
  };

  const recent = movements.filter((m) => m.type === 'IssuedToRoom').slice(0, 8);

  return (
    <div className="container py-5 storekeeper-page">
      <div className="store-hero d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <nav aria-label="breadcrumb" className="store-breadcrumb mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
              <li className="breadcrumb-item"><Link to="/Storekeeper/Dashboard">Storekeeper</Link></li>
              <li className="breadcrumb-item active" aria-current="page">Issue to Room</li>
            </ol>
          </nav>
          <h1 className="store-title h2 mb-1">Issue to Room</h1>
          <p className="store-subtitle mb-0">Move stock from central storage into a room.</p>
        </div>
        <Link to="/Storekeeper/Dashboard" className="btn btn-store-dark"><i className="bi bi-arrow-left me-2" />Storekeeper Dashboard</Link>
      </div>

      {notice && <div className="lux-alert lux-alert-success mb-4">{notice}</div>}

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon blue">↗</span>Issue Stock</div>
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
                    <label className="form-label">Room</label>
                    <select className="form-select" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                      <option value="">Select…</option>
                      {rooms.map((room) => <option key={room.id} value={room.id}>Room {room.number}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" min="1" value={qty} required onChange={(e) => setQty(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Note</label>
                  <textarea className="form-control" rows="2" placeholder="Optional details" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-store-blue w-100 mt-3">Issue to Room ↗</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card store-card h-100">
            <div className="card-header"><span className="store-icon blue">↗</span>Recent Room Issues</div>
            <div className="card-body p-0">
              <div className="store-table-card" style={{ boxShadow: 'none', border: 0 }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr><th>Product</th><th>To</th><th>Qty</th><th>Date</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-4 text-muted">No issues to rooms recorded yet.</td></tr>
                    ) : (
                      recent.map((m) => (
                        <tr key={m.id}>
                          <td className="fw-bold">{m.productName}</td>
                          <td>{m.to}</td>
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
