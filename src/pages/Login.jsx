import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminAccount } from '../services/userService';
import './auth.css';

const roleHome = (role, email) => {
  if ((role === 'admin' || role === 'system') && isAdminAccount(email)) return '/Admin/Dashboard';
  if (role === 'housekeeping') return '/Housekeeping/Dashboard';
  if (role === 'laundry') return '/Laundry/Dashboard';
  if (role === 'storekeeper') return '/Storekeeper/Dashboard';
  if (role === 'maintenance') return '/Maintenance/Dashboard';
  return '/Guest/Dashboard';
};

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    if (justLoggedIn && user) {
      const target =
        user.role === 'admin' || user.role === 'system'
          ? roleHome(user.role, user.email)
          : location.state?.from || roleHome(user.role, user.email);
      navigate(target, { replace: true });
    }
  }, [justLoggedIn, user, navigate, location.state?.from]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await login(email, password);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setJustLoggedIn(true);
  };

  return (
    <div className="login-shell">
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-grid">
            <div className="login-hero">
              <div className="login-brand">Grand Hotel</div>
              <h1>Welcome back.</h1>
              <p>
                Sign in to manage reservations, explore rooms, and access your personalized hotel
                experience.
              </p>
            </div>

            <div className="login-form-pane">
              <div className="login-kicker">Guest Access</div>
              <h2 className="login-title">Sign In</h2>
              <p className="login-subtitle">Enter your details to continue to your account.</p>

              {error && <div className="lux-alert">{error}</div>}

              <form onSubmit={submit} noValidate>
                <div className="form-field">
                  <label className="lux-label" htmlFor="Email">
                    Email
                  </label>
                  <input
                    className="lux-input"
                    placeholder="you@example.com"
                    type="email"
                    id="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label className="lux-label" htmlFor="Password">
                    Password
                  </label>
                  <input
                    className="lux-input"
                    placeholder="••••••••"
                    type="password"
                    id="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="lux-btn-primary" disabled={submitting}>
                  <i className="bi bi-box-arrow-in-right me-2" /> {submitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <hr style={{ margin: '1.5rem 0' }} />

              <p className="text-center mb-3 login-footer-link" style={{ textAlign: 'center' }}>
                Don&rsquo;t have an account? <Link to="/Account/Register">Register here</Link>
              </p>

              <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                Admin access is reserved for admin@hotel.com. Staff roles are assigned in the
                Firebase console.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
