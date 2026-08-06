import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LuxLayout from './components/LuxLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isAdminAccount } from './services/userService';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import RoomDetails from './pages/RoomDetails';
import AdminRoomCreate from './pages/AdminRoomCreate';
import AdminRoomEdit from './pages/AdminRoomEdit';
import Events from './pages/Events';
import Services from './pages/Services';
import Login from './pages/Login';
import Register from './pages/Register';
import GuestDashboard from './pages/GuestDashboard';
import ReservationCreate from './pages/ReservationCreate';
import ReservationDetails from './pages/ReservationDetails';
import Invoice from './pages/Invoice';
import LostItems from './pages/LostItems';
import Housekeeping from './pages/Housekeeping';
import MaintenanceRequest from './pages/MaintenanceRequest';
import SelfCheckInWizard from './pages/SelfCheckInWizard';
import CheckInWelcome from './pages/CheckInWelcome';
import Kiosk from './pages/Kiosk';

import HousekeepingServices from './pages/HousekeepingServices';
import HousekeepingDashboard from './pages/HousekeepingDashboard';
import HousekeepingRequests from './pages/HousekeepingRequests';
import CleaningRequests from './pages/CleaningRequests';
import FoundItems from './pages/FoundItems';
import RoomInspections from './pages/RoomInspections';
import InspectionCreate from './pages/InspectionCreate';
import InspectionDetails from './pages/InspectionDetails';
import LaundryDashboard from './pages/LaundryDashboard';
import StorekeeperDashboard from './pages/StorekeeperDashboard';
import StorekeeperStockIn from './pages/StorekeeperStockIn';
import StorekeeperIssueToRoom from './pages/StorekeeperIssueToRoom';
import StorekeeperAdjustments from './pages/StorekeeperAdjustments';
import MaintenanceDashboard from './pages/MaintenanceDashboard';

import AdminDashboard from './pages/AdminDashboard';
import AdminReservations from './pages/AdminReservations';
import AdminGuests from './pages/AdminGuests';
import AdminCheckIns from './pages/AdminCheckIns';
import AdminPayments from './pages/AdminPayments';
import AdminAmenities from './pages/AdminAmenities';
import AdminInventory from './pages/AdminInventory';
import AdminInventoryStaff from './pages/AdminInventoryStaff';
import AdminCleanerSchedules from './pages/AdminCleanerSchedules';
import RestaurantMenu from './pages/RestaurantMenu';
import RestaurantReserve from './pages/RestaurantReserve';
import AdminRestaurant from './pages/AdminRestaurant';
import AdminRestaurantMenu from './pages/AdminRestaurantMenu';
import AdminRestaurantTables from './pages/AdminRestaurantTables';
import AdminRestaurantReports from './pages/AdminRestaurantReports';

const canAccessAdmin = (user) =>
  user?.role === 'admin' && isAdminAccount(user?.email);

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/Account/Login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RequireRole({ roles = [], children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/Account/Login" replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(user.role)) {
    return (
      <Navigate
        to={canAccessAdmin(user) ? '/Admin/Dashboard' : '/Guest/Dashboard'}
        replace
      />
    );
  }

  if (roles.includes('admin') && !canAccessAdmin(user)) {
    return <Navigate to="/Guest/Dashboard" replace />;
  }

  return children;
}

const STAFF_ROLES = ['admin', 'housekeeping', 'laundry', 'storekeeper', 'maintenance', 'system'];
const ADMIN_ROLES = ['admin', 'system'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Kiosk" element={<Kiosk />} />
          <Route
            path="*"
            element={
              <LuxLayout>
                <Routes>
                  <Route path="/Rooms" element={<Rooms />} />
                  <Route path="/Rooms/Details/:id" element={<RoomDetails />} />
                  <Route path="/Rooms/Create" element={<RequireRole roles={ADMIN_ROLES}><AdminRoomCreate /></RequireRole>} />
                  <Route path="/Rooms/Edit/:id" element={<RequireRole roles={ADMIN_ROLES}><AdminRoomEdit /></RequireRole>} />
                  <Route path="/Events" element={<Events />} />
                  <Route path="/Restaurant" element={<RestaurantMenu />} />
                  <Route path="/Restaurant/Reserve" element={<RestaurantReserve />} />
                  <Route path="/Amenities/Request" element={<Services />} />
                  <Route path="/Laundry" element={<Services />} />
                  <Route path="/Account/Login" element={<Login />} />
                  <Route path="/Account/Register" element={<Register />} />

                  <Route path="/Guest/Dashboard" element={<RequireAuth><GuestDashboard /></RequireAuth>} />
                  <Route path="/Reservations/Create" element={<RequireAuth><ReservationCreate /></RequireAuth>} />
                  <Route path="/Reservations/Details/:id" element={<RequireAuth><ReservationDetails /></RequireAuth>} />
                  <Route path="/Payments/Bill/:id" element={<RequireAuth><Invoice /></RequireAuth>} />
                  <Route path="/LostItems/Services" element={<RequireAuth><LostItems /></RequireAuth>} />
                  <Route path="/LostItems/Report" element={<RequireAuth><LostItems /></RequireAuth>} />
                  <Route path="/Housekeeping/RequestRoomCleaning" element={<RequireAuth><Housekeeping /></RequireAuth>} />
                  <Route path="/Housekeeping" element={<RequireAuth><Housekeeping /></RequireAuth>} />
                  <Route path="/Maintenance/Request" element={<RequireAuth><MaintenanceRequest /></RequireAuth>} />
                  <Route path="/Maintenance/Create" element={<RequireAuth><MaintenanceRequest /></RequireAuth>} />
                  <Route path="/CheckIns/SelfCheckInWizard" element={<RequireAuth><SelfCheckInWizard /></RequireAuth>} />
                  <Route path="/CheckIns/CheckInWelcome" element={<RequireAuth><CheckInWelcome /></RequireAuth>} />

                  <Route path="/Housekeeping/Services" element={<RequireRole roles={STAFF_ROLES}><HousekeepingServices /></RequireRole>} />
                  <Route path="/Housekeeping/Dashboard" element={<RequireRole roles={STAFF_ROLES}><HousekeepingDashboard /></RequireRole>} />
                  <Route path="/Housekeeping/MyRequests" element={<RequireRole roles={STAFF_ROLES}><HousekeepingRequests /></RequireRole>} />
                  <Route path="/Housekeeping/Requests" element={<RequireRole roles={STAFF_ROLES}><HousekeepingRequests /></RequireRole>} />
                  <Route path="/Housekeeping/GuestRequests" element={<RequireRole roles={STAFF_ROLES}><CleaningRequests /></RequireRole>} />
                  <Route path="/FoundItems/Services" element={<RequireRole roles={STAFF_ROLES}><FoundItems /></RequireRole>} />
                  <Route path="/RoomInspections" element={<RequireRole roles={STAFF_ROLES}><RoomInspections /></RequireRole>} />
                  <Route path="/RoomInspections/Create" element={<RequireRole roles={STAFF_ROLES}><InspectionCreate /></RequireRole>} />
                  <Route path="/RoomInspections/Details/:id" element={<RequireRole roles={STAFF_ROLES}><InspectionDetails /></RequireRole>} />
                  <Route path="/Admin/RoomInspections" element={<RequireRole roles={STAFF_ROLES}><RoomInspections /></RequireRole>} />
                  <Route path="/Admin/RoomInspections/Create" element={<RequireRole roles={STAFF_ROLES}><InspectionCreate /></RequireRole>} />
                  <Route path="/Admin/RoomInspections/Details/:id" element={<RequireRole roles={STAFF_ROLES}><InspectionDetails /></RequireRole>} />
                  <Route path="/Laundry/Dashboard" element={<RequireRole roles={STAFF_ROLES}><LaundryDashboard /></RequireRole>} />
                  <Route path="/Storekeeper/Dashboard" element={<RequireRole roles={STAFF_ROLES}><StorekeeperDashboard /></RequireRole>} />
                  <Route path="/Storekeeper/StockIn" element={<RequireRole roles={STAFF_ROLES}><StorekeeperStockIn /></RequireRole>} />
                  <Route path="/Storekeeper/IssueToRoom" element={<RequireRole roles={STAFF_ROLES}><StorekeeperIssueToRoom /></RequireRole>} />
                  <Route path="/Storekeeper/Adjustments" element={<RequireRole roles={STAFF_ROLES}><StorekeeperAdjustments /></RequireRole>} />
                  <Route path="/Maintenance/Dashboard" element={<RequireRole roles={STAFF_ROLES}><MaintenanceDashboard /></RequireRole>} />

                  <Route path="/Admin/Dashboard" element={<RequireRole roles={ADMIN_ROLES}><AdminDashboard /></RequireRole>} />
                  <Route path="/Admin/Reservations" element={<RequireRole roles={ADMIN_ROLES}><AdminReservations /></RequireRole>} />
                  <Route path="/Admin/Guests" element={<RequireRole roles={ADMIN_ROLES}><AdminGuests /></RequireRole>} />
                  <Route path="/Admin/CheckIns" element={<RequireRole roles={ADMIN_ROLES}><AdminCheckIns /></RequireRole>} />
                  <Route path="/Admin/Payments" element={<RequireRole roles={ADMIN_ROLES}><AdminPayments /></RequireRole>} />
                  <Route path="/Admin/Amenities" element={<RequireRole roles={ADMIN_ROLES}><AdminAmenities /></RequireRole>} />
                  <Route path="/Admin/Restaurant" element={<RequireRole roles={STAFF_ROLES}><AdminRestaurant /></RequireRole>} />
                  <Route path="/Admin/Restaurant/Menu" element={<RequireRole roles={STAFF_ROLES}><AdminRestaurantMenu /></RequireRole>} />
                  <Route path="/Admin/Restaurant/Tables" element={<RequireRole roles={STAFF_ROLES}><AdminRestaurantTables /></RequireRole>} />
                  <Route path="/Admin/Restaurant/Reports" element={<RequireRole roles={STAFF_ROLES}><AdminRestaurantReports /></RequireRole>} />
                  <Route path="/Admin/Inventory" element={<RequireRole roles={ADMIN_ROLES}><AdminInventory /></RequireRole>} />
                  <Route path="/Admin/InventoryStaff" element={<RequireRole roles={ADMIN_ROLES}><AdminInventoryStaff /></RequireRole>} />
                  <Route path="/Admin/CleanerSchedules" element={<RequireRole roles={ADMIN_ROLES}><AdminCleanerSchedules /></RequireRole>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </LuxLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
