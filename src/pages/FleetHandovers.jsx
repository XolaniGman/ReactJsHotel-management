import { Link } from 'react-router-dom';
import { useFleetLive } from '../hooks/useFleetLive';
import HandoverRegister from '../components/HandoverRegister';
import './guest.css';
import './fleet.css';

export default function FleetHandovers() {
  const { handovers } = useFleetLive();
  const damaged = (handovers || []).filter((h) => (h.variance?.damages?.length || 0) > 0 || h.damageCheck?.flagged);

  const checkedOut = (handovers || []).filter((h) => h.handoverType === 'CheckOut').length;
  const checkedIn = (handovers || []).filter((h) => h.handoverType === 'CheckIn').length;

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet · Handover Register</div>
            <h1 className="maint-title">Checked-in &amp; checked-out vehicle records</h1>
          </div>
          <div className="d-flex gap-2">
            <Link to="/Fleet/Dashboard" className="btn-log" style={{ background: '#355f8c' }}><i className="bi bi-kanban me-2" />Fleet Ops</Link>
            <Link to="/Fleet/Incidents" className="btn-log" style={{ background: '#7a251b' }}><i className="bi bi-bug me-2" />Incidents</Link>
            <Link to="/Fleet/Maintenance" className="btn-log" style={{ background: '#433c7d' }}><i className="bi bi-wrench-adjustable me-2" />Work Orders</Link>
          </div>
        </div>

        <div className="metric-grid mb-4">
          {[
            { n: checkedOut, label: 'Cars checked out', icon: 'bi-box-arrow-right', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
            { n: checkedIn, label: 'Cars checked in', icon: 'bi-box-arrow-in-down', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
            { n: damaged.length, label: 'Damage flagged', icon: 'bi-exclamation-triangle', bg: 'linear-gradient(135deg,#a33a2d,#7a251b)' },
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

        <div className="panel-card">
          <div className="panel-header">
            <h2><i className="bi bi-arrow-left-right me-2" />Handover records</h2>
            <span className="panel-actions">Every check-out and check-in is kept here for fleet staff, the fleet manager and admins.</span>
          </div>
          <div className="p-3">
            <HandoverRegister />
          </div>
        </div>
      </div>
    </div>
  );
}