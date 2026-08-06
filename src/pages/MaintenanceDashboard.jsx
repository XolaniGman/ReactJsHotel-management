import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listMaintenanceRequests,
  assignMaintenanceTask,
  updateMaintenanceStatus,
} from '../services/maintenanceService';
import { listProducts } from '../services/productService';
import './maintenance.css';

const PRIORITY_CLASS = { Urgent: 'priority-urgent', High: 'priority-high', Medium: 'priority-medium', Low: 'priority-low' };
const STATUS_CLASS = { Open: 'status-open', InProgress: 'status-progress', Hold: 'status-hold', Completed: 'status-complete' };

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [r, p] = await Promise.all([listMaintenanceRequests(), listProducts()]);
    setRequests(r);
    setProducts(p);
  };

  useEffect(() => { load(); }, []);

  const assign = async (id) => {
    await assignMaintenanceTask(id, user?.name || user?.email);
    setNotice('Task assigned to you and moved to In Progress.');
    load();
  };

  const setStatus = async (id, status) => {
    await updateMaintenanceStatus(id, status);
    setNotice(`Task marked as ${status}.`);
    load();
  };

  const open = requests.filter((r) => r.status === 'Open').length;
  const inProgress = requests.filter((r) => r.status === 'InProgress').length;
  const hold = requests.filter((r) => r.status === 'Hold').length;
  const completed = requests.filter((r) => r.status === 'Completed').length;

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Maintenance Team</div>
            <h1 className="maint-title">Maintenance Dashboard</h1>
          </div>
          <Link to="/Maintenance/Request" className="btn-log"><i className="bi bi-plus-lg me-2" />New request</Link>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="metric-grid">
          {[
            { n: open, label: 'Open', icon: 'bi-inbox', bg: 'linear-gradient(135deg,#6d7483,#454a57)' },
            { n: inProgress, label: 'In Progress', icon: 'bi-tools', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
            { n: hold, label: 'On Hold', icon: 'bi-pause-circle', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
            { n: completed, label: 'Completed', icon: 'bi-check-circle', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
          ].map((m) => (
            <div className="metric-card" key={m.label} style={{ background: m.bg }}>
              <div className="metric-content">
                <i className={`bi ${m.icon} metric-icon`} />
                <span className="metric-number">{m.n}</span>
                <span className="metric-label">{m.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="panel-card">
            <div className="panel-header">
              <h2>Maintenance Tasks</h2>
              <span className="panel-actions">{requests.length} total</span>
            </div>
            <div className="table-responsive">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Task</th><th>Room</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-5 text-muted">No maintenance requests yet.</td></tr>
                  ) : (
                    requests.slice(0, 12).map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="task-name">{r.category}</div>
                          <div className="task-sub">{r.description}</div>
                        </td>
                        <td>{r.roomNumber ? `Room ${r.roomNumber}` : '—'}</td>
                        <td><span className={`priority-pill ${PRIORITY_CLASS[r.priority] || 'priority-medium'}`}>{r.priority}</span></td>
                        <td><span className={`status-pill ${STATUS_CLASS[r.status] || 'status-open'}`}>{r.status === 'InProgress' ? 'In Progress' : r.status}</span></td>
                        <td>
                          <span className="assignee">
                            <span className="avatar">{(r.assignee || '?')[0]?.toUpperCase()}</span>
                            {r.assignee || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          {r.status === 'Open' && (
                            <button type="button" className="btn-request-start btn-request-done" onClick={() => assign(r.id)}>Assign</button>
                          )}
                          {r.status === 'InProgress' && (
                            <div className="d-flex gap-1">
                              <button type="button" className="btn btn-warning btn-sm" onClick={() => setStatus(r.id, 'Hold')}>Hold</button>
                              <button type="button" className="btn-request-complete btn-request-done" onClick={() => setStatus(r.id, 'Completed')}>Done</button>
                            </div>
                          )}
                          {r.status === 'Hold' && (
                            <button type="button" className="btn-request-start btn-request-done" onClick={() => setStatus(r.id, 'InProgress')}>Resume</button>
                          )}
                          {r.status === 'Completed' && <span className="text-success small"><i className="bi bi-check-lg me-1" />Done</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h2>Inventory Alerts</h2>
              <span className="panel-actions"><i className="bi bi-bell" /></span>
            </div>
            <div>
              {products.filter((p) => p.storageQty <= p.lowStockThreshold).slice(0, 6).map((p) => (
                <div className="inventory-row" key={p.id}>
                  <div>
                    <div className="inventory-name">{p.name}</div>
                    <div className="inventory-sub">In storage: {p.storageQty} · Threshold: {p.lowStockThreshold}</div>
                  </div>
                  <span className={p.storageQty <= 0 ? 'stock-warning' : 'stock-ok'}>
                    {p.storageQty <= 0 ? 'Out of stock' : 'Low'}
                  </span>
                </div>
              ))}
              {products.filter((p) => p.storageQty <= p.lowStockThreshold).length === 0 && (
                <div className="inventory-row"><span className="stock-ok"><i className="bi bi-check-circle me-1" />All stocked</span></div>
              )}
            </div>
            <Link to="/Admin/InventoryStaff" className="view-all">Manage inventory →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
