import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listCarBookings,
  listCarServices,
  listVehicleHandovers,
  reviewPendingCharge,
  recordBookingPayment,
  recordServicePayment,
  bookingDisplay,
} from '../services/fleetService';
import { formatPrice, formatGuestDate } from '../lib/utils';
import './maintenance.css';
import './housekeeping.css';
import './guest.css';
import './fleet.css';

export default function FleetCharges() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [payments, setPayments] = useState({});
  const [disputeNote, setDisputeNote] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const isManager = ['fleetmanager', 'admin', 'system'].includes(user?.role);

  const load = async () => {
    const [b, s, h] = await Promise.all([listCarBookings(), listCarServices(), listVehicleHandovers()]);
    setBookings(b);
    setServices(s);
    setHandovers(h);
  };

  useEffect(() => { load(); }, []);

  const billable = bookings.filter((b) => ['Confirmed', 'CheckedOut', 'PendingInspection', 'CheckedIn'].includes(b.status));
  const completedServices = services.filter((s) => s.status === 'Completed');

  const bookingBalance = (booking) => Math.max(
    0,
    Number(booking.estimatedTotal || 0) + Number(booking.finalCharges || 0) - Number(booking.paidAmount || 0),
  );

  const serviceBalance = (service) => Math.max(
    0,
    Number(service.confirmedBookingAmount || service.estimatedFare || 0) - Number(service.paidAmount || 0),
  );

  useEffect(() => {
    setPayments((current) => {
      const next = { ...current };
      bookings.filter((booking) => ['Confirmed', 'CheckedOut', 'PendingInspection', 'CheckedIn'].includes(booking.status)).forEach((booking) => {
        if (next[booking.id] === undefined || next[booking.id] === '') next[booking.id] = bookingBalance(booking) || '';
      });
      services.filter((service) => service.status === 'Completed').forEach((service) => {
        const key = `svc-${service.id}`;
        if (next[key] === undefined || next[key] === '') next[key] = serviceBalance(service) || '';
      });
      return next;
    });
  }, [bookings, services]);

  const reviewCharge = async (booking, item, action) => {
    const result = await reviewPendingCharge(booking.id, item.id, {
      action,
      by: user.name,
      note: action === 'dispute' ? disputeNote[item.id] : '',
    });
    setError('');
    if (result?.error) return setError(result.error);
    setNotice(action === 'accept' ? `Charge accepted & posted: ${item.description}.` : `Charge disputed and held: ${item.description}.`);
    await load();
  };

  const recordPay = async (item, kind) => {
    const key = kind === 'booking' ? item.id : `svc-${item.id}`;
    const amount = Number(payments[key]);
    if (!amount || amount <= 0) return setError('Enter a payment amount.');
    const balance = kind === 'booking' ? bookingBalance(item) : serviceBalance(item);
    if (amount > balance) return setError(`Payment cannot exceed the outstanding balance of ${formatPrice(balance)}.`);
    if (kind === 'booking') {
      await recordBookingPayment(item.id, { amount, byName: `${user.name} (${bookingDisplay(item.status)})` });
    } else {
      await recordServicePayment(item.id, { amount, byName: `${user.name} (Trip fare)` });
    }
    setPayments((current) => ({ ...current, [key]: '' }));
    setError('');
    setNotice(`Payment of ${formatPrice(amount)} recorded against ${item.ref}.`);
    await load();
  };


  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Billing · Fleet</div>
            <h1 className="maint-title">Calculate Rental &amp; Service Charges</h1>
          </div>
          <div className="d-flex gap-2">
            <Link to="/Fleet/Dashboard" className="btn-log" style={{ background: '#355f8c' }}><i className="bi bi-arrow-left me-2" />Fleet Ops</Link>
            {isManager && (
              <Link to="/Fleet/Manager" className="btn-log" style={{ background: '#2f7d4f' }}><i className="bi bi-graph-up me-2" />Reports</Link>
            )}
          </div>
        </div>

        {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}

        <div className="panel-card mb-4">
          <div className="panel-header">
            <h2><i className="bi bi-car-front me-2" />Rental bookings</h2>
            <span className="panel-actions">{billable.length} billable</span>
          </div>
          <div className="table-responsive">
            <table className="task-table">
              <thead>
                <tr><th>Booking</th><th>Guest / vehicle</th><th>Est. total</th><th>Itemized charges</th><th>Record payment</th></tr>
              </thead>
              <tbody>
                {billable.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-5 text-muted">No rentals ready to bill.</td></tr>
                ) : (
                  billable.map((b) => {
                    const pendingCharges = b.pendingCharges || [];
                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="task-name">{b.ref}</div>
                          <div className="task-sub">{formatGuestDate(b.pickupDate)} → {formatGuestDate(b.dropoffDate)}</div>
                        </td>
                        <td>
                          <div className="task-name">{b.guestName}</div>
                          <div className="task-sub">{b.vehicleName} · {b.unitNumber}</div>
                        </td>
                        <td>
                          <div className="task-name">{formatPrice(b.estimatedTotal)}</div>
                          <div className="task-sub">Final charges: {formatPrice(b.finalCharges || 0)}</div>
                          <div className="fleet-auto-balance">Balance: {formatPrice(bookingBalance(b))}</div>
                        </td>
                        <td style={{ minWidth: 280 }}>
                          {pendingCharges.length === 0 ? (
                            <span className="task-sub text-success"><i className="bi bi-check-circle me-1" />No items held</span>
                          ) : (
                            pendingCharges.map((item) => (
                              <div className="fleet-charge-item" key={item.id}>
                                <div className="flex-grow-1">
                                  <div className="task-sub">{item.description}</div>
                                  <strong>{formatPrice(item.amount)}</strong>{' '}
                                  <span className={`fleet-charge-status ${item.status}`}>{item.status}</span>
                                  {item.status === 'Held' && (
                                    <input
                                      type="text"
                                      className="form-control form-control-sm mt-1"
                                      placeholder="Dispute note (optional)"
                                      value={disputeNote[item.id] || ''}
                                      onChange={(e) => setDisputeNote({ ...disputeNote, [item.id]: e.target.value })}
                                    />
                                  )}
                                </div>
                                {item.status === 'Held' && (
                                  <div className="d-flex gap-1">
                                    <button type="button" className="btn btn-sm btn-success" onClick={() => reviewCharge(b, item, 'accept')}>Accept</button>
                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => reviewCharge(b, item, 'dispute')}>Dispute</button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <input type="number" min="0" className="form-control form-control-sm" style={{ width: 100 }} placeholder="Auto" value={payments[b.id] || ''} onChange={(e) => setPayments({ ...payments, [b.id]: e.target.value })} />
                            <button type="button" className="btn-request-complete btn-request-done" onClick={() => recordPay(b, 'booking')}>Record</button>
                          </div>
                          <div className="fleet-auto-note"><i className="bi bi-stars me-1" />Auto-calculated from rental, approved charges and payments</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h2><i className="bi bi-taxi-front me-2" />Completed shuttle trips</h2>
            <span className="panel-actions">{completedServices.length} trips</span>
          </div>
          <div className="table-responsive">
            <table className="task-table">
              <thead>
                <tr><th>Trip</th><th>Guest</th><th>Driver</th><th>Fare</th><th>Record payment</th></tr>
              </thead>
              <tbody>
                {completedServices.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-5 text-muted">No completed trips to bill.</td></tr>
                ) : (
                  completedServices.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="task-name">{s.ref}</div>
                        <div className="task-sub">{s.pickupLocation} → {s.destination}</div>
                      </td>
                      <td className="task-name">{s.guestName}</td>
                      <td className="task-name">{s.driverName || '—'}</td>
                      <td>
                        <div className="task-name">{formatPrice(s.confirmedBookingAmount || s.estimatedFare)}</div>
                        <div className="fleet-auto-balance">Balance: {formatPrice(serviceBalance(s))}</div>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <input type="number" min="0" className="form-control form-control-sm" style={{ width: 100 }} placeholder="Auto" value={payments[`svc-${s.id}`] || ''} onChange={(e) => setPayments({ ...payments, [`svc-${s.id}`]: e.target.value })} />
                          <button type="button" className="btn-request-complete btn-request-done" onClick={() => recordPay(s, 'service')}>Record</button>
                        </div>
                        <div className="fleet-auto-note"><i className="bi bi-stars me-1" />Auto-calculated balance</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-muted small mt-3">
          <i className="bi bi-info-circle me-1" />Charges posted to a folio appear on the guest’s bill automatically. Handover variance reports are generated from check-out vs check-in records.
          {handovers.length === 0 && ' No handover records have been captured yet.'}
        </div>
      </div>
    </div>
  );
}