import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './auth.css';

export default function Register() {
  const { register, sendVerificationEmail } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await register({ firstName, lastName, email, password });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setRegistered(true);
  };

  const resend = async () => {
    const result = await sendVerificationEmail();
    if (result?.ok) setResent(true);
  };

  if (registered) {
    return (
      <div className="login-shell">
        <div className="login-wrap">
          <div className="login-card">
            <div className="login-form-pane" style={{ borderLeft: 'none' }}>
              <div className="login-kicker">Almost there</div>
              <h2 className="login-title">Confirm your email</h2>
              <p className="login-subtitle">
                We sent a verification link to <strong>{email}</strong>. Open it to activate your
                account, then sign in.
              </p>

              <div className="lux-alert" style={{ background: '#f1f8f2', color: '#1b5e20' }}>
                <i className="bi bi-envelope-check me-2" />
                Your account is active as soon as you confirm your email.
              </div>

              {resent && (
                <p className="text-success" style={{ fontSize: '0.9rem' }}>
                  <i className="bi bi-check-circle me-1" /> Verification email resent.
                </p>
              )}

              <button type="button" className="lux-btn-primary" onClick={resend}>
                <i className="bi bi-envelope-arrow-up me-2" /> Resend email
              </button>

              <Link to="/Account/Login" className="lux-btn lux-btn-outline" style={{ marginTop: '0.75rem' }}>
                <i className="bi bi-box-arrow-in-right me-2" /> Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-grid">
            <div className="login-hero">
              <div className="login-brand">Grand Hotel</div>
              <h1>Begin your stay.</h1>
              <p>
                Create an account to unlock room availability, curated experiences, and a personal
                hotel journey.
              </p>
            </div>

            <div className="login-form-pane">
              <div className="login-kicker">Guest Access</div>
              <h2 className="login-title">Create Account</h2>
              <p className="login-subtitle">Join Grand Hotel and start exploring.</p>

              {error && <div className="lux-alert">{error}</div>}

              <form onSubmit={submit} noValidate>
                <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-field">
                    <label className="lux-label" htmlFor="FirstName">
                      First Name
                    </label>
                    <input
                      className="lux-input"
                      id="FirstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="lux-label" htmlFor="LastName">
                      Last Name
                    </label>
                    <input
                      className="lux-input"
                      id="LastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

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

                <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

                  <div className="form-field">
                    <label className="lux-label" htmlFor="ConfirmPassword">
                      Confirm Password
                    </label>
                    <input
                      className="lux-input"
                      placeholder="••••••••"
                      type="password"
                      id="ConfirmPassword"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="lux-btn-primary" disabled={submitting}>
                  <i className="bi bi-person-plus me-2" /> {submitting ? 'Creating…' : 'Create Account'}
                </button>
              </form>

              <hr style={{ margin: '1.5rem 0' }} />

              <p className="text-center mb-3 login-footer-link" style={{ textAlign: 'center' }}>
                Already have an account? <Link to="/Account/Login">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
