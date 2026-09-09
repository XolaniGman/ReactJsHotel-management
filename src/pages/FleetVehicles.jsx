import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listFleetVehicles } from '../services/fleetService';
import { smartMatchVehicles, vehicleRateCard, vehicleRatingInfo } from '../lib/fleetAlgo';
import { formatPrice, todayISO, addDaysISO, nightsBetween } from '../lib/utils';
import { VEHICLE_TYPES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, HOURLY_FUEL_SURCHARGE } from '../lib/constants';
import './rooms.css';
import './fleet.css';
import './palm.css';

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80';

export default function FleetVehicles() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('All');
  const [category, setCategory] = useState('All');
  const [transmission, setTransmission] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [sort, setSort] = useState('price');
  const [view, setView] = useState('cards');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(searchParams.get('pickup') || todayISO());
  const [dropoffDate, setDropoffDate] = useState(searchParams.get('dropoff') || addDaysISO(todayISO(), 3));

  const isFleetManager = ['fleetmanager', 'admin', 'system'].includes(user?.role);

  const load = async () => {
    setLoading(true);
    setVehicles(await listFleetVehicles());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const days = Math.max(1, nightsBetween(pickupDate, dropoffDate) || 1);

  const primaryFiltersSet = type !== 'All' || category !== 'All' || transmission !== 'All';
  const showMoreFilters = moreFiltersOpen || primaryFiltersSet;

  const filtered = useMemo(() => {
    let list = vehicles.filter(
      (v) =>
        (type === 'All' || v.type === type) &&
        (category === 'All' || v.category === category) &&
        (transmission === 'All' || v.transmission === transmission) &&
        (availability === 'All' ||
          (availability === 'Available' ? v.status === 'Available' : v.status !== 'Available')),
    );
    if (sort === 'price') list = [...list].sort((a, b) => (a.pricePerDay || 0) - (b.pricePerDay || 0));
    if (sort === 'priceDesc') list = [...list].sort((a, b) => (b.pricePerDay || 0) - (a.pricePerDay || 0));
    if (sort === 'capacity') list = [...list].sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
    if (sort === 'match') {
      const ranked = smartMatchVehicles(list, { tripType: 'Local Trip', partySize: 2 });
      list = ranked.map((r) => r.vehicle);
    }
    return list;
  }, [vehicles, type, category, transmission, availability, sort]);

  const matches = useMemo(() => {
    const map = {};
    smartMatchVehicles(vehicles, { tripType: 'Local Trip', partySize: 2 }).forEach((r) => { map[r.vehicle.id] = r; });
    return map;
  }, [vehicles]);

  return (
    <div className="san-shell palm-page">
      <div className="palm-page-header">
        <div>
          <div className="palm-page-kicker">Vehicles Hub</div>
          <h1 className="palm-page-title">Car Rental &amp; Shuttle Fleet</h1>
          <p className="palm-page-copy">
            Explore our vehicles available for hire during your stay — or catch a hotel shuttle for
            a point-to-point trip. Every vehicle-specific rate, spec and estimated total is shown
            upfront.
          </p>
        </div>
      </div>

      <div className="palm-card">
        <div className="palm-card-header">
          <div>
            <span className="palm-card-title d-block">Find your ride</span>
            <span className="palm-card-sub">Filter by type, transmission, availability and your rental window.</span>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <div className="fleet-view-toggle">
              <button type="button" className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
                <i className="bi bi-grid me-1" /> Cards
              </button>
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                <i className="bi bi-list-ul me-1" /> List
              </button>
              <button type="button" className={view === 'pricing' ? 'active' : ''} onClick={() => setView('pricing')}>
                <i className="bi bi-table me-1" /> Pricing table
              </button>
            </div>
            <Link to="/Fleet/Service" className="palm-btn palm-btn-primary">
              <i className="bi bi-taxi-front" /> Request a shuttle
            </Link>
          </div>
        </div>
        <div className="palm-card-body">
        <div className="san-filter-body">
          <div className="filter-row">
            <div>
              <label className="san-label" htmlFor="VType">Vehicle Type</label>
              <select id="VType" className="san-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="All">All types</option>
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="san-label" htmlFor="VCategory">Category</label>
              <select id="VCategory" className="san-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="All">All categories</option>
                {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="san-label" htmlFor="VTrans">Transmission</label>
              <select id="VTrans" className="san-select" value={transmission} onChange={(e) => setTransmission(e.target.value)}>
                <option value="All">All</option>
                {VEHICLE_TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {showMoreFilters ? (
              <>
                <div>
                  <label className="san-label" htmlFor="VAvail">Availability</label>
                  <select id="VAvail" className="san-select" value={availability} onChange={(e) => setAvailability(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Available">Available now</option>
                    <option value="Busy">Reserved / in service</option>
                  </select>
                </div>
                <div>
                  <label className="san-label">Rental window</label>
                  <div className="d-flex gap-1">
                    <input type="date" className="san-select" style={{ width: 'auto' }} value={pickupDate} min={todayISO()} onChange={(e) => setPickupDate(e.target.value)} />
                    <input type="date" className="san-select" style={{ width: 'auto' }} value={dropoffDate} min={pickupDate} onChange={(e) => setDropoffDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="san-label" htmlFor="VSort">Sort by</label>
                  <select id="VSort" className="san-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="price">Price (low → high)</option>
                    <option value="priceDesc">Price (high → low)</option>
                    <option value="capacity">Seating capacity</option>
                    <option value="match">Smart match (recommended)</option>
                  </select>
                </div>
                <div className="filter-actions">
                  <button
                    type="button"
                    className="palm-btn palm-btn-outline"
                    onClick={() => { setType('All'); setCategory('All'); setTransmission('All'); setAvailability('All'); setSort('price'); setMoreFiltersOpen(false); }}
                  >
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <div className="filter-actions">
                <button type="button" className="palm-btn palm-btn-outline" onClick={() => setMoreFiltersOpen(true)}>
                  <i className="bi bi-sliders me-1" /> More filters
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted py-5">Loading fleet…</p>
      ) : filtered.length === 0 ? (
        <div className="san-empty">No vehicles match your filters. Try a different combination.</div>
      ) : view === 'list' ? (
        <div className="fleet-list-view">
          {filtered.map((v) => {
            const busy = v.status !== 'Available';
            const { rating, reviewCount, isPlaceholder } = vehicleRatingInfo(v);
            const fullStars = Math.round(rating);
            const features = v.features || [];
            const mid = Math.ceil(features.length / 2);
            const colA = features.slice(0, mid);
            const colB = features.slice(mid);
            return (
              <div key={v.id} className={`flv-row ${busy ? 'is-muted' : ''}`}>
                <Link to={`/Fleet/Vehicles/Details/${v.id}`} className="flv-image">
                  <img src={v.image || DEFAULT_IMG} alt={v.name} loading="lazy" />
                  {busy && <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>}
                </Link>
                <div className="flv-body">
                  <div className="flv-top">
                    <div>
                      <h3><Link to={`/Fleet/Vehicles/Details/${v.id}`}>{v.name}</Link></h3>
                      <div className="flv-stars">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <i key={i} className={i < fullStars ? 'bi bi-star-fill' : 'bi bi-star'} />
                        ))}
                        <span>{reviewCount > 0 ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'New listing'}{isPlaceholder ? ' (est.)' : ''}</span>
                      </div>
                    </div>
                    <div className="flv-price">
                      {formatPrice(v.pricePerDay)}
                      <small>Per Day</small>
                    </div>
                  </div>

                  <div className="flv-specs">
                    <span><i className="bi bi-people" />{v.capacity}</span>
                    <span><i className="bi bi-gear" />{v.transmission}</span>
                    <span><i className="bi bi-fuel-pump" />{v.fuelType}</span>
                    <span><i className="bi bi-car-front" />{v.category || v.type}</span>
                  </div>

                  {features.length > 0 && (
                    <>
                      <hr />
                      <div className="flv-features">
                        <div>
                          {colA.map((f) => <div key={f}><i className="bi bi-check2" />{f}</div>)}
                        </div>
                        <div>
                          {colB.map((f) => <div key={f}><i className="bi bi-check2" />{f}</div>)}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flv-actions">
                    <Link to={`/Fleet/Vehicles/Details/${v.id}`} className="san-btn-secondary">
                      <i className="bi bi-eye me-1" /> View details
                    </Link>
                    {!busy && (
                      <Link to={`/Fleet/Rent?vehicle=${v.id}&pickup=${pickupDate}&dropoff=${dropoffDate}`} className="san-btn-primary">
                        <i className="bi bi-car-front me-1" /> Rent this vehicle
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'pricing' ? (
        <div className="palm-card fleet-pricing-wrap">
          <div className="table-responsive">
            <table className="fleet-pricing-table">
              <thead>
                <tr>
                  <th className="fpt-veh">Vehicle</th>
                  <th className="fpt-rate fpt-hour">Per Hour Rate</th>
                  <th className="fpt-rate fpt-day">Per Day Rate</th>
                  <th className="fpt-rate fpt-lease">Leasing</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const busy = v.status !== 'Available';
                  const rates = vehicleRateCard(v);
                  return (
                    <tr key={v.id} className={busy ? 'is-muted' : ''}>
                      <td className="fpt-veh">
                        <div className="fpt-veh-cell">
                          <img src={v.image || DEFAULT_IMG} alt={v.name} loading="lazy" />
                          <div>
                            <strong><Link to={`/Fleet/Vehicles/Details/${v.id}`}>{v.name}</Link></strong>
                            <span>{v.category || v.type} · {v.transmission} · {v.capacity} seats</span>
                          </div>
                        </div>
                      </td>
                      <td className="fpt-rate">
                        <div className="fpt-amount">{formatPrice(rates.perHour)} <small>/ hour</small></div>
                        <div className="fpt-sub">{formatPrice(HOURLY_FUEL_SURCHARGE)}/hour fuel surcharges</div>
                      </td>
                      <td className="fpt-rate">
                        <div className="fpt-amount">{formatPrice(rates.perDay)} <small>/ day</small></div>
                        <div className="fpt-sub">Dynamic rate applied at checkout</div>
                      </td>
                      <td className="fpt-rate">
                        <div className="fpt-amount">{formatPrice(rates.perMonth)} <small>/ month</small></div>
                        <div className="fpt-sub">
                          {busy ? (
                            <span className="fleet-badge fleet-badge-Reserved">{v.status}</span>
                          ) : (
                            <Link to={`/Fleet/Rent?vehicle=${v.id}&pickup=${pickupDate}&dropoff=${dropoffDate}`}>Rent this vehicle →</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="san-room-grid">
          {filtered.map((v) => {
            const busy = v.status !== 'Available';
            const estTotal = (Number(v.pricePerDay) || 0) * days;
            return (
              <article key={v.id} className={`san-room-card ${busy ? 'is-muted' : ''}`}>
                <div className="san-room-image">
                  <Link
                    to={`/Fleet/Vehicles/Details/${v.id}`}
                    className="fleet-image-link"
                    aria-label={`View details for ${v.name}`}
                  >
                    <img src={v.image || DEFAULT_IMG} alt={v.name} loading="lazy" />
                  </Link>
                  <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>
                  <span className="fleet-badge category-badge">{v.category || '—'}</span>
                </div>
                <div className="san-room-body">
                  <div className="san-room-meta">
                    <span>{v.type} · {v.transmission} · {v.year}</span>
                    <strong>{v.unitNumber || v.plateNumber || v.name}</strong>
                  </div>
                  <h3>{v.name}</h3>
                  <p className="san-room-copy">{v.description}</p>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <span className="vehicle-spec"><i className="bi bi-people" />{v.capacity} seats</span>
                    <span className="vehicle-spec"><i className="bi bi-fuel-pump" />{v.fuelType}</span>
                    <span className="vehicle-spec"><i className="bi bi-speedometer2" />{v.mileage?.toLocaleString()} km</span>
                    {v.nextServiceDate && v.status === 'InMaintenance' && (
                      <span className="vehicle-spec" style={{ background: '#fff6db', color: '#8a640e' }}>
                        <i className="bi bi-tools" />Service due {v.nextServiceDate}
                      </span>
                    )}
                  </div>

                  {(v.features || []).length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {(v.features || []).slice(0, 4).map((f) => (
                        <span key={f} className="badge bg-light text-dark border">
                          <i className="bi bi-check2 me-1" />{f}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="san-room-price">
                    {formatPrice(v.pricePerDay)} <small>/ day</small>
                    <span className="text-muted d-block" style={{ fontSize: '0.8rem' }}>
                      Est. total for {days} day{days > 1 ? 's' : ''}: {formatPrice(estTotal)} · dynamic rate applied at checkout
                    </span>
                    {matches[v.id] && (
                      <span className="match-score mt-2" title={matches[v.id].reasons.join(' · ')}>
                        <i className="bi bi-stars me-1" />{matches[v.id].score}% smart match
                      </span>
                    )}
                  </div>

                  <div className="san-room-actions">
                    <Link to={`/Fleet/Vehicles/Details/${v.id}`} className="san-btn-secondary">
                      <i className="bi bi-eye me-1" /> View details
                    </Link>
                    {busy ? (
                      <span className="san-btn-secondary" style={{ cursor: 'not-allowed', opacity: 0.7 }}>
                        Currently unavailable
                      </span>
                    ) : (
                      <Link
                        to={`/Fleet/Rent?vehicle=${v.id}&pickup=${pickupDate}&dropoff=${dropoffDate}`}
                        className="san-btn-primary"
                      >
                        <i className="bi bi-car-front me-1" /> Rent this vehicle
                      </Link>
                    )}
                    {isFleetManager && (
                      <div className="d-flex gap-2">
                        <Link to={`/Fleet/Manager?manage=${v.id}`} className="san-btn-secondary" style={{ flex: 1 }}>
                          <i className="bi bi-pencil me-1" /> Edit
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}