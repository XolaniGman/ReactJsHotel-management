import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listRooms } from '../services/roomService';
import { listAllReservations } from '../services/reservationService';
import { createReservation } from '../services/reservationService';
import { computeTotals } from '../services/billService';
import { formatPrice, todayISO, nightsBetween } from '../lib/utils';
import { BOOKING_CATEGORIES } from '../lib/constants';

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80';

const STEPS = ['Dates', 'Room', 'Add-ons', 'Details', 'Price', 'Review'];

const ADD_ONS = [
  { key: 'breakfast', name: 'Breakfast (per night)', unitPrice: 150, qty: 0 },
  { key: 'airport', name: 'Airport Transfer', unitPrice: 890, qty: 0 },
  { key: 'spa', name: 'Spa Voucher', unitPrice: 450, qty: 0 },
  { key: 'late', name: 'Late Checkout', unitPrice: 300, qty: 0 },
];

export default function ReservationCreate() {
  const { user } = useAuth();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loadingRooms] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomId, setRoomId] = useState(params.get('room') || '');
  const [addOns, setAddOns] = useState(ADD_ONS);
  const [category, setCategory] = useState('Individual');
  const [company, setCompany] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      const [r, res] = await Promise.all([listRooms(), listAllReservations()]);
      setRooms(r);
      setReservations(res);
    })();
  }, []);

  const availableRooms = useMemo(() => {
    if (!checkIn || !checkOut) return [];
    const overlap = (from, to) => from < checkOut && to > checkIn;
    const bookedIds = new Set(
      reservations
        .filter((r) => ['Pending', 'Approved', 'CheckedIn'].includes(r.status) && overlap(r.checkInDate, r.checkOutDate))
        .map((r) => r.roomId),
    );
    return rooms.filter((r) => r.status === 'Available' && !bookedIds.has(r.id));
  }, [rooms, reservations, checkIn, checkOut]);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const nights = useMemo(() => (checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0), [checkIn, checkOut]);

  const totals = useMemo(() => {
    const selected = addOns.filter((a) => a.qty > 0).map((a) => ({
      description: a.name,
      qty: a.key === 'breakfast' ? nights : 1,
      unitPrice: a.unitPrice,
      total: a.unitPrice * (a.key === 'breakfast' ? nights : 1),
    }));
    return computeTotals(selectedRoom?.price || 0, nights, selected, discount);
  }, [selectedRoom, nights, addOns, discount]);

  const selectedAddOns = addOns.filter((a) => a.qty > 0);

  const go = (next) => {
    setError('');
    if (step === 0) {
      if (!checkIn || !checkOut) return setError('Please select check-in and check-out dates.');
      if (nights <= 0) return setError('Check-out must be after check-in.');
    }
    if (step === 1 && !roomId) return setError('Please select a room.');
    if (step === 3 && category === 'Corporate' && !company.trim())
      return setError('Please enter your company name.');
    if (step === 4 && discount < 0) return setError('Discount cannot be negative.');
    setStep(next);
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const guestSurname = (user.name || '').trim().split(' ').pop() || '';
      const res = await createReservation({
        guestUid: user.uid,
        guestName: user.name,
        guestSurname,
        guestEmail: user.email,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.number,
        roomType: selectedRoom.type,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        category,
        company,
        basePrice: selectedRoom.price,
        addOns: selectedAddOns.map((a) => ({
          name: a.name,
          description: a.name,
          qty: a.key === 'breakfast' ? nights : 1,
          unitPrice: a.unitPrice,
          total: a.unitPrice * (a.key === 'breakfast' ? nights : 1),
        })),
        discount,
        notes,
      });
      setCreated(res);
    } catch (err) {
      setError(err.message || 'Could not create reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="book-page">
        <div className="book-card" style={{ maxWidth: 640, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
          <div className="book-kicker" style={{ background: '#eef8f1', color: '#2f7d4f' }}>
            <i className="bi bi-check-circle" /> Reservation submitted
          </div>
          <h1 className="res-title" style={{ fontSize: '2rem' }}>Request received</h1>
          <p className="book-subtitle" style={{ color: '#6d7483' }}>
            Your reservation <strong>{created.bookingRef}</strong> is <strong>Pending</strong>. Our
            team will confirm availability and approve your stay shortly.
          </p>
          <div className="book-summary" style={{ margin: '1.5rem 0' }}>
            <div className="book-summary-row"><span>Room</span><strong>Room {created.roomNumber} · {created.roomType}</strong></div>
            <div className="book-summary-row"><span>Dates</span><strong>{checkIn} → {checkOut} ({nights} night(s))</strong></div>
            <div className="book-summary-row"><span>Estimated total</span><strong>{formatPrice(created.total)}</strong></div>
          </div>
          <div className="d-flex justify-content-center gap-2 flex-wrap">
            <Link to={`/Reservations/Details/${created.id}`} className="res-btn res-btn-primary">View reservation</Link>
            <Link to="/Guest/Dashboard" className="res-btn res-btn-outline">My dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="book-page">
      <div className="book-hero">
        <div className="book-hero-inner">
          <span className="book-kicker"><i className="bi bi-calendar-heart" /> Book your stay</span>
          <h1 className="book-title">Reserve your room</h1>
          <p className="book-subtitle">
            Choose your dates, pick a room, add extras and submit your reservation. Payment is
            settled at checkout.
          </p>
        </div>
      </div>

      <div className="d-flex justify-content-center mb-4 flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`badge px-3 py-2 ${i <= step ? 'bg-dark text-white' : 'bg-light text-secondary border'}`}
            style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {error && <div className="book-alert"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      <div className="book-grid">
        <div className="book-card">
          <div className="book-card-header">
            <h2>{STEPS[step]}</h2>
          </div>
          <div className="book-card-body">
            {step === 0 && (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="book-label" htmlFor="CheckIn">Check-in date</label>
                  <input
                    type="date" id="CheckIn" className="form-control book-input"
                    min={todayISO()} value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="book-label" htmlFor="CheckOut">Check-out date</label>
                  <input
                    type="date" id="CheckOut" className="form-control book-input"
                    min={checkIn || todayISO()} value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                  />
                </div>
                <p className="text-muted small mt-2">
                  {nights > 0 ? `${nights} night(s) selected.` : 'Select both dates to continue.'}
                </p>
              </div>
            )}

            {step === 1 && (
              <>
                {loadingRooms ? (
                  <p>Loading rooms…</p>
                ) : availableRooms.length === 0 ? (
                  <div className="book-alert">No rooms are available for the selected dates.</div>
                ) : (
                  <div className="row g-3">
                    {availableRooms.map((r) => (
                      <div className="col-md-6" key={r.id}>
                        <div
                          className={`d-flex align-items-center gap-3 border rounded-3 p-3 ${roomId === r.id ? 'border-dark' : 'border-light'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setRoomId(r.id)}
                        >
                          <img src={r.image || DEFAULT_IMG} alt={r.name} style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                          <div className="flex-grow-1">
                            <strong>{r.name}</strong>
                            <div className="text-muted small">Room {r.number} · {r.type} · Sleeps {r.capacity}</div>
                            <div className="small text-warning fw-bold">{formatPrice(r.price)}/night</div>
                          </div>
                          <input type="radio" checked={roomId === r.id} onChange={() => setRoomId(r.id)} readOnly />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <div className="row g-3">
                {addOns.map((a) => (
                  <div className="col-md-6" key={a.key}>
                    <div className="d-flex justify-content-between align-items-center border rounded-3 p-3">
                      <div>
                        <strong>{a.name}</strong>
                        <div className="text-muted small">{formatPrice(a.unitPrice)}</div>
                      </div>
                      <input
                        type="number" min="0" max="20" className="form-control" style={{ width: 80 }}
                        value={a.qty} onChange={(e) => {
                          const q = Math.max(0, Number(e.target.value) || 0);
                          setAddOns(addOns.map((x) => (x.key === a.key ? { ...x, qty: q } : x)));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="book-label" htmlFor="Category">Booking category</label>
                  <select id="Category" className="form-select book-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {BOOKING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {category === 'Corporate' && (
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="Company">Company name</label>
                    <input id="Company" className="form-control book-input" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                )}
                <div className="col-md-6">
                  <label className="book-label" htmlFor="Discount">Discount (ZAR)</label>
                  <input id="Discount" type="number" min="0" className="form-control book-input" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div className="col-12">
                  <label className="book-label" htmlFor="Notes">Special requests</label>
                  <textarea id="Notes" className="form-control book-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && selectedRoom && (
              <div>
                <div className="book-summary-row"><span>Room ({selectedRoom.name})</span><strong>{formatPrice(selectedRoom.price)} × {nights}</strong></div>
                {selectedAddOns.map((a) => {
                  const q = a.key === 'breakfast' ? nights : 1;
                  return <div key={a.key} className="book-summary-row"><span>{a.name}</span><strong>{formatPrice(a.unitPrice * q)}</strong></div>;
                })}
                {discount > 0 && <div className="book-summary-row"><span>Discount</span><strong>−{formatPrice(discount)}</strong></div>}
                <div className="book-summary-row"><span>Subtotal</span><strong>{formatPrice(totals.subtotal)}</strong></div>
                <div className="book-summary-row"><span>VAT (15%)</span><strong>{formatPrice(totals.vat)}</strong></div>
                <div className="book-summary-row"><span>Tourism Levy (1%)</span><strong>{formatPrice(totals.levy)}</strong></div>
                <div className="book-summary-total">
                  <span>Estimated total</span>
                  <strong>{formatPrice(totals.total)}</strong>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <div className="book-alert book-alert--success">
                  <i className="bi bi-check2-circle me-2" /> Please review your reservation before submitting.
                </div>
                <div className="book-summary-row"><span>Room</span><strong>Room {selectedRoom.number} · {selectedRoom.name}</strong></div>
                <div className="book-summary-row"><span>Dates</span><strong>{checkIn} → {checkOut}</strong></div>
                <div className="book-summary-row"><span>Nights</span><strong>{nights}</strong></div>
                <div className="book-summary-row"><span>Category</span><strong>{category}{company ? ` · ${company}` : ''}</strong></div>
                <div className="book-summary-row"><span>Add-ons</span><strong>{selectedAddOns.length ? selectedAddOns.map((a) => a.name).join(', ') : 'None'}</strong></div>
                <div className="book-summary-row"><span>Total (incl. VAT & levy)</span><strong>{formatPrice(totals.total)}</strong></div>
                <div className="book-note mt-3">
                  <i className="bi bi-info-circle me-2" />
                  Submitting creates a <strong>Pending</strong> reservation. An admin will approve it before your arrival.
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between mt-4">
              {step > 0 ? (
                <button type="button" className="book-cancel" onClick={() => setStep(step - 1)}>
                  <i className="bi bi-arrow-left me-2" /> Back
                </button>
              ) : <span />}
              {step < STEPS.length - 1 ? (
                <button type="button" className="book-submit" style={{ width: 'auto', paddingInline: '2rem' }} onClick={() => go(step + 1)}>
                  Continue <i className="bi bi-arrow-right ms-2" />
                </button>
              ) : (
                <button type="button" className="book-submit" style={{ width: 'auto', paddingInline: '2rem' }} onClick={submit} disabled={submitting}>
                  <i className="bi bi-send me-2" /> {submitting ? 'Submitting…' : 'Submit reservation'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="book-summary">
          <div className="book-summary-header"><h2>Your stay</h2></div>
          <div className="book-summary-body">
            {selectedRoom && (
              <div className="book-room-preview" style={{ backgroundImage: `url(${selectedRoom.image || DEFAULT_IMG})` }}>
                <div>
                  <small>Room {selectedRoom.number}</small>
                  <h3>{selectedRoom.name}</h3>
                </div>
              </div>
            )}
            <div className="book-summary-row"><span>Check-in</span><strong>{checkIn || '—'}</strong></div>
            <div className="book-summary-row"><span>Check-out</span><strong>{checkOut || '—'}</strong></div>
            <div className="book-summary-row"><span>Nights</span><strong>{nights || '—'}</strong></div>
            <div className="book-summary-total">
              <span>Total</span>
              <strong>{formatPrice(totals.total)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
