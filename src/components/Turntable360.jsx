import { useEffect, useRef, useState } from 'react';

const SIDES = [
  { angle: 0, label: 'Front' },
  { angle: 90, label: 'Right' },
  { angle: 180, label: 'Rear' },
  { angle: 270, label: 'Left' },
];

// Draggable 360° turntable. `strip` is a wide sprite image where consecutive
// frames are the SAME car rotated 360°, so dragging / auto-rotating cycles the
// viewed frame and shows every angle of the actual vehicle.
export default function Turntable360({
  strip,
  frames = 16,
  label = 'Vehicle',
  auto = true,
}) {
  const viewRef = useRef(null);
  const pointerRef = useRef(null);
  const angleRef = useRef(0);
  const autoRef = useRef(auto);

  const [angle, setAngle] = useState(0);
  const [autoSpin, setAutoSpin] = useState(auto);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    autoRef.current = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    if (!autoSpin || !strip) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      angleRef.current = (angleRef.current + 30 * dt) % 360;
      setAngle(((angleRef.current % 360) + 360) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin, strip]);

  const frameIndex = Math.round((angle % 360) / (360 / frames)) % frames;

  const nearest = SIDES.reduce(
    (best, s) => {
      const d = Math.min(Math.abs(angle - s.angle), 360 - Math.abs(angle - s.angle));
      return d < best.d ? { s, d } : best;
    },
    { s: SIDES[0], d: 999 },
  ).s;

  const go = (deg) => {
    angleRef.current = deg % 360;
    setAutoSpin(false);
    setAngle((((deg % 360) + 360) % 360));
  };

  const onPointerDown = (e) => {
    pointerRef.current = { x: e.clientX, a: angleRef.current, w: viewRef.current?.clientWidth || 300 };
    setAutoSpin(false);
    setGrabbing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!pointerRef.current) return;
    const dx = e.clientX - pointerRef.current.x;
    const deg = pointerRef.current.a + (dx / pointerRef.current.w) * 360;
    angleRef.current = ((deg % 360) + 360) % 360;
    setAngle(angleRef.current);
  };

  const onPointerUp = () => {
    pointerRef.current = null;
    setGrabbing(false);
  };

  const bgSize = `${frames * 100}% 100%`;
  const bgPos = `${frames > 1 ? (frameIndex / (frames - 1)) * 100 : 0}% 0`;

  return (
    <div className="tt" aria-label={`${label} 360° view`}>
      <div
        ref={viewRef}
        className={`tt-stage ${grabbing ? 'tt-grabbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag to rotate the car 360°"
      >
        <div
          className="tt-bg"
          role="img"
          aria-label={`${label} 360° view`}
          style={{ backgroundImage: `url(${strip})`, backgroundSize: bgSize, backgroundPosition: bgPos }}
        />

        <span className="tt-hint">
          <i className="bi bi-arrows-move me-1" />
          drag to rotate · shows every angle
        </span>

        <span className="tt-angle">
          Viewing <b>{nearest.label}</b>
        </span>
      </div>

      <div className="tt-bar">
        <div className="tt-sides">
          {SIDES.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`tt-side-btn ${nearest.label === s.label ? 'active' : ''}`}
              onClick={() => go(s.angle)}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={`tt-side-btn ${autoSpin ? 'active' : ''}`}
            onClick={() => setAutoSpin((v) => !v)}
            title={autoSpin ? 'Pause rotation' : 'Auto rotate'}
          >
            <i className={`bi ${autoSpin ? 'bi-pause-fill' : 'bi-play-fill'}`} />
          </button>
        </div>
      </div>

      <input
        type="range"
        min="1"
        max={frames}
        step="1"
        value={frameIndex + 1}
        className="form-range tt-slider mt-1"
        onChange={(e) => go(((Number(e.target.value) - 1) / frames) * 360)}
        aria-label={`${label} rotation`}
      />
    </div>
  );
}