import { useEffect, useRef, useState } from 'react';

const SIDES = [
  { key: 'front', label: 'Front', angle: 0, squash: 1, brightness: 1 },
  { key: 'right', label: 'Right', angle: 90, squash: 0.52, brightness: 0.9 },
  { key: 'rear', label: 'Rear', angle: 180, squash: -1, brightness: 0.8 },
  { key: 'left', label: 'Left', angle: 270, squash: -0.52, brightness: 0.92 },
];

const DEFAULT_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220"><rect width="400" height="220" fill="#e9e4da"/><text x="200" y="118" font-size="16" fill="#8a7f6d" text-anchor="middle">Car photo</text></svg>`,
  );

// CSS-3D turntable: drag, slider or quick buttons to rotate around the car and
// inspect every side. Each "side" renders the car photo with a different camera
// angle (squash / mirror / lighting) so front, both flanks and rear are visible
// while the perspective projection gives depth as you spin.
export default function CarViewer3D({ image, label = 'Vehicle', size = 240, auto = false }) {
  const width = Math.round(size * 1.62);
  const height = size;
  const radius = Math.round(width / 2 - 18);

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(auto);
  const [grabbing, setGrabbing] = useState(false);
  const rafRef = useRef(null);
  const pointerRef = useRef(null);

  useEffect(() => {
    if (!spinning) return undefined;
    let raf;
    const tick = () => {
      setAngle((a) => (a + 0.4) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const nearest = SIDES.reduce(
    (best, s) => {
      const d = Math.abs(((angle - s.angle + 540) % 360) - 180);
      return d < best.d ? { s, d } : best;
    },
    { s: SIDES[0], d: 999 },
  ).s;

  const go = (v) => {
    setSpinning(false);
    setAngle(((v % 360) + 360) % 360);
  };

  const onPointerDown = (e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, a: angle };
    setSpinning(false);
    setGrabbing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!pointerRef.current || !grabbing) return;
    const dx = e.clientX - pointerRef.current.x;
    setAngle(((pointerRef.current.a + dx * 0.22) % 360 + 360) % 360);
  };

  const onPointerUp = () => {
    pointerRef.current = null;
    setGrabbing(false);
  };

  return (
    <div className="car3d" style={{ maxWidth: width + 8 }}>
      <div
        className={`car3d-stage ${grabbing ? 'grabbing' : ''}`}
        style={{ width, height, perspective: Math.round(width * 1.9) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag to rotate the car"
      >
        <div className="car3d-track" style={{ transform: `rotateY(${angle}deg)` }}>
          {SIDES.map((side) => (
            <div
              key={side.key}
              className="car3d-face"
              style={{ width, height, transform: `rotateY(${side.angle}deg) translateZ(${radius}px)` }}
            >
              <img
                className="car3d-img"
                src={image || DEFAULT_IMG}
                alt={`${label} — ${side.label} view`}
                style={{ transform: `scaleX(${side.squash})`, filter: `brightness(${side.brightness})` }}
              />
              <span className="car3d-corner">{side.label}</span>
            </div>
          ))}
        </div>
        <div className="car3d-hint"><i className="bi bi-arrows-move me-1" />drag to spin</div>
      </div>

      <div className="car3d-compass">
        <span className={`car3d-compass-active`}>
          <i className="bi bi-arrow-repeat me-1" />Viewing {nearest.label}
        </span>
        {SIDES.map((side) => (
          <button
            key={side.key}
            type="button"
            className={`car3d-side-btn ${nearest.key === side.key ? 'active' : ''}`}
            onClick={() => go(side.angle)}
          >
            {side.label}
          </button>
        ))}
        <button
          type="button"
          className={`car3d-side-btn ${spinning ? 'active' : ''}`}
          onClick={() => setSpinning((v) => !v)}
          title={spinning ? 'Stop auto-spin' : 'Auto spin'}
        >
          <i className={`bi ${spinning ? 'bi-pause-fill' : 'bi-play-fill'}`} />
        </button>
      </div>

      <input
        type="range"
        min="0"
        max="360"
        step="1"
        value={angle}
        className="form-range car3d-slider mt-2"
        onChange={(e) => go(Number(e.target.value))}
        aria-label={`${label} rotation`}
      />
    </div>
  );
}