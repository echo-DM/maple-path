import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildLandscape } from './landscape';
import { getView, overview, type View, type ViewId } from './poem';
import { terrainHeight } from './terrain';

export type WorldStatus = 'loading' | 'ready' | 'error';
export type WorldSnapshot = {
  ready: boolean;
  view: ViewId;
  flying: boolean;
  paused: boolean;
  reducedMotion: boolean;
  camera: number[];
  target: number[];
  animationTime: number;
  frames: number;
  drawCalls: number;
  triangles: number;
  treeCount: number;
  quality: 'mobile' | 'desktop';
};
export type WorldController = {
  select: (id: ViewId) => void;
  setMotion: (paused: boolean, reduced: boolean) => void;
  dispose: () => void;
  snapshot: () => WorldSnapshot;
};

declare global {
  interface Window {
    readonly __maplePath?: WorldSnapshot;
  }
}

type Flight = {
  from: THREE.Vector3;
  targetFrom: THREE.Vector3;
  to: THREE.Vector3;
  targetTo: THREE.Vector3;
  started: number;
  lift: number;
  view: View;
};

export function createWorld(
  host: HTMLElement,
  options: { paused: boolean; reduced: boolean; onStatus: (status: WorldStatus, message?: string) => void; onManual: () => void },
): WorldController {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '杜牧《山行》的三维秋山，拖动环顾，滚轮或双指缩放');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8d4b9');
  scene.fog = new THREE.Fog('#e8d4b9', 155, 345);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 800);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.minPolarAngle = 0.12;

  scene.add(new THREE.HemisphereLight('#ffedce', '#7c836f', 2));
  const sunlight = new THREE.DirectionalLight('#ffe4bb', 1.9);
  sunlight.position.set(-60, 110, 30);
  sunlight.castShadow = !mobile;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = -105;
  sunlight.shadow.camera.right = 105;
  sunlight.shadow.camera.top = 100;
  sunlight.shadow.camera.bottom = -100;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 290;
  sunlight.shadow.bias = -0.001;
  sunlight.shadow.normalBias = 0.25;
  scene.add(sunlight);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(410, 20, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#bdd1c6') },
        bottom: { value: new THREE.Color('#f1d4b0') },
      },
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){float h=smoothstep(-0.06,0.65,normalize(vPosition).y); gl_FragColor=vec4(mix(bottom,top,h),1.0);\n#include <colorspace_fragment>\n}',
    }),
  );
  scene.add(sky);
  const landscape = buildLandscape(mobile);
  scene.add(landscape.root);

  let ready = false;
  let failed = false;
  let disposed = false;
  let selected: ViewId = 'overview';
  let paused = options.paused;
  let reducedMotion = options.reduced;
  let flight: Flight | undefined;
  let animationTime = 0;
  let frames = 0;
  let frameId = 0;
  let lastTime = performance.now();

  function limits(view: View) {
    controls.minDistance = view.minDistance;
    controls.maxDistance = view.maxDistance;
    controls.maxPolarAngle = view.maxPolarAngle;
  }

  function place(view: View) {
    camera.position.fromArray(view.position);
    controls.target.fromArray(view.target);
    limits(view);
    controls.update();
  }
  place(overview);

  function destination(view: View) {
    const p = new THREE.Vector3().fromArray(view.position);
    const target = new THREE.Vector3().fromArray(view.target);
    // Back away along the same sightline in a portrait canvas.
    if (camera.aspect < 1) p.sub(target).multiplyScalar(view.id === 'overview' ? 1.38 : 1.16).add(target);
    return { p, target };
  }

  function select(id: ViewId) {
    selected = id;
    if (failed || disposed) return;
    const view = getView(id);
    const { p, target } = destination(view);
    const currentPosition = camera.position.clone();
    const currentTarget = controls.target.clone();
    controls.minDistance = 0.1;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI * 0.94;
    // Drain OrbitControls inertia, then restore the actual current pose.
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(currentPosition);
    controls.target.copy(currentTarget);
    controls.update();
    if (reducedMotion) {
      flight = undefined;
      camera.position.copy(p);
      controls.target.copy(target);
      limits(view);
      controls.update();
      controls.enableDamping = true;
      return;
    }
    flight = {
      from: camera.position.clone(),
      targetFrom: controls.target.clone(),
      to: p,
      targetTo: target,
      started: performance.now(),
      lift: Math.min(17, camera.position.distanceTo(p) * 0.18),
      view,
    };
  }

  function manual() {
    if (failed || disposed) return;
    flight = undefined;
    controls.enableDamping = true;
    const view = getView(selected);
    limits(view);
    const currentDistance = camera.position.distanceTo(controls.target);
    const currentPolar = Math.acos(THREE.MathUtils.clamp((camera.position.y - controls.target.y) / currentDistance, -1, 1));
    controls.minDistance = Math.min(view.minDistance, currentDistance);
    controls.maxDistance = Math.max(view.maxDistance, currentDistance);
    controls.maxPolarAngle = Math.max(view.maxPolarAngle, currentPolar);
    options.onManual();
  }
  controls.addEventListener('start', manual);

  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    // Keep the first portrait overview framed without an entry animation.
    if (!ready) {
      const { p, target } = destination(overview);
      camera.position.copy(p);
      controls.target.copy(target);
      controls.update();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  function fail(message: string) {
    if (failed || disposed) return;
    failed = true;
    ready = false;
    flight = undefined;
    controls.enabled = false;
    options.onStatus('error', message);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    fail('图形连接暂时中断。诗文仍可阅读，点击下方按钮重新进入山林。');
  }
  canvas.addEventListener('webglcontextlost', contextLost);

  function visibilityChanged() {
    lastTime = performance.now();
    if (!document.hidden && !disposed && !failed) {
      if (flight) {
        flight.from.copy(camera.position);
        flight.targetFrom.copy(controls.target);
        flight.started = lastTime;
      }
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(render);
    }
  }
  document.addEventListener('visibilitychange', visibilityChanged);

  function render(now: number) {
    if (disposed || failed || document.hidden) return;
    const delta = Math.min((now - lastTime) / 1000, 0.06);
    lastTime = now;
    if (renderer.getContext().isContextLost()) {
      fail('图形连接暂时中断。诗文仍可阅读，点击下方按钮重新进入山林。');
      return;
    }
    if (flight) {
      const t = Math.max(0, Math.min(1, (now - flight.started) / 2100));
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(flight.from, flight.to, ease);
      camera.position.y += Math.sin(Math.PI * ease) * flight.lift;
      controls.target.lerpVectors(flight.targetFrom, flight.targetTo, ease);
      controls.update();
      if (t === 1) {
        limits(flight.view);
        flight = undefined;
        controls.enableDamping = true;
        controls.update();
      }
    } else {
      controls.update();
      camera.position.y = Math.max(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + 2);
    }
    if (!paused && !reducedMotion) {
      animationTime += delta;
      landscape.update(animationTime);
    }
    try {
      renderer.render(scene, camera);
    } catch {
      fail('这次未能绘制山景。你可以继续读诗，或尝试重新进入。');
      return;
    }
    frames++;
    if (!ready) {
      ready = true;
      options.onStatus('ready');
    }
    frameId = requestAnimationFrame(render);
  }

  function snapshot(): WorldSnapshot {
    return {
      ready,
      view: selected,
      flying: Boolean(flight),
      paused,
      reducedMotion,
      camera: camera.position.toArray(),
      target: controls.target.toArray(),
      animationTime,
      frames,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      treeCount: landscape.treeCount,
      quality: mobile ? 'mobile' : 'desktop',
    };
  }
  const diagnosticGetter = () => Object.freeze(snapshot());
  Object.defineProperty(window, '__maplePath', { configurable: true, get: diagnosticGetter });
  frameId = requestAnimationFrame(render);

  function setMotion(nextPaused: boolean, reduced: boolean) {
    paused = nextPaused;
    reducedMotion = reduced;
    if (reducedMotion && flight) {
      const id = flight.view.id;
      select(id);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    controls.removeEventListener('start', manual);
    controls.dispose();
    document.removeEventListener('visibilitychange', visibilityChanged);
    canvas.removeEventListener('webglcontextlost', contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((material) => materials.add(material));
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    sunlight.shadow.dispose();
    renderer.dispose();
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    canvas.remove();
    scene.clear();
    if (Object.getOwnPropertyDescriptor(window, '__maplePath')?.get === diagnosticGetter) {
      Reflect.deleteProperty(window, '__maplePath');
    }
  }

  return { select, setMotion, dispose, snapshot };
}
