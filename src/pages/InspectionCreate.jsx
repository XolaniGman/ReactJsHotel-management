import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createInspection } from '../services/inspectionService';
import { listRooms } from '../services/roomService';
import { INSPECTION_TYPES, INSPECTION_CHECKLIST, INSPECTION_CONDITIONS } from '../lib/constants';
import './maintenance.css';

export default function InspectionCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [type, setType] = useState(INSPECTION_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState(INSPECTION_CHECKLIST.map((c) => ({ item: c, condition: 'Good' })));

  useEffect(() => {
    listRooms().then(setRooms);
  }, []);

  const setCondition = (item, condition) => {
    setChecklist((prev) => prev.map((c) => (c.item === item ? { ...c, condition } : c)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return setError('Please select a room.');
    await createInspection({
      roomId,
      roomNumber: room.number,
      type,
      inspector: user?.name || user?.email || 'Hotel Staff',
      checklist,
      notes,
    });
    navigate('/Admin/RoomInspections');
  };

  const issueCount = checklist.filter((c) => c.condition !== 'Good').length;
  const doneCount = checklist.length;

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Quality Control</div>
            <h1 className="maint-title">Create Inspection</h1>
          </div>
          <Link to="/Admin/RoomInspections" className="btn-log"><i className="bi bi-arrow-left me-2" />Back</Link>
        </div>

        {error && <div className="lost-alert lost-alert-danger mb-3">{error}</div>}

        <form onSubmit={submit}>
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="inspection-form-card">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="inspection-label">Room</label>
                    <select className="form-select inspection-input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                      <option value="">Select room…</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} — {r.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="inspection-label">Inspection type</label>
                    <select className="form-select inspection-input" value={type} onChange={(e) => setType(e.target.value)}>
                      {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="inspection-progress mt-4">
                  <div className="d-flex justify-content-between mb-2">
                    <strong>Checklist progress</strong>
                    <span>{doneCount}/{checklist.length} · {issueCount} issue(s)</span>
                  </div>
                  <div className="progress"><div className="progress-bar" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>
                </div>

                <div className="inspection-checklist-grid">
                  {checklist.map((c, i) => (
                    <div className="inspection-check-card" key={c.item}>
                      <div className="inspection-check-header">
                        <span className="inspection-check-number">{i + 1}</span>
                        <strong>{c.item}</strong>
                      </div>
                      <div className="inspection-check-body">
                        <select className="form-select inspection-input" value={c.condition} onChange={(e) => setCondition(c.item, e.target.value)}>
                          {INSPECTION_CONDITIONS.map((cond) => <option key={cond} value={cond}>{cond}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="inspection-label">Notes</label>
                  <textarea className="form-control inspection-input" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations…" />
                </div>

                <button type="submit" className="btn-log mt-4"><i className="bi bi-check-lg me-2" />Save inspection</button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="inspection-side-card">
                <div className="inspection-side-img" />
                <div className="inspection-side-body">
                  <h2 className="inspection-card-title">Good to know</h2>
                  <div className="info-row"><i className="bi bi-clipboard-check" /><span>Every checklist item must be rated for a full inspection.</span></div>
                  <div className="info-row"><i className="bi bi-exclamation-triangle" /><span>Any item not marked Good flags the room for follow-up.</span></div>
                  <div className="info-row"><i className="bi bi-lightbulb" /><span>Use MaintenanceFollowUp after repairs are completed.</span></div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
