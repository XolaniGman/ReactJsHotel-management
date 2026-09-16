import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const makeCanvasTexture = (draw, size = 512) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  return new THREE.CanvasTexture(canvas);
};

const makeBackdropTexture = () =>
  makeCanvasTexture((ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#171b21');
    g.addColorStop(0.42, '#262c35');
    g.addColorStop(0.62, '#3a414d');
    g.addColorStop(1, '#14171d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    const glow = ctx.createRadialGradient(s * 0.5, s * 0.55, s * 0.02, s * 0.5, s * 0.55, s * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.16)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
  }, 1024);

const makeShadowTexture = () =>
  makeCanvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 6, s / 2, s / 2, s * 0.42);
    g.addColorStop(0, 'rgba(5,8,12,0.6)');
    g.addColorStop(0.55, 'rgba(5,8,12,0.28)');
    g.addColorStop(1, 'rgba(5,8,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

const makeRingTexture = () =>
  makeCanvasTexture((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2);
    ctx.stroke();
  });

const makeStageLightTexture = () =>
  makeCanvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s * 0.5, s * 0.5, 4, s * 0.5, s * 0.5, s * 0.34);
    g.addColorStop(0, 'rgba(255,214,160,0.5)');
    g.addColorStop(0.45, 'rgba(255,196,140,0.16)');
    g.addColorStop(1, 'rgba(255,196,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

// A "studio showroom" turntable: straight-on photoreal render of the actual car
// photo on a glossy showroom floor with a true mirrored reflection, soft stage
// lighting and a cinematic orbit camera — no mismatched 3D model, always the
// vehicle you are actually looking at.
export default function CarStudio({
  image,
  label = 'Vehicle',
  height = 420,
  auto = true,
}) {
  const mountRef = useRef(null);
  const userDraggingRef = useRef(false);
  const spinRef = useRef(auto);
  const resetRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [spin, setSpin] = useState(auto);

  useEffect(() => {
    spinRef.current = spin;
  }, [spin]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setStatus('error');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.setClearColor(0x14171d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = makeBackdropTexture();

    const camera = new THREE.PerspectiveCamera(
      36,
      host.clientWidth / host.clientHeight,
      0.1,
      80,
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.4;
    controls.maxDistance = 9.5;
    controls.minAzimuthAngle = -1.25;
    controls.maxAzimuthAngle = 1.25;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = 0.72;
    controls.addEventListener('start', () => {
      userDraggingRef.current = true;
    });
    controls.addEventListener('end', () => {
      userDraggingRef.current = false;
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Studio lights (world-fixed, so light & shadow fall realistically).
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3.5, 6, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc9d8ff, 0.55);
    fill.position.set(-6, 3, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(-2, 4.5, -6);
    scene.add(rim);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a2430, 0.5);
    scene.add(hemi);

    // Glossy showroom floor — real mirror reflection of the car card.
    const reflector = new Reflector(new THREE.CircleGeometry(4.6, 96).rotateX(-Math.PI / 2), {
      clipBias: 0.004,
      textureWidth: 1024,
      textureHeight: 512,
      color: 0x232a33,
      recursion: 1,
    });
    reflector.position.y = 0.001;
    scene.add(reflector);

    // Solid base disc under the reflector's edge.
    const baseDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.62, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x11151b }),
    );
    baseDisc.position.y = -0.002;
    scene.add(baseDisc);

    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(2.05, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: makeRingTexture(), transparent: true, depthWrite: false }),
    );
    ring.position.y = 0.0035;
    scene.add(ring);

    const stageLight = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: makeStageLightTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    stageLight.position.set(0.35, 0.003, 0.5);
    scene.add(stageLight);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.position.y = 0.004;
    scene.add(shadow);

    // Car photo panel.
    let panel = null;
    let geometry = null;
    let material = null;
    let disposed = false;

    const makePanel = (tex) => {
      const img = tex?.image;
      const aspect = img && img.width && img.height ? img.width / img.height : 1.92;
      const pw = 5.1;
      const ph = Math.min(4.4, pw / aspect);
      if (geometry) geometry.dispose();
      geometry = new THREE.PlaneGeometry(pw, ph);
      if (material) material.dispose();
      material = new THREE.MeshBasicMaterial({
        map: tex || null,
        side: THREE.FrontSide,
        color: tex ? 0xffffff : 0x8fa0b4,
      });
      panel = new THREE.Mesh(geometry, material);
      panel.position.y = ph / 2;
      scene.add(panel);
      if (!tex) controls.target.set(0, 0.6, 0);
    };

    if (image) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        image,
        (tex) => {
          if (disposed) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          makePanel(tex);
          setStatus('ready');
        },
        undefined,
        () => {
          if (disposed) return;
          makePanel();
          setStatus('ready');
        },
      );
    } else {
      makePanel();
      setStatus('ready');
    }

    // Cinematic camera start pose (3/4 hero angle).
    const radius = 6.4;
    camera.position.set(radius * Math.sin(-0.62), radius * 0.34, radius * 0.84);
    controls.update();

    let raf = 0;

    // Gentle auto sway of the orbit around the car (like a showroom turntable).
    const sway = (now) => {
      if (!spinRef.current || userDraggingRef.current || !panel) return;
      const target = 0.62 * Math.sin(now * 0.00045);
      const cur = controls.getAzimuthalAngle();
      const delta = target - cur;
      controls.rotateLeft(Math.max(-0.012, Math.min(0.012, delta * 0.04)));
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      sway(performance.now());
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const home = camera.position.clone();
    const homeTarget = controls.target.clone();
    resetRef.current = () => {
      camera.position.copy(home);
      controls.target.copy(homeTarget);
      controls.update();
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      pmrem.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            Object.values(m).forEach((v) => {
              if (v && v.isTexture) v.dispose();
            });
            m.dispose?.();
          });
        }
      });
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [image]);

  return (
    <div className="carview carview-studio" style={{ height }}>
      <div className="carview-canvas" ref={mountRef} aria-label={`${label} showroom preview`} />

      {status === 'loading' && (
        <div className="carview-loader">
          <div className="carview-loader-text">Preparing {label} studio…</div>
          <div className="carview-loader-track">
            <div className="carview-loader-fill" style={{ width: '92%' }} />
          </div>
          <div className="carview-loader-pct">rendering</div>
        </div>
      )}

      {status === 'error' && (
        <div className="carview-error">
          {image ? (
            <img src={image} alt={label} />
          ) : (
            <span>
              <i className="bi bi-x-octagon me-2" />
              Could not load the showroom preview.
            </span>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="carview-hud">
            <span className="carview-badge360">
              <i className="bi bi-circle-half me-1" />360° studio view
            </span>
            <span className="carview-label">{label}</span>
          </div>

          <div className="carview-hint">
            <i className="bi bi-arrows-move me-1" />
            drag to rotate · scroll to zoom
          </div>

          <div className="carview-controls">
            <div className="carview-actions">
              <button
                type="button"
                className={`carview-btn ${spin ? 'active' : ''}`}
                title={spin ? 'Pause rotation' : 'Auto rotate'}
                onClick={() => setSpin((v) => !v)}
              >
                <i className={`bi ${spin ? 'bi-pause-fill' : 'bi-play-fill'}`} />
              </button>
              <button type="button" className="carview-btn" title="Reset view" onClick={() => resetRef.current?.()}>
                <i className="bi bi-arrow-counterclockwise" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}