import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listAmenities, requestAmenity, requestLaundry } from '../services/amenityService';
import { listUserReservations } from '../services/reservationService';
import { formatPrice } from '../lib/utils';
import { LAUNDRY_ITEM_TYPES } from '../lib/constants';
import './guest.css';
import './palm.css';

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
    <div className="palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Guest Services</div>
          <h1 className="palm-page-title">Request a service</h1>
          <p className="palm-page-copy">
            Order amenities to your room or send items for laundry. Free amenities have no charge;
            chargeable items are added to your bill once delivered.
          </p>
        </div>
      </div>

      {error && <div className="palm-alert palm-alert-danger"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {success && <div className="palm-alert palm-alert-success"><i className="bi bi-check-circle" />{success}</div>}

      {!activeRes && (
        <div className="palm-alert palm-alert-info">
          <i className="bi bi-info-circle" />
          You don&rsquo;t have an active stay. Requests will be recorded without a room; book a stay to
          link services to your room.
        </div>
      )}

      <div className="palm-tabs">
        <button type="button" className={`palm-tab ${tab === 'amenities' ? 'active' : ''}`} onClick={() => { setTab('amenities'); setError(''); setSuccess(''); }}>
          <i className="bi bi-star me-1" /> Amenities
        </button>
        <button type="button" className={`palm-tab ${tab === 'laundry' ? 'active' : ''}`} onClick={() => { setTab('laundry'); setError(''); setSuccess(''); }}>
          <i className="bi bi-washing-machine me-1" /> Laundry
        </button>
      </div>

      {tab === 'amenities' && (
        <div className="palm-card">
          <div className="palm-card-body pt-4">
            <h2 className="palm-card-title mb-3">Choose your amenities</h2>
            {amenities.length === 0 ? (
              <div className="palm-empty"><i className="bi bi-star d-block mb-2" style={{ fontSize: '1.4rem' }} />No amenities available yet.</div>
            ) : (
              <div className="row g-3">
                {amenities.map((a) => (
                  <div className="col-md-6 col-lg-4" key={a.id}>
                    <div className="palm-choice-row">
                      <div>
                        <i className={`bi ${a.icon || 'bi-star'} me-2`} style={{ color: 'var(--palm-accent)' }} />
                        <strong style={{ fontSize: '0.85rem' }}>{a.name}</strong>
                        <div className="palm-list-meta">
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
            <button type="button" className="palm-btn palm-btn-primary mt-4" onClick={submitAmenities}>
              <i className="bi bi-send" /> Submit request
            </button>
          </div>
        </div>
      )}

      {tab === 'laundry' && (
        <div className="palm-card">
          <div className="palm-card-body pt-4">
            <h2 className="palm-card-title mb-3">Laundry service</h2>
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
            <button type="button" className="palm-btn palm-btn-outline mt-3" onClick={() => setLaundryItems([...laundryItems, { type: 'Washing', count: 1 }])}>
              <i className="bi bi-plus-lg" /> Add item
            </button>
            <div className="mt-3">
              <label htmlFor="LaundryNotes">Special instructions</label>
              <textarea id="LaundryNotes" className="form-control" value={laundryNotes} onChange={(e) => setLaundryNotes(e.target.value)} />
            </div>
            <button type="button" className="palm-btn palm-btn-primary mt-4" onClick={submitLaundry}>
              <i className="bi bi-washing-machine" /> Submit laundry request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
