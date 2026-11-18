export type SurfaceTextureProfile =
  | 'triangulaire'
  | 'fentes_cavites'
  | 'creneaux'
  | 'rectangulaire'
  | 'circulaire'
  | 'sinusoidale';

export type GuidedMode = 'TE' | 'TM';

export type PolarizationMode = 'rectiligne' | 'circulaire' | 'source_surfacique';

export type BoundaryModel = 'dioptre_semi_infini' | 'lame_finie' | 'guide_ondes';

export interface MaterialPreset {
  id: string;
  name: string;
  epsilonR: number;
  lossTangent: number;
  conductivity: number; // S/m (utilisé pour le régime bon conducteur / PEC)
  isConductor?: boolean;
  isPEC?: boolean;
  color: string;
  description: string;
}

export interface WallGeometry {
  textureProfile: SurfaceTextureProfile;
  thickness: number; // Épaisseur e (m)
  textureDepth: number; // Profondeur de modulation h (m)
  texturePeriod: number; // Période spatiale Λ (m)
  posX: number; // Position du centre de la paroi sur X (m)
  height: number; // Hauteur de l'obstacle (m)
}

export interface WaveConfig {
  frequency: number; // Fréquence f (GHz)
  amplitude: number; // Amplitude de crête E0 (V/m)
  guidedMode: GuidedMode; // Mode TE (E ⊥ plan) ou TM (E ∥ plan)
  guideA: number; // Largeur du guide d'ondes a (m)
  guideB: number; // Hauteur du guide d'ondes b (m)
  modeM: number; // Indice de mode m (ex: 1 pour TE10)
  modeN: number; // Indice de mode n (ex: 0 pour TE10)
  polarization: PolarizationMode; // Forme d'onde source (rectiligne, circulaire, nappe js)
  incidenceAngleDeg: number; // Angle d'incidence θi (°) sur le dioptre
  medium1EpsilonR: number; // Permittivité du milieu 1 (1.0 = vide/air, 2.25 = verre)
  boundaryModel?: BoundaryModel; // Dioptre semi-infini, lame finie, ou guide d'ondes rectangulaire
  waveSpeedC: number; // Vitesse de référence normalisée pour l'animation 3D
}

export interface DualProbeState {
  // Sonde 1 (x1, z1) - Voie A (Cyan)
  x1: number;
  z1: number;
  val1: number;
  history1: number[];
  pkToPk1: number;
  rms1: number;

  // Sonde 2 (x2, z2) - Voie B (Ambre)
  x2: number;
  z2: number;
  val2: number;
  history2: number[];
  pkToPk2: number;
  rms2: number;

  // Grandeurs différentielles, guidées & ondes stationnaires (Ch. 3)
  activeProbe: 1 | 2;
  deltaPhiRad: number;
  deltaPhiDeg: number;
  distanceDeltaX: number;
  transmissionCoeff: number;
  isCutoff: boolean;
  cutoffFreq: number; // fc (GHz)
  vPhaseGuided: number;
  lambdaGuided: number;
  attenuationAlpha: number;
}

export type CameraMode = 'perspective' | 'top' | 'profile' | 'incident' | 'isometric';

export interface SimulationState {
  isPlaying: boolean;
  speed: number;
  time: number;
  showVectors: boolean;
  showSurface: boolean;
  showRays: boolean;
  showEnvelope: boolean;
  showTrihedron: boolean;
  cameraMode: CameraMode;
  showKatexPanel: boolean;
}

export interface AcademicProfile {
  studentName: string;
  studentId: string;
  studentClass: string;
  studentEmail: string;
  teacherName: string;
  teacherTitle: string;
  teacherDepartment: string;
  teacherEmail: string;
  institution: string;
  moduleName: string;
}

