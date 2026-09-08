import { useEffect, useState } from 'react';
import pixelmatch from 'pixelmatch';
import './map.css';

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

const renderToCanvas = (img, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  return { canvas, ctx, data };
};

export default function DamageCompare({ height = 112, onResult }) {
  const [baseline, setBaseline] = useState(null);
  const [current, setCurrent] = useState(null);
  const [diff, setDiff] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (baseline?.url) URL.revokeObjectURL(baseline.url);
    if (current?.url) URL.revokeObjectURL(current.url);
    if (diff?.url) URL.revokeObjectURL(diff.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (e, side) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const item = { file, url: URL.createObjectURL(file) };
    if (side === 'baseline') setBaseline(item);
    else setCurrent(item);
    setDiff(null);
  };

  const compare = async () => {
    setError('');
    setRunning(true);
    try {
      const [imgA, imgB] = await Promise.all([loadImage(baseline.file), loadImage(current.file)]);
      const scale = Math.min(1, 560 / Math.max(imgA.width, imgB.width));
      const width = Math.max(160, Math.round(Math.max(imgA.width, imgB.width) * scale));
      const height = Math.max(120, Math.round(Math.max(imgA.height, imgB.height) * scale));
      const a = renderToCanvas(imgA, width, height);
      const b = renderToCanvas(imgB, width, height);
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = width;
      diffCanvas.height = height;
      const diffCtx = diffCanvas.getContext('2d');
      const out = diffCtx.createImageData(width, height);
      const mismatched = pixelmatch(a.data.data, b.data.data, out.data, width, height, {
        threshold: 0.12,
        includeAA: false,
      });
      const pct = (mismatched / (width * height)) * 100;
      diffCtx.putImageData(out, 0, 0);
      const result = {
        pct: Math.round(pct * 100) / 100,
        flagged: pct > 5,
      };
      setDiff({ ...result, url: diffCanvas.toDataURL('image/png') });
      onResult?.(result);
    } catch {
      setError('Could not analyse the photos — try different images.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fleet-damage-compare">
      <div className="d-flex flex-wrap gap-3">
        <label className="fleet-damage-box">
          <span className="text-muted small d-block">Baseline (check-out)</span>
          {baseline && <img src={baseline.url} alt="baseline" style={{ height }} />}
          {!baseline && <span className="fleet-damage-placeholder"><i className="bi bi-camera" />Check-out photo</span>}
          <input type="file" accept="image/*" className="d-none" onChange={(e) => pick(e, 'baseline')} />
        </label>
        <label className="fleet-damage-box">
          <span className="text-muted small d-block">Now (check-in)</span>
          {current && <img src={current.url} alt="current" style={{ height }} />}
          {!current && <span className="fleet-damage-placeholder"><i className="bi bi-camera" />Returned photo</span>}
          <input type="file" accept="image/*" className="d-none" onChange={(e) => pick(e, 'current')} />
        </label>
        <div className="fleet-damage-cta">
          <button
            type="button"
            className="btn-log"
            style={{ background: '#355f8c' }}
            disabled={!baseline || !current || running}
            onClick={compare}
          >
            <i className={`bi ${running ? 'bi-arrow-repeat spin' : 'bi-ui-checks'} me-2`} />
            {running ? 'Comparing…' : 'Run damage check'}
          </button>
          {error && <div className="text-danger small mt-1">{error}</div>}
        </div>
      </div>

      {diff && (
        <div className="d-flex align-items-center gap-3 mt-3">
          <img src={diff.url} alt="diff" style={{ height: 120, borderRadius: 8, border: '1px solid #dee2e6' }} />
          <div>
            <div className={`fleet-badge ${diff.flagged ? 'fleet-badge-InMaintenance' : 'fleet-badge-Available'}`}>
              {diff.flagged ? 'Damage flagged — review' : 'No significant change'}
            </div>
            <div className="text-muted small mt-1">
              {diff.pct}% pixel mismatch across regions
            </div>
          </div>
        </div>
      )}
    </div>
  );
}