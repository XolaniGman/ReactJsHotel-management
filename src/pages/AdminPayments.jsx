import { useEffect, useState } from 'react';
import { listPayments } from '../services/billService';
import { formatPrice, formatDateTime } from '../lib/utils';
import './admin.css';

const METHOD_TONE = {
  Cash: 'status-approved',
  Card: 'status-checkedin',
  EFT: 'status-pending',
  Stripe: 'status-approved',
  Online: 'status-checkedin',
};

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    listPayments().then(setPayments);
  }, []);

  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="admin-dash-bg">
      <div className="admin-dash">
        <div className="admin-top">
          <div>
            <div className="admin-kicker">Billing</div>
            <h1 className="admin-title"><i className="bi bi-credit-card me-2" />Payments</h1>
            <p className="meta-text mb-0">All payments received across the property.</p>
          </div>
          <div className="admin-date">Total received: {formatPrice(total)}</div>
        </div>

        <div className="admin-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th><th>Guest</th><th>Method</th><th>Amount</th><th>Recorded by</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-5">No payments recorded yet.</td></tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td><div className="guest-name">{p.reference}</div></td>
                      <td>{p.guestName}</td>
                      <td><span className={`status-pill ${METHOD_TONE[p.method] || 'status-default'}`}>{p.method}</span></td>
                      <td><strong>{formatPrice(p.amount)}</strong></td>
                      <td className="meta-text">{p.byName}</td>
                      <td className="meta-text">{formatDateTime(p.date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
