import { useState } from 'react';
import { Link } from 'react-router-dom';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_HEADS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toKey = (d) => d.toISOString().slice(0, 10);
const toDate = (key) => new Date(`${key}T00:00:00`);

export default function AvailabilityPicker({ bookedDays = [], roomId, title = 'Select your dates' }) {
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [range, setRange] = useState(null);

  const booked = new Set(bookedDays.map((d) => toKey(d)));
  const now = toKey(today);

  const days = buildMonth(cursor.year, cursor.month);
  const selectedStart = range ? toKey(range.start) : null;
  const selectedEnd = range ? toKey(range.end) : null;

  const moveMonth = (delta) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  const selectDay = (key) => {
    if (key < now || booked.has(key)) return;
    setRange((r) => {
      if (!r) return { start: key, end: key };
      if (key < r.start) return { start: key, end: r.end };
      if (key > r.end) return { start: r.start, end: key };
      return { start: key, end: key };
    });
  };

  const inRange = (key) => {
    if (!range) return false;
    return key > range.start && key < range.end;
  };

  return (
    <div className={`avail-picker open`}>
      <div className="avail-nav">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="avail-month-label">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </span>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="avail-grid">
        {DAY_HEADS.map((h) => (
          <span key={h} className="avail-day-head">
            {h}
          </span>
        ))}
        {days.map((day, i) => {
          if (!day) return <span key={`e${i}`} className="avail-day empty" />;
          const key = toKey(day);
          const cls = ['avail-day'];
          if (key < now) cls.push('past');
          if (booked.has(key)) cls.push('booked');
          if (key >= now && !booked.has(key)) cls.push('available');
          if (key === selectedStart || key === selectedEnd) cls.push('sel-start');
          if (inRange(key)) cls.push('in-range');
          return (
            <span key={key} className={cls.join(' ')} onClick={() => selectDay(key)}>
              {day.getDate()}
            </span>
          );
        })}
      </div>

      <div className="avail-legend">
        <span>
          <i className="avail-dot dot-booked" /> Booked
        </span>
        <span>
          <i className="avail-dot dot-avail" /> Available
        </span>
      </div>

      <div className="avail-date-display">
        {range
          ? `${toDate(range.start).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} → ${toDate(range.end).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : title}
      </div>

      {range && (
        <Link className="avail-book-btn visible" to={`/Rooms/Details/${roomId}`}>
          Book This Room
        </Link>
      )}
    </div>
  );
}

function buildMonth(year, month) {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const cells = new Array(first.getDay()).fill(null);
  for (let d = 1; d <= count; d += 1) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}
