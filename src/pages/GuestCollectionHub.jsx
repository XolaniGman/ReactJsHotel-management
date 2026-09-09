import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeCarBookings, collectionStepLabel, bookingDisplay } from '../services/fleetService';
import { formatGuestDate, formatPrice } from '../lib/utils';
import './guest.css';
import './fleet.css';

export default function GuestCollectionHub() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeCarBookings((all) => setBookings(all.filter((b) => b.guestUid === user.uid)));
  }, [user?.uid]);

  const due = (b) => {
    if (b.status === 'Cancelled') return { kind: 'muted', label: 'Cancelled' };
    if (b.status === 'PendingConfirmation') return { kind: 'warn', label: 'Awaiting confirmation' };
    if (b.status === 'Confirmed') {
      const alreadyArrived = b.guestArrived || (b.collectionProgress?.step && b.collectionProgress.step !== 'prep');
      return alreadyArrived
        ? { kind: 'info', label: 'Collection in progress — front desk is working on it' }
        : { kind: 'success', label: `Ready for pick-up · ${b.pickupDate} ${b.pickupTime || ''}` };
    }
    if (b.status === 'CheckedOut') {
      return b.guestAcknowledgedAt || b.guestSignature
        ? { kind: 'success', label: 'Collection complete — keys handed over' }
        : { kind: 'warn', label: 'Vehicle handed out — please review & sign your condition report' };
    }
    return { kind: 'muted', label: bookingDisplay(b.status) };
  };

  const cta = (b) => {
    if (b.status === 'Confirmed') {
      const inProgress = b.guestArrived || (b.collectionProgress?.step && b.collectionProgress.step !== 'prep');
      return {
        to: `/Fleet/Collection/${b.id}`,
        icon: 'bi-box-arrow-right',
        label: inProgress ? 'Continue collection' : 'Start pickup',
        cls: 'san-btn-primary',
      };
    }
    if (b.status === 'CheckedOut' && !b.guestAcknowledgedAt && !b.guestSignature) {
      return { to: `/Fleet/Collection/${b.id}`, icon: 'bi-pen', label: 'Review & sign', cls: 'san-btn-primary' };
    }
    if (b.status === 'CheckedOut') {
      return { to: '/Fleet/MyTrips', icon: 'bi-geo-alt', label: 'Track my trip', cls: 'san-btn-secondary' };
    }
    return null;
  };

  const sorted = [...bookings].sort((a, b) => {
    const rank = { Confirmed: 0, CheckedOut: 1, PendingConfirmation: 2, PendingInspection: 3, CheckedIn: 4, Cancelled: 5 };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.pickupDate || '').localeCompare(b.pickupDate || '');
  });

  const active = sorted.filter((b) => !['CheckedIn', 'Cancelled'].includes(b.status));

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Fetch the car</div>
          <h1 className="lost-title">Vehicle collection</h1>
          <p className="lost-copy">
            Pick up your rental at the front desk. See what to bring, watch your collection in real time, and sign your condition report straight from your phone.
          </p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>No active rental pick-ups</h2></div>
          <div className="dash-empty">
            <i className="bi bi-car-front me-2" />You don't have a rental waiting to be collected right now.
          </div>
          <div className="p-3 pt-0 d-flex gap-2">
            <Link to="/Fleet/Vehicles" className="san-btn-primary"><i className="bi bi-car-front me-2" />Rent a vehicle</Link>
            <Link to="/Fleet/MyTrips" className="san-btn-secondary"><i className="bi bi-signpost-split me-2" />My trips</Link>
          </div>
        </div>
      ) : (
        <div className="dash-panel">
          <div className="dash-panel-header"><h2>Your rental pick-ups</h2></div>
          {sorted.filter((b) => !['CheckedIn', 'Cancelled'].includes(b.status)).map((b) => {
            const d = due(b);
            const c = cta(b);
            const step = b.collectionProgress?.step;
            return (
              <div className="fleet-row" key={b.id}>
                <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                <div className="flex-grow-1">
                  <div className="dash-row-title">{b.vehicleName} <span className="text-muted">· {b.ref}</span></div>
                  <div className="dash-row-meta">
                    <span><i className="bi bi-box-arrow-up-right me-1" />Pick-up: <strong>{formatGuestDate(b.pickupDate)} {b.pickupTime}</strong></span>
                    <span><i className="bi bi-box-arrow-in-down me-1" />Return: <strong>{formatGuestDate(b.dropoffDate)} {b.dropoffTime}</strong></span>
                    <span>{formatPrice(b.estimatedTotal || 0)}</span>
                  </div>
                  <div className="dash-row-meta">
                    <span className={`fleet-badge ${d.kind === 'success' ? 'fleet-badge-SignedOff' : d.kind === 'warn' ? 'fleet-badge-Open' : d.kind === 'info' ? 'fleet-badge-InProgress' : 'fleet-badge-Cancelled'}`}>
                      {d.label}
                    </span>
                    {step && step !== 'prep' && (
                      <span className="fleet-badge category-badge"><i className="bi bi-arrow-repeat me-1" />{collectionStepLabel(step)}</span>
                    )}
                  </div>
                </div>
                {c && (
                  <Link to={c.to} className={`btn btn-sm ${c.cls}`}>
                    <i className={`bi ${c.icon} me-1`} />{c.label}
                  </Link>
                )}
              </div>
            );
          })}
          <div className="p-3 pt-2">
            <Link to="/Fleet/MyTrips" className="san-btn-secondary"><i className="bi bi-arrow-left me-1" />Back to my trips</Link>
          </div>
        </div>
      )}
    </div>
  );
}