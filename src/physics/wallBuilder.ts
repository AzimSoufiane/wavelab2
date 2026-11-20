import * as THREE from 'three';
import { MaterialPreset, WallGeometry, WaveConfig } from '../types';
import { getSurfaceTextureDisplacement } from './waveEngine';

interface CachedTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const textureCache = new Map<string, CachedTextureSet>();
const materialCache = new Map<string, THREE.Material>();

function seededNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function getMaterialTextures(
  materialId: string,
  baseColorHex: string,
  maxAnisotropy: number
): CachedTextureSet {
  const key = `${materialId}_${baseColorHex}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const size = 128;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const baseColor = new THREE.Color(baseColorHex);
  const rBase = Math.round(baseColor.r * 255);
  const gBase = Math.round(baseColor.g * 255);
  const bBase = Math.round(baseColor.b * 255);

  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let grain = 0;
      let bumpVal = 128;
      let roughVal = 180;

      if (materialId === 'metal' || materialId === 'copper' || materialId === 'aluminum') {
        // Anisotropic horizontal brushed metal streaks
        const streak = seededNoise(Math.floor(x / 18), y, 1) * 0.7 + seededNoise(x, y, 2) * 0.3;
        grain = (streak - 0.5) * 26;
        bumpVal = Math.round(128 + (streak - 0.5) * 35);
        roughVal = Math.round(45 + streak * 45);
      } else if (materialId === 'concrete') {
        // Mineral aggregate micro-pitting
        const coarse = seededNoise(Math.floor(x / 3), Math.floor(y / 3), 3);
        const fine = seededNoise(x, y, 4);
        const pit = coarse < 0.08 ? -35 : 0;
        grain = (coarse - 0.5) * 28 + (fine - 0.5) * 18 + pit;
        bumpVal = Math.max(0, Math.min(255, Math.round(135 + (coarse - 0.5) * 90 + pit * 1.5)));
        roughVal = Math.round(205 + fine * 40);
      } else if (materialId === 'brick') {
        // Kiln-fired masonry with subtle horizontal strata
        const row = Math.floor(y / 32);
        const mortar = y % 32 < 3 || ((x + (row % 2) * 48) % 96 < 3);
        const clay = seededNoise(Math.floor(x / 2), Math.floor(y / 2), 5);
        grain = mortar ? -42 : (clay - 0.5) * 26;
        bumpVal = mortar ? 60 : Math.round(145 + (clay - 0.5) * 65);
        roughVal = mortar ? 245 : Math.round(190 + clay * 45);
      } else if (materialId === 'polystyrene') {
        // Closed-cell expanded dielectric bead pattern
        const cellX = Math.floor(x / 6);
        const cellY = Math.floor(y / 6);
        const cell = seededNoise(cellX, cellY, 7);
        const micro = seededNoise(x, y, 8);
        grain = (cell - 0.5) * 18 + (micro - 0.5) * 10;
        bumpVal = Math.round(128 + (cell - 0.5) * 55);
        roughVal = Math.round(135 + cell * 45);
      } else {
        // Optical air / glass reference
        const fine = seededNoise(x, y, 9);
        grain = (fine - 0.5) * 8;
        bumpVal = 128;
        roughVal = 24;
      }

      aImg.data[idx] = Math.max(0, Math.min(255, Math.round(rBase + grain)));
      aImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(gBase + grain)));
      aImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(bBase + grain)));
      aImg.data[idx + 3] = 255;

      bImg.data[idx] = bumpVal;
      bImg.data[idx + 1] = bumpVal;
      bImg.data[idx + 2] = bumpVal;
      bImg.data[idx + 3] = 255;

      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1.5);
    tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  };

  const set: CachedTextureSet = {
    map: configureTex(albedoCanvas, true),
    bumpMap: configureTex(bumpCanvas, false),
    roughnessMap: configureTex(roughCanvas, false),
  };
  textureCache.set(key, set);
  return set;
}

function createWallPBRMaterial(
  material: MaterialPreset,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Material {
  const matKey = `${material.id}_${material.color}_${material.isConductor ? 1 : 0}_${isSoftwareGl ? 1 : 0}`;
  const cached = materialCache.get(matKey);
  if (cached) return cached;

  const maps = getMaterialTextures(material.id, material.color, maxAnisotropy);
  let pbrMat: THREE.Material;

  if (material.id === 'air') {
    pbrMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#7dd3fc'),
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: isSoftwareGl ? 0.22 : 0.2,
      transmission: isSoftwareGl ? 0 : 0.75,
      ior: 1.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });
  } else if (material.isConductor || material.id === 'metal') {
    const isCopper = material.id === 'copper';
    pbrMat = new THREE.MeshPhysicalMaterial({
      color: isCopper ? new THREE.Color('#f59e60') : 0xffffff,
      map: maps.map,
      bumpMap: maps.bumpMap,
      bumpScale: 0.015,
      roughnessMap: maps.roughnessMap,
      roughness: isCopper ? 0.32 : 0.25,
      metalness: isCopper ? 0.68 : 0.88,
      emissive: isCopper ? new THREE.Color('#431407') : new THREE.Color(0x000000),
      emissiveIntensity: isCopper ? 0.35 : 0.0,
      anisotropy: 0.8,
      anisotropyRotation: 0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.25,
      envMapIntensity: isCopper ? 0.85 : 1.25,
    });
  } else if (material.id === 'polystyrene') {
    pbrMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: maps.map,
      bumpMap: maps.bumpMap,
      bumpScale: 0.025,
      roughnessMap: maps.roughnessMap,
      roughness: 0.62,
      metalness: 0.05,
      clearcoat: 0.12,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.9,
    });
  } else {
    pbrMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: maps.map,
      bumpMap: maps.bumpMap,
      bumpScale: 0.04,
      roughnessMap: maps.roughnessMap,
      roughness: material.id === 'concrete' ? 0.88 : 0.8,
      metalness: 0.04,
      envMapIntensity: 0.75,
    });
  }

  pbrMat.userData.shared = true;
  materialCache.set(matKey, pbrMat);
  return pbrMat;
}

function getSharedFrameMaterial(
  key: string,
  factory: () => THREE.Material
): THREE.Material {
  const existing = materialCache.get(key);
  if (existing) return existing;
  const created = factory();
  created.userData.shared = true;
  materialCache.set(key, created);
  return created;
}

function createExtrudedProfileMesh(
  zStart: number,
  zEnd: number,
  wall: WallGeometry,
  mat: THREE.Material,
  zSteps: number,
  wallHeight: number,
  castShadow: boolean
): THREE.Mesh {
  const halfThickness = wall.thickness / 2;
  const shape = new THREE.Shape();

  shape.moveTo(zEnd, halfThickness);
  shape.lineTo(zStart, halfThickness);

  for (let i = 0; i <= zSteps; i++) {
    const z = zStart + (i / zSteps) * (zEnd - zStart);
    const deltaX =
      wall.textureProfile === 'fentes_cavites'
        ? wall.textureDepth
        : getSurfaceTextureDisplacement(
            z,
            wall.textureProfile,
            wall.textureDepth,
            wall.texturePeriod
          );
    const xFront = -halfThickness - deltaX;
    shape.lineTo(z, xFront);
  }
  shape.closePath();

  const depthY = Math.max(0.4, wallHeight - 0.16);
  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: depthY,
    bevelEnabled: false,
    curveSegments: 6,
  });

  // Transform (z_2d, x_2d, y_extrude) -> (x, y, z)
  extrudeGeo.rotateZ(-Math.PI / 2);
  extrudeGeo.rotateX(-Math.PI / 2);
  extrudeGeo.translate(wall.posX, 0.08, 0);
  extrudeGeo.computeVertexNormals();

  // Scale UVs cleanly so procedural textures never stretch
  const uv = extrudeGeo.attributes.uv;
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 0.15, uv.getY(i) * 0.15);
    }
    uv.needsUpdate = true;
  }

  const mesh = new THREE.Mesh(extrudeGeo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function createFlatBlockMesh(
  zStart: number,
  zEnd: number,
  xFront: number,
  xBack: number,
  mat: THREE.Material,
  wallHeight: number,
  castShadow: boolean
): THREE.Mesh {
  const widthX = Math.max(0.08, xBack - xFront);
  const depthY = Math.max(0.4, wallHeight - 0.16);
  const lengthZ = Math.max(0.08, zEnd - zStart);
  const boxGeo = new THREE.BoxGeometry(widthX, depthY, lengthZ);
  const mesh = new THREE.Mesh(boxGeo, mat);
  mesh.position.set((xFront + xBack) * 0.5, 0.08 + depthY * 0.5, (zStart + zEnd) * 0.5);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Construit un ensemble architectural et optique complet (THREE.Group multi-composants)
 * pour remplacer l'ancien bloc wireframe années 90 :
 * - Socle usiné anodisé au sol + ombre de contact
 * - Corps diélectrique/métallique chanfreiné avec textures PBR procédurales
 * - Vraies fentes traversantes pour le profil "Col d'air"
 * - Montants de bridage latéraux & rail supérieur en aluminium brossé
 * - Ligne de référence dioptre z=0 au sol
 */
export function buildBarrierAssembly(
  wall: WallGeometry,
  material: MaterialPreset,
  wave: WaveConfig,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): THREE.Group {
  const group = new THREE.Group();
  const wallSpanZ = 24.0;
  const wallHeight = Math.max(1.2, wall.height || 2.8);
  const totalDepth = wall.thickness + wall.textureDepth;
  const centerX = wall.posX - wall.textureDepth * 0.5;
  const castShadow = !isSoftwareGl && material.id !== 'air';

  const frameAnodizedMat = getSharedFrameMaterial('frame_anodized', () =>
    new THREE.MeshStandardMaterial({
      color: 0x161f30,
      roughness: 0.42,
      metalness: 0.78,
      envMapIntensity: 1.0,
    })
  );
  const brushedTrimMat = getSharedFrameMaterial('brushed_trim', () =>
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.24,
      metalness: 0.88,
      envMapIntensity: 1.2,
    })
  );
  const isMetalAccent = Boolean(material.isConductor || material.id === 'metal');
  const accentStripMat = getSharedFrameMaterial(
    isMetalAccent ? 'accent_conductor' : 'accent_dielectric',
    () =>
      new THREE.MeshStandardMaterial({
        color: isMetalAccent ? 0xf43f5e : 0x38bdf8,
        roughness: 0.3,
        metalness: 0.4,
        emissive: isMetalAccent ? 0x4c0519 : 0x082f49,
        emissiveIntensity: 0.45,
      })
  );

  // 1. Rail d'alignement optique avant (indique le plan d'entrée)
  const frontRailGeo = new THREE.BoxGeometry(0.08, 0.04, wallSpanZ + 0.6);
  const frontRail = new THREE.Mesh(frontRailGeo, accentStripMat);
  frontRail.position.set(wall.posX - wall.thickness / 2 - wall.textureDepth - 0.18, 0.025, 0);
  group.add(frontRail);

  const barrierMat = createWallPBRMaterial(material, maxAnisotropy, isSoftwareGl);

  if (wall.textureProfile === 'fentes_cavites') {
    // Vraies colonnes diélectriques séparées laissant des canaux "Col d'air" ouverts de haut en bas
    const period = Math.max(0.8, wall.texturePeriod);
    const halfSpan = wallSpanZ / 2;
    const slotHalfRatio = 0.22;
    const startIdx = Math.floor(-halfSpan / period) - 1;
    const endIdx = Math.ceil(halfSpan / period) + 1;

    // Deux rails fins au sol (avant & arrière) laissant le canal central totalement dégagé
    const runnerGeo = new THREE.BoxGeometry(0.16, 0.06, wallSpanZ + 0.6);
    const runnerFront = new THREE.Mesh(runnerGeo, frameAnodizedMat);
    runnerFront.position.set(wall.posX - wall.thickness / 2 - wall.textureDepth + 0.08, 0.03, 0);
    group.add(runnerFront);

    const runnerBack = new THREE.Mesh(runnerGeo, frameAnodizedMat);
    runnerBack.position.set(wall.posX + wall.thickness / 2 - 0.08, 0.03, 0);
    group.add(runnerBack);

    for (let k = startIdx; k <= endIdx; k++) {
      const segStart = Math.max(-halfSpan, (k - (0.5 - slotHalfRatio)) * period);
      const segEnd = Math.min(halfSpan, (k + (0.5 - slotHalfRatio)) * period);
      const segLen = segEnd - segStart;
      if (segLen > 0.08) {
        // Patin d'ancrage individuel sous chaque colonne
        const padGeo = new THREE.BoxGeometry(totalDepth + 0.16, 0.09, segLen + 0.08);
        const pad = new THREE.Mesh(padGeo, frameAnodizedMat);
        pad.position.set(centerX, 0.045, (segStart + segEnd) / 2);
        pad.receiveShadow = true;
        group.add(pad);

        const blockMesh = createFlatBlockMesh(
          segStart,
          segEnd,
          wall.posX - wall.thickness / 2 - wall.textureDepth,
          wall.posX + wall.thickness / 2,
          barrierMat,
          wallHeight,
          castShadow
        );
        group.add(blockMesh);

        // Chapeau individuel sur la colonne (laisse les canaux d'air 100% dégagés)
        const colCapGeo = new THREE.BoxGeometry(0.24, 0.06, segLen + 0.04);
        const colCap = new THREE.Mesh(colCapGeo, brushedTrimMat);
        colCap.position.set(wall.posX + wall.thickness / 2 - 0.12, wallHeight + 0.04, (segStart + segEnd) / 2);
        group.add(colCap);
      }
    }
  } else {
    // Socle usiné continu pour barrière pleine
    const plinthGeo = new THREE.BoxGeometry(totalDepth + 0.36, 0.09, wallSpanZ + 0.6);
    const plinth = new THREE.Mesh(plinthGeo, frameAnodizedMat);
    plinth.position.set(centerX, 0.035, 0);
    plinth.receiveShadow = true;
    plinth.castShadow = !isSoftwareGl;
    group.add(plinth);

    const shadowPlaneGeo = new THREE.PlaneGeometry(totalDepth + 1.2, wallSpanZ + 1.0);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = getSharedFrameMaterial('contact_shadow', () =>
      new THREE.MeshBasicMaterial({
        color: 0x020617,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    );
    const contactShadow = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    contactShadow.position.set(centerX, -0.012, 0);
    group.add(contactShadow);

    const bodyMesh =
      wall.textureDepth <= 0.01
        ? createFlatBlockMesh(
            -wallSpanZ / 2,
            wallSpanZ / 2,
            wall.posX - wall.thickness / 2,
            wall.posX + wall.thickness / 2,
            barrierMat,
            wallHeight,
            castShadow
          )
        : createExtrudedProfileMesh(
            -wallSpanZ / 2,
            wallSpanZ / 2,
            wall,
            barrierMat,
            wall.textureProfile === 'creneaux' || wall.textureProfile === 'rectangulaire' ? 84 : 72,
            wallHeight,
            castShadow
          );
    group.add(bodyMesh);
  }

  // 4. Poteaux d'extrémité en aluminium anodisé (Z = ±12.16)
  const pillarGeo = new THREE.BoxGeometry(totalDepth + 0.28, wallHeight + 0.12, 0.24);
  for (const zSide of [-wallSpanZ / 2 - 0.16, wallSpanZ / 2 + 0.16]) {
    const pillar = new THREE.Mesh(pillarGeo, frameAnodizedMat);
    pillar.position.set(centerX, (wallHeight + 0.12) / 2, zSide);
    pillar.castShadow = !isSoftwareGl;
    pillar.receiveShadow = true;
    group.add(pillar);

    const collarGeo = new THREE.BoxGeometry(totalDepth + 0.34, 0.1, 0.28);
    const topCollar = new THREE.Mesh(collarGeo, brushedTrimMat);
    topCollar.position.set(centerX, wallHeight + 0.06, zSide);
    group.add(topCollar);
  }

  // Lisse dorsale supérieure uniquement pour les parois pleines (jamais au-dessus des fentes ouvertes)
  if (wall.textureProfile !== 'fentes_cavites') {
    const topCapGeo = new THREE.BoxGeometry(0.24, 0.08, wallSpanZ + 0.44);
    const topCap = new THREE.Mesh(topCapGeo, brushedTrimMat);
    topCap.position.set(wall.posX + wall.thickness / 2 - 0.12, wallHeight + 0.05, 0);
    topCap.castShadow = !isSoftwareGl;
    group.add(topCap);
  }

  // 5. Plaques latérales du guide d'onde rectangulaire si régime guide d'ondes actif
  if (wave.boundaryModel === 'guide_ondes') {
    const guideWallGeo = new THREE.BoxGeometry(30, wallHeight * 0.72, 0.14);
    const guideWallMat = getSharedFrameMaterial('guide_side_plate', () =>
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.32,
        metalness: 0.85,
        transparent: true,
        opacity: 0.35,
      })
    );
    for (const zSide of [-12.05, 12.05]) {
      const sidePlate = new THREE.Mesh(guideWallGeo, guideWallMat);
      sidePlate.position.set(0, (wallHeight * 0.72) / 2, zSide);
      group.add(sidePlate);
    }
  }

  return group;
}

export function disposeGroupResources(group: THREE.Group): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      if (obj.geometry && !disposedGeos.has(obj.geometry)) {
        obj.geometry.dispose();
        disposedGeos.add(obj.geometry);
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && !m.userData?.shared && !disposedMats.has(m)) {
          m.dispose();
          disposedMats.add(m);
        }
      }
    }
  });
}
