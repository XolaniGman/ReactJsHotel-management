import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBill, recordPayment, listPayments } from '../services/billService';
import { checkout } from '../services/checkinService';
import { getReservation } from '../services/reservationService';
import { formatPrice, formatGuestDate, formatDateTime } from '../lib/utils';
import { PAYMENT_METHODS } from '../lib/constants';
import './guest.css';

export default function Invoice() {
  const { id } = useParams();
  const { user } = useAuth();
  const [bill, setBill] = useState(null);
  const [res, setRes] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [method, setMethod] = useState('Card');
  const [amount, setAmount] = useState(0);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const b = await getBill(id);
    setBill(b);
    if (b?.reservationId) setRes(await getReservation(b.reservationId));
    const all = await listPayments();
    setPayments(all.filter((p) => p.billId === id));
    setAmount(b?.balanceDue || 0);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-center text-muted py-5">Loading bill…</p>;
  if (!bill) return <div className="inv-page"><div className="inv-card">Bill not found.</div></div>;

  const paid = (bill.status || '').toLowerCase() === 'paid';

  const pay = async () => {
    setError('');
    if (!amount || amount <= 0) return setError('Enter a payment amount.');
    if (amount > bill.balanceDue) return setError('Amount exceeds the balance due.');
    setPaying(true);
    try {
      await recordPayment({
        billId: bill.id,
        method,
        amount: Number(amount),
        byName: user?.name,
      });
      setSuccess('Payment recorded successfully.');
      load();
    } catch (err) {
      setError(err.message || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  const doCheckout = async () => {
    if (!window.confirm('Check out and finalize this bill?')) return;
    await checkout(res.id, { byName: user?.name });
    setSuccess('Checked out successfully.');
    load();
  };

  return (
    <div className="inv-page">
      <div className="inv-card">
        <div className="inv-header">
          <div>
            <p className="inv-label">Invoice</p>
            <h1 className="inv-title">Stay Statement</h1>
            <p className="inv-subtitle">Issued {formatDateTime(bill.createdAt)} · Reference {bill.id?.slice(0, 8).toUpperCase()}</p>
          </div>
          <span className={`inv-status ${paid ? 'inv-status--paid' : 'inv-status--unpaid'}`}>
            {paid ? 'Paid' : `Balance due ${formatPrice(bill.balanceDue)}`}
          </span>
        </div>

        <div className="inv-rule" />

        <div className="inv-party-grid">
          <div className="inv-party">
            <h2>Guest</h2>
            <p>{bill.guestName}</p>
          </div>
          <div className="inv-party">
            <h2>Grand Hotel</h2>
            <p>Coastal Road · Guest Relations: frontdesk@grandhotel.test</p>
          </div>
        </div>

        <div className="inv-rule" />

        <div className="inv-booking">
          <div className="inv-booking-icon"><i className="bi bi-door-open" /></div>
          <div style={{ width: '100%' }}>
            <h2 className="inv-booking-title">Room {bill.roomNumber} · {bill.roomType}</h2>
            <div className="inv-booking-grid">
              <div className="inv-field"><span>Check-in</span><strong>{formatGuestDate(bill.checkIn)}</strong></div>
              <div className="inv-field"><span>Check-out</span><strong>{formatGuestDate(bill.checkOut)}</strong></div>
              <div className="inv-field"><span>Nights</span><strong>{bill.nights}</strong></div>
              <div className="inv-field"><span>Total</span><strong>{formatPrice(bill.total)}</strong></div>
            </div>
          </div>
        </div>

        <div className="inv-rule" />

        <table className="inv-table">
          <thead>
            <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {(bill.lineItems || []).map((li, i) => (
              <tr key={i}>
                <td className="inv-line-title">{li.description}</td>
                <td>{li.qty}</td>
                <td>{formatPrice(li.unitPrice)}</td>
                <td className="inv-amount" style={{ textAlign: 'right' }}>{formatPrice(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-rule" />

        <div className="inv-footer-grid">
          <div>
            {payments.length > 0 && (
              <details className="inv-history">
                <summary>Payment history ({payments.length})</summary>
                <table className="inv-table inv-history-table">
                  <thead>
                    <tr><th>Date</th><th>Method</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDateTime(p.date)}</td>
                        <td><span className={`inv-chip ${method ? 'inv-chip--success' : 'inv-chip--muted'}`}>{p.method}</span></td>
                        <td>{p.reference}</td>
                        <td style={{ textAlign: 'right' }} className="inv-amount">{formatPrice(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            {!paid && (
              <div className="inv-payment-form">
                <h3 className="res-label">Make a payment</h3>
                {error && <div className="lux-alert">{error}</div>}
                {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}
                <div className="inv-payment-form-grid">
                  <div>
                    <label className="res-label" htmlFor="Method">Method</label>
                    <select id="Method" className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="res-label" htmlFor="Amount">Amount</label>
                    <input id="Amount" type="number" min="0" max={bill.balanceDue} className="form-control" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                  </div>
                </div>
                <button type="button" className="inv-pay-btn mt-3" onClick={pay} disabled={paying}>
                  <i className="bi bi-credit-card me-2" /> {paying ? 'Processing…' : `Pay ${formatPrice(amount)}`}
                </button>
                <p className="text-muted small mt-2 mb-0">
                  {method === 'Stripe' ? 'You will be redirected to a secure Stripe checkout.' : `Payment via ${method} is recorded on this bill.`}
                </p>
              </div>
            )}
          </div>

          <div className="inv-summary">
            <div className="inv-summary-row"><span>Subtotal</span><strong>{formatPrice(bill.subtotal)}</strong></div>
            <div className="inv-summary-row"><span>VAT (15%)</span><strong>{formatPrice(bill.vat)}</strong></div>
            <div className="inv-summary-row"><span>Tourism Levy (1%)</span><strong>{formatPrice(bill.levy)}</strong></div>
            <div className="inv-summary-row"><span>Paid</span><strong>{formatPrice(bill.paidAmount)}</strong></div>
            <div className="inv-summary-total">
              <span>Balance due</span>
              <strong>{formatPrice(bill.balanceDue)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="inv-actions">
        {res?.status === 'CheckedIn' && (
          <button type="button" className="inv-action inv-action--primary" onClick={doCheckout}>
            <i className="bi bi-box-arrow-right" /> Check Out &amp; Finalize
          </button>
        )}
        <Link to={`/Reservations/Details/${res?.id}`} className="inv-action inv-action--outline">
          <i className="bi bi-arrow-left" /> Back to reservation
        </Link>
        <button type="button" className="inv-action inv-action--muted" onClick={() => window.print()}>
          <i className="bi bi-printer" /> Print
        </button>
      </div>
    </div>
  );
}
