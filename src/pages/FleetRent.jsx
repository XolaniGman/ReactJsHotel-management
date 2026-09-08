import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFleetVehicle, computeRentalQuote, createCarBooking, listFleetVehicles } from '../services/fleetService';
import { listUserReservations } from '../services/reservationService';
import { scanLicence } from '../services/ocr';
import { smartMatchVehicles } from '../lib/fleetAlgo';
import { formatPrice, todayISO, addDaysISO, nightsBetween, formatGuestDate } from '../lib/utils';
import { CAR_RENTAL_ADDONS } from '../lib/constants';
import './guest.css';
import './rooms.css';
import './fleet.css';

export default function FleetRent() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [pickupDate, setPickupDate] = useState(searchParams.get('pickup') || todayISO());
  const [dropoffDate, setDropoffDate] = useState(searchParams.get('dropoff') || addDaysISO(todayISO(), 1));
  const [pickupTime, setPickupTime] = useState('10:00');
  const [dropoffTime, setDropoffTime] = useState('10:00');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const fileInputRef = useRef(null);

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  useEffect(() => {
    (async () => {
      const vid = searchParams.get('vehicle');
      if (vid) setVehicle(await getFleetVehicle(vid));
      setFleet(await listFleetVehicles());
      if (user?.uid) setReservations(await listUserReservations(user.uid));
    })();
  }, [searchParams, user?.uid]);

  const toggleAddon = (name) =>
    setSelectedAddons((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const addOns = useMemo(
    () => CAR_RENTAL_ADDONS.filter((a) => selectedAddons.includes(a.name)),
    [selectedAddons],
  );

  const days = Math.max(1, nightsBetween(pickupDate, dropoffDate) || 1);

  const quote = useMemo(
    () => (vehicle ? computeRentalQuote({ vehicle, pickupDate, dropoffDate, addOns }) : null),
    [vehicle, pickupDate, dropoffDate, addOns],
  );

  const rankedFleet = useMemo(
    () => (fleet.length ? smartMatchVehicles(fleet, { tripType: 'Local Trip', partySize: 2 }) : []),
    [fleet],
  );
  const topPicks = useMemo(() => new Set(rankedFleet.slice(0, 3).map((r) => r.vehicle.id)), [rankedFleet]);

  const onScanFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScannerBusy(true);
    setScanNote('');
    const result = await scanLicence(file);
    setScannerBusy(false);
    if (result?.error || !result?.confidence) {
      setScanNote('Could not read the licence — please type the details manually.');
      return;
    }
    if (result.licenseNumber) setLicenseNumber(result.licenseNumber);
    if (result.licenseExpiry) setLicenseExpiry(result.licenseExpiry);
    setScanNote(`Read at ${Math.round(result.confidence * 100)}% confidence${result.licenseExpiry ? '' : ' — enter the expiry date manually'}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!vehicle) return setError('No vehicle selected.');
    if (!licenseNumber.trim()) return setError('Driver’s licence number is required.');
    if (!licenseExpiry) return setError('Driver’s licence expiry date is required.');
    if (new Date(`${licenseExpiry}T23:59:59`) < new Date()) return setError('That licence has expired. Please provide a valid licence.');
    if (!terms) return setError('Please accept the rental terms and conditions.');
    setSubmitting(true);
    const result = await createCarBooking({
      guestUid: user.uid,
      guestName: user.name,
      vehicleId: vehicle.id,
      pickupDate,
      pickupTime,
      dropoffDate,
      dropoffTime,
      licenseNumber,
      licenseExpiry,
      addOns,
      reservationId: reservationId || activeRes?.id || '',
      notes,
    });
    setSubmitting(false);
    if (result?.error) return setError(result.error);
    setSuccess(
      'Your rental request has been submitted with status “Pending Confirmation”. Our front desk will confirm your vehicle shortly.',
    );
  };

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Car Rental</div>
          <h1 className="lost-title">Request a car rental booking</h1>
          <p className="lost-copy">
            Choose your rental window, add optional extras and submit your request. Our team will
            confirm your vehicle unit shortly after a quick licence check.
          </p>
        </div>
        <Link to="/Fleet/Vehicles" className="san-btn-secondary">
          <i className="bi bi-arrow-left me-2" /> Back to fleet
        </Link>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && (
        <div className="lost-alert lost-alert-success">
          <i className="bi bi-check-circle me-2" />{success}{' '}
          <Link to="/Fleet/MyTrips" className="fw-bold text-decoration-none">View my bookings →</Link>
        </div>
      )}

      {!vehicle ? (
        <div>
          <div className="dash-empty" style={{ marginBottom: '1.25rem' }}>
            <i className="bi bi-car-front me-2" />Choose a vehicle below to start your rental request — or{' '}
            <Link to="/Fleet/Vehicles" className="text-decoration-none">browse the full fleet</Link>.
          </div>
          {fleet.length === 0 ? (
            <div className="dash-empty">No vehicles available at the moment.</div>
          ) : (
            <div className="san-room-grid">
              {rankedFleet.map(({ vehicle: v, score, reasons }) => {
                const busy = v.status !== 'Available';
                return (
                  <article key={v.id} className={`san-room-card ${busy ? 'is-muted' : ''}`}>
                    <div className="san-room-image">
                      <img src={v.image} alt={v.name} loading="lazy" />
                      <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>
                      <span className="fleet-badge category-badge">{v.category || v.type}</span>
                      {topPicks.has(v.id) && <span className="fleet-badge category-badge" style={{ background: '#2f7d4f', color: '#fff' }}>★ Recommended</span>}
                    </div>
                    <div className="san-room-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="san-room-meta">
                          <span>{v.type} · {v.transmission} · {v.year}</span>
                          <strong>{v.unitNumber || v.plateNumber || v.name}</strong>
                        </div>
                        <span className="match-score" title={reasons.join(' · ')}>{score}% match</span>
                      </div>
                      <h3>{v.name}</h3>
                      <p className="san-room-copy">{v.description}</p>
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <span className="vehicle-spec"><i className="bi bi-people" />{v.capacity} seats</span>
                        <span className="vehicle-spec"><i className="bi bi-fuel-pump" />{v.fuelType}</span>
                        <span className="vehicle-spec"><i className="bi bi-cash-coin" />{formatPrice(v.pricePerDay)}/day</span>
                      </div>
                      <div className="san-room-price">
                        {formatPrice(v.pricePerDay)} <small>/ day</small>
                      </div>
                      <div className="san-room-actions">
                        <button
                          type="button"
                          className={busy ? 'san-btn-secondary' : 'san-btn-primary'}
                          disabled={busy}
                          onClick={() => setVehicle(v)}
                        >
                          <i className="bi bi-plus-circle me-1" /> Select &amp; continue
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="fleet-form-section mb-4">
                <h3><i className="bi bi-calendar-range me-2" />Rental window</h3>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="PickupDate">Pick-up date</label>
                    <input id="PickupDate" type="date" className="form-control book-input" min={todayISO()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="PickupTime">Pick-up time</label>
                    <input id="PickupTime" type="time" className="form-control book-input" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="DropoffDate">Drop-off date</label>
                    <input id="DropoffDate" type="date" className="form-control book-input" min={pickupDate} value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="DropoffTime">Drop-off time</label>
                    <input id="DropoffTime" type="time" className="form-control book-input" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="fleet-form-section mb-4">
                <h3><i className="bi bi-credit-card-2-front me-2" />Driver verification</h3>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="LicenseNo">Licence / ID number</label>
                    <input id="LicenseNo" className="form-control book-input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="e.g. ZA-7782411" />
                  </div>
                  <div className="col-md-6">
                    <label className="book-label" htmlFor="LicenseExpiry">Licence expiry</label>
                    <input id="LicenseExpiry" type="date" className="form-control book-input" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
                  </div>
                  <div className="col-12">
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                      <button type="button" className="btn-log" style={{ background: '#355f8c', padding: '0.5rem 1rem' }} disabled={scannerBusy} onClick={() => fileInputRef.current?.click()}>
                        <i className={`bi ${scannerBusy ? 'bi-arrow-repeat spin' : 'bi-upc-scan'} me-1`} />
                        {scannerBusy ? 'Reading licence…' : 'Scan licence'}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={onScanFile} />
                      {scanNote && <span className="task-sub text-primary">{scanNote}</span>}
                    </div>
                    <div className="text-muted small mt-1">
                      <i className="bi bi-info-circle me-1" />OCR runs locally in your browser via Tesseract.js — the photo is never uploaded.
                    </div>
                  </div>
                </div>
                {reservations.length > 0 && (
                  <div className="mt-3">
                    <label className="book-label" htmlFor="Folio">Link to stay (for folio billing)</label>
                    <select id="Folio" className="form-select book-input" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
                      <option value="">No stay — pay separately</option>
                      {reservations.filter((r) => ['Approved', 'CheckedIn'].includes(r.status)).map((r) => (
                        <option key={r.id} value={r.id}>Room {r.roomNumber} · {formatGuestDate(r.checkInDate)} → {formatGuestDate(r.checkOutDate)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="fleet-form-section mb-4">
                <h3><i className="bi bi-plus-circle me-2" />Add-ons</h3>
                <div className="row g-2">
                  {CAR_RENTAL_ADDONS.map((a) => (
                    <div className="col-md-6" key={a.name}>
                      <label className="d-flex justify-content-between align-items-center border rounded-3 p-3">
                        <div>
                          <strong>{a.name}</strong>
                          <div className="text-muted small">{formatPrice(a.price)} / rental</div>
                        </div>
                        <input type="checkbox" className="form-check-input" checked={selectedAddons.includes(a.name)} onChange={() => toggleAddon(a.name)} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="fleet-quote-box mb-4">
                <div className="d-flex gap-3 align-items-center mb-3">
                  <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                  <div>
                    <div className="fw-bold">{vehicle.name}</div>
                    <div className="text-muted small">{vehicle.type} · {vehicle.transmission} · {vehicle.capacity} seats</div>
                    <div className="text-muted small">{vehicle.unitNumber || vehicle.plateNumber}</div>
                    <button type="button" className="badge bg-light text-dark border mt-1" style={{ fontSize: '0.68rem' }} onClick={() => setVehicle(null)}>
                      <i className="bi bi-arrow-left me-1" />Change vehicle
                    </button>
                  </div>
                </div>
                <div className="fleet-quote-row"><span className="text-muted">Daily rate</span><strong>{formatPrice(vehicle.pricePerDay)}</strong></div>
                <div className="fleet-quote-row mt-2">
                  <span className="text-muted">Dynamic rate ×{quote?.rateFactor}</span>
                  <strong>{formatPrice(quote?.adjustedDaily)}/day</strong>
                </div>
                {quote?.dynamicReasons?.length > 0 && (
                  <div className="text-muted small mt-1" style={{ fontSize: '0.72rem' }}>{quote.dynamicReasons.join(' · ')}</div>
                )}
                <div className="fleet-quote-row mt-2"><span className="text-muted">{days} day{days > 1 ? 's' : ''} × rate</span><strong>{formatPrice(quote?.base)}</strong></div>
                <div className="fleet-quote-row mt-2"><span className="text-muted">Add-ons ({addOns.length})</span><strong>{formatPrice(quote?.addOnTotal)}</strong></div>
                <div className="fleet-quote-row mt-2"><span className="text-muted">Refundable deposit</span><strong>{formatPrice(quote?.deposit)}</strong></div>
                <div className="fleet-quote-total">
                  <span>Estimated total (incl. deposit)</span>
                  <span className="amount">{formatPrice(quote?.estimatedTotal)}</span>
                </div>
                <div className="text-muted small mt-2"><i className="bi bi-info-circle me-1" />Final charges are calculated on return based on mileage, fuel and condition.</div>
              </div>

              <div className="fleet-form-section">
                <h3><i className="bi bi-file-earmark-check me-2" />Terms &amp; conditions</h3>
                <label className="d-flex gap-2 align-items-start">
                  <input type="checkbox" className="form-check-input mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span className="small text-muted">
                    I hold a valid driver’s licence, accept the rental terms, and understand that a
                    refundable deposit of <strong>{formatPrice(quote?.deposit)}</strong> applies.
                    Cancellations inside 48 hours of pick-up attract a fee of R250.
                  </span>
                </label>
                <div className="mt-3">
                  <label className="book-label" htmlFor="RentNotes">Notes for the team (optional)</label>
                  <textarea id="RentNotes" className="form-control book-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Airport pick-up, child seat fitted…" />
                </div>
                <button type="submit" className="book-submit mt-4 w-100" disabled={submitting}>
                  <i className="bi bi-car-front me-2" />{submitting ? 'Submitting…' : 'Submit rental request'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}