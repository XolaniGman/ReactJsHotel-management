import { useEffect, useMemo, useState } from 'react';
import CarStudio from './CarStudio';
import Turntable360 from './Turntable360';
import { stripCandidatesFor } from '../lib/strips';

// Photoreal WebGL showroom whenever a sprite strip isn't available yet, and the
// draggable 360° turntable (slicing the local strip) once one is — so the car
// always renders, AI-free, from files the user controls.
export default function CarTurntable({ vehicle, label = null, height = 420 }) {
  const name = label || vehicle?.name || 'Vehicle';
  const candidates = useMemo(() => stripCandidatesFor(vehicle), [vehicle]);

  const [strip, setStrip] = useState(null);
  const [frames, setFrames] = useState(16);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let live = true;
    setChecked(false);
    setStrip(null);
    const tryIndex = (i) => {
      if (!live || i >= candidates.length) {
        if (live) setChecked(true);
        return;
      }
      const candidate = candidates[i];
      const img = new Image();
      img.onload = () => {
        if (live) {
          setStrip(candidate.src);
          setFrames(candidate.frames);
          setChecked(true);
        }
      };
      img.onerror = () => tryIndex(i + 1);
      img.src = candidate.src;
    };
    tryIndex(0);
    return () => {
      live = false;
    };
  }, [candidates]);

  if (checked && strip) {
    return (
      <div className="ctt ctt-host" style={{ height }}>
        <Turntable360 strip={strip} frames={frames} label={name} />
      </div>
    );
  }

  return <CarStudio image={vehicle?.image} label={name} height={height} />;
}