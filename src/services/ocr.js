import { createWorker } from 'tesseract.js';

// Single lazily-created worker reused across scans (kept in module scope).
let workerPromise = null;
const getWorker = () => {
  if (!workerPromise) {
    workerPromise = createWorker('eng').then((w) => w);
  }
  return workerPromise;
};

const parseDates = (text) => {
  const matches = [...text.matchAll(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/g)];
  const parsed = [];
  for (const m of matches) {
    const [, a, b, c] = m;
    let day;
    let month;
    let year;
    const y = c.length === 2 ? 2000 + Number(c) : Number(c);
    if (Number(a) > 12) {
      day = Number(a);
      month = Number(b);
    } else if (Number(b) > 12) {
      day = Number(b);
      month = Number(a);
    } else {
      day = Number(a);
      month = Number(b);
      year = y + 100 > 2050 ? y - 100 : y;
    }
    if (!year) year = y;
    const date = new Date(year, month - 1, day, 23, 59, 59);
    if (!Number.isNaN(date.getTime())) parsed.push({ date, day, month, year });
  }
  return parsed;
};

const findExpiry = (text) => {
  const dates = parseDates(text);
  const now = Date.now();
  const future = dates.filter((d) => d.date.getTime() >= now).sort((a, b) => a.date - b.date);
  if (future.length > 0) return future[future.length - 1];
  const all = dates.sort((a, b) => b.date - a.date);
  return all.length > 0 ? all[0] : null;
};

export const scanLicence = async (file) => {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  const text = (data.text || '').replace(/[ \t]+/g, ' ').trim();
  const upper = text.toUpperCase();

  let licenseNumber = '';
  // "Licence No: 441520" style lines
  const noLine = upper.match(/LICEN[CS]E[^\n]*?NO[^\n]*[:#]?\s*([A-Z0-9\-\s]{4,16})/);
  if (noLine) {
    licenseNumber = noLine[1].replace(/[^A-Z0-9]/gi, '').replace(/^[RSAV0O]{3,}/, '');
  }
  if (!licenseNumber.match(/[\d]{4,}/)) {
    // fall back to longest digit run on the card
    const runs = [...upper.matchAll(/\d{5,13}/g)].map((m) => m[0]);
    licenseNumber = runs.reduce((acc, r) => (r.length > acc.length ? r : acc), '');
  }

  let licenseExpiry = '';
  const expiry = findExpiry(text);
  if (expiry) licenseExpiry = `${expiry.year}-${String(expiry.month).padStart(2, '0')}-${String(expiry.day).padStart(2, '0')}`;

  let dob = '';
  const id13 = [...upper.matchAll(/\b\d{13}\b/g)].map((m) => m[0])[0];
  if (id13) {
    const yy = Number(id13.slice(0, 2));
    const mm = Number(id13.slice(2, 4));
    const dd = Number(id13.slice(4, 6));
    const year = yy > 40 ? 1900 + yy : 2000 + yy;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) dob = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return {
    text,
    licenseNumber,
    licenseExpiry,
    dob,
    confidence: Math.round(data.confidence || 0),
  };
};