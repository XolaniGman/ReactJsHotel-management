import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminAccount } from '../services/userService';

const NAV_SECTIONS = [
  {
    label: 'Portal',
    items: [
      { to: '/', icon: 'bi-house-door', label: 'Home' },
      { to: '/Rooms', icon: 'bi-door-open', label: 'Rooms' },
      { to: '/Events', icon: 'bi-calendar-event', label: 'Events' },
      { to: '/Restaurant', icon: 'bi-egg-fried', label: 'Restaurant' },
      { to: '/Amenities/Request', icon: 'bi-star', label: 'Services' },
    ],
  },
];

const GUEST_SECTIONS = [
  {
    label: 'Guest Area',
    items: [
      { to: '/Guest/Dashboard', icon: 'bi-house', label: 'Dashboard' },
      { to: '/Reservations/Create', icon: 'bi-calendar-plus', label: 'Book a Stay' },
      { to: '/CheckIns/SelfCheckInWizard', icon: 'bi-person-check', label: 'Self Check-In' },
      { to: '/Restaurant/Reserve', icon: 'bi-calendar-check', label: 'Reserve a Table' },
      { to: '/Housekeeping/RequestRoomCleaning', icon: 'bi-stars', label: 'Room Cleaning' },
      { to: '/Maintenance/Request', icon: 'bi-wrench-adjustable', label: 'Maintenance' },
      { to: '/LostItems/Services', icon: 'bi-search', label: 'Lost Item Reports' },
    ],
  },
];

const HOUSEKEEPING_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { to: '/Housekeeping/Dashboard', icon: 'bi-kanban', label: 'Cleaning Kanban' },
      { to: '/Housekeeping/GuestRequests', icon: 'bi-bell', label: 'Guest Requests' },
      { to: '/FoundItems/Services', icon: 'bi-box-seam', label: 'Found Item Reports' },
      { to: '/RoomInspections', icon: 'bi-clipboard-check', label: 'Room Inspections' },
    ],
  },
];

const LAUNDRY_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { to: '/Laundry/Dashboard', icon: 'bi-washing-machine', label: 'Laundry' },
    ],
  },
];

const STOREKEEPER_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { to: '/Storekeeper/Dashboard', icon: 'bi-box-seam', label: 'Storekeeper' },
      { to: '/Storekeeper/StockIn', icon: 'bi-plus-square', label: 'Stock In' },
      { to: '/Storekeeper/IssueToRoom', icon: 'bi-box-arrow-up-right', label: 'Issue to Room' },
      { to: '/Storekeeper/Adjustments', icon: 'bi-sliders', label: 'Stock Adjustments' },
    ],
  },
];

const MAINTENANCE_SECTIONS = [
  {
    label: 'Operations',
    items: [
      { to: '/Maintenance/Dashboard', icon: 'bi-tools', label: 'Room Maintenance' },
    ],
  },
];

const RESTAURANT_SECTIONS = [
  {
    label: 'Restaurant',
    items: [
      { to: '/Admin/Restaurant', icon: 'bi-egg-fried', label: 'Kitchen Queue' },
      { to: '/Admin/Restaurant/Tables', icon: 'bi-grid', label: 'Tables & Reservations' },
      { to: '/Admin/Restaurant/Menu', icon: 'bi-book', label: 'Menu Catalogue' },
      { to: '/Admin/Restaurant/Reports', icon: 'bi-graph-up', label: 'Kitchen Report' },
    ],
  },
];

const ADMIN_SECTIONS = [
  {
    label: 'Management',
    items: [
      { to: '/Admin/Dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
      { to: '/Admin/Reservations', icon: 'bi-calendar-check', label: 'Reservations' },
      { to: '/Admin/Guests', icon: 'bi-people', label: 'Guests' },
      { to: '/Admin/CheckIns', icon: 'bi-door-closed', label: 'Check-Ins' },
      { to: '/Admin/Payments', icon: 'bi-credit-card', label: 'Payments' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/Rooms', icon: 'bi-door-open', label: 'Rooms' },
      { to: '/Events', icon: 'bi-calendar-event', label: 'Events' },
      { to: '/Restaurant', icon: 'bi-egg-fried', label: 'Restaurant' },
      { to: '/Admin/Inventory', icon: 'bi-box-seam', label: 'Inventory' },
      { to: '/Admin/InventoryStaff', icon: 'bi-person-gear', label: 'Inventory Staff' },
      { to: '/Admin/Amenities', icon: 'bi-bell', label: 'Amenities' },
      { to: '/Admin/Restaurant', icon: 'bi-egg-fried', label: 'Restaurant' },
      { to: '/Admin/Restaurant/Menu', icon: 'bi-book', label: 'Restaurant Menu' },
      { to: '/Admin/Restaurant/Tables', icon: 'bi-grid', label: 'Restaurant Tables' },
      { to: '/Admin/Restaurant/Reports', icon: 'bi-graph-up', label: 'Kitchen Report' },
      { to: '/Admin/CleanerSchedules', icon: 'bi-calendar-week', label: 'Cleaner Schedules' },
    ],
  },
  {
    label: 'Housekeeping',
    items: [
      { to: '/Housekeeping/Dashboard', icon: 'bi-kanban', label: 'Cleaning Kanban' },
      { to: '/FoundItems/Services', icon: 'bi-box-seam', label: 'Found Item Reports' },
      { to: '/RoomInspections', icon: 'bi-clipboard-check', label: 'Room Inspections' },
      { to: '/Admin/CleanerSchedules', icon: 'bi-calendar-week', label: 'Cleaner Schedules' },
    ],
  },
  {
    label: 'Maintenance',
    items: [{ to: '/Maintenance/Dashboard', icon: 'bi-tools', label: 'Room Maintenance' }],
  },
];

export default function LuxLayout({ children }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role;
  const isAdminView = role === 'admin' && isAdminAccount(user?.email);

  const base = isAdminView ? ADMIN_SECTIONS
    : role === 'housekeeping' ? [...NAV_SECTIONS, ...HOUSEKEEPING_SECTIONS, ...RESTAURANT_SECTIONS]
    : role === 'laundry' ? [...NAV_SECTIONS, ...LAUNDRY_SECTIONS, ...RESTAURANT_SECTIONS]
    : role === 'storekeeper' ? [...NAV_SECTIONS, ...STOREKEEPER_SECTIONS, ...RESTAURANT_SECTIONS]
    : role === 'maintenance' ? [...NAV_SECTIONS, ...MAINTENANCE_SECTIONS, ...RESTAURANT_SECTIONS]
    : user ? [...NAV_SECTIONS, ...GUEST_SECTIONS]
    : NAV_SECTIONS;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      className={`lux-layout ${collapsed ? 'sidebar-collapsed' : ''} ${
        mobileOpen ? 'sidebar-open' : ''
      }`}
    >
      <div
        className={`lux-sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className="lux-sidebar" aria-label="Sidebar Navigation">
        <div className="w-100 d-flex flex-column">
          <div className="lux-sidebar-top">
            <Link className="lux-sidebar-brand" to="/">
              Grand Hotel
            </Link>
          </div>

          <div className="lux-sidebar-body">
            {base.map((section) => (
              <div key={section.label}>
                <div className="sidebar-section-label">{section.label}</div>
                {section.items.length > 0 && (
                  <nav className="sidebar-nav">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `sidebar-link ${isActive ? 'active' : ''}`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <i className={`bi ${item.icon}`} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                )}
              </div>
            ))}

            <div>
              <div className="sidebar-section-label">
                {user ? 'Account' : 'Access'}
              </div>
              <nav className="sidebar-nav">
                {user ? (
                  <>
                    {isAdminView && (
                      <NavLink
                        to="/Admin/Dashboard"
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <i className="bi bi-speedometer2" />
                        <span>Admin</span>
                      </NavLink>
                    )}
                    <button type="button" className="sidebar-link" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink
                      to="/Account/Login"
                      className={({ isActive }) =>
                        `sidebar-link ${isActive || location.pathname === '/Account/Login' ? 'active' : ''}`
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <i className="bi bi-box-arrow-in-right" />
                      <span>Login</span>
                    </NavLink>
                    <NavLink
                      to="/Account/Register"
                      className={({ isActive }) =>
                        `sidebar-link ${isActive || location.pathname === '/Account/Register' ? 'active' : ''}`
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      <i className="bi bi-person-plus" />
                      <span>Register</span>
                    </NavLink>
                    <NavLink
                      to="/Kiosk"
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <i className="bi bi-tv" />
                      <span>Check-In Kiosk</span>
                    </NavLink>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      </aside>

      <div className="lux-main">
        <header className="lux-topbar">
          <div className="lux-topbar-left">
            <button
              type="button"
              className="lux-sidebar-toggle"
              aria-label="Toggle sidebar"
              onClick={() => {
                setCollapsed((c) => !c);
                setMobileOpen(false);
              }}
            >
              <i className="bi bi-layout-sidebar-inset" />
              <i className="bi bi-list" />
            </button>
            <div>
              <h1 className="lux-page-title">{pageTitle(location.pathname)}</h1>
              <p className="lux-page-subtitle">Grand Hotel Management System</p>
            </div>
          </div>

          <div className="lux-topbar-right">
            {user ? (
              <>
                <div className="lux-user-chip d-none d-md-inline-flex">
                  <span className="lux-user-avatar">
                    {(user.name || user.email || 'G').charAt(0).toUpperCase()}
                  </span>
                  <span className="lux-user-name">{user.name}</span>
                </div>
                <button
                  type="button"
                  className="lux-btn lux-btn-outline lux-logout-btn"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right" /> Logout
                </button>
              </>
            ) : (
              <div className="lux-auth-actions d-flex align-items-center gap-2">
                <Link className="lux-btn lux-btn-outline" to="/Account/Login">
                  Login
                </Link>
                <Link className="lux-btn lux-btn-solid" to="/Account/Register">
                  Register
                </Link>
              </div>
            )}
          </div>
        </header>

        <div className="lux-content">{children}</div>

        <footer className="lux-footer">
          <small>&copy; 2026 Grand Hotel Management System</small>
        </footer>
      </div>
    </div>
  );
}

function pageTitle(path) {
  if (path === '/') return 'Home';
  if (path === '/Kiosk') return 'Check-In Kiosk';
  if (path.startsWith('/Rooms/Create')) return 'Add Room';
  if (path.startsWith('/Rooms/Edit')) return 'Edit Room';
  if (path.startsWith('/Rooms/Details')) return 'Room Details';
  if (path.startsWith('/Rooms')) return 'Rooms';
  if (path.startsWith('/Events')) return 'Events';
  if (path === '/Amenities/Request' || path === '/Laundry') return 'Services';
  if (path === '/Account/Login') return 'Login';
  if (path === '/Account/Register') return 'Register';
  if (path.startsWith('/Guest/Dashboard')) return 'Guest Dashboard';
  if (path.startsWith('/Reservations/Create')) return 'Make a Reservation';
  if (path.startsWith('/Reservations/Details')) return 'Reservation Details';
  if (path.startsWith('/Payments/Bill')) return 'Invoice';
  if (path.startsWith('/LostItems')) return 'Lost Item Services';
  if (path.startsWith('/CheckIns/SelfCheckInWizard')) return 'Self Check-In';
  if (path.startsWith('/CheckIns/CheckInWelcome')) return 'Welcome';
  if (path.startsWith('/Housekeeping/GuestRequests')) return 'Guest Requests';
  if (path.startsWith('/Housekeeping/Requests')) return 'All Cleaning Requests';
  if (path.startsWith('/Housekeeping/MyRequests')) return 'All Cleaning Requests';
  if (path.startsWith('/Housekeeping/Dashboard')) return 'Cleaning Kanban';
  if (path.startsWith('/Housekeeping/RequestRoomCleaning') || path === '/Housekeeping') return 'Room Cleaning';
  if (path.startsWith('/Housekeeping/Services')) return 'Housekeeping Services';
  if (path.startsWith('/Housekeeping')) return 'Room Cleaning';
  if (path.startsWith('/FoundItems')) return 'Found Item Services';
  if (path.includes('/RoomInspections/Create')) return 'New Room Inspection';
  if (path.includes('/RoomInspections/Details')) return 'Inspection Details';
  if (path.includes('/RoomInspections')) return 'Room Inspections';
  if (path.startsWith('/Laundry')) return 'Laundry Dashboard';
  if (path.startsWith('/Storekeeper/StockIn')) return 'Stock In';
  if (path.startsWith('/Storekeeper/IssueToRoom')) return 'Issue to Room';
  if (path.startsWith('/Storekeeper/Adjustments')) return 'Stock Adjustments';
  if (path.startsWith('/Storekeeper')) return 'Storekeeper Dashboard';
  if (path.startsWith('/Maintenance/Dashboard')) return 'Maintenance Dashboard';
  if (path.startsWith('/Maintenance')) return 'Maintenance Request';
  if (path.startsWith('/Admin/Reservations')) return 'Reservations';
  if (path.startsWith('/Admin/Guests')) return 'Guests';
  if (path.startsWith('/Admin/CheckIns')) return 'Check-Ins';
  if (path.startsWith('/Admin/Payments')) return 'Payments';
  if (path.startsWith('/Admin/Amenities')) return 'Amenities';
  if (path.startsWith('/Admin/InventoryStaff')) return 'Inventory Staff';
  if (path.startsWith('/Admin/Inventory')) return 'Inventory';
  if (path.startsWith('/Admin/CleanerSchedules')) return 'Cleaner Schedules';
  if (path === '/Restaurant/Reserve') return 'Reserve a Table';
  if (path.startsWith('/Restaurant')) return 'Restaurant Dining';
  if (path === '/Admin/Restaurant/Menu') return 'Restaurant Menu';
  if (path === '/Admin/Restaurant/Tables') return 'Restaurant Tables';
  if (path === '/Admin/Restaurant/Reports') return 'Kitchen Report';
  if (path.startsWith('/Admin/Restaurant')) return 'Kitchen Order Queue';
  if (path.startsWith('/Admin')) return 'Admin Dashboard';
  return 'Grand Hotel';
}
