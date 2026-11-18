import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  MaterialPreset,
  WallGeometry,
  WaveConfig,
  SimulationState,
  DualProbeState,
  CameraMode,
} from '../types';
import {
  calculateWaveField,
  calculateElectromagneticParameters,
  calculateStandingWaveEnvelope,
} from '../physics/waveEngine';
import { buildBarrierAssembly, disposeGroupResources } from '../physics/wallBuilder';

interface ThreeViewportProps {
  wave: WaveConfig;
  wall: WallGeometry;
  material: MaterialPreset;
  probe: DualProbeState;
  onProbeMove: (probeId: 1 | 2, x: number, z: number) => void;
  simulation: SimulationState;
  onTimeUpdate: (time: number, val1: number, val2: number) => void;
  onWaveChange?: (wave: WaveConfig) => void;
  onCameraModeChange?: (mode: CameraMode) => void;
}

const CAMERA_PRESETS: Record<
  CameraMode,
  { pos: [number, number, number]; look: [number, number, number]; shortLabel: string; label: string }
> = {
  perspective: {
    pos: [-7.5, 20, 26],
    look: [0, 0.3, 0],
    shortLabel: 'Vue 3D',
    label: 'Vue 3D oblique',
  },
  top: {
    pos: [0, 34, 0.01],
    look: [0, 0, 0],
    shortLabel: 'Dessus',
    label: 'Vue du dessus (zénith)',
  },
  profile: {
    pos: [0, 5.2, 27],
    look: [0, 0.8, 0],
    shortLabel: 'Profil',
    label: 'Vue de profil latéral',
  },
  incident: {
    pos: [-22, 10.5, 10],
    look: [0, 0.8, 0],
    shortLabel: 'Face',
    label: 'Vue depuis l’onde incidente',
  },
  isometric: {
    pos: [16, 17, -21],
    look: [0, 0.4, 0],
    shortLabel: 'Arrière',
    label: 'Vue arrière 3/4 (Milieu 2)',
  },
};

const CAMERA_ORDER: CameraMode[] = ['perspective', 'top', 'profile', 'incident', 'isometric'];

const detectSoftwareWebGL = (): boolean => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
};

// Scratch objects pre-allocated outside the render loop (zero GC)
const _arrowDummy = new THREE.Object3D();
const _rayMouse = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeIntersect = new THREE.Vector3();

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  wave,
  wall,
  material,
  probe,
  onProbeMove,
  simulation,
  onTimeUpdate,
  onWaveChange,
  onCameraModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const waveMeshRef = useRef<THREE.Mesh | null>(null);
  const wallGroupRef = useRef<THREE.Group | null>(null);
  const vectorArrowsRef = useRef<THREE.InstancedMesh | null>(null);
  const raysGroupRef = useRef<THREE.Group | null>(null);
  const envelopeGroupRef = useRef<THREE.Group | null>(null);
  const trihedronGroupRef = useRef<THREE.Group | null>(null);
  const triEArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const triHArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const triKArrowRef = useRef<THREE.ArrowHelper | null>(null);

  const probe1GroupRef = useRef<THREE.Group | null>(null);
  const probe1SphereRef = useRef<THREE.Mesh | null>(null);
  const probe1StemRef = useRef<THREE.Mesh | null>(null);

  const probe2GroupRef = useRef<THREE.Group | null>(null);
  const probe2SphereRef = useRef<THREE.Mesh | null>(null);
  const probe2StemRef = useRef<THREE.Mesh | null>(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const draggingProbeRef = useRef<1 | 2 | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);
  const [contextLost, setContextLost] = useState(false);

  // Sync latest React props into mutable refs
  const waveRef = useRef(wave);
  waveRef.current = wave;
  const wallRef = useRef(wall);
  wallRef.current = wall;
  const materialRef = useRef(material);
  materialRef.current = material;
  const simRef = useRef(simulation);
  simRef.current = simulation;
  const probeStateRef = useRef(probe);
  probeStateRef.current = probe;
  const onProbeMoveRef = useRef(onProbeMove);
  onProbeMoveRef.current = onProbeMove;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const timeRef = useRef(0);
  const renderNowRef = useRef<(() => void) | null>(null);

  // Camera transition targets (exponential damping)
  const camTargetPosRef = useRef(new THREE.Vector3(-7.5, 20, 26));
  const camTargetLookRef = useRef(new THREE.Vector3(0, 0.3, 0));
  const camTransitionActiveRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const isSoftwareGl = detectSoftwareWebGL();
    isSoftwareGlRef.current = isSoftwareGl;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c15);
    scene.fog = new THREE.FogExp2(0x080c15, 0.011);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 1000);
    camera.position.set(-7.5, 20, 26);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio environment reflections (essential for brushed metal & dielectric clearcoat)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 7;
    controls.maxDistance = 68;
    controls.target.set(0, 0, 0);
    controls.addEventListener('start', () => {
      camTransitionActiveRef.current = false;
    });
    controlsRef.current = controls;

    // 3-point warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    keyLight.position.set(12, 26, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-16, 12, -14);
    scene.add(rimLight);

    // Calibrated optical bench deck (grounded matte slate surface + subtle metric grid)
    const benchGeo = new THREE.PlaneGeometry(46, 36);
    benchGeo.rotateX(-Math.PI / 2);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      roughness: 0.84,
      metalness: 0.18,
    });
    const benchMesh = new THREE.Mesh(benchGeo, benchMat);
    benchMesh.position.y = -0.05;
    benchMesh.receiveShadow = true;
    scene.add(benchMesh);

    const grid = new THREE.GridHelper(36, 36, 0x26354d, 0x131d31);
    grid.position.y = -0.025;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const gm of gridMats) {
      gm.polygonOffset = true;
      gm.polygonOffsetFactor = -1;
      gm.polygonOffsetUnits = -1;
    }
    scene.add(grid);

    // Wave heightfield surface
    const segX = isSoftwareGl ? 96 : 136;
    const segZ = isSoftwareGl ? 56 : 84;
    const planeGeo = new THREE.PlaneGeometry(32, 22, segX, segZ);
    planeGeo.rotateX(-Math.PI / 2);
    const vertCount = planeGeo.attributes.position.count;
    const colors = new Float32Array(vertCount * 3);
    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const waveMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const waveMesh = new THREE.Mesh(planeGeo, waveMat);
    waveMesh.receiveShadow = true;
    scene.add(waveMesh);
    waveMeshRef.current = waveMesh;

    // Poynting flux vector arrows
    const arrowConeGeo = new THREE.ConeGeometry(0.11, 0.42, 8);
    arrowConeGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.5,
    });
    const arrowRows = 12;
    const arrowCols = 18;
    const arrowMesh = new THREE.InstancedMesh(arrowConeGeo, arrowMat, arrowRows * arrowCols);
    arrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    arrowMesh.frustumCulled = false;
    scene.add(arrowMesh);
    vectorArrowsRef.current = arrowMesh;

    // Dual optical probes
    const buildProbeGroup = (colorHex: number) => {
      const group = new THREE.Group();

      const sphereGeo = new THREE.SphereGeometry(0.36, 20, 20);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.75,
        roughness: 0.22,
        metalness: 0.3,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.y = 1.0;
      sphere.castShadow = !isSoftwareGl;
      group.add(sphere);

      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 10);
      const stemMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.35,
        metalness: 0.6,
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.5;
      group.add(stem);

      const ringGeo = new THREE.RingGeometry(0.38, 0.6, 28);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.015;
      group.add(ring);

      const outerRingGeo = new THREE.RingGeometry(0.82, 1.05, 28);
      outerRingGeo.rotateX(-Math.PI / 2);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.position.y = 0.015;
      group.add(outerRing);

      const hitBoxGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.6, 12);
      const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBox.position.y = 1.4;
      group.add(hitBox);

      return { group, sphere, stem };
    };

    const p1 = buildProbeGroup(0x00f5d4);
    scene.add(p1.group);
    probe1GroupRef.current = p1.group;
    probe1SphereRef.current = p1.sphere;
    probe1StemRef.current = p1.stem;

    const p2 = buildProbeGroup(0xf59e0b);
    scene.add(p2.group);
    probe2GroupRef.current = p2.group;
    probe2SphereRef.current = p2.sphere;
    probe2StemRef.current = p2.stem;

    // Initial barrier build
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const initWall = buildBarrierAssembly(
      wallRef.current,
      materialRef.current,
      waveRef.current,
      maxAniso,
      isSoftwareGl
    );
    scene.add(initWall);
    wallGroupRef.current = initWall;

    // Snell-Descartes ray & angle overlay group
    const raysGroup = new THREE.Group();
    scene.add(raysGroup);
    raysGroupRef.current = raysGroup;

    // Standing-wave spatial envelope |E(x)| group
    const envGroup = new THREE.Group();
    scene.add(envGroup);
    envelopeGroupRef.current = envGroup;

    // Orthogonal (E, H, k) trihedron at Probe 1
    const triGroup = new THREE.Group();
    const triE = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.5, 0x22d3ee, 0.32, 0.16);
    const triH = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.2, 0x34d399, 0.28, 0.14);
    const triK = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.8, 0xfbbf24, 0.34, 0.16);
    triGroup.add(triE, triH, triK);
    scene.add(triGroup);
    trihedronGroupRef.current = triGroup;
    triEArrowRef.current = triE;
    triHArrowRef.current = triH;
    triKArrowRef.current = triK;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(1, containerRef.current.clientWidth);
      const h = Math.max(1, containerRef.current.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // WebGL context loss safety
    const domEl = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    domEl.addEventListener('webglcontextlost', handleContextLost);
    domEl.addEventListener('webglcontextrestored', handleContextRestored);

    // Probe drag raycasting
    const checkProbeHit = (clientX: number, clientY: number): 1 | 2 | null => {
      if (!containerRef.current || !cameraRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      _rayMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(_rayMouse, cameraRef.current);

      if (probe1GroupRef.current) {
        const hits1 = raycasterRef.current.intersectObjects(probe1GroupRef.current.children, true);
        if (hits1.length > 0) return 1;
      }
      if (probe2GroupRef.current) {
        const hits2 = raycasterRef.current.intersectObjects(probe2GroupRef.current.children, true);
        if (hits2.length > 0) return 2;
      }
      if (raycasterRef.current.ray.intersectPlane(_groundPlane, _planeIntersect)) {
        const prb = probeStateRef.current;
        const d1 = Math.hypot(_planeIntersect.x - prb.x1, _planeIntersect.z - prb.z1);
        const d2 = Math.hypot(_planeIntersect.x - prb.x2, _planeIntersect.z - prb.z2);
        if (d1 < 2.2 && d1 <= d2) return 1;
        if (d2 < 2.2) return 2;
      }
      return null;
    };

    const getGroundPosition = (clientX: number, clientY: number): THREE.Vector3 | null => {
      if (!containerRef.current || !cameraRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      _rayMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(_rayMouse, cameraRef.current);
      if (raycasterRef.current.ray.intersectPlane(_groundPlane, _planeIntersect)) {
        return _planeIntersect;
      }
      return null;
    };

    const handlePointerDown = (e: MouseEvent) => {
      const hit = checkProbeHit(e.clientX, e.clientY);
      if (hit !== null) {
        draggingProbeRef.current = hit;
        controls.enabled = false;
        domEl.style.cursor = 'grabbing';
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (draggingProbeRef.current !== null) {
        const pt = getGroundPosition(e.clientX, e.clientY);
        if (pt) {
          const cx = Math.max(-14.5, Math.min(14.5, pt.x));
          const cz = Math.max(-9.5, Math.min(9.5, pt.z));
          onProbeMoveRef.current(draggingProbeRef.current, cx, cz);
        }
      } else {
        const hit = checkProbeHit(e.clientX, e.clientY);
        domEl.style.cursor = hit !== null ? 'grab' : 'default';
      }
    };

    const handlePointerUp = () => {
      if (draggingProbeRef.current !== null) {
        draggingProbeRef.current = null;
        controls.enabled = true;
        domEl.style.cursor = 'default';
      }
    };

    domEl.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // Animation loop (paced with afterDraw on software WebGL)
    let frameId = 0;
    let lastPerf = performance.now();
    let lastUiSync = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const updateDynamicMeshes = (tNow: number, syncUi: boolean) => {
      // Update wave surface vertices & colors
      if (waveMeshRef.current) {
        waveMeshRef.current.visible = simRef.current.showSurface;
        if (simRef.current.showSurface) {
          const geo = waveMeshRef.current.geometry;
          const posAttr = geo.attributes.position as THREE.BufferAttribute;
          const colAttr = geo.attributes.color as THREE.BufferAttribute;
          const curWave = waveRef.current;
          const curWall = wallRef.current;
          const curMat = materialRef.current;
          const invAmp = 1 / Math.max(0.2, curWave.amplitude);

          for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vz = posAttr.getZ(i);
            const field = calculateWaveField(vx, vz, tNow, curWave, curWall, curMat);
            const yVal = field.amplitude * 1.25;
            posAttr.setY(i, yVal);

            const norm = Math.max(-1, Math.min(1, field.amplitude * invAmp));
            let r = 0.08;
            let g = 0.14;
            let b = 0.24;
            if (field.inObstacle && curMat.id !== 'air') {
              if (field.isEvanescent) {
                r = 0.45 + Math.abs(norm) * 0.45;
                g = 0.1 + Math.abs(norm) * 0.15;
                b = 0.22;
              } else {
                r = 0.06 + Math.max(0, norm) * 0.85;
                g = 0.42 + Math.abs(norm) * 0.45;
                b = 0.46 + Math.max(0, -norm) * 0.4;
              }
            } else if (norm >= 0) {
              r = 0.1 + norm * 0.12;
              g = 0.24 + norm * 0.68;
              b = 0.42 + norm * 0.54;
            } else {
              const neg = -norm;
              r = 0.14 + neg * 0.65;
              g = 0.12 + neg * 0.28;
              b = 0.32 - neg * 0.15;
            }
            colAttr.setXYZ(i, r, g, b);
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
          geo.computeVertexNormals();
        }
      }

      // Update Poynting flux arrows (zero allocation)
      if (vectorArrowsRef.current) {
        vectorArrowsRef.current.visible = simRef.current.showVectors;
        if (simRef.current.showVectors) {
          let idx = 0;
          const xStep = 28 / (arrowCols - 1);
          const zStep = 18 / (arrowRows - 1);
          for (let r = 0; r < arrowRows; r++) {
            for (let c = 0; c < arrowCols; c++) {
              const x = -14 + c * xStep;
              const z = -9 + r * zStep;
              const field = calculateWaveField(
                x,
                z,
                tNow,
                waveRef.current,
                wallRef.current,
                materialRef.current
              );
              const fluxLen = Math.hypot(field.fluxX, field.fluxZ);
              if (fluxLen < 0.05) {
                _arrowDummy.scale.set(0, 0, 0);
              } else {
                _arrowDummy.position.set(x, Math.max(0.18, field.amplitude * 1.25 + 0.35), z);
                const angle = Math.atan2(field.fluxX, field.fluxZ);
                _arrowDummy.rotation.set(0, angle, 0);
                const s = Math.min(1.25, Math.max(0.25, Math.abs(field.amplitude) * 0.75 + 0.2));
                _arrowDummy.scale.set(s, s, s);
              }
              _arrowDummy.updateMatrix();
              vectorArrowsRef.current.setMatrixAt(idx++, _arrowDummy.matrix);
            }
          }
          vectorArrowsRef.current.instanceMatrix.needsUpdate = true;
        }
      }

      // Update probes
      const prb = probeStateRef.current;
      const f1 = calculateWaveField(
        prb.x1,
        prb.z1,
        tNow,
        waveRef.current,
        wallRef.current,
        materialRef.current
      );
      const f2 = calculateWaveField(
        prb.x2,
        prb.z2,
        tNow,
        waveRef.current,
        wallRef.current,
        materialRef.current
      );

      if (probe1GroupRef.current && probe1SphereRef.current && probe1StemRef.current) {
        probe1GroupRef.current.position.set(prb.x1, 0, prb.z1);
        const y1 = Math.max(0.25, 0.9 + f1.amplitude * 1.25);
        probe1SphereRef.current.position.y = y1;
        probe1StemRef.current.position.y = y1 / 2;
        probe1StemRef.current.scale.set(1, y1, 1);
      }

      if (probe2GroupRef.current && probe2SphereRef.current && probe2StemRef.current) {
        probe2GroupRef.current.position.set(prb.x2, 0, prb.z2);
        const y2 = Math.max(0.25, 0.9 + f2.amplitude * 1.25);
        probe2SphereRef.current.position.y = y2;
        probe2StemRef.current.position.y = y2 / 2;
        probe2StemRef.current.scale.set(1, y2, 1);
      }

      // Update orthogonal (E, H, k) trihedron at Probe 1
      if (trihedronGroupRef.current && triEArrowRef.current && triHArrowRef.current && triKArrowRef.current) {
        const showTri = simRef.current.showTrihedron;
        trihedronGroupRef.current.visible = showTri;
        if (showTri) {
          const triY = Math.max(0.5, 1.3 + f1.amplitude * 1.1);
          trihedronGroupRef.current.position.set(prb.x1, triY, prb.z1);
          const curWave = waveRef.current;
          const pTri = calculateElectromagneticParameters(curWave, materialRef.current, wallRef.current);
          const thI = curWave.boundaryModel === 'guide_ondes' ? 0 : pTri.thetaIRad;
          const kx = Math.cos(thI);
          const kz = Math.sin(thI);

          const eSign = f1.amplitude >= 0 ? 1 : -1;
          const eLen = Math.max(0.25, Math.min(2.6, Math.abs(f1.amplitude) * 1.25));
          triEArrowRef.current.setDirection(new THREE.Vector3(0, eSign, 0));
          triEArrowRef.current.setLength(eLen, Math.min(0.35, eLen * 0.3), 0.16);

          triKArrowRef.current.setDirection(new THREE.Vector3(kx, 0, kz));
          triKArrowRef.current.setLength(1.85, 0.34, 0.16);

          const hx = -kz * eSign;
          const hz = kx * eSign;
          const hLen = Math.max(0.22, Math.min(2.2, Math.abs(f1.amplitude) * 1.0));
          triHArrowRef.current.setDirection(new THREE.Vector3(hx, 0, hz));
          triHArrowRef.current.setLength(hLen, Math.min(0.3, hLen * 0.3), 0.14);
        }
      }

      if (syncUi) {
        onTimeUpdateRef.current(tNow, f1.amplitude, f2.amplitude);
      }
      renderer.render(scene, camera);
    };

    renderNowRef.current = () => {
      if (disposed) return;
      if (!simRef.current.isPlaying) {
        timeRef.current = simRef.current.time;
      }
      updateDynamicMeshes(timeRef.current, false);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastPerf) / 1000);
      lastPerf = now;

      if (simRef.current.isPlaying) {
        timeRef.current += dt * simRef.current.speed;
      } else if (simRef.current.time !== timeRef.current) {
        timeRef.current = simRef.current.time;
      }

      // Smooth damped camera preset transitions
      if (camTransitionActiveRef.current) {
        const alpha = isSoftwareGl ? 1 : 1 - Math.exp(-8 * dt);
        camera.position.lerp(camTargetPosRef.current, alpha);
        controls.target.lerp(camTargetLookRef.current, alpha);
        if (isSoftwareGl || camera.position.distanceTo(camTargetPosRef.current) < 0.05) {
          camera.position.copy(camTargetPosRef.current);
          controls.target.copy(camTargetLookRef.current);
          camTransitionActiveRef.current = false;
        }
      }
      controls.update();

      const shouldSyncUi = isSoftwareGl || now - lastUiSync >= 45;
      if (shouldSyncUi) {
        lastUiSync = now;
      }
      updateDynamicMeshes(timeRef.current, shouldSyncUi);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      domEl.removeEventListener('webglcontextrestored', handleContextRestored);
      domEl.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      controls.dispose();
      if (wallGroupRef.current) {
        disposeGroupResources(wallGroupRef.current);
      }
      if (raysGroupRef.current) {
        disposeGroupResources(raysGroupRef.current);
      }
      if (envelopeGroupRef.current) {
        disposeGroupResources(envelopeGroupRef.current);
      }
      if (container.contains(domEl)) {
        container.removeChild(domEl);
      }
      renderer.dispose();
    };
  }, []);

  // Rebuild multi-part PBR barrier assembly on wall/material/mode changes
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    if (wallGroupRef.current) {
      scene.remove(wallGroupRef.current);
      disposeGroupResources(wallGroupRef.current);
      wallGroupRef.current = null;
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const newAssembly = buildBarrierAssembly(
      wall,
      material,
      wave,
      maxAniso,
      isSoftwareGlRef.current
    );
    scene.add(newAssembly);
    wallGroupRef.current = newAssembly;
  }, [wall, material, wave.boundaryModel]);

  // Rebuild 3D Snell-Descartes ray diagram & Ch. 3 standing-wave envelope when parameters or toggles change
  useEffect(() => {
    const raysGroup = raysGroupRef.current;
    if (raysGroup) {
      disposeGroupResources(raysGroup);
      while (raysGroup.children.length > 0) {
        raysGroup.remove(raysGroup.children[0]);
      }
      raysGroup.visible = simulation.showRays;

      if (simulation.showRays) {
        const params = calculateElectromagneticParameters(wave, material, wall);
        const xFront = wall.posX - wall.thickness / 2 - wall.textureDepth;
        const rayY = Math.max(2.0, (wall.height || 2.8) + 0.6);
        const thI = wave.boundaryModel === 'guide_ondes' ? 0 : params.thetaIRad;
        const thT = params.thetaTRad;
        const rayLen = 7.5;

        // Interface normal dashed line
        const normGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(xFront - 5.5, rayY, 0),
          new THREE.Vector3(xFront + 5.5, rayY, 0),
        ]);
        const normMat = new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.35, gapSize: 0.25 });
        const normLine = new THREE.Line(normGeo, normMat);
        normLine.computeLineDistances();
        raysGroup.add(normLine);

        // Point of incidence marker ring on the dioptre normal
        const hitRingGeo = new THREE.RingGeometry(0.16, 0.28, 24);
        hitRingGeo.rotateX(-Math.PI / 2);
        const hitRingMat = new THREE.MeshBasicMaterial({
          color: 0xf8fafc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const hitRing = new THREE.Mesh(hitRingGeo, hitRingMat);
        hitRing.position.set(xFront, rayY, 0);
        raysGroup.add(hitRing);

        // Helper to draw a 3D Snell-Descartes angle sector wedge + perimeter arc
        const addAngleArc = (
          radius: number,
          angleRad: number,
          xSign: -1 | 1,
          zSign: -1 | 1,
          colorHex: number
        ) => {
          if (angleRad < 0.025) return;
          const steps = Math.max(12, Math.ceil((angleRad * 32) / (Math.PI / 2)));
          const arcPts: THREE.Vector3[] = [];
          const innerArcPts: THREE.Vector3[] = [];
          const fanVerts: number[] = [];

          for (let s = 0; s <= steps; s++) {
            const a = (s / steps) * angleRad;
            const px = xFront + xSign * radius * Math.cos(a);
            const pz = zSign * radius * Math.sin(a);
            arcPts.push(new THREE.Vector3(px, rayY + 0.02, pz));
            innerArcPts.push(
              new THREE.Vector3(
                xFront + xSign * (radius - 0.1) * Math.cos(a),
                rayY + 0.02,
                zSign * (radius - 0.1) * Math.sin(a)
              )
            );

            if (s < steps) {
              const aNext = ((s + 1) / steps) * angleRad;
              const nx = xFront + xSign * radius * Math.cos(aNext);
              const nz = zSign * radius * Math.sin(aNext);
              fanVerts.push(
                xFront, rayY + 0.01, 0,
                px, rayY + 0.01, pz,
                nx, rayY + 0.01, nz
              );
            }
          }

          const arcMat = new THREE.LineBasicMaterial({ color: colorHex });
          raysGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts), arcMat));
          raysGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(innerArcPts), arcMat));

          const fanGeo = new THREE.BufferGeometry();
          fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(fanVerts, 3));
          const fanMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.36,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          raysGroup.add(new THREE.Mesh(fanGeo, fanMat));
        };

        // Incident ray arrow + θi arc (cyan)
        const dirI = new THREE.Vector3(Math.cos(thI), 0, Math.sin(thI)).normalize();
        const originI = new THREE.Vector3(xFront - dirI.x * rayLen, rayY, -dirI.z * rayLen);
        const incArrow = new THREE.ArrowHelper(dirI, originI, rayLen, 0x22d3ee, 0.55, 0.24);
        raysGroup.add(incArrow);
        addAngleArc(2.85, thI, -1, -1, 0x22d3ee);

        // Reflected ray arrow + θr arc (rose, scales with |Γ| -> disappears at Brewster!)
        if (params.gammaMag > 0.02) {
          const dirR = new THREE.Vector3(-Math.cos(thI), 0, Math.sin(thI)).normalize();
          const refLen = 3.0 + params.gammaMag * 4.2;
          const refArrow = new THREE.ArrowHelper(
            dirR,
            new THREE.Vector3(xFront, rayY, 0),
            refLen,
            0xf43f5e,
            0.5,
            0.22
          );
          raysGroup.add(refArrow);
          addAngleArc(2.3, thI, -1, 1, 0xf43f5e);
        }

        // Transmitted ray arrow + θt arc (emerald, hidden in PEC or total internal reflection)
        if (!material.isPEC && !material.isConductor && !params.isTotalInternalReflection) {
          const dirT = new THREE.Vector3(Math.cos(thT), 0, Math.sin(thT)).normalize();
          const transArrow = new THREE.ArrowHelper(
            dirT,
            new THREE.Vector3(xFront, rayY, 0),
            rayLen,
            0x34d399,
            0.55,
            0.24
          );
          raysGroup.add(transArrow);
          addAngleArc(2.85, thT, 1, 1, 0x34d399);
        }
      }
    }

    const envGroup = envelopeGroupRef.current;
    if (envGroup) {
      disposeGroupResources(envGroup);
      while (envGroup.children.length > 0) {
        envGroup.remove(envGroup.children[0]);
      }
      envGroup.visible = simulation.showEnvelope;

      if (simulation.showEnvelope) {
        const { points, xFront, dFirstMinSim } = calculateStandingWaveEnvelope(
          wave,
          wall,
          material,
          -15,
          15,
          150
        );
        const zEdge = 11.4;
        const pts = points.map((p) => new THREE.Vector3(p.x, p.envAbs * 1.25 + 0.08, zEdge));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
        envGroup.add(new THREE.Line(lineGeo, lineMat));

        // First minimum marker pin (d) in front of the wall
        if (dFirstMinSim > 0 && xFront - dFirstMinSim > -15) {
          const minX = xFront - dFirstMinSim;
          const pinGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8);
          const pinMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
          const pin = new THREE.Mesh(pinGeo, pinMat);
          pin.position.set(minX, 0.7, zEdge);
          envGroup.add(pin);
        }
      }
    }
    renderNowRef.current?.();
  }, [
    wave,
    wall,
    material,
    probe.x1,
    probe.z1,
    probe.x2,
    probe.z2,
    simulation.showSurface,
    simulation.showVectors,
    simulation.showRays,
    simulation.showEnvelope,
    simulation.showTrihedron,
    simulation.time,
  ]);

  // Smooth damped camera preset switching
  useEffect(() => {
    const preset = CAMERA_PRESETS[simulation.cameraMode] || CAMERA_PRESETS.perspective;
    camTargetPosRef.current.set(...preset.pos);
    camTargetLookRef.current.set(...preset.look);

    if (isSoftwareGlRef.current && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(camTargetPosRef.current);
      controlsRef.current.target.copy(camTargetLookRef.current);
      controlsRef.current.update();
      camTransitionActiveRef.current = false;
      renderNowRef.current?.();
    } else {
      camTransitionActiveRef.current = true;
    }
  }, [simulation.cameraMode]);

  const emParams = calculateElectromagneticParameters(wave, material, wall);
  const isNearBrewster =
    wave.boundaryModel !== 'guide_ondes' &&
    wave.guidedMode === 'TM' &&
    emParams.brewsterDeg !== null &&
    Math.abs(wave.incidenceAngleDeg - emParams.brewsterDeg) <= 1.0;

  return (
    <div className="@container relative w-full h-full select-none overflow-hidden bg-[#080c15]">
      {/* Dedicated WebGL canvas mount */}
      <div
        ref={containerRef}
        data-testid="three-viewport"
        className="w-full h-full"
      />

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080c15]/95 text-slate-200 text-sm">
          Contexte WebGL interrompu — réinitialisation en cours...
        </div>
      )}

      {/* Top-left compact Snell-Descartes Angle d'incidence (θi) HUD */}
      {wave.boundaryModel !== 'guide_ondes' && onWaveChange && (
        <div
          aria-label="Contrôle rapide de l'angle d'incidence"
          className="absolute top-3 left-3 z-10 bg-[#0c1322]/92 px-2.5 py-2 rounded-lg border border-slate-700/70 shadow-md w-[185px] @[560px]:w-[228px] space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
            <label htmlFor="hud-incidence-angle" className="text-slate-200 font-semibold">
              θi = <span className="text-cyan-300">{Math.round(wave.incidenceAngleDeg)}°</span>
            </label>
            <span
              className={
                emParams.isTotalInternalReflection
                  ? 'text-rose-300 font-semibold'
                  : isNearBrewster
                    ? 'text-amber-300 font-semibold'
                    : 'text-emerald-300'
              }
            >
              {material.isPEC
                ? 'PEC'
                : emParams.isTotalInternalReflection
                  ? 'TIR'
                  : isNearBrewster
                    ? 'Brewster'
                    : `θt = ${emParams.thetaTDeg.toFixed(1)}°`}
            </span>
          </div>
          <input
            id="hud-incidence-angle"
            aria-label="Angle d'incidence sur banc 3D (θi)"
            type="range"
            min="0"
            max="85"
            step="1"
            value={wave.incidenceAngleDeg}
            onChange={(e) =>
              onWaveChange({ ...wave, incidenceAngleDeg: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="hidden @[560px]:flex items-center gap-1">
            {[0, 30, 45, 60].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => onWaveChange({ ...wave, incidenceAngleDeg: deg })}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  Math.round(wave.incidenceAngleDeg) === deg
                    ? 'bg-cyan-500/20 border-cyan-500/70 text-cyan-200 font-semibold'
                    : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:text-white'
                }`}
              >
                {deg}°
              </button>
            ))}
            {emParams.brewsterDeg !== null && (
              <button
                type="button"
                title={`Angle de Brewster TM (${emParams.brewsterDeg.toFixed(1)}°)`}
                onClick={() =>
                  onWaveChange({
                    ...wave,
                    guidedMode: 'TM',
                    incidenceAngleDeg: Math.round(emParams.brewsterDeg!),
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  isNearBrewster
                    ? 'bg-amber-500/20 border-amber-500/70 text-amber-200 font-semibold'
                    : 'bg-slate-900/80 border-slate-700/70 text-amber-300 hover:text-amber-200'
                }`}
              >
                θB
              </button>
            )}
          </div>
        </div>
      )}

      {/* Minimal non-blocking probe instruction badge (solid bg, no backdrop-blur) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2.5 bg-[#0c1322]/92 px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs text-slate-300 shadow-md pointer-events-none">
        <span className="font-mono text-cyan-300 font-semibold">Banc Optique 3D</span>
        <span className="hidden @[560px]:inline text-slate-600" aria-hidden="true">·</span>
        <span className="hidden @[560px]:inline text-slate-300 text-[11px]">
          Glisser <span className="text-cyan-300 font-mono">Sonde 1</span> ou{' '}
          <span className="text-amber-300 font-mono">Sonde 2</span>
        </span>
      </div>

      {/* Bottom-left probe coordinate legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-[#0c1322]/92 px-3 py-1.5 rounded-lg border border-slate-700/70 text-[11px] text-slate-200 font-mono pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" aria-hidden="true" />
          <span>S1 (x={probe.x1.toFixed(1)}m)</span>
        </div>
        <span className="text-slate-600" aria-hidden="true">/</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" aria-hidden="true" />
          <span>S2 (x={probe.x2.toFixed(1)}m)</span>
        </div>
      </div>

      {/* Bottom-right 3D camera viewpoint switcher (shown whenever viewport width >= 560px) */}
      {onCameraModeChange && (
        <div
          role="group"
          aria-label="Angles de vue 3D"
          className="hidden @[560px]:flex absolute bottom-3 right-3 z-10 items-center gap-1 bg-[#0c1322]/92 p-1 rounded-lg border border-slate-700/70 shadow-md"
        >
          {CAMERA_ORDER.map((mode) => {
            const preset = CAMERA_PRESETS[mode];
            const isActive = simulation.cameraMode === mode;
            return (
              <button
                key={mode}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={isActive}
                onClick={() => onCameraModeChange(mode)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap border ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                    : 'text-slate-300 border-transparent hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
