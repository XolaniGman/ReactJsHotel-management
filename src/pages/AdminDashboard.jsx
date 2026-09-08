import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardStats, seedDemoData } from '../services/adminService';
import { listAmenityRequests } from '../services/amenityService';
import { listCheckIns } from '../services/checkinService';
import { formatPrice, formatDateRange, statusTone } from '../lib/utils';
import './admin.css';

const QUICK_ACTIONS = [
  { to: '/Reservations/Create', icon: 'bi-calendar-plus', label: 'New Reservation' },
  { to: '/Rooms/Create', icon: 'bi-door-open', label: 'Add Room' },
  { to: '/Admin/Reservations', icon: 'bi-calendar-check', label: 'Review Bookings' },
  { to: '/Admin/CheckIns', icon: 'bi-door-closed', label: 'Check-Ins' },
  { to: '/Admin/Inventory', icon: 'bi-box-seam', label: 'Inventory' },
  { to: '/Admin/Amenities', icon: 'bi-bell', label: 'Amenities' },
  { to: '/Admin/Payments', icon: 'bi-credit-card', label: 'Payments' },
  { to: '/Admin/CleanerSchedules', icon: 'bi-calendar-week', label: 'Cleaner Schedules' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  useEffect(() => {
    (async () => {
      const [s, sv, ci] = await Promise.all([dashboardStats(), listAmenityRequests(), listCheckIns()]);
      setStats(s);
      setServices(sv.filter((x) => x.status === 'Pending'));
      setCheckins(ci.filter((c) => !c.isCheckedOut));
    })();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const result = await seedDemoData();
      setSeedMsg(`Seeded ${result.rooms} rooms, ${result.events} events, ${result.amenities} amenities, ${result.products} products, ${result.menuItems} menu items, ${result.tables} tables, ${result.chefs} chefs, ${result.fleetVehicles} fleet vehicles, ${result.fleetDrivers} drivers, ${result.reservations} approved bookings.`);
      window.location.reload();
    } catch (err) {
      setSeedMsg(`Seed failed: ${err?.message || 'Please check your Firestore rules.'}`);
    } finally {
      setSeeding(false);
    }
  };

  if (!stats) {
    return (
      <div className="admin-dash-bg"><div className="admin-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading…</p>
      </div></div>
    );
  }

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Operations Overview</div>
            <h1 className="admin-title"><i className="bi bi-speedometer2 me-2" />Admin Dashboard</h1>
            <p className="meta-text mb-0">Live snapshot of rooms, guests, bookings, revenue, and hotel activity.</p>
          </div>
          <div className="admin-date">
            <i className="bi bi-calendar3 me-2" />
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {seedMsg && (
          <div className="admin-alert" role="status">
            <i className="bi bi-info-circle me-2" />{seedMsg}
          </div>
        )}

        <section className="kpi-grid">
          {[
            { icon: 'bi-door-open', value: stats.totalRooms, label: 'Total Rooms' },
            { icon: 'bi-door-closed', value: stats.occupiedRooms, label: 'Occupied' },
            { icon: 'bi-brush', value: stats.dirtyRooms, label: 'Dirty / In Cleaning' },
            { icon: 'bi-people', value: stats.registeredGuests, label: 'Registered Guests' },
            { icon: 'bi-calendar-check', value: stats.pendingBookings, label: 'Pending Bookings' },
            { icon: 'bi-key', value: stats.activeCheckIns, label: 'Active Check-Ins' },
            { icon: 'bi-bell', value: stats.pendingServices, label: 'Pending Services' },
            { icon: 'bi-credit-card', value: formatPrice(stats.revenue), label: 'Revenue Received' },
          ].map((kpi) => (
            <div className="kpi-card" key={kpi.label}>
              <span className="kpi-icon"><i className={`bi ${kpi.icon}`} /></span>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          ))}
        </section>

        <div className="quick-actions">
          <button type="button" className="admin-btn" onClick={handleSeed} disabled={seeding}>
            <i className={`bi ${seeding ? 'bi-arrow-repeat' : 'bi-magic'} me-2`} />
            {seeding ? 'Seeding…' : 'Seed demo data'}
          </button>
          {QUICK_ACTIONS.map((a) => (
            <Link className="admin-btn" to={a.to} key={a.label}>
              <i className={`bi ${a.icon} me-2`} />{a.label}
            </Link>
          ))}
        </div>

        <section className="admin-main-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-calendar-check me-2" />Recent Reservations</h2>
              <Link className="view-link" to="/Admin/Reservations">View All</Link>
            </div>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentReservations.length === 0 ? (
                    <tr><td colSpan="5" className="text-center text-muted py-4">No reservations yet.</td></tr>
                  ) : (
                    stats.recentReservations.map((res) => (
                      <tr key={res.id}>
                        <td><div className="guest-name">{res.guestName}</div><div className="meta-text">{res.bookingRef}</div></td>
                        <td>Room {res.roomNumber}</td>
                        <td className="meta-text">{formatDateRange(res.checkInDate, res.checkOutDate)}</td>
                        <td>{formatPrice(res.total)}</td>
                        <td><span className={`status-pill ${statusTone(res.status)}`}>{res.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title"><i className="bi bi-bell me-2" />Pending Services</h2>
              <Link className="view-link" to="/Admin/Amenities">View All</Link>
            </div>
            {services.length === 0 ? (
              <div className="empty-state"><i className="bi bi-check2-all d-block mb-2" style={{ fontSize: '1.6rem' }} />All services are handled.</div>
            ) : (
              services.slice(0, 5).map((s) => (
                <div className="service-item" key={s.id}>
                  <div>
                    <div className="guest-name">{s.amenityName}</div>
                    <div className="meta-text">{s.guestName} · Room {s.roomNumber || '—'}</div>
                  </div>
                  <span className="status-pill status-pending">Pending</span>
                </div>
              ))
            )}
          </aside>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title"><i className="bi bi-door-closed me-2" />Active Check-Ins</h2>
          </div>
          {checkins.length === 0 ? (
            <div className="empty-state"><i className="bi bi-key d-block mb-2" style={{ fontSize: '1.6rem' }} />No guests are currently checked in.</div>
          ) : (
            <div className="checkin-grid">
              {checkins.map((c) => (
                <div className={`checkin-card ${c.method === 'self' ? 'self-checkin' : ''}`} key={c.id}>
                  <div className="checkin-guest-name">{c.guestName}</div>
                  <div className="checkin-room"><i className="bi bi-door-open me-1" />Room {c.roomNumber}</div>
                  <div className="checkin-info"><i className="bi bi-calendar-event me-1" />Checked in {new Date(c.checkInDate || Date.now()).toLocaleDateString('en-ZA')}</div>
                  <span className={`checkin-badge ${c.method === 'self' ? 'self' : 'staff'}`}>
                    <i className={`bi ${c.method === 'self' ? 'bi-person-check' : 'bi-person-badge'} me-1`} />
                    {c.method === 'self' ? 'Self Check-In' : 'Front Desk'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
