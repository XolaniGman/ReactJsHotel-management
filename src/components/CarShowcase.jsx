import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DEFAULT_MODEL = '/models/ferrari.glb';

const PAINT_SWATCHES = [
  { name: 'Rosso Corsa', hex: '#c1121f' },
  { name: 'Deep Marine', hex: '#123a6b' },
  { name: 'Pearl White', hex: '#e9ebee' },
  { name: 'Obsidian Black', hex: '#16171a' },
  { name: 'Giallo Modena', hex: '#f2b705' },
  { name: 'Verde British', hex: '#3b7a57' },
];

// Meshes that take the respray paint colour (car body + accent trim panels).
const paintableMesh = (name) =>
  /(^body$|^paint$|^trim$|^blue$|yellow_trim|^hood$|^door$|^fender$|^bumper$|side_skirt|body_color|_paint)/i.test(
    name || '',
  );

const makePaintMaterial = (src, hex) => {
  const mat = new THREE.MeshPhysicalMaterial({
    name: src.name,
    color: new THREE.Color(hex),
    metalness: 0.45,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.25,
  });
  if (src.map) mat.map = src.map;
  if (src.normalMap) mat.normalMap = src.normalMap;
  if (src.roughnessMap) mat.roughnessMap = src.roughnessMap;
  if (src.metalnessMap) mat.metalnessMap = src.metalnessMap;
  if (src.aoMap) {
    mat.aoMap = src.aoMap;
    mat.aoMapIntensity = src.aoMapIntensity ?? 1;
  }
  mat.side = src.side ?? THREE.FrontSide;
  return mat;
};

const makeShadowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 122);
  grad.addColorStop(0, 'rgba(15,18,26,0.55)');
  grad.addColorStop(0.65, 'rgba(15,18,26,0.22)');
  grad.addColorStop(1, 'rgba(15,18,26,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
};

export default function CarShowcase({
  modelSrc = DEFAULT_MODEL,
  label = 'Vehicle',
  fallbackImage = null,
  height = 400,
  auto = true,
}) {
  const mountRef = useRef(null);
  const spinningRef = useRef(auto);
  const paintRef = useRef(PAINT_SWATCHES[0].hex);
  const paintTargetsRef = useRef([]);
  const resetRef = useRef(null);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [progress, setProgress] = useState(0);
  const [spin, setSpin] = useState(auto);
  const [activeSwatch, setActiveSwatch] = useState(0);

  useEffect(() => {
    spinningRef.current = spin;
  }, [spin]);

  useEffect(() => {
    paintRef.current = PAINT_SWATCHES[activeSwatch].hex;
  }, [activeSwatch]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('error');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.1, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    const timer = new THREE.Timer();
    timer.connect(document);
    const pmrem = new THREE.PMREMGenerator(renderer);

    let car = null;
    let painted = [];
    let raf = 0;
    let disposed = false;
    let home = null;
    const cameraDist = 6.8;

    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3.5, 6.5, 2.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(10, 64).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xd7dade,
        metalness: 0.35,
        roughness: 0.16,
        envMapIntensity: 1.5,
      }),
    );
    floor.position.y = -0.02;
    scene.add(floor);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({
        map: makeShadowTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    scene.add(shadow);

    const setHome = () => {
      const center = controls.target.clone();
      home = { pos: camera.position.clone(), target: center, yaw: car ? car.rotation.y : 0 };
    };

    const placeCamera = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      camera.position.set(cameraDist * 0.85, cameraDist * 0.46, -cameraDist * 0.62);
      controls.target.set(0, 0.55, 0);
      controls.update();
      setHome();
    };

    const draco = new DRACOLoader();
    draco.setDecoderPath('/models/draco/');
    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(draco);

    gltf.load(
      modelSrc,
      (parsed) => {
        if (disposed) return;
        car = parsed.scene;

        car.traverse((obj) => {
          if (!obj.isMesh) return;
          if (paintableMesh(obj.name)) {
            obj.material = makePaintMaterial(obj.material, paintRef.current);
            painted.push(obj);
          }
        });
        paintTargetsRef.current = painted;

        const box = new THREE.Box3().setFromObject(car);
        const size = box.getSize(new THREE.Vector3());
        const FITTING = 4.4;
        car.scale.setScalar(FITTING / Math.max(size.x, size.z));

        const box2 = new THREE.Box3().setFromObject(car);
        const center = box2.getCenter(new THREE.Vector3());
        const halfH = Math.max((box2.max.y - box2.min.y) / 2, 0.01);
        car.position.sub(center);
        car.position.y = halfH;
        scene.add(car);
        controls.target.set(0, halfH, 0);
        controls.update();
        setHome();
        setProgress(100);
        setStatus('ready');
      },
      (e) => {
        if (disposed || !e.total) return;
        setProgress(Math.round((e.loaded / e.total) * 100));
      },
      () => {
        if (!disposed) setStatus('error');
      },
    );

    placeCamera();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.05);
      if (spinningRef.current && car) car.rotation.y += 0.5 * dt * 2;
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

    const reset = () => {
      if (!home) return;
      camera.position.copy(home.pos);
      controls.target.copy(home.target);
      if (car) car.rotation.y = home.yaw;
      controls.update();
    };
    resetRef.current = reset;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      timer.disconnect();
      draco.dispose();
      pmrem.dispose();
      paintTargetsRef.current = [];
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
  }, [modelSrc]);

  const pick = (idx) => {
    setActiveSwatch(idx);
    const hex = PAINT_SWATCHES[idx].hex;
    paintRef.current = hex;
    paintTargetsRef.current.forEach((m) => m.material.color.set(hex));
  };

  return (
    <div className="carview" style={{ height }}>
      <div className="carview-canvas" ref={mountRef} aria-label={`${label} 3D preview`} />

      {status === 'loading' && (
        <div className="carview-loader">
          <div className="carview-loader-text">Rendering {label}…</div>
          <div className="carview-loader-track">
            <div className="carview-loader-fill" style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          <div className="carview-loader-pct">{progress}%</div>
        </div>
      )}

      {status === 'error' && (
        <div className="carview-error">
          {fallbackImage ? (
            <img src={fallbackImage} alt={label} />
          ) : (
            <span>
              <i className="bi bi-x-octagon me-2" />
              Could not load the 3D preview.
            </span>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="carview-hud">
            <span className="carview-hint">
              <i className="bi bi-arrows-move me-1" />
              drag to rotate · scroll to zoom
            </span>
            <span className="carview-label">{label}</span>
          </div>

          <div className="carview-controls">
            <div className="carview-swatches" role="group" aria-label="Paint colours">
              {PAINT_SWATCHES.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  className={`carview-swatch ${i === activeSwatch ? 'active' : ''}`}
                  style={{ '--swatch': s.hex }}
                  title={s.name}
                  aria-label={s.name}
                  onClick={() => pick(i)}
                />
              ))}
            </div>
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