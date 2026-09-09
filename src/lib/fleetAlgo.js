import { round } from './utils';
import {
  CANCELLATION_WINDOW_HOURS,
  CANCELLATION_FEE,
  FLEET_BRANCHES,
  ONE_WAY_FEES,
  YOUNG_DRIVER_SURCHARGE_PER_DAY,
  YOUNG_DRIVER_SURCHARGE_CAP_DAYS,
  YOUNG_DRIVER_AGE_THRESHOLD,
  WAIVER_LIABILITY_CAP,
  ADDITIONAL_DRIVER_FEE,
  LATE_RETURN_DAILY_FEE,
  REFUEL_SERVICE_FEE,
  FUEL_PRICE_PER_LITRE,
  TANK_LITRES_DEFAULT,
  ACCIDENT_ADMIN_FEE,
  ACCIDENT_ADMIN_FEE_LOW,
  ACCIDENT_ADMIN_FEE_LOW_THRESHOLD,
  RENTAL_CANCELLATION_POLICY,
  SERVICE_NOTICE_HOURS,
  SERVICE_CANCELLATION_TIERS,
  DEPOSIT_AMOUNT,
  HOURLY_RATE_FACTOR,
  LEASE_MONTHLY_FACTOR,
} from './constants';

// ---------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------

export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---------------------------------------------------------------
// Dynamic pricing engine (rule based, no external service)
// ---------------------------------------------------------------

const PEAK_MONTHS = [10, 11, 0];
const WEEKEND_DAYS = [5, 6, 0];
const LAST_MINUTE_HOURS = 72;
const LONG_RENTAL_DAYS = 5;

export const dynamicRateMultiplier = ({ pickupDate, dropoffDate, pricePerDay }) => {
  const reasons = [];
  let factor = 1;
  const d0 = pickupDate ? new Date(`${pickupDate}T00:00:00`) : null;
  const d1 = dropoffDate ? new Date(`${dropoffDate}T00:00:00`) : null;
  if (!d0 || Number.isNaN(d0.getTime()) || !d1 || Number.isNaN(d1.getTime())) {
    return { factor: 1, adjustedDaily: pricePerDay || 0, reasons: ['Standard rate'] };
  }

  let days = 0;
  let weekendDays = 0;
  let peakDays = 0;
  const cursor = new Date(d0);
  while (cursor <= d1) {
    days += 1;
    if (WEEKEND_DAYS.includes(cursor.getDay())) weekendDays += 1;
    if (PEAK_MONTHS.includes(cursor.getMonth())) peakDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (weekendDays > 0) {
    factor += 0.1;
    reasons.push(`${weekendDays} weekend day${weekendDays > 1 ? 's' : ''} → +10%`);
  }
  if (peakDays > 0) {
    factor += 0.15;
    reasons.push('Peak season (Nov–Jan) → +15%');
  }
  const hoursToPickup = (new Date(`${d0}T00:00:00`).getTime() - Date.now()) / 3600000;
  if (hoursToPickup >= 0 && hoursToPickup < LAST_MINUTE_HOURS) {
    factor += 0.08;
    reasons.push('Booked within 72h → +8%');
  }
  if (days >= LONG_RENTAL_DAYS) {
    factor -= 0.1;
    reasons.push(`${days}-day rental → −10% (long stay)`);
  }

  factor = Math.min(1.35, Math.max(0.85, round(factor)));
  if (factor === 1) reasons.unshift('Standard rate');
  const adjustedDaily = pricePerDay ? round(Number(pricePerDay) * factor) : 0;
  return { factor, adjustedDaily, days, weekendDays, peakDays, reasons };
};

// ---------------------------------------------------------------
// Smart Match — score a vehicle for a guest context
// ---------------------------------------------------------------

const TRIP_CATEGORY_PREF = {
  'Airport Transfer': ['Shuttle', 'Luxury'],
  'Local Trip': ['Compact', 'Sedan'],
  Business: ['Sedan', 'Luxury'],
  Family: ['SUV', 'Shuttle'],
  Leisure: ['SUV', 'Sedan', 'Luxury'],
};

const CATEGORY_RANK = { Compact: 2, Sedan: 4, SUV: 6, Luxury: 8, Shuttle: 5 };

export const vehicleMatchScore = (vehicle, ctx = {}) => {
  const {
    tripType = 'Local Trip',
    partySize = 2,
    budgetPerDay = null,
    pastRentals = [],
    childSeat = false,
  } = ctx;
  let score = 5;
  const reasons = [];

  const preferred = TRIP_CATEGORY_PREF[tripType] || ['Sedan'];
  const cat = vehicle.category || vehicle.type || '';
  const rank = preferred.indexOf(cat);
  if (rank === 0) {
    score += 40;
    reasons.push(`Ideal for ${tripType}`);
  } else if (rank > 0) {
    score += 24;
    reasons.push(`Good fit for ${tripType}`);
  } else {
    score -= 8;
    reasons.push(`Not the typical pick for ${tripType}`);
  }

  const capacity = Number(vehicle.capacity) || 4;
  if (capacity >= partySize) {
    score += 20;
    const surplus = capacity - partySize;
    if (surplus > 3) {
      score -= 8;
      reasons.push(`Roomy but maybe larger than needed`);
    }
  } else {
    score -= 30;
    reasons.push(`Only seats ${capacity} — below your party size`);
  }

  if (budgetPerDay != null && budgetPerDay > 0) {
    const price = Number(vehicle.pricePerDay) || 0;
    if (price <= budgetPerDay) {
      score += 20;
      reasons.push('Within your daily budget');
    } else if (price <= budgetPerDay * 1.2) {
      score -= 5;
      reasons.push('Slightly over budget');
    } else {
      score -= 15;
      reasons.push('Over your daily budget');
    }
  }

  if (pastRentals.length > 0) {
    const recent = [...pastRentals].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
    const seenCount = recent.filter((r) => r.category === cat || r.type === cat || r.vehicleId === vehicle.id).length;
    if (seenCount > 0) {
      score += 10 * Math.min(seenCount, 2);
      reasons.push(`You’ve hired this class before`);
    }
  }

  const features = vehicle.features || [];
  if (childSeat && features.includes('Child Seat')) {
    score += 12;
    reasons.push('Child seat available');
  }
  if (features.includes('GPS Navigation')) {
    score += 4;
  }

  return {
    vehicle,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 4),
  };
};

export const smartMatchVehicles = (vehicles, ctx = {}) =>
  vehicles
    .map((v) => vehicleMatchScore(v, ctx))
    .sort((a, b) => b.score - a.score);

export const categoryPriceRank = (category) => CATEGORY_RANK[category] || 3;

// ---------------------------------------------------------------
// Rate card — hourly / daily / leasing tiers for a vehicle
// ---------------------------------------------------------------

export const vehicleRateCard = (vehicle) => {
  const perDay = Number(vehicle?.pricePerDay) || 0;
  const perHour = Number(vehicle?.pricePerHour) || round(perDay * HOURLY_RATE_FACTOR);
  const perMonth = Number(vehicle?.pricePerMonth) || round(perDay * LEASE_MONTHLY_FACTOR);
  return { perHour, perDay, perMonth };
};

// ---------------------------------------------------------------
// Rating display — real rating/reviewCount if a manager set them,
// otherwise a stable per-vehicle placeholder (until guest reviews ship)
// ---------------------------------------------------------------

const seedFromString = (str) => {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const vehicleRatingInfo = (vehicle) => {
  if (Number(vehicle?.rating) > 0) {
    return { rating: Number(vehicle.rating), reviewCount: Number(vehicle.reviewCount) || 0, isPlaceholder: false };
  }
  const seed = seedFromString(vehicle?.unitNumber || vehicle?.id || vehicle?.name);
  return {
    rating: round(3.8 + (seed % 12) / 10),
    reviewCount: 6 + (seed % 35),
    isPlaceholder: true,
  };
};

// ---------------------------------------------------------------
// Driver matching — proximity + workload scoring
// ---------------------------------------------------------------

export const rankDriversForTrip = (drivers, { pickupLat = null, pickupLng = null, tripType = '', activeCounts = {} } = {}) => {
  const pool = drivers.filter((d) => d.available !== false);
  if (pool.length === 0) return [];
  return pool
    .map((d) => {
      let score = 40;
      const reasons = [];
      if (pickupLat != null && d.homeLat != null && d.homeLng != null) {
        const km = haversineKm(Number(pickupLat), Number(pickupLng), Number(d.homeLat), Number(d.homeLng));
        const prox = Math.max(0, 50 - km * 2);
        score += prox;
        reasons.push(`~${km.toFixed(1)} km from pickup`);
      } else {
        score += 10;
        reasons.push('Zone not pinned — neutral distance');
      }
      score += 15;
      reasons.push('On duty');
      const load = Number(activeCounts[d.id] || 0);
      if (load === 0) {
        score += 10;
        reasons.push('No active trip');
      } else {
        score -= load * 8;
        reasons.push(`${load} active trip${load > 1 ? 's' : ''}`);
      }
      if (d.rating) {
        score += (Number(d.rating) - 4) * 10;
        reasons.push(`Rating ${d.rating}`);
      }
      if (tripType === 'Airport Transfer' && d.vehicleUnit) {
        score += 5;
        reasons.push('Shift vehicle assigned');
      }
      return { ...d, matchScore: Math.max(0, Math.min(100, Math.round(score))), matchReasons: reasons };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
};

// ---------------------------------------------------------------
// Cancellation penalty preview
// ---------------------------------------------------------------

export const cancellationPreview = ({ pickupDate, pickupTime = '10:00' }) => {
  const pickup = pickupDate ? new Date(`${pickupDate}T${pickupTime || '00:00'}`) : new Date(NaN);
  const hoursUntilPickup = Number.isNaN(pickup.getTime())
    ? 0
    : Math.max(0, (pickup.getTime() - Date.now()) / 3600000);
  const withinWindow = hoursUntilPickup < CANCELLATION_WINDOW_HOURS;
  return {
    pickupDate,
    pickupTime,
    hoursUntilPickup: round(hoursUntilPickup),
    windowHours: CANCELLATION_WINDOW_HOURS,
    withinWindow,
    free: !withinWindow,
    fee: withinWindow ? CANCELLATION_FEE : 0,
  };
};

// ---------------------------------------------------------------
// Predictive analytics — moving average + linear regression
// ---------------------------------------------------------------

export const movingAverage = (values, window = 3) => {
  const out = [];
  for (let i = 0; i < (values || []).length; i += 1) {
    const slice = (values || []).slice(Math.max(0, i - window + 1), i + 1);
    out.push(round(slice.reduce((s, v) => s + Number(v), 0) / slice.length));
  }
  return out;
};

export const linearFit = (points) => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? points[0].y : 0, r2: 1 };
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    ssRes += (p.y - (intercept + slope * p.x)) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  return { slope, intercept, r2: ssTot === 0 ? 1 : round(1 - ssRes / ssTot) };
};

export const projectSeries = (values, opts = {}) => {
  const horizon = opts.horizon || 7;
  const lookback = opts.lookback || 21;
  const data = (values || []).map((v, i) => ({ x: i, y: Number(v) || 0 }));
  const fit = linearFit(data.slice(-Math.min(lookback, data.length)));
  let last = data.length > 0 ? data[data.length - 1].y : 0;
  const out = [...data.map((p) => p.y)];
  for (let i = 1; i <= horizon; i += 1) {
    const forecast = Math.max(0, fit.intercept + fit.slope * (data.length - 1 + i));
    last = round((last + forecast) / 2);
    out.push(last);
  }
  return { series: out, forecastCount: horizon, slope: fit.slope, r2: fit.r2 };
};

// ---------------------------------------------------------------
// Avis-aligned fee calculators (UC11, UC13–UC16, UC17, UC19, UC21)
// ---------------------------------------------------------------

export const ageFromDob = (dob) => {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
};

export const isYoungDriver = (dob) => {
  const age = ageFromDob(dob);
  return age != null && age < YOUNG_DRIVER_AGE_THRESHOLD;
};

export const additionalDriverFee = (hasAdditionalDriver) => (hasAdditionalDriver ? ADDITIONAL_DRIVER_FEE : 0);

export const youngDriverSurcharge = (dob, days) => {
  if (!isYoungDriver(dob)) return 0;
  const chargeableDays = Math.min(Math.max(0, Number(days) || 0), YOUNG_DRIVER_SURCHARGE_CAP_DAYS);
  return round(chargeableDays * YOUNG_DRIVER_SURCHARGE_PER_DAY);
};

export const branchById = (branchId) => FLEET_BRANCHES.find((b) => b.id === branchId) || null;

export const locationSurcharge = (pickupBranchId) => Number(branchById(pickupBranchId)?.locationSurcharge) || 0;

export const liabilityCapFor = (vehicle, hasWaiver) =>
  hasWaiver ? WAIVER_LIABILITY_CAP : Number(vehicle?.deposit) || DEPOSIT_AMOUNT;

export const oneWayFee = (pickupBranchId, returnBranchId) => {
  if (!pickupBranchId || !returnBranchId || pickupBranchId === returnBranchId) return 0;
  return Number(ONE_WAY_FEES[`${pickupBranchId}-${returnBranchId}`]) || 0;
};

export const noticePeriodCheck = (serviceType, pickupDate, pickupTime = '00:00') => {
  const hoursRequired = Number(SERVICE_NOTICE_HOURS[serviceType]) || 0;
  const pickup = pickupDate ? new Date(`${pickupDate}T${pickupTime || '00:00'}`) : new Date(NaN);
  const hoursNotice = Number.isNaN(pickup.getTime()) ? 0 : (pickup.getTime() - Date.now()) / 3600000;
  return {
    hoursRequired,
    hoursNotice: round(hoursNotice),
    ok: hoursNotice >= hoursRequired,
  };
};

export const lateReturnCharges = ({ scheduledDropoff, scheduledDropoffTime = '00:00', actualReturn = Date.now(), dailyRate = 0, graceHours = 0 }) => {
  const scheduled = scheduledDropoff ? new Date(`${scheduledDropoff}T${scheduledDropoffTime || '00:00'}`) : new Date(NaN);
  const actual = typeof actualReturn === 'number' ? new Date(actualReturn) : new Date(actualReturn);
  const elapsedHours = Math.round((actual.getTime() - scheduled.getTime()) / 3600000);
  if (Number.isNaN(scheduled.getTime()) || Number.isNaN(actual.getTime()) || actual <= scheduled) {
    return { lateDays: 0, extraDayFee: 0, dailyLateFee: 0, total: 0, status: 'Early', elapsedHours, lateHours: 0, graceHours };
  }
  const lateHoursRaw = Math.ceil((actual.getTime() - scheduled.getTime()) / 3600000);
  const chargeableHours = Math.max(0, lateHoursRaw - (Number(graceHours) || 0));
  const status = chargeableHours === 0 ? 'OnTime' : 'Late';
  const lateDays = Math.ceil(chargeableHours / 24);
  const extraDayFee = round(lateDays * (Number(dailyRate) || 0));
  const dailyLateFee = round(lateDays * LATE_RETURN_DAILY_FEE);
  return { lateDays, extraDayFee, dailyLateFee, total: round(extraDayFee + dailyLateFee), status, elapsedHours, lateHours: chargeableHours, graceHours };
};

export const fuelVarianceCharge = ({ fuelOutPct = 0, fuelInPct = 0, tankLitres = TANK_LITRES_DEFAULT }) => {
  const shortfallPct = Math.max(0, (Number(fuelOutPct) || 0) - (Number(fuelInPct) || 0));
  if (shortfallPct <= 0) return { shortfallLitres: 0, fuelCost: 0, serviceFee: 0, total: 0 };
  const shortfallLitres = round((shortfallPct / 100) * (Number(tankLitres) || TANK_LITRES_DEFAULT));
  const fuelCost = round(shortfallLitres * FUEL_PRICE_PER_LITRE);
  return { shortfallLitres, fuelCost, serviceFee: REFUEL_SERVICE_FEE, total: round(fuelCost + REFUEL_SERVICE_FEE) };
};

export const accidentAdminFee = (repairEstimate = 0) =>
  Number(repairEstimate) > 0 && Number(repairEstimate) < ACCIDENT_ADMIN_FEE_LOW_THRESHOLD
    ? ACCIDENT_ADMIN_FEE_LOW
    : ACCIDENT_ADMIN_FEE;

// UC21 policy branched from UC11 (self-drive rentals): ≥3 days out → lower of
// paid amount or R550; <3 days out → lower of paid amount or 3 days' rental
// value; day-of/no-show → full amount retained.
export const rentalCancellationPenalty = ({ paidAmount = 0, dailyRate = 0, hoursUntilPickup = 0, isDayOf = false }) => {
  const paid = Number(paidAmount) || 0;
  if (isDayOf || hoursUntilPickup <= 0) {
    return { fee: paid, tier: 'DayOf/NoShow', note: 'Day-of or no-show — full amount retained' };
  }
  const daysOut = hoursUntilPickup / 24;
  if (daysOut >= RENTAL_CANCELLATION_POLICY.farWindowDays) {
    return {
      fee: round(Math.min(paid, RENTAL_CANCELLATION_POLICY.farWindowFee)),
      tier: `>=${RENTAL_CANCELLATION_POLICY.farWindowDays} days`,
      note: `Lower of paid amount or R${RENTAL_CANCELLATION_POLICY.farWindowFee}`,
    };
  }
  const threeDaysValue = round(3 * (Number(dailyRate) || 0));
  return {
    fee: round(Math.min(paid, threeDaysValue)),
    tier: `<${RENTAL_CANCELLATION_POLICY.farWindowDays} days`,
    note: "Lower of paid amount or 3 days' rental value",
  };
};

// UC21 policy branched from UC17 (chauffeur/transfer bookings).
export const serviceCancellationPenalty = ({ confirmedBookingAmount = 0, hoursUntilPickup = 0 }) => {
  const amount = Number(confirmedBookingAmount) || 0;
  let fraction = SERVICE_CANCELLATION_TIERS.hours24;
  let tier = '>=24h notice';
  if (hoursUntilPickup < 1) {
    fraction = SERVICE_CANCELLATION_TIERS.underHour1;
    tier = '<1h notice';
  } else if (hoursUntilPickup < 24) {
    fraction = SERVICE_CANCELLATION_TIERS.underHours24;
    tier = '<24h notice';
  }
  return { fee: round(amount * fraction), tier, fraction };
};

export const groupDailyCounts = (items = [], { valueOf = (i) => i?.createdAt, days = 14 } = {}) => {
  const buckets = {};
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, label: d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), count: 0, revenue: 0 };
  }
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    let ts;
    try {
      ts = typeof valueOf === 'function' ? valueOf(item) : item.createdAt;
    } catch {
      continue;
    }
    if (ts == null) continue;
    let d;
    try {
      d = typeof ts.toDate === 'function'
        ? ts.toDate()
        : typeof ts.toMillis === 'function'
          ? new Date(ts.toMillis())
          : typeof ts.toSeconds === 'function'
            ? new Date(ts.toSeconds() * 1000)
            : new Date(ts);
    } catch {
      continue;
    }
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (!buckets[key]) return null;
    buckets[key].count += 1;
    buckets[key].revenue += Number(item?.finalCharges) || Number(item?.estimatedTotal) || Number(item?.estimatedFare) || 0;
  }
  return Object.values(buckets || {});
};