import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findByBookingRef } from '../services/reservationService';
import { allocateRoomForBooking } from '../services/checkinService';
import { todayISO, formatGuestDate } from '../lib/utils';
import './guest.css';

export default function Kiosk() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [surname, setSurname] = useState('');
  const [idDocType, setIdDocType] = useState('ID');
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [result, setResult] = useState(null);

  const verify = async () => {
    setError('');
    let res;
    try {
      res = await findByBookingRef(bookingRef);
    } catch {
      return setError('Could not look up that booking. Please check the reference and try again.');
    }
    if (!res) return setError('No booking found with that reference.');

    const today = todayISO();
    if (res.checkInDate && today < res.checkInDate) {
      return setError(`This booking is not due for check-in until ${formatGuestDate(res.checkInDate)}. Please return on your check-in date.`);
    }
    if (res.checkOutDate && today >= res.checkOutDate) {
      return setError('The stay for this booking has ended. Please contact reception if you need assistance.');
    }

    if (surname.trim().toLowerCase() !== (res.guestSurname || '').toLowerCase())
      return setError('Surname does not match this booking.');
    if (res.status !== 'Approved')
      return setError(`This booking is ${res.status}. Only approved bookings can check in.`);
    setStep(1);
  };

  const allocate = async () => {
    setError('');
    if (!idNumber.trim()) return setError('Please enter your ID / passport number.');
    if (!dateOfBirth) return setError('Please enter your date of birth.');
    let res;
    try {
      res = await allocateRoomForBooking(null, 'kiosk', {
        idDocType,
        idNumber,
        dateOfBirth,
        reservationId: bookingRef,
      });
    } catch {
      return setError('Something went wrong while checking you in. Please try again.');
    }
    if (res?.error) return setError(res.error);
    setResult(res);
    setStep(2);
  };

  const reset = () => {
    setStep(0); setError(''); setBookingRef(''); setSurname(''); setIdNumber(''); setDateOfBirth(''); setResult(null);
  };

  if (step === 2 && result) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#101d16,#1d3325)', padding: '2rem' }}>
        <div className="clean-form" style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3.4rem' }} />
          <h1 className="lost-title mt-3">Check-in complete!</h1>
          <p className="text-muted">Welcome, {result.reservation.guestName || 'guest'}. Your key is ready.</p>
          <div className="text-start border rounded-3 p-4 bg-white mt-3">
            <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Room</span><strong>Room {result.room.number}</strong></div>
            <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Wi-Fi</span><strong>GrandHotel-{result.room.number} / guest2026</strong></div>
            <div className="d-flex justify-content-between py-2 border-bottom"><span className="text-muted">Check-out</span><strong>11:00</strong></div>
            <div className="d-flex justify-content-between py-2"><span className="text-muted">Mobile key</span><strong className="text-success">Ready via NFC</strong></div>
          </div>
          <div className="d-flex gap-2 justify-content-center mt-4">
            <button type="button" className="book-cancel" onClick={reset}>New guest</button>
            <Link to="/CheckIns/CheckInWelcome" className="res-btn res-btn-success">Open guest app</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#101d16,#1d3325)', padding: '2rem' }}>
      <div className="clean-form" style={{ maxWidth: 520, width: '100%' }}>
        <div className="text-center mb-4">
          <i className="bi bi-building" style={{ fontSize: '2.4rem', color: '#e0c27b' }} />
          <h1 className="lost-title mt-2">Grand Hotel</h1>
          <p className="text-muted">Self-service check-in kiosk</p>
        </div>

        {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

        {step === 0 && (
          <>
            <label className="clean-label" htmlFor="KRef">Booking reference</label>
            <input id="KRef" className="form-control clean-input" placeholder="GH-XXXX-123" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
            <label className="clean-label mt-3" htmlFor="KSurname">Surname</label>
            <input id="KSurname" className="form-control clean-input" value={surname} onChange={(e) => setSurname(e.target.value)} />
            <button type="button" className="book-submit mt-4 w-100" onClick={verify}>Continue</button>
          </>
        )}

        {step === 1 && (
          <>
            <label className="clean-label" htmlFor="KDoc">ID document</label>
            <select id="KDoc" className="form-select clean-input" value={idDocType} onChange={(e) => setIdDocType(e.target.value)}>
              <option>ID</option><option>Passport</option><option>Driver&apos;s licence</option>
            </select>
            <label className="clean-label mt-3" htmlFor="KId">ID / Passport number</label>
            <input id="KId" className="form-control clean-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            <label className="clean-label mt-3" htmlFor="KDob">Date of birth</label>
            <input id="KDob" type="date" className="form-control clean-input" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            <div className="d-flex justify-content-between mt-4">
              <button type="button" className="book-cancel" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="book-submit" onClick={allocate}>Check me in</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
