export const formatPrice = (value) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayISO = () => toISODate(new Date());

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const nightsBetween = (from, to) => {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
};

export const formatGuestDate = (iso, options = {}) => {
  if (!iso) return '-';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
};

export const formatDateRange = (from, to) => {
  if (!from || !to) return '-';
  const start = formatGuestDate(from, { day: 'numeric', month: 'short' });
  const end = formatGuestDate(to, { day: 'numeric', month: 'short' });
  return `${start} – ${end}`;
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  const d = typeof value === 'object' && value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (value) => {
  if (!value) return '-';
  const d = typeof value === 'object' && value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

export const titleCase = (s) =>
  String(s || '')
    .split(' ')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

export const bookingRef = () =>
  `GH-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

export const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (['checkedin', 'approved', 'confirmed', 'completed', 'found', 'paid', 'resolved', 'inprogress', 'available'].includes(s)) return 'success';
  if (['pending', 'processing', 'searching', 'unpaid', 'open', 'in review', 'low'].includes(s)) return 'warning';
  if (['cancelled', 'declined', 'rejected', 'checkedout', 'lost', 'damaged', 'missing'].includes(s)) return 'danger';
  if (['dirty', 'maintenance', 'onhold'].includes(s)) return 'dark';
  return 'info';
};

export const fileToDataUrl = (file, maxSize = 1000, quality = 0.8) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not process image.'));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

export const firstInitial = (name = '') => (name || '?').trim().charAt(0).toUpperCase();
