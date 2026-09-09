import { useState } from 'react';
import { formatPrice } from '../lib/utils';
import './StripeCheckoutModal.css';

const formatCardNumber = (v) =>
  v.replace(/[^\d]/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (v) => {
  const digits = v.replace(/[^\d]/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

// Simulated Stripe Checkout — this project has no backend to hold a Stripe
// secret key, so no real charge is made. `onConfirm` performs the actual
// booking-payment write once the fake card form "succeeds".
export default function StripeCheckoutModal({ amount, description, onCancel, onDone, onConfirm }) {
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/29');
  const [cvc, setCvc] = useState('123');
  const [stage, setStage] = useState('form');
  const [error, setError] = useState('');

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    if (!cardName.trim()) return setError('Enter the name on the card.');
    if (cardNumber.replace(/\s/g, '').length < 12) return setError('Enter a valid card number.');
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError('Enter the expiry as MM/YY.');
    if (cvc.length < 3) return setError('Enter a valid CVC.');

    setStage('processing');
    await new Promise((r) => setTimeout(r, 1400));
    try {
      await onConfirm();
      setStage('done');
      setTimeout(() => onDone?.(), 1100);
    } catch (err) {
      setStage('form');
      setError(err?.message || 'Payment failed. Please try again.');
    }
  };

  return (
    <div className="stripe-modal-backdrop">
      <div className="stripe-modal">
        <div className="stripe-modal-header">
          <div className="stripe-brand">
            <i className="bi bi-lock-fill" /> Secure Checkout
          </div>
          {stage === 'form' && (
            <button type="button" className="stripe-modal-close" onClick={onCancel} aria-label="Close">
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        <div className="stripe-modal-amount">
          <span>Amount due</span>
          <strong>{formatPrice(amount)}</strong>
          {description && <span className="stripe-modal-desc">{description}</span>}
        </div>

        {stage === 'processing' && (
          <div className="stripe-modal-stage">
            <div className="stripe-spinner" />
            <p>Processing your payment…</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="stripe-modal-stage">
            <div className="stripe-check"><i className="bi bi-check-lg" /></div>
            <p>Payment successful</p>
          </div>
        )}

        {stage === 'form' && (
          <form onSubmit={pay} className="stripe-modal-form">
            {error && <div className="stripe-modal-error"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
            <div className="mb-3">
              <label className="book-label" htmlFor="StripeCardName">Name on card</label>
              <input id="StripeCardName" className="form-control book-input" placeholder="Full name" value={cardName} onChange={(e) => setCardName(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="book-label" htmlFor="StripeCardNumber">Card number</label>
              <input id="StripeCardNumber" className="form-control book-input" placeholder="1234 1234 1234 1234" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} />
            </div>
            <div className="row g-3 mb-1">
              <div className="col-6">
                <label className="book-label" htmlFor="StripeExpiry">Expiry</label>
                <input id="StripeExpiry" className="form-control book-input" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} />
              </div>
              <div className="col-6">
                <label className="book-label" htmlFor="StripeCvc">CVC</label>
                <input id="StripeCvc" className="form-control book-input" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} />
              </div>
            </div>
            <button type="submit" className="stripe-pay-btn mt-3">
              <i className="bi bi-lock-fill me-2" />Pay {formatPrice(amount)}
            </button>
            <p className="stripe-modal-footnote">
              <i className="bi bi-info-circle me-1" />Demo checkout — no real card is charged.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
