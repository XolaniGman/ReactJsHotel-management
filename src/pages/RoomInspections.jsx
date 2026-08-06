import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInspections } from '../services/inspectionService';
import { formatDateTime } from '../lib/utils';
import './maintenance.css';

export default function RoomInspections() {
  const [inspections, setInspections] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    listInspections().then(setInspections);
  }, []);

  const counts = {
    total: inspections.length,
    good: inspections.filter((i) => i.checklist?.every((c) => c.condition === 'Good')).length,
    issues: inspections.filter((i) => i.checklist?.some((c) => c.condition !== 'Good')).length,
  };

  const shown = filter === 'All' ? inspections : filter === 'Good' ? inspections.filter((i) => i.checklist?.every((c) => c.condition === 'Good')) : inspections.filter((i) => i.checklist?.some((c) => c.condition !== 'Good'));

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Quality Control</div>
            <h1 className="maint-title">Room Inspections</h1>
          </div>
          <Link to="/Admin/RoomInspections/Create" className="btn-log"><i className="bi bi-plus-lg me-2" />New inspection</Link>
        </div>

        <div className="inspection-stat-grid">
          <div className="inspection-stat-card">
            <span className="text-muted small">Total inspections</span>
            <strong>{counts.total}</strong>
          </div>
          <div className="inspection-stat-card">
            <span className="text-muted small">Passed (all Good)</span>
            <strong style={{ color: '#2f7d4f' }}>{counts.good}</strong>
          </div>
          <div className="inspection-stat-card">
            <span className="text-muted small">Issues found</span>
            <strong style={{ color: '#a33a2d' }}>{counts.issues}</strong>
          </div>
        </div>

        <div className="d-flex gap-2 mb-3">
          {['All', 'Good', 'Issues'].map((f) => (
            <button type="button" key={f} className="inspection-filter-btn" style={filter === f ? { background: '#775a19', color: '#fff' } : {}} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="empty-request-state"><i className="bi bi-clipboard-check" /><p>No inspections recorded yet.</p></div>
        ) : (
          shown.map((i) => {
            const hasIssue = i.checklist?.some((c) => c.condition !== 'Good');
            return (
              <Link to={`/Admin/RoomInspections/Details/${i.id}`} className="inspection-row-card" key={i.id} style={{ textDecoration: 'none' }}>
                <span className="inspection-icon"><i className="bi bi-search" /></span>
                <div>
                  <div className="inspection-room-title">Room {i.roomNumber}</div>
                  <p className="inspection-sub">{i.type} · {i.inspector} · {formatDateTime(i.date)}</p>
                </div>
                <div className="inspection-meta">
                  <span className="inspection-mini-label">Items</span>
                  <span className="inspection-mini-value">{i.checklist?.length || 0}</span>
                </div>
                <span className={`inspection-status ${hasIssue ? 'issuefound' : 'passed'}`}>
                  <i className={`bi ${hasIssue ? 'bi-exclamation-circle' : 'bi-check-circle'} me-1`} />
                  {hasIssue ? 'Issues' : 'Passed'}
                </span>
                <span><i className="bi bi-chevron-right" /></span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
