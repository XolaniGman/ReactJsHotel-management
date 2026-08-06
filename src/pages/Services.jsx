import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listAmenities, requestAmenity, requestLaundry } from '../services/amenityService';
import { listUserReservations } from '../services/reservationService';
import { formatPrice } from '../lib/utils';
import { LAUNDRY_ITEM_TYPES } from '../lib/constants';
import './guest.css';

export default function Services() {
  const { user } = useAuth();
  const [amenities, setAmenities] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [tab, setTab] = useState('amenities');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [cart, setCart] = useState({});
  const [laundryItems, setLaundryItems] = useState([{ type: 'Washing', count: 1 }]);
  const [laundryNotes, setLaundryNotes] = useState('');

  const activeRes = reservations.find((r) => ['Approved', 'CheckedIn'].includes(r.status));

  useEffect(() => {
    (async () => {
      const [a, r] = await Promise.all([listAmenities(), user?.uid ? listUserReservations(user.uid) : []]);
      setAmenities(a);
      setReservations(r);
    })();
  }, [user?.uid]);

  const submitAmenities = async () => {
    setError('');
    setSuccess('');
    const selected = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (selected.length === 0) return setError('Select at least one amenity.');
    for (const [amenityId, qty] of selected) {
      const a = amenities.find((x) => x.id === amenityId);
      await requestAmenity({
        guestUid: user.uid,
        guestName: user.name,
        reservationId: activeRes?.id || '',
        roomNumber: activeRes?.roomNumber || '',
        amenityId,
        amenityName: a.name,
        quantity: qty,
        unitPrice: a.unitPrice,
      });
    }
    setCart({});
    setSuccess('Your amenity request has been submitted. We will deliver it shortly.');
  };

  const submitLaundry = async () => {
    setError('');
    setSuccess('');
    const items = laundryItems.filter((i) => i.count > 0);
    if (items.length === 0) return setError('Add at least one laundry item.');
    await requestLaundry({
      guestUid: user.uid,
      guestName: user.name,
      reservationId: activeRes?.id || '',
      roomNumber: activeRes?.roomNumber || '',
      items,
      notes: laundryNotes,
    });
    setLaundryItems([{ type: 'Washing', count: 1 }]);
    setLaundryNotes('');
    setSuccess('Your laundry request has been submitted.');
  };

  return (
    <div className="clean-shell">
      <div className="lost-top">
        <div>
          <div className="lost-kicker">Guest Services</div>
          <h1 className="lost-title">Request a service</h1>
          <p className="lost-copy">
            Order amenities to your room or send items for laundry. Free amenities have no charge;
            chargeable items are added to your bill once delivered.
          </p>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
      {success && <div className="lost-alert lost-alert-success"><i className="bi bi-check-circle me-2" />{success}</div>}

      {!activeRes && (
        <div className="dash-notice">
          <i className="bi bi-info-circle me-2" />
          You don&rsquo;t have an active stay. Requests will be recorded without a room; book a stay to
          link services to your room.
        </div>
      )}

      <div className="d-flex gap-2 mb-3">
        <button type="button" className={`lux-btn ${tab === 'amenities' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => { setTab('amenities'); setError(''); setSuccess(''); }}>
          <i className="bi bi-star me-2" /> Amenities
        </button>
        <button type="button" className={`lux-btn ${tab === 'laundry' ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => { setTab('laundry'); setError(''); setSuccess(''); }}>
          <i className="bi bi-washing-machine me-2" /> Laundry
        </button>
      </div>

      {tab === 'amenities' && (
        <div className="clean-form">
          <h2 className="clean-card-title">Choose your amenities</h2>
          {amenities.length === 0 ? (
            <div className="dash-empty"><i className="bi bi-star" /> No amenities available yet.</div>
          ) : (
            <div className="row g-3">
              {amenities.map((a) => (
                <div className="col-md-6 col-lg-4" key={a.id}>
                  <div className="d-flex justify-content-between align-items-center border rounded-3 p-3">
                    <div>
                      <i className={`bi ${a.icon || 'bi-star'} me-2 text-warning`} />
                      <strong>{a.name}</strong>
                      <div className="text-muted small">
                        {a.isFree ? 'Free' : formatPrice(a.unitPrice)}
                      </div>
                    </div>
                    <input
                      type="number" min="0" max="20" className="form-control" style={{ width: 72 }}
                      value={cart[a.id] || 0}
                      onChange={(e) => setCart({ ...cart, [a.id]: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="book-submit mt-4" onClick={submitAmenities}>
            <i className="bi bi-send me-2" /> Submit request
          </button>
        </div>
      )}

      {tab === 'laundry' && (
        <div className="clean-form">
          <h2 className="clean-card-title">Laundry service</h2>
          <div className="row g-3">
            {laundryItems.map((item, idx) => (
              <div className="col-md-6" key={idx}>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select"
                    value={item.type}
                    onChange={(e) => setLaundryItems(laundryItems.map((it, i) => (i === idx ? { ...it, type: e.target.value } : it)))}
                  >
                    {LAUNDRY_ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="number" min="0" max="50" className="form-control" style={{ width: 80 }}
                    value={item.count}
                    onChange={(e) => setLaundryItems(laundryItems.map((it, i) => (i === idx ? { ...it, count: Math.max(0, Number(e.target.value) || 0) } : it)))}
                  />
                  <button
                    type="button" className="btn btn-sm btn-outline-danger"
                    onClick={() => setLaundryItems(laundryItems.filter((_, i) => i !== idx))}
                    disabled={laundryItems.length === 1}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="book-cancel mt-3" onClick={() => setLaundryItems([...laundryItems, { type: 'Washing', count: 1 }])}>
            <i className="bi bi-plus-lg me-2" /> Add item
          </button>
          <div className="mt-3">
            <label className="book-label" htmlFor="LaundryNotes">Special instructions</label>
            <textarea id="LaundryNotes" className="form-control book-textarea" value={laundryNotes} onChange={(e) => setLaundryNotes(e.target.value)} />
          </div>
          <button type="button" className="book-submit mt-4" onClick={submitLaundry}>
            <i className="bi bi-washing-machine me-2" /> Submit laundry request
          </button>
        </div>
      )}
    </div>
  );
}
