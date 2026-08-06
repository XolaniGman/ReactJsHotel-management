import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCheckInByReservation } from '../services/checkinService';
import { getReservation } from '../services/reservationService';
import { formatDateRange } from '../lib/utils';
import './guest.css';

export default function CheckInWelcome() {
  const [params] = useSearchParams();
  const [checkin, setCheckin] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = params.get('reservation');
    (async () => {
      if (!id) return;
      try {
        const res = await getReservation(id);
        setReservation(res);
        const ci = await getCheckInByReservation(id);
        setCheckin(ci);
      } catch {
        setError('Could not load your stay.');
      }
    })();
  }, [params]);

  return (
    <div className="dash-shell">
      <div className="dash-hero text-center py-5" style={{ background: 'linear-gradient(135deg,#172033,#2a3b5e)', color: '#fff', borderRadius: '0.75rem' }}>
        <i className="bi bi-stars" style={{ fontSize: '2rem' }} />
        <h1 className="mt-2 mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>Welcome to Grand Hotel</h1>
        <p className="mb-0 opacity-75">Your home by the coast — we hope you love every moment.</p>
      </div>

      {error && <div className="lost-alert lost-alert-danger mt-4">{error}</div>}

      <div className="row g-4 mt-4">
        <div className="col-lg-8">
          <div className="dash-panel h-100">
            <h2 className="dash-title">Your stay</h2>
            {checkin && reservation ? (
              <>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="border rounded-3 p-3">
                      <span className="text-muted small d-block">Room</span>
                      <strong className="fs-3">Room {checkin.roomNumber}</strong>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="border rounded-3 p-3">
                      <span className="text-muted small d-block">Dates</span>
                      <strong>{formatDateRange(reservation.checkIn, reservation.checkOut)}</strong>
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 mb-3" style={{ fontFamily: "'Noto Serif', serif", fontSize: '1.1rem' }}>Good to know</h3>
                <ul className="list-unstyled" style={{ lineHeight: 2 }}>
                  <li><i className="bi bi-wifi me-2 text-success" /> Wi-Fi: <strong>GrandHotel-{checkin.roomNumber}</strong> · password <strong>guest2026</strong></li>
                  <li><i className="bi bi-phone me-2 text-success" /> Mobile key: enabled via NFC on your phone</li>
                  <li><i className="bi bi-clock me-2 text-success" /> Breakfast served 06:30 – 10:30</li>
                  <li><i className="bi bi-door-closed me-2 text-success" /> Check-out by 11:00</li>
                </ul>
                <div className="d-flex gap-2 flex-wrap">
                  <Link to="/Amenities/Request" className="res-btn res-btn-success">Request a service</Link>
                  <Link to="/Maintenance/Request" className="res-btn res-btn-outline">Report a maintenance issue</Link>
                </div>
              </>
            ) : (
              <div className="dash-empty">
                <i className="bi bi-key" />
                <p>Enter your booking reference to see your stay details.</p>
                <a className="res-btn res-btn-success" href="/CheckIns/SelfCheckInWizard">Start check-in</a>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="dash-panel">
            <h2 className="dash-title">Need anything?</h2>
            <ul className="list-unstyled mb-0" style={{ lineHeight: 2 }}>
              <li><Link to="/Amenities/Request" className="text-decoration-none">Request towels or amenities</Link></li>
              <li><Link to="/Housekeeping" className="text-decoration-none">Schedule room cleaning</Link></li>
              <li><Link to="/Laundry" className="text-decoration-none">Send laundry</Link></li>
              <li><Link to="/LostItems/Report" className="text-decoration-none">Report a lost item</Link></li>
              <li><Link to="/Events" className="text-decoration-none">Browse hotel events</Link></li>
              <li><Link to="/Guest/Dashboard" className="text-decoration-none">My dashboard</Link></li>
            </ul>
          </div>
          <div className="dash-panel mt-4">
            <h2 className="dash-title">Concierge</h2>
            <p className="mb-1"><i className="bi bi-telephone me-2" /> 0 1000 2030</p>
            <p className="mb-0"><i className="bi bi-envelope me-2" /> concierge@grandhotel.co.za</p>
          </div>
        </div>
      </div>
    </div>
  );
}
