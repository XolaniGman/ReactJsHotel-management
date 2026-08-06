import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getInspection } from '../services/inspectionService';
import { formatDateTime } from '../lib/utils';
import './maintenance.css';

const CONDITION_CLASS = {
  Good: 'condition-good',
  NeedsCleaning: 'condition-cleaning',
  Damaged: 'condition-damaged',
  Missing: 'condition-missing',
  NeedsMaintenance: 'condition-maintenance',
};

export default function InspectionDetails() {
  const { id } = useParams();
  const [inspection, setInspection] = useState(null);

  useEffect(() => {
    getInspection(id).then(setInspection);
  }, [id]);

  if (!inspection) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <div className="empty-request-state"><i className="bi bi-hourglass-split" /><p>Loading inspection…</p></div>
      </div></div>
    );
  }

  const issues = (inspection.checklist || []).filter((c) => c.condition !== 'Good');

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Quality Control</div>
            <h1 className="maint-title">Room {inspection.roomNumber} Inspection</h1>
          </div>
          <Link to="/Admin/RoomInspections" className="btn-log"><i className="bi bi-arrow-left me-2" />Back</Link>
        </div>

        <div className="inspection-summary">
          <div className="summary-grid">
            <div className="summary-box">
              <div className="summary-label">Type</div>
              <div className="summary-value">{inspection.type}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Inspector</div>
              <div className="summary-value">{inspection.inspector}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Date</div>
              <div className="summary-value">{formatDateTime(inspection.date)}</div>
            </div>
            <div className="summary-box">
              <div className="summary-label">Result</div>
              <div className="summary-value" style={{ color: issues.length ? '#a33a2d' : '#2f7d4f' }}>
                {issues.length ? `${issues.length} issue(s)` : 'Passed'}
              </div>
            </div>
          </div>
          {inspection.notes && <p className="mt-3 mb-0"><strong>Notes:</strong> {inspection.notes}</p>}
        </div>

        <h2 className="h4 mb-3" style={{ fontFamily: "'Noto Serif', serif", color: '#172033' }}>Checklist results</h2>
        <div className="inspection-grid">
          {(inspection.checklist || []).map((c) => (
            <div className="inspection-card" key={c.item}>
              <div className="inspection-body">
                <div className="inspection-title">{c.item}</div>
                <span className={`inspection-condition ${CONDITION_CLASS[c.condition] || 'condition-good'}`}>
                  <i className={`bi ${c.condition === 'Good' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-1`} />
                  {c.condition}
                </span>
                <div className="inspection-meta">Inspected by <strong>{inspection.inspector}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
