import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listMenuItems, listTables, placeOrder } from '../services/restaurantService';
import { listUserReservations } from '../services/reservationService';
import { formatPrice } from '../lib/utils';
import './events.css';
import './restaurant.css';

const DIETARY_TAGS = ['Vegan', 'Vegetarian', 'Halal', 'Gluten-Free'];

export default function RestaurantMenu() {
  const { user } = useAuth();
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeRes, setActiveRes] = useState(null);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('All');
  const [dietFilter, setDietFilter] = useState('');

  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [chargeToRoom, setChargeToRoom] = useState(true);
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestContact, setGuestContact] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    (async () => {
      const [m, t, r] = await Promise.all([
        listMenuItems(),
        listTables(),
        user?.uid ? listUserReservations(user.uid) : [],
      ]);
      setMenu(m);
      setTables(t);
      const active = r.find((x) => ['Approved', 'CheckedIn'].includes(x.status));
      setActiveRes(active || null);
      setLoading(false);
    })();
  }, [user?.uid]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(menu.map((m) => m.category).filter(Boolean)))],
    [menu],
  );

  const filtered = menu.filter(
    (m) =>
      (category === 'All' || m.category === category) &&
      (!dietFilter || (m.dietary || []).includes(dietFilter)),
  );

  const cartTotal = cart.reduce((s, i) => s + (i.unitPrice || 0) * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, qty: Math.min(20, i.qty + 1) } : i,
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, unitPrice: item.price, qty: 1, notes: '' }];
    });
  };

  const updateQty = (menuItemId, delta) =>
    setCart((prev) =>
      prev
        .map((i) => (i.menuItemId === menuItemId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );

  const setNotes = (menuItemId, notes) =>
    setCart((prev) => prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes } : i)));

  const submitOrder = async () => {
    setError('');
    if (!tableNumber) return setError('Choose a table to dine at.');
    if (!guestName.trim()) return setError('Please enter a name for the order.');
    if (chargeToRoom && !activeRes) return setError('No active stay to charge to. Uncheck "charge to room" or book a stay first.');
    setPlacing(true);
    const result = await placeOrder({
      items: cart,
      tableNumber: Number(tableNumber),
      guestUid: user?.uid || '',
      guestName: guestName.trim(),
      guestContact: guestContact.trim(),
      reservationId: chargeToRoom && activeRes ? activeRes.id : '',
    });
    setPlacing(false);
    if (result?.error) return setError(result.error);
    setPlaced(result);
  };

  const resetOrder = () => {
    setCart([]);
    setTableNumber('');
    setPlaced(null);
    setError('');
  };

  return (
    <div className="rest-shell">
      <div className="rest-hero">
        <div className="rest-hero-body">
          <div className="rest-kicker">Dine-in Restaurant</div>
          <h1 className="rest-title">Winds Restaurant</h1>
          <p className="rest-subtitle">
            A seasonal coastal menu — breakfast to late dinner. Order straight to your table and the
            kitchen gets it instantly.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <Link to="/Restaurant/Reserve" className="rest-cta">
              <i className="bi bi-calendar-check me-2" /> Reserve a table
            </Link>
            <span className="rest-hours"><i className="bi bi-clock me-1" /> Open 07:00 – 22:00</span>
          </div>
        </div>
      </div>

      {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      {placed ? (
        <div className="rest-success">
          <div className="rest-success-icon"><i className="bi bi-check2-circle" /></div>
          <h2>Order placed</h2>
          <p>Your order is with the kitchen.</p>
          <div className="rest-success-row">
            <div><span>Order no.</span><strong>{placed.orderNo}</strong></div>
            <div><span>Est. preparation</span><strong>~{placed.estimateMinutes} min</strong></div>
            <div><span>Table</span><strong>{tableNumber}</strong></div>
          </div>
          <button type="button" className="rest-cta mt-4" onClick={resetOrder}>
            <i className="bi bi-arrow-left me-2" /> Order again
          </button>
        </div>
      ) : (
        <div className="rest-layout">
          <div className="rest-content">
            <div className="rest-toolbar">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`rest-chip ${category === c ? 'active' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className={`rest-diet ${dietFilter === '' ? 'active' : ''}`} onClick={() => setDietFilter('')}>
                  All diets
                </button>
                {DIETARY_TAGS.map((t) => (
                  <button type="button" key={t} className={`rest-diet ${dietFilter === t ? 'active' : ''}`} onClick={() => setDietFilter(dietFilter === t ? '' : t)}>
                    {t === 'Gluten-Free' ? 'GF' : t}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-muted">Loading menu…</p>
            ) : filtered.length === 0 ? (
              <div className="empty-state">No dishes match these filters.</div>
            ) : (
              <div className="menu-grid">
                {filtered.map((m) => {
                  const soldOut = m.available === false;
                  return (
                    <article key={m.id} className={`menu-card ${soldOut ? 'sold-out' : ''}`}>
                      <div className="menu-card-top">
                        <img src={m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'} alt={m.name} />
                        <div className="menu-overlay" />
                        {soldOut ? (
                          <span className="menu-badge badge-soldout">Sold out</span>
                        ) : (
                          <span className="menu-badge badge-prep"><i className="bi bi-clock" /> {m.prepTime || 15} min</span>
                        )}
                      </div>
                      <div className="menu-card-body">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <h3 className="menu-name">{m.name}</h3>
                          <div className="menu-price">{formatPrice(m.price)}</div>
                        </div>
                        <p className="menu-desc">{m.description}</p>
                        <div className="d-flex flex-wrap gap-1 mb-3">
                          {(m.dietary || []).map((t) => (
                            <span key={t} className="menu-diet-tag">{t}</span>
                          ))}
                        </div>
                        <button type="button" className="rest-cta w-100" disabled={soldOut} onClick={() => addToCart(m)}>
                          <i className="bi bi-plus-lg me-1" /> Add to order
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="menu-cart">
            <div className="menu-cart-head">
              <h2><i className="bi bi-basket me-2" />Your order</h2>
              {cartCount > 0 && <span className="menu-cart-count">{cartCount}</span>}
            </div>

            {cart.length === 0 ? (
              <div className="menu-cart-empty">
                <i className="bi bi-basket2" />
                <p className="mb-0">Your order is empty. Add dishes from the menu.</p>
              </div>
            ) : (
              <>
                <div className="menu-cart-items">
                  {cart.map((i) => (
                    <div className="menu-cart-item" key={i.menuItemId}>
                      <div className="d-flex justify-content-between">
                        <strong className="small">{i.name}</strong>
                        <span className="small">{formatPrice(i.unitPrice * i.qty)}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <div className="qty-stepper">
                          <button type="button" onClick={() => updateQty(i.menuItemId, -1)}><i className="bi bi-dash" /></button>
                          <span>{i.qty}</span>
                          <button type="button" onClick={() => updateQty(i.menuItemId, 1)}><i className="bi bi-plus" /></button>
                        </div>
                        <input className="form-control form-control-sm" placeholder="Notes (e.g. allergy)" value={i.notes} onChange={(e) => setNotes(i.menuItemId, e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="menu-cart-fields">
                  <label className="book-label fw-bold small text-uppercase">Dining table</label>
                  <select className="form-select mb-2" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}>
                    <option value="">Select a table…</option>
                    {tables.filter((t) => t.status === 'Available' || t.status === 'Reserved').map((t) => (
                      <option key={t.id} value={t.number}>Table {t.number} — seats {t.capacity} ({t.location})</option>
                    ))}
                  </select>

                  {user ? (
                    <div className="form-check form-switch mb-2">
                      <input className="form-check-input" type="checkbox" id="ChargeRoom" checked={chargeToRoom} onChange={(e) => setChargeToRoom(e.target.checked)} disabled={!activeRes} />
                      <label className="form-check-label" htmlFor="ChargeRoom">Charge to my stay {activeRes ? `(Room ${activeRes.roomNumber || '—'})` : ''}</label>
                    </div>
                  ) : (
                    <div className="mb-2">
                      <label className="book-label fw-bold small text-uppercase">Guest name</label>
                      <input className="form-control" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Sipho Nkosi" />
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="book-label fw-bold small text-uppercase">Contact (optional)</label>
                    <input className="form-control" value={guestContact} onChange={(e) => setGuestContact(e.target.value)} placeholder="Phone / email" />
                  </div>
                </div>

                <div className="menu-cart-total">
                  <span>Total</span>
                  <strong>{formatPrice(cartTotal)}</strong>
                </div>
                <button type="button" className="rest-cta w-100" onClick={submitOrder} disabled={placing}>
                  <i className="bi bi-send me-2" />{placing ? 'Placing order…' : 'Submit order to kitchen'}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
