import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fleetReports,
  listFleetVehicles,
  createFleetVehicle,
  updateFleetVehicle,
  deleteFleetVehicle,
  listFleetDrivers,
  createFleetDriver,
  updateFleetDriver,
  deleteFleetDriver,
  toggleDriverAvailability,
  getFleetVehicle,
  listCarBookings,
  listCarServices,
} from '../services/fleetService';
import { formatPrice } from '../lib/utils';
import { groupDailyCounts, projectSeries, movingAverage } from '../lib/fleetAlgo';
import { VEHICLE_TYPES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, VEHICLE_STATUSES } from '../lib/constants';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './maintenance.css';
import './guest.css';
import './fleet.css';

const EMPTY_VEHICLE = {
  name: '',
  category: 'Compact',
  type: 'Sedan',
  transmission: 'Automatic',
  capacity: 4,
  pricePerDay: '',
  deposit: 500,
  fuelType: 'Petrol',
  unitNumber: '',
  plateNumber: '',
  year: new Date().getFullYear(),
  mileage: '',
  nextServiceDate: '',
  status: 'Available',
  image: '',
  description: '',
  features: '',
};

const EMPTY_DRIVER = {
  name: '',
  phone: '',
  licenseNo: '',
  vehicleUnit: '',
  shiftStart: '08:00',
  shiftEnd: '18:00',
  rating: 5,
};

export default function FleetManagerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [reports, setReports] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingDriver, setEditingDriver] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState(null);

  const load = async () => {
    const [r, v, d] = await Promise.all([fleetReports(), listFleetVehicles(), listFleetDrivers()]);
    setReports(r);
    setVehicles(v);
    setDrivers(d);
  };

  useEffect(() => {
    (async () => {
      const [b, s] = await Promise.all([listCarBookings(), listCarServices()]);
      setRaw({ bookings: Array.isArray(b) ? b : [], services: Array.isArray(s) ? s : [] });
    })();
  }, []);

useEffect(() => { load(); }, []);

useEffect(() => {
  if (window.location.hash === '#drivers') {
    setTab('drivers');
    window.history.replaceState(null, '', window.location.pathname);
  }
}, []);

useEffect(() => {
  const manage = searchParams.get('manage');
    if (manage) {
      (async () => {
        const v = await getFleetVehicle(manage);
        if (v) {
          setVehicleForm({
            name: v.name || '',
            category: v.category || '',
            type: v.type || 'Sedan',
            transmission: v.transmission || 'Automatic',
            capacity: v.capacity || 4,
            pricePerDay: v.pricePerDay || '',
            deposit: v.deposit || 500,
            fuelType: v.fuelType || 'Petrol',
            unitNumber: v.unitNumber || '',
            plateNumber: v.plateNumber || '',
            year: v.year || new Date().getFullYear(),
            mileage: v.mileage || '',
            nextServiceDate: v.nextServiceDate || '',
            status: v.status || 'Available',
            image: v.image || '',
            description: v.description || '',
            features: (v.features || []).join(', '),
          });
          setEditingVehicle(manage);
          setTab('vehicles');
        }
      })();
    }
  }, [searchParams]);

  const changeTab = (t) => {
    setTab(t);
    setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true });
    if (t === 'vehicles') { setEditingVehicle(null); setVehicleForm(EMPTY_VEHICLE); }
    if (t === 'drivers') { setEditingDriver(null); setDriverForm(EMPTY_DRIVER); }
  };

  const saveVehicle = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!vehicleForm.name.trim() || !vehicleForm.pricePerDay) return setError('Vehicle name and daily rate are required.');
    setSaving(true);
    const payload = {
      ...vehicleForm,
      capacity: Number(vehicleForm.capacity) || 4,
      pricePerDay: Number(vehicleForm.pricePerDay) || 0,
      deposit: Number(vehicleForm.deposit) || 500,
      year: Number(vehicleForm.year) || new Date().getFullYear(),
      mileage: Number(vehicleForm.mileage) || 0,
      features: vehicleForm.features.split(',').map((f) => f.trim()).filter(Boolean),
      image: vehicleForm.image.trim(),
    };
    if (editingVehicle) {
      await updateFleetVehicle(editingVehicle, payload);
      setNotice('Vehicle updated.');
    } else {
      await createFleetVehicle(payload);
      setNotice('Vehicle added to the fleet.');
    }
    setSaving(false);
    setVehicleForm(EMPTY_VEHICLE);
    setEditingVehicle(null);
    await load();
  };

  const saveDriver = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!driverForm.name.trim()) return setError('Driver name is required.');
    setSaving(true);
    if (editingDriver) {
      await updateFleetDriver(editingDriver, driverForm);
      setNotice('Driver updated.');
    } else {
      await createFleetDriver(driverForm);
      setNotice('Driver added to the roster.');
    }
    setSaving(false);
    setDriverForm(EMPTY_DRIVER);
    setEditingDriver(null);
    await load();
  };

  const removeVehicle = async (id) => {
    if (!window.confirm('Delete this vehicle? Its rental history remains on bookings.')) return;
    await deleteFleetVehicle(id);
    setNotice('Vehicle deleted.');
    await load();
  };

  const removeDriver = async (id) => {
    if (!window.confirm('Remove this driver?')) return;
    await deleteFleetDriver(id);
    setNotice('Driver removed.');
    await load();
  };

  const groupedVehicles = useMemo(() => {
    const order = VEHICLE_CATEGORIES;
    const map = {};
    for (const v of vehicles) {
      const key = v.category || 'Other';
      (map[key] = map[key] || []).push(v);
    }
    const known = order.map((c) => ({ category: c, items: map[c] || [] }));
    const extra = Object.keys(map).filter((k) => !order.includes(k)).map((k) => ({ category: k, items: map[k] }));
    return [...known, ...extra].filter((g) => g.items.length > 0);
  }, [vehicles]);

  const grades = useMemo(() => {
    if (!reports) return [];
    const maxTrips = Math.max(1, ...reports.driverPerformance.map((d) => d.trips || 0));
    return reports.driverPerformance
      .map((d) => ({ ...d, grade: d.trips === 0 ? 'No trips' : d.trips >= maxTrips * 0.6 ? 'Strong' : d.trips >= maxTrips * 0.3 ? 'Steady' : 'Building' }))
      .sort((a, b) => (b.trips || 0) - (a.trips || 0));
  }, [reports]);

  const prediction = useMemo(() => {
    if (!raw) return null;
    const totalDaily = groupDailyCounts([...(raw.bookings || []), ...(raw.services || [])], { days: 28 });
    if (!totalDaily) return null;
    const counts = totalDaily.map((d) => d.count);
    const fit = projectSeries(counts, { horizon: 7, lookback: 14 });
    const rows = fit.series.map((count, i) => ({
      label: totalDaily[i] ? totalDaily[i].label : `+${i - totalDaily.length + 1}d`,
      actual: i < counts.length ? count : null,
      forecast: i >= counts.length ? count : null,
      moving: movingAverage(counts.slice(0, i + 1), 3)[i],
    }));
    const forecastSum = fit.series.slice(counts.length).reduce((s, v) => s + v, 0);
    const today = counts.length ? counts[counts.length - 1] : 0;
    return { rows, slope: fit.slope, r2: fit.r2, forecastSum, today, peak: counts.length ? Math.max(...counts) : 0 };
  }, [raw]);

  if (!reports) {
    return (
      <div className="maint-dash-bg"><div className="maint-dash">
        <p className="text-center text-muted py-5"><i className="bi bi-arrow-repeat me-2" />Loading fleet reports…</p>
      </div></div>
    );
  }

  return (
    <div className="maint-dash-bg">
      <div className="maint-dash">
        <div className="maint-top">
          <div>
            <div className="maint-kicker">Fleet Manager · Reports &amp; Fleet</div>
            <h1 className="maint-title">Fleet Manager {tab === 'overview' ? 'Overview' : tab === 'reports' ? 'Report' : tab === 'vehicles' ? '· Vehicles Hub' : tab === 'predictions' ? '· Predictions' : '· Drivers'}</h1>
          </div>
          <div className="d-flex gap-2">
            <Link to="/Fleet/Incidents" className="btn-log" style={{ background: '#7a251b' }}><i className="bi bi-bug me-2" />Incidents</Link>
            <Link to="/Fleet/Maintenance" className="btn-log" style={{ background: '#433c7d' }}><i className="bi bi-wrench-adjustable me-2" />Work Orders</Link>
            <Link to="/Fleet/Dashboard" className="btn-log" style={{ background: '#355f8c' }}><i className="bi bi-kanban me-2" />Fleet Ops</Link>
            <Link to="/Fleet/Charges" className="btn-log" style={{ background: '#775a19' }}><i className="bi bi-credit-card me-2" />Charges</Link>
          </div>
        </div>

        {notice && <div className="lost-alert lost-alert-success mb-3"><i className="bi bi-check-circle me-2" />{notice}</div>}
        {error && <div className="lost-alert lost-alert-danger mb-3"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

        <div className="d-flex gap-2 mb-3 flex-wrap">
          {[['overview', 'Overview', 'bi-speedometer2'], ['reports', 'Reports', 'bi-graph-up'], ['predictions', 'Predictions', 'bi-graph-up-arrow'], ['vehicles', 'Vehicles Hub', 'bi-car-front'], ['drivers', 'Drivers', 'bi-person-badge']].map(([key, label, icon]) => (
            <button key={key} type="button" className={`lux-btn ${tab === key ? 'lux-btn-solid' : 'lux-btn-outline'}`} onClick={() => changeTab(key)}>
              <i className={`bi ${icon} me-2`} />{label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="metric-grid">
              {[
                { n: `${reports.utilization}%`, label: 'Fleet Utilization', icon: 'bi-bar-chart', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
                { n: formatPrice(reports.totalRevenue), label: 'Rental + Shuttle Revenue', icon: 'bi-currency-rand', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
                { n: reports.activeBookings, label: 'Active Bookings', icon: 'bi-car-front', bg: 'linear-gradient(135deg,#5b51a8,#433c7d)' },
                { n: reports.serviceDueSoon.length, label: 'Service Due ≤ 7 days', icon: 'bi-tools', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
              ].map((m) => (
                <div className="metric-card" key={m.label} style={{ background: m.bg }}>
                  <div className="metric-content">
                    <i className={`bi ${m.icon} metric-icon`} />
                    <span className="metric-number">{m.n}</span>
                    <span className="metric-label">{m.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-grid">
              <div className="panel-card">
                <div className="panel-header"><h2>Fleet composition</h2><span className="panel-actions">{reports.availableCount} available</span></div>
                <div className="p-3">
                  {Object.entries(reports.byType).length === 0 ? (
                    <div className="dash-empty">No vehicles in the fleet yet — add some under the Vehicles Hub tab.</div>
                  ) : (
                    Object.entries(reports.byType).map(([type, count]) => (
                      <div className="fleet-row" key={type}>
                        <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                        <div className="flex-grow-1"><div className="task-name">{type}</div><div className="task-sub">{count} unit{count > 1 ? 's' : ''}</div></div>
                        <strong>{Math.round((count / (reports.byType ? Object.values(reports.byType).reduce((a, b) => a + b, 0) : 1)) * 100)}%</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header"><h2>Maintenance due</h2><span className="panel-actions"><i className="bi bi-tools" />{reports.inMaintenanceCount} in service</span></div>
                {reports.serviceDueSoon.length === 0 ? (
                  <div className="dash-empty" style={{ padding: '1.5rem' }}><i className="bi bi-check2-circle me-2" />No vehicles due for service in the next week.</div>
                ) : (
                  reports.serviceDueSoon.map((v) => (
                    <div className="fleet-row" key={v.id}>
                      <span className="fleet-thumb"><i className="bi bi-tools" /></span>
                      <div className="flex-grow-1">
                        <div className="task-name">{v.name}</div>
                        <div className="task-sub">{v.unitNumber || v.plateNumber} · service due {v.nextServiceDate}</div>
                      </div>
                      <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel-card mt-4">
              <div className="panel-header"><h2>Predictive insight</h2><button type="button" className="btn-log" style={{ background: '#5b51a8', padding: '0.4rem 0.85rem' }} onClick={() => changeTab('predictions')}><i className="bi bi-graph-up-arrow me-1" />See forecasts</button></div>
              <div className="p-3 text-muted">
                {reports.totalBookings === 0 && reports.totalServices === 0
                  ? 'Once bookings and shuttle trips start flowing, usage forecasts (peak rental periods and upcoming maintenance windows) will appear here to help you plan fleet allocation.'
                  : `Rental bookings: ${reports.totalBookings} · Shuttle trips: ${reports.totalServices}. Aggregated demand forecasts project ${prediction ? `~${prediction.forecastSum} new requests` : 'new requests'} over the next 7 days — open Predictions to view the chart and scheduling recommendations.`}
              </div>
            </div>
          </>
        )}

        {tab === 'reports' && (
          <>
            <div className="panel-card mb-4">
              <div className="panel-header">
                <h2><i className="bi bi-currency-rand me-2" />Revenue summary</h2>
                <span className="panel-actions">export available as PDF / Excel</span>
              </div>
              <div className="p-3">
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="fleet-driver-card">
                      <div className="task-sub">Rental revenue</div>
                      <div className="fleet-quote-total"><span className="amount" style={{ fontSize: '1.3rem' }}>{formatPrice(reports.totalRentalRevenue)}</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="fleet-driver-card">
                      <div className="task-sub">Shuttle revenue</div>
                      <div className="fleet-quote-total"><span className="amount" style={{ fontSize: '1.3rem' }}>{formatPrice(reports.serviceRevenue)}</span></div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="fleet-driver-card" style={{ borderColor: '#775a19' }}>
                      <div className="task-sub">Total fleet revenue</div>
                      <div className="fleet-quote-total"><span className="amount" style={{ fontSize: '1.3rem' }}>{formatPrice(reports.totalRevenue)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header"><h2><i className="bi bi-person-video3 me-2" />Driver performance</h2></div>
              <div className="table-responsive">
                <table className="task-table">
                  <thead><tr><th>Driver</th><th>Shift</th><th>Rating</th><th>Trips completed</th><th>Revenue</th><th>Performance</th></tr></thead>
                  <tbody>
                    {grades.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-5 text-muted">Add drivers to start tracking performance.</td></tr>
                    ) : (
                      grades.map((g) => (
                        <tr key={g.driver.id}>
                          <td>
                            <div className="task-name">{g.driver.name}</div>
                            <div className="task-sub">{g.driver.phone}</div>
                          </td>
                          <td className="task-sub">{g.driver.shiftStart}–{g.driver.shiftEnd}</td>
                          <td>★ {g.driver.rating ?? 5}</td>
                          <td className="task-name">{g.trips}</td>
                          <td className="task-name">{formatPrice(g.revenue)}</td>
                          <td>
                            <span className={`fleet-badge ${g.grade === 'Strong' ? 'fleet-badge-Available' : g.grade === 'Steady' ? 'fleet-badge-Reserved' : 'fleet-badge-PendingAssignment'}`}>{g.grade}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-muted small mt-3">
              <i className="bi bi-lightbulb me-1" />Reports aggregate bookings, trips and billing records. Utilization is the share of fleet currently reserved or out of service.
            </div>
          </>
        )}

        {tab === 'predictions' && (
          <>
            <div className="metric-grid">
              {[
                { n: prediction ? String(prediction.forecastSum) : '—', label: 'Forecast requests · next 7 days', icon: 'bi-graph-up-arrow', bg: 'linear-gradient(135deg,#5b51a8,#433c7d)' },
                { n: prediction ? (prediction.slope >= 0.02 ? 'Rising' : prediction.slope <= -0.02 ? 'Falling' : 'Steady') : '—', label: 'Demand trend', icon: 'bi-activity', bg: 'linear-gradient(135deg,#355f8c,#26456a)' },
                { n: prediction ? `${Math.round(prediction.today)} today` : '—', label: 'Requests today', icon: 'bi-calendar3', bg: 'linear-gradient(135deg,#2f7d4f,#1f5c38)' },
                { n: prediction ? `${Math.round(prediction.r2 * 100)}%` : '—', label: 'Forecast confidence (R²)', icon: 'bi-sliders', bg: 'linear-gradient(135deg,#8a640e,#6b4d0a)' },
              ].map((m) => (
                <div className="metric-card" key={m.label} style={{ background: m.bg }}>
                  <div className="metric-content">
                    <i className={`bi ${m.icon} metric-icon`} />
                    <span className="metric-number">{m.n}</span>
                    <span className="metric-label">{m.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-card">
              <div className="panel-header">
                <h2><i className="bi bi-graph-up-arrow me-2" />Demand forecast — rentals + shuttles</h2>
                <span className="panel-actions">28-day history · linear-regression projection</span>
              </div>
              <div className="p-3">
                {!prediction ? (
                  <div className="dash-empty">Collect bookings and shuttle trips first — forecasts appear once the last 28 days have some volume.</div>
                ) : (
                  <>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <LineChart data={prediction.rows} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} interval={3} />
                          <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="actual" name="Requests (actual)" stroke="#355f8c" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                          <Line type="monotone" dataKey="moving" name="3-day average" stroke="#8a640e" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#2f7d4f" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="dash-notice mt-3" style={{ margin: '1rem 0 0' }}>
                      <i className="bi bi-lightbulb me-2" />
                      {prediction.slope >= 0.02
                        ? `Demand is trending up (+${prediction.slope.toFixed(2)} req/day) — expect ~${prediction.forecastSum} requests over the next 7 days. Keep the fleet availability ratio high and pre-assign drivers for peak windows near ${prediction.peak} daily requests.`
                        : prediction.slope <= -0.02
                          ? `Demand is cooling (${prediction.slope.toFixed(2)} req/day) — ~${prediction.forecastSum} requests expected over the next 7 days. Use the window to schedule vehicle servicing and driver training.`
                          : `Demand is roughly steady — ~${prediction.forecastSum} requests expected over the next 7 days. Maintain current staffing and rotate servicing to keep availability at ~${prediction.peak} peak units.`}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="panel-card mt-4">
              <div className="panel-header"><h2><i className="bi bi-wrench-adjustable me-2" />Suggested actions</h2></div>
              <div className="p-3">
                <ul className="mb-0" style={{ paddingLeft: '1.2rem' }}>
                  <li className="mb-1">Schedule the {reports.serviceDueSoon.length} vehicle(s) due for service within 7 days during forecasted low-demand days.</li>
                  <li className="mb-1">Keep the top {groupedVehicles.length ? Math.min(3, groupedVehicles.length) : 1} most-booked categories ready to hire over weekends (dynamic pricing marks +10%).</li>
                  <li>Forecast confidence ({prediction ? Math.round(prediction.r2 * 100) : 0}%) grows with 28+ days of history — revisit allocation monthly.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {tab === 'vehicles' && (
          <div className="dashboard-grid">
            <div className="panel-card">
              <div className="panel-header">
                <h2>{editingVehicle ? 'Edit vehicle' : 'Add vehicle to hub'}</h2>
              </div>
              <div className="p-3">
                <form onSubmit={saveVehicle}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="book-label">Name</label>
                      <input className="form-control book-input" placeholder="e.g. Toyota Corolla" value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Type</label>
                      <select className="form-select book-input" value={vehicleForm.type} onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}>
                        {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Category</label>
                      <select className="form-select book-input" value={vehicleForm.category} onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value })}>
                        {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Transmission</label>
                      <select className="form-select book-input" value={vehicleForm.transmission} onChange={(e) => setVehicleForm({ ...vehicleForm, transmission: e.target.value })}>
                        {VEHICLE_TRANSMISSIONS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Rate / day (R)</label>
                      <input type="number" min="0" className="form-control book-input" value={vehicleForm.pricePerDay} onChange={(e) => setVehicleForm({ ...vehicleForm, pricePerDay: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Deposit (R)</label>
                      <input type="number" min="0" className="form-control book-input" value={vehicleForm.deposit} onChange={(e) => setVehicleForm({ ...vehicleForm, deposit: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Seats</label>
                      <input type="number" min="1" max="60" className="form-control book-input" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Fuel</label>
                      <input className="form-control book-input" value={vehicleForm.fuelType} onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Unit no.</label>
                      <input className="form-control book-input" placeholder="e.g. F-102" value={vehicleForm.unitNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, unitNumber: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Plate</label>
                      <input className="form-control book-input" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Year</label>
                      <input type="number" className="form-control book-input" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Odometer (km)</label>
                      <input type="number" min="0" className="form-control book-input" value={vehicleForm.mileage} onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Next service</label>
                      <input type="date" className="form-control book-input" value={vehicleForm.nextServiceDate} onChange={(e) => setVehicleForm({ ...vehicleForm, nextServiceDate: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Status</label>
                      <select className="form-select book-input" value={vehicleForm.status} onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}>
                        {VEHICLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="book-label">Image URL</label>
                      <input className="form-control book-input" value={vehicleForm.image} onChange={(e) => setVehicleForm({ ...vehicleForm, image: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="book-label">Features (comma separated)</label>
                      <input className="form-control book-input" placeholder="GPS, Bluetooth, Baby seat" value={vehicleForm.features} onChange={(e) => setVehicleForm({ ...vehicleForm, features: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="book-label">Description</label>
                      <textarea className="form-control book-textarea" value={vehicleForm.description} onChange={(e) => setVehicleForm({ ...vehicleForm, description: e.target.value })} />
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-3">
                    <button type="submit" className="btn-log" disabled={saving}>
                      <i className="bi bi-check-lg me-2" />{saving ? 'Saving…' : editingVehicle ? 'Save changes' : 'Add vehicle'}
                    </button>
                    {editingVehicle && (
                      <button type="button" className="btn btn-light" onClick={() => { setEditingVehicle(null); setVehicleForm(EMPTY_VEHICLE); }}>Cancel edit</button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header"><h2>Fleet ({vehicles.length})</h2></div>
              <div style={{ padding: '0.75rem' }}>
                {vehicles.length === 0 ? (
                  <div className="dash-empty">No vehicles yet.</div>
                ) : (
                  groupedVehicles.map((group) => (
                    <div key={group.category} className="mb-3">
                      <div className="fleet-category-head">
                        <span className="fleet-badge category-badge">{group.category}</span>
                        <span className="text-muted small">{group.items.length} vehicle{group.items.length > 1 ? 's' : ''}</span>
                      </div>
                      {group.items.map((v) => (
                        <div className="fleet-row" key={v.id}>
                          {v.image ? (
                            <img className="fleet-thumb-img" src={v.image} alt={v.name} loading="lazy" />
                          ) : (
                            <span className="fleet-thumb"><i className="bi bi-car-front" /></span>
                          )}
                          <div className="flex-grow-1">
                            <div className="task-name">
                              {v.name}
                              {v.demo && <span className="badge bg-secondary ms-2" style={{ fontSize: '0.62rem' }}>Sample</span>}
                            </div>
                            <div className="task-sub">{v.type} · {v.unitNumber || v.plateNumber} · {formatPrice(v.pricePerDay)}/day</div>
                          </div>
                          <span className={`fleet-badge fleet-badge-${v.status}`}>{v.status}</span>
                          {v.demo ? (
                            <span className="text-muted small px-2 text-nowrap">Seed or add one to manage</span>
                          ) : (
                            <div className="d-flex gap-1">
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSearchParams({ manage: v.id }, { replace: true })}>
                                <i className="bi bi-pencil" />
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeVehicle(v.id)}>
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'drivers' && (
          <div className="dashboard-grid">
            <div className="panel-card">
              <div className="panel-header"><h2>{editingDriver ? 'Edit driver' : 'Add driver'}</h2></div>
              <div className="p-3">
                <form onSubmit={saveDriver}>
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="book-label">Full name</label>
                      <input className="form-control book-input" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <label className="book-label">Phone</label>
                      <input className="form-control book-input" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="book-label">Licence no.</label>
                      <input className="form-control book-input" value={driverForm.licenseNo} onChange={(e) => setDriverForm({ ...driverForm, licenseNo: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="book-label">Vehicle unit</label>
                      <input className="form-control book-input" placeholder="F-102" value={driverForm.vehicleUnit} onChange={(e) => setDriverForm({ ...driverForm, vehicleUnit: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Shift start</label>
                      <input type="time" className="form-control book-input" value={driverForm.shiftStart} onChange={(e) => setDriverForm({ ...driverForm, shiftStart: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Shift end</label>
                      <input type="time" className="form-control book-input" value={driverForm.shiftEnd} onChange={(e) => setDriverForm({ ...driverForm, shiftEnd: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <label className="book-label">Rating (1–5)</label>
                      <input type="number" min="1" max="5" step="0.1" className="form-control book-input" value={driverForm.rating} onChange={(e) => setDriverForm({ ...driverForm, rating: e.target.value })} />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <label className="d-flex gap-2 align-items-center">
                        <input type="checkbox" className="form-check-input" checked={driverForm.available !== false} onChange={(e) => setDriverForm({ ...driverForm, available: e.target.checked })} />
                        <span className="small">Available now</span>
                      </label>
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-3">
                    <button type="submit" className="btn-log" disabled={saving}>
                      <i className="bi bi-check-lg me-2" />{saving ? 'Saving…' : editingDriver ? 'Save changes' : 'Add driver'}
                    </button>
                    {editingDriver && (
                      <button type="button" className="btn btn-light" onClick={() => { setEditingDriver(null); setDriverForm(EMPTY_DRIVER); }}>Cancel</button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-header"><h2>Roster ({drivers.length})</h2></div>
              <div style={{ padding: '0.75rem' }}>
                {drivers.length === 0 ? (
                  <div className="dash-empty">No drivers yet.</div>
                ) : (
                  drivers.map((d) => (
                    <div className="fleet-row" key={d.id}>
                      <span className="avatar">{(d.name || '?').charAt(0).toUpperCase()}</span>
                      <div className="flex-grow-1">
                        <div className="task-name">{d.name}</div>
                        <div className="task-sub">Shift {d.shiftStart}–{d.shiftEnd} · {d.vehicleUnit || 'no unit'} · ★{d.rating ?? 5}</div>
                      </div>
                      <button type="button" className={`btn btn-sm ${d.available !== false ? 'btn-success' : 'btn-outline-secondary'}`} onClick={async () => { await toggleDriverAvailability(d.id, d.available !== false ? false : true); await load(); }}>
                        {d.available !== false ? 'Available' : 'Off duty'}
                      </button>
                      <div className="d-flex gap-1">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingDriver(d.id); setDriverForm({ name: d.name, phone: d.phone || '', licenseNo: d.licenseNo || '', vehicleUnit: d.vehicleUnit || '', shiftStart: d.shiftStart || '08:00', shiftEnd: d.shiftEnd || '18:00', rating: d.rating ?? 5, available: d.available !== false }); }}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeDriver(d.id)}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}