import { Link } from 'react-router-dom';
import './housekeeping.css';

export default function HousekeepingServices() {
  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Housekeeping</div>
            <h1 className="maint-title">Housekeeping Services</h1>
            <p className="meta-text mb-0">
              Manage cleaning tasks, guest requests, found items and room inspections.
            </p>
          </div>
        </div>

        <section className="hk-actions-grid">
          <div className="hk-action-card">
            <h2 className="h4 mb-2">What would you like to do?</h2>
            <p className="text-muted mb-4">
              Select a primary action to start work or review housekeeping requests.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link className="btn-log" to="/Housekeeping/Dashboard"><i className="bi bi-kanban me-2" />Cleaning kanban</Link>
              <Link className="admin-btn" to="/Housekeeping/GuestRequests"><i className="bi bi-bell me-2" />Guest requests</Link>
              <Link className="admin-btn" to="/Housekeeping/MyRequests"><i className="bi bi-list-check me-2" />All cleaning requests</Link>
              <Link className="admin-btn" to="/Housekeeping/RequestRoomCleaning"><i className="bi bi-brush me-2" />Request cleaning (guest)</Link>
            </div>
          </div>

          <aside className="hk-status-card">
            <i className="bi bi-house-heart" />
            <h3 className="h5 fw-bold mb-1">Housekeeping Hub</h3>
            <p className="mb-1">Keep every room pristine.</p>
            <span className="hk-stat-pill mx-auto">Grand Hotel Standards</span>
          </aside>
        </section>

        <section className="hk-mini-grid">
          <Link className="hk-mini-card" to="/FoundItems/Services">
            <span className="hk-mini-icon"><i className="bi bi-box" /></span>
            <h3 className="h5">Found Items</h3>
            <p>Log items found across the property and match them to guests.</p>
          </Link>
          <Link className="hk-mini-card" to="/RoomInspections">
            <span className="hk-mini-icon"><i className="bi bi-clipboard-check" /></span>
            <h3 className="h5">Inspections</h3>
            <p>Check room quality, safety, and cleaning inspection logs.</p>
          </Link>
          <Link className="hk-mini-card" to="/Admin/CleanerSchedules">
            <span className="hk-mini-icon"><i className="bi bi-calendar-week" /></span>
            <h3 className="h5">Cleaner Schedules</h3>
            <p>Assign cleaners to rooms per shift.</p>
          </Link>
        </section>

        <section className="hk-hero-banner">
          <div>
            <h2>Grand Hotel Standards</h2>
            <p className="mb-0" style={{ maxWidth: '620px', color: 'rgba(255,255,255,0.86)' }}>
              Every room is maintained with precision. Our housekeeping team ensures every detail
              reflects the quality of your stay.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
