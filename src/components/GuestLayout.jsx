import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listUserReservations } from '../services/reservationService';
import { listBillsForGuest } from '../services/billService';
import { listTableReservations } from '../services/restaurantService';
import '../pages/palm.css';

const GUEST_PORTAL = [
  { to: '/Guest/Dashboard', icon: 'bi-house-door', label: 'Overview' },
  { to: '/Reservations/Create', icon: 'bi-briefcase', label: 'My Stays & Bookings' },
  { to: '/Restaurant/Reserve', icon: 'bi-cup-hot', label: 'Dining & Lounges', badgeKey: 'dining' },
  { to: '/Amenities/Request', icon: 'bi-flower2', label: 'Spa & Wellness' },
];

const ELITE_SERVICES = [
  { to: '/Housekeeping/RequestRoomCleaning', icon: 'bi-stars', label: 'Housekeeping' },
  { to: '/Fleet/Service', icon: 'bi-taxi-front', label: 'Shuttle & Valet' },
  { to: '/Maintenance/Request', icon: 'bi-tools', label: 'Maintenance' },
  { to: '/LostItems/Services', icon: 'bi-search', label: 'Lost & Found' },
];

const FLEET_MANAGER_PORTAL = [
  { to: '/Fleet/Manager', icon: 'bi-speedometer2', label: 'Overview' },
  { to: '/Fleet/Dashboard', icon: 'bi-kanban', label: 'Fleet Operations' },
  { to: '/Fleet/Vehicles', icon: 'bi-car-front', label: 'Vehicles Hub' },
  { to: '/Fleet/RentalQueue', icon: 'bi-hourglass-split', label: 'Rental Requests Queue' },
  { to: '/Fleet/ActiveRentals', icon: 'bi-arrow-left-right', label: 'Active Rentals — Check-out / Check-in' },
  { to: '/Fleet/MyTrips', icon: 'bi-signpost-split', label: 'Trip Bookings' },
];

const FLEET_MANAGER_SERVICES = [
  { to: '/Fleet/Charges', icon: 'bi-credit-card', label: 'Charges & Payments' },
  { to: '/Fleet/Incidents', icon: 'bi-journal-text', label: 'Incident Register' },
  { to: '/Fleet/Maintenance', icon: 'bi-wrench-adjustable', label: 'Work Orders' },
];

export default function GuestLayout({ children }) {
  const { user, logout, sendVerificationEmail } = useAuth();
  const isFleetManager = user?.role === 'fleetmanager';
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeRes, setActiveRes] = useState(null);
  const [latestBill, setLatestBill] = useState(null);
  const [diningCount, setDiningCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [chatPos, setChatPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const chatRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const [reservations, bills, tableReservations] = await Promise.all([
        listUserReservations(user.uid),
        listBillsForGuest(user.uid),
        listTableReservations(),
      ]);
      setActiveRes(reservations.find((r) => ['CheckedIn', 'Approved'].includes(r.status)) || null);
      setLatestBill(bills.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null);
      setDiningCount(
        tableReservations.filter((r) => r.guestUid === user.uid && ['Reserved', 'CheckedIn'].includes(r.status)).length,
      );
    })();
  }, [user?.uid]);

  const badgeValues = { dining: diningCount };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const resendVerification = async () => {
    const result = await sendVerificationEmail();
    if (result?.ok) setVerifySent(true);
  };

  const startChatDrag = (e) => {
    const rect = chatRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const rect = chatRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      const x = Math.min(Math.max(0, e.clientX - dragOffset.current.x), Math.max(0, maxX));
      const y = Math.min(Math.max(0, e.clientY - dragOffset.current.y), Math.max(0, maxY));
      setChatPos({ x, y });
    };

    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  const initials = (user?.name || user?.email || 'G').charAt(0).toUpperCase();
  const roomLabel = isFleetManager
    ? 'Fleet Manager'
    : activeRes ? `Suite ${activeRes.roomNumber} · ${activeRes.roomType}` : 'Guest Account';
  const portalItems = isFleetManager ? FLEET_MANAGER_PORTAL : GUEST_PORTAL;
  const serviceItems = isFleetManager ? FLEET_MANAGER_SERVICES : ELITE_SERVICES;

  return (
    <div className={`palm-shell ${mobileOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="palm-sidebar-overlay" onClick={() => setMobileOpen(false)} />

      <aside className="palm-sidebar">
        <Link className="palm-sidebar-brand" to={isFleetManager ? '/Fleet/Manager' : '/Guest/Dashboard'} onClick={() => setMobileOpen(false)}>
          <span className="palm-sidebar-brand-mark">P</span>
          <span className="palm-sidebar-brand-text">
            <span className="palm-sidebar-brand-name d-block">Winds Hotel</span>
            <span className="palm-sidebar-brand-sub">Resort &amp; Sanctuary</span>
          </span>
        </Link>

        <div className="palm-nav-section">
          <div className="palm-nav-label">{isFleetManager ? 'Fleet Management' : 'Guest Portal'}</div>
          <nav className="d-flex flex-column gap-1">
            {portalItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `palm-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
                title={item.label}
              >
                <i className={`bi ${item.icon}`} />
                <span className="palm-nav-link-text">{item.label}</span>
                {item.badgeKey && badgeValues[item.badgeKey] > 0 && (
                  <span className="palm-nav-badge">{badgeValues[item.badgeKey]}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="palm-nav-section">
          <div className="palm-nav-label">{isFleetManager ? 'Fleet Services' : 'Elite &amp; Services'}</div>
          <nav className="d-flex flex-column gap-1">
            {serviceItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `palm-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
                title={item.label}
              >
                <i className={`bi ${item.icon}`} />
                <span className="palm-nav-link-text">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="palm-nav-section" style={{ marginBottom: '1.5rem' }}>
          <nav className="d-flex flex-column gap-1">
            <button type="button" className="palm-nav-link" onClick={handleLogout} title="Log Out">
              <i className="bi bi-box-arrow-right" />
              <span className="palm-nav-link-text">Log Out</span>
            </button>
          </nav>
        </div>
      </aside>

      <div className="palm-main">
        <header className="palm-topbar">
          <button type="button" className="palm-topbar-toggle" aria-label="Toggle menu" onClick={() => setMobileOpen((v) => !v)}>
            <i className="bi bi-list" />
          </button>
          <button
            type="button"
            className="palm-sidebar-collapse-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((c) => !c)}
          >
            <i className={`bi ${collapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar-inset-reverse'}`} />
          </button>
          <div className="palm-search">
            <i className="bi bi-search" />
            <input type="text" placeholder={`Search by, ${roomLabel.replace('Suite ', '')}`} readOnly />
          </div>
          <div className="palm-topbar-right">
            <span className="palm-concierge d-none d-md-flex">
              <i className="bi bi-telephone" />Resort Concierge · Ext. 0
            </span>
            <span className="palm-bell">
              <i className="bi bi-bell" />
              {(diningCount > 0 || (latestBill && latestBill.balanceDue > 0)) && <span className="dot" />}
            </span>
            <div className="palm-user-chip">
              <span className="palm-user-avatar">{initials}</span>
              <span className="d-none d-sm-block">
                <span className="palm-user-name d-block">{user?.name}</span>
                <span className="palm-user-sub">{roomLabel}</span>
              </span>
            </div>
          </div>
        </header>

        {user && !user.emailVerified && !bannerDismissed && (
          <div className="palm-verify-banner">
            <i className="bi bi-exclamation-triangle" />
            Verify your contact details to enable mobile keyless entry and contactless express checkout.
            {!verifySent ? (
              <button type="button" className="link" onClick={resendVerification}>Resend verification email</button>
            ) : (
              <span className="fw-bold">Verification email sent.</span>
            )}
            <button type="button" className="close" aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        )}

        <div className="palm-content">{children}</div>

        <footer className="palm-footer">
          <strong>Winds Hotel</strong> <span className="sep">·</span> Luxury Hospitality Group &amp; Sanctuary
          <span className="sep">·</span> 24-Hour Guest Support · +1 800 555 0142
          <div className="mt-1">
            <a href="#privacy">Guest Privacy</a>
            <a href="#terms">House Rules &amp; Terms</a>
            <a href="#contact">Contact General Manager</a>
          </div>
        </footer>
      </div>

      <div
        ref={chatRef}
        className={`palm-chat-widget ${dragging ? 'dragging' : ''}`}
        style={chatPos ? { left: chatPos.x, top: chatPos.y, bottom: 'auto', right: 'auto' } : undefined}
      >
        <div className="palm-chat-header" onPointerDown={startChatDrag}>
          <span className="palm-chat-title">Front Desk Chat</span>
          <span className="palm-chat-status"><span className="dot" />Online</span>
        </div>
        <div className="palm-chat-body">
          Need help? We&apos;re here for you — chat with our staff for anything you need.
          <div className="palm-chat-actions">
            <a className="palm-btn palm-btn-outline" href="tel:+18005550142"><i className="bi bi-telephone" />Call</a>
            <a className="palm-btn palm-btn-primary" href="mailto:concierge@thepalmresort.example"><i className="bi bi-chat-dots" />Chat</a>
          </div>
        </div>
      </div>
    </div>
  );
}
