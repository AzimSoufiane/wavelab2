import {
  MaterialPreset,
  WallGeometry,
  WaveConfig,
  SurfaceTextureProfile,
} from '../types';

export const C_LIGHT_VACUUM = 2.99792458e8; // c dans le vide (m/s)
export const MU_0 = 4 * Math.PI * 1e-7; // Perméabilité du vide (H/m)
export const EPS_0 = 8.8541878128e-12; // Permittivité du vide (F/m)
export const ETA_0 = Math.sqrt(MU_0 / EPS_0); // ≈ 376.7303 Ω

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'polystyrene',
    name: 'Polystyrène Expansé',
    epsilonR: 2.54,
    lossTangent: 0.0005,
    conductivity: 1e-14,
    color: '#38BDF8',
    description:
      'Diélectrique à faibles pertes (εr = 2.54, tan δ = 0.0005). Retard de phase modéré, forte transmission.',
  },
  {
    id: 'concrete',
    name: 'Béton de Structure',
    epsilonR: 6.0,
    lossTangent: 0.05,
    conductivity: 0.015,
    color: '#94A3B8',
    description:
      'Milieu dissipatif à pertes modérées (εr = 6.0, tan δ = 0.05). Onde stationnaire marquée et atténuation e^{-αx}.',
  },
  {
    id: 'air',
    name: 'Vide / Espace Libre',
    epsilonR: 1.0,
    lossTangent: 0.0,
    conductivity: 0.0,
    color: '#67E8F9',
    description:
      'Milieu de référence sans pertes (εr = 1.0, η = η₀). Adaptation parfaite si milieu 1 = vide (Γ = 0, ROS = 1).',
  },
  {
    id: 'metal',
    name: 'Conducteur Parfait (PEC)',
    epsilonR: 1.0,
    lossTangent: 1e6,
    conductivity: 5.8e7, // Cuivre comme référence de peau, limite PEC η → 0
    isConductor: true,
    isPEC: true,
    color: '#CBD5E1',
    description:
      'Miroir électromagnétique (σ → ∞, η → 0, Γ = -1). Réflexion totale avec nœud sur l’interface (ROS = ∞).',
  },
  {
    id: 'brick',
    name: 'Brique Pleine',
    epsilonR: 4.2,
    lossTangent: 0.02,
    conductivity: 0.004,
    color: '#FB923C',
    description:
      'Diélectrique réfractif standard (εr = 4.2, tan δ = 0.02). Contraste d’indice net et déphasage interne.',
  },
  {
    id: 'copper',
    name: 'Cuivre Réel (Bon Conducteur)',
    epsilonR: 1.0,
    lossTangent: 0.0,
    conductivity: 5.813e7,
    isConductor: true,
    isPEC: false,
    color: '#D97706',
    description:
      'Bon conducteur réel (σ = 5,81×10⁷ S/m, δs ≈ 0,66 µm à 10 GHz, arg(η) = 45°). Quasi-miroir (R ≈ 1).',
  },
  {
    id: 'aluminum',
    name: 'Aluminium Réel (Bon Conducteur)',
    epsilonR: 1.0,
    lossTangent: 0.0,
    conductivity: 3.816e7,
    isConductor: true,
    isPEC: false,
    color: '#94A3B8',
    description:
      'Bon conducteur réel (σ = 3,82×10⁷ S/m, δs ≈ 0,81 µm à 10 GHz, arg(η) = 45°). Blindage RF léger.',
  },
];

// --- Arithmétique complexe exacte (convention e^{+jωt}) ---
export interface Complex {
  re: number;
  im: number;
}

export const cplx = (re: number, im = 0): Complex => ({ re, im });
export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cDiv = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-30) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
};
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re);
export const cExp = (a: Complex): Complex => {
  const mag = Math.exp(Math.max(-60, Math.min(60, a.re)));
  return { re: mag * Math.cos(a.im), im: mag * Math.sin(a.im) };
};
export const cSqrt = (a: Complex): Complex => {
  const r = Math.hypot(a.re, a.im);
  if (r === 0) return { re: 0, im: 0 };
  const re = Math.sqrt((r + a.re) / 2);
  const imSign = a.im < 0 ? -1 : 1;
  const im = imSign * Math.sqrt(Math.max(0, (r - a.re) / 2));
  return { re, im };
};

export interface FieldValue {
  amplitude: number; // Champ électrique principal Ey(x, z, t) ou résultant
  amplitudeZ: number; // Composante secondaire (polarisation circulaire)
  gradientX: number; // dE/dx
  gradientZ: number; // dE/dz
  fluxX: number; // Composante X normalisée du flux de Poynting
  fluxZ: number; // Composante Z normalisée du flux de Poynting
  inObstacle: boolean;
  isEvanescent: boolean;
}

/**
 * Fréquence de coupure fc pour un guide d'onde rectangulaire TE_mn / TM_mn :
 * fc = (c / (2 * sqrt(eps_r))) * sqrt((m/a)^2 + (n/b)^2)
 */
export function calculateCutoffFrequency(
  a: number,
  b: number,
  m: number,
  n: number,
  epsilonR: number,
  cSpeed: number = C_LIGHT_VACUUM
): number {
  if (m === 0 && n === 0) return 0;
  const sqrtEps = Math.sqrt(Math.max(1.0, epsilonR));
  const termX = m / Math.max(0.001, a);
  const termY = n / Math.max(0.001, b);
  return (cSpeed / (2 * sqrtEps)) * Math.sqrt(termX * termX + termY * termY);
}

export function getVisualCSim(wave: WaveConfig): number {
  const base = Math.max(0.1, wave.waveSpeedC);
  return wave.frequency > 2.5 ? base * (wave.frequency / 2.5) : base;
}

/**
 * Calcule le déphasage spatial Δφ cohérent avec le vecteur d'onde de la scène 3D.
 */
export function calculateProbePhaseDelta(
  wave: WaveConfig,
  n1: number,
  n2: number,
  fcRatio: number,
  isCutoff: boolean,
  deltaX: number
): { deltaPhiRad: number; deltaPhiDeg: number; kSimEff: number } {
  const kSimBase = (2 * Math.PI * wave.frequency) / getVisualCSim(wave);
  const kSimEff =
    wave.boundaryModel === 'guide_ondes' && !isCutoff
      ? kSimBase * n2 * Math.sqrt(Math.max(0, 1 - fcRatio * fcRatio))
      : kSimBase * n1;
  const deltaPhiRad = kSimEff * deltaX;
  const deltaPhiDeg = (deltaPhiRad * 180) / Math.PI;
  return { deltaPhiRad, deltaPhiDeg, kSimEff };
}

/**
 * Paramètres complets des Chapitres 1, 2, 3 (Fiche Mod-M115) et modes guidés.
 */
export function calculateElectromagneticParameters(
  wave: WaveConfig,
  material: MaterialPreset,
  wall?: WallGeometry
) {
  const eps1 = Math.max(1.0, wave.medium1EpsilonR || 1.0);
  const n1 = Math.sqrt(eps1);
  const eta1 = ETA_0 / n1;

  const eps2 = Math.max(1.0, material.epsilonR);
  const n2 = Math.sqrt(eps2);

  const fHz = Math.max(1e6, wave.frequency * 1e9);
  const omega = 2 * Math.PI * fHz;
  const k0 = omega / C_LIGHT_VACUUM;
  const k1 = k0 * n1;
  const lambda1 = (2 * Math.PI) / k1;
  const lambda0 = C_LIGHT_VACUUM / fHz;

  // --- Chapitre 2 : Milieux dissipatifs (γ = α + jβ, η complexe, δs) ---
  // tan δ_eff = ε''/ε' + σ / (ω ε0 ε')
  let gamma: Complex;
  let eta2Complex: Complex;
  let alpha = 0;
  let beta = k0 * n2;
  let skinDepth = Infinity;
  let regime: 'sans_pertes' | 'faibles_pertes' | 'bon_conducteur' | 'pec' = 'sans_pertes';
  const sigma = Math.max(0, material.conductivity || 0);
  const tanDeltaCond = sigma / (omega * EPS_0 * eps2);
  const tanDelta = Math.max(0, material.lossTangent) + tanDeltaCond;

  if (material.isPEC) {
    regime = 'pec';
    const sigmaCu = Math.max(1e5, sigma || 5.8e7);
    skinDepth = Math.sqrt(2 / (MU_0 * sigmaCu * omega));
    alpha = 1 / skinDepth;
    beta = 1 / skinDepth;
    gamma = cplx(alpha, beta);
    eta2Complex = cplx(0, 0);
  } else if (tanDelta === 0) {
    regime = 'sans_pertes';
    gamma = cplx(0, k0 * n2);
    eta2Complex = cplx(ETA_0 / n2, 0);
    alpha = 0;
    beta = k0 * n2;
    skinDepth = Infinity;
  } else if (tanDelta > 100 || material.isConductor) {
    // Bon conducteur exact (σ >> ωε) : γ = (1 + j)/δ, η = (1 + j)/(σ δ)
    regime = 'bon_conducteur';
    const sigmaEff = Math.max(1e-6, sigma + omega * EPS_0 * eps2 * Math.max(0, material.lossTangent));
    skinDepth = Math.sqrt(2 / (MU_0 * sigmaEff * omega));
    alpha = 1 / skinDepth;
    beta = 1 / skinDepth;
    gamma = cplx(alpha, beta);
    eta2Complex = cDiv(cplx(0, omega * MU_0), gamma);
  } else {
    // γ = j (ω/c) sqrt(ε') sqrt(1 - j tan δ_eff)
    const rootTerm = cSqrt(cplx(1, -tanDelta));
    const pref = k0 * n2;
    gamma = cplx(-pref * rootTerm.im, pref * rootTerm.re);
    alpha = Math.max(0, gamma.re);
    beta = Math.max(1e-9, gamma.im);
    skinDepth = alpha > 1e-12 ? 1 / alpha : Infinity;
    eta2Complex = cDiv(cplx(0, omega * MU_0), gamma);
    regime = tanDelta > 10 ? 'bon_conducteur' : 'faibles_pertes';
  }

  const vPhase = omega / beta;
  const lambdaMedium = (2 * Math.PI) / beta;
  const kMedium = beta;
  const eta = material.isPEC ? 0 : cAbs(eta2Complex);
  const etaPhaseDeg = material.isPEC ? 0 : (cArg(eta2Complex) * 180) / Math.PI;
  const attenuationDbPerM = Number.isFinite(alpha) ? 8.686 * alpha : Infinity;
  const poyntingMean = (wave.amplitude * wave.amplitude) / (2 * eta1);

  // --- Chapitre 1 : Lois de Descartes & Coefficients de Fresnel (normale + oblique TE/TM) ---
  const thetaIRad = (Math.min(85, Math.max(0, wave.incidenceAngleDeg || 0)) * Math.PI) / 180;
  const sinThetaI = Math.sin(thetaIRad);
  const cosThetaI = Math.cos(thetaIRad);

  // Angle critique θl si n1 > n2 et milieu 2 sans pertes
  const hasCriticalAngle = !material.isPEC && n1 > n2;
  const thetaLimitRad = hasCriticalAngle ? Math.asin(n2 / n1) : null;
  const thetaLimitDeg = thetaLimitRad !== null ? (thetaLimitRad * 180) / Math.PI : null;

  // Angle de Brewster θB (mode TM uniquement, diélectriques peu dissipatifs) : tan θB = n2 / n1
  const brewsterRad = !material.isPEC && !material.isConductor ? Math.atan(n2 / n1) : null;
  const brewsterDeg = brewsterRad !== null ? (brewsterRad * 180) / Math.PI : null;

  // Snell-Descartes : n1 sin θi = n2 sin θt
  const sinThetaT = !material.isPEC ? (n1 / n2) * sinThetaI : 0;
  const isTotalInternalReflection = !material.isPEC && sinThetaT > 1.0;

  // cos θt (réel si sinThetaT <= 1, imaginaire pur -j sqrt(sin^2 θt - 1) si réflexion totale)
  const cosThetaT: Complex = isTotalInternalReflection
    ? cplx(0, -Math.sqrt(sinThetaT * sinThetaT - 1.0))
    : cplx(Math.sqrt(Math.max(0, 1.0 - sinThetaT * sinThetaT)), 0);

  const thetaTRad = isTotalInternalReflection
    ? Math.PI / 2
    : Math.asin(Math.min(1, Math.max(-1, sinThetaT)));
  const thetaTDeg = (thetaTRad * 180) / Math.PI;

  // Coefficients de Fresnel complexes
  let gammaNormal: Complex;
  let transNormal: Complex;
  let gammaTE: Complex;
  let transTE: Complex;
  let gammaTM: Complex;
  let transTM: Complex;

  if (material.isPEC) {
    gammaNormal = cplx(-1, 0);
    transNormal = cplx(0, 0);
    gammaTE = cplx(-1, 0);
    transTE = cplx(0, 0);
    gammaTM = cplx(-1, 0);
    transTM = cplx(0, 0);
  } else {
    const eta1C = cplx(eta1, 0);
    // Incidence normale : Γ = (η2 - η1)/(η2 + η1), T = 2η2/(η2 + η1)
    gammaNormal = cDiv(cSub(eta2Complex, eta1C), cAdd(eta2Complex, eta1C));
    transNormal = cDiv(cplx(2 * eta2Complex.re, 2 * eta2Complex.im), cAdd(eta2Complex, eta1C));

    // Mode TE : Γ_TE = (η2 cos θi - η1 cos θt) / (η2 cos θi + η1 cos θt)
    const eta2CosI = cplx(eta2Complex.re * cosThetaI, eta2Complex.im * cosThetaI);
    const eta1CosT = cplx(eta1 * cosThetaT.re, eta1 * cosThetaT.im);
    gammaTE = cDiv(cSub(eta2CosI, eta1CosT), cAdd(eta2CosI, eta1CosT));
    transTE = cDiv(cplx(2 * eta2CosI.re, 2 * eta2CosI.im), cAdd(eta2CosI, eta1CosT));

    // Mode TM (convention du cours : Γ_TM(0) = Γ_normale) :
    // Γ_TM = (η2 cos θt - η1 cos θi) / (η2 cos θt + η1 cos θi)
    const eta2CosT = cMul(eta2Complex, cosThetaT);
    const eta1CosI = cplx(eta1 * cosThetaI, 0);
    gammaTM = cDiv(cSub(eta2CosT, eta1CosI), cAdd(eta2CosT, eta1CosI));
    transTM = cDiv(cplx(2 * eta2CosI.re, 2 * eta2CosI.im), cAdd(eta2CosT, eta1CosI));
  }

  const useTM = wave.boundaryModel !== 'guide_ondes' && wave.guidedMode === 'TM';
  const gammaSingle =
    thetaIRad < 1e-4 ? gammaNormal : useTM ? gammaTM : gammaTE;
  const transSingle =
    thetaIRad < 1e-4 ? transNormal : useTM ? transTM : transTE;

  let activeGamma = gammaSingle;
  let activeTrans = transSingle;
  let isSlabModel = wave.boundaryModel === 'lame_finie' && wall !== undefined && !material.isPEC;

  if (isSlabModel && wall) {
    // Lame diélectrique / dissipative d'épaisseur e (Fabry-Pérot / transfert d'impédance)
    const cSim = Math.max(0.1, wave.waveSpeedC);
    const k2Sim = (2 * Math.PI * wave.frequency * n2) / cSim;
    const lossRatio = beta > 1e-9 ? alpha / beta : 0;
    const alphaSim = material.isConductor ? 4.2 : k2Sim * lossRatio;
    const pathFactor = cosThetaT.re > 1e-4 ? cosThetaT.re : 1.0;
    // Atténuation + déphasage aller dans la lame : exp(-(α + jβ) e / cosθt)
    const propExp = cExp(
      cplx(-alphaSim * wall.thickness, -k2Sim * wall.thickness * pathFactor)
    );
    const propExp2 = cMul(propExp, propExp);
    const gamma2 = cplx(-gammaSingle.re, -gammaSingle.im); // interface 2 -> 1
    const one = cplx(1, 0);
    // Γ_in = (Γ1 + Γ2 e^{-2γd}) / (1 + Γ1 Γ2 e^{-2γd})
    const g2Exp2 = cMul(gamma2, propExp2);
    activeGamma = cDiv(cAdd(gammaSingle, g2Exp2), cAdd(one, cMul(gammaSingle, g2Exp2)));
    // T_slab = (1 - Γ1^2) e^{-γd} / (1 - Γ1^2 e^{-2γd}) (rapport en amplitude milieu 1 -> milieu 1)
    const g1Sq = cMul(gammaSingle, gammaSingle);
    activeTrans = cDiv(
      cMul(cSub(one, g1Sq), propExp),
      cSub(one, cMul(g1Sq, propExp2))
    );
  }

  const gammaMag = cAbs(activeGamma);
  const gammaPhaseRad = cArg(activeGamma); // φ dans Γ = |Γ| e^{jφ}
  const reflectionR = Math.min(1, gammaMag * gammaMag);

  // Coefficient en énergie T'
  let transmissionTPrime = 0;
  if (!material.isPEC && !isTotalInternalReflection) {
    if (isSlabModel) {
      // Pour lame finie (milieu 1 de chaque côté) : T' = |T_slab|^2
      transmissionTPrime = Math.max(0, Math.min(1, Math.pow(cAbs(activeTrans), 2)));
    } else if (regime === 'sans_pertes') {
      transmissionTPrime = Math.max(0, 1 - reflectionR);
    } else {
      const ratio = cDiv(
        cplx(eta1 * cosThetaT.re, eta1 * cosThetaT.im),
        cplx(eta2Complex.re * cosThetaI, eta2Complex.im * cosThetaI)
      );
      transmissionTPrime = Math.max(0, Math.min(1, ratio.re * Math.pow(cAbs(activeTrans), 2)));
    }
  }

  // --- Chapitre 3 : Ondes stationnaires devant un dioptre ---
  // Dans ce cours : TOS = |Γ|, ROS = (1 + |Γ|) / (1 - |Γ|)
  const tos = gammaMag;
  const ros = gammaMag >= 0.9999 ? Infinity : (1 + gammaMag) / (1 - gammaMag);
  const eMax = wave.amplitude * (1 + gammaMag);
  const eMin = wave.amplitude * Math.abs(1 - gammaMag);

  // Distance d entre l'interface et le 1er minimum dans le milieu 1 (en incidence normale) :
  // 2 k1 (-d) + φ = -π  => d = (π + φ) / (2 k1) ramené dans [0, λ1/2[
  let phiNorm = gammaPhaseRad;
  while (phiNorm <= -Math.PI) phiNorm += 2 * Math.PI;
  while (phiNorm > Math.PI) phiNorm -= 2 * Math.PI;
  // Si φ = π (Γ < 0), 1er min est à d = 0 ; si φ = 0 (Γ > 0), 1er min à d = λ1/4
  const dFirstMin = gammaMag < 1e-4 ? 0 : (((Math.PI - phiNorm) % (2 * Math.PI)) / (2 * k1));

  // --- Paramètres guidés (TE / TM en guide rectangulaire) ---
  let fc = 0;
  let isCutoff = false;
  let vPhaseGuided = vPhase;
  let lambdaGuided = lambdaMedium;
  let kGuided = kMedium;
  let attenuationAlpha = alpha;

  if (wave.boundaryModel === 'guide_ondes') {
    fc = calculateCutoffFrequency(
      wave.guideA,
      wave.guideB,
      wave.modeM,
      wave.modeN,
      eps2,
      C_LIGHT_VACUUM
    );
    const fcRatio = fc / fHz;
    if (fcRatio >= 1.0) {
      isCutoff = true;
      vPhaseGuided = Infinity;
      lambdaGuided = Infinity;
      kGuided = 0;
      attenuationAlpha = (omega / vPhase) * Math.sqrt(fcRatio * fcRatio - 1.0);
    } else {
      isCutoff = false;
      const betaFactor = Math.sqrt(1.0 - fcRatio * fcRatio);
      vPhaseGuided = vPhase / betaFactor;
      lambdaGuided = lambdaMedium / betaFactor;
      kGuided = kMedium * betaFactor;
      attenuationAlpha = alpha;
    }
  }

  return {
    fHz,
    omega,
    n1,
    n2,
    eta1,
    vPhase,
    lambda0,
    lambda1,
    lambdaMedium,
    k0,
    k1,
    kMedium,
    eta,
    etaPhaseDeg,
    eta2Complex,
    gamma,
    alpha,
    beta,
    attenuationDbPerM,
    skinDepth,
    regime,
    poyntingMean,
    // Fresnel normale & oblique
    rFresnel: gammaNormal.re,
    tFresnel: transNormal.re,
    gammaActive: activeGamma,
    transActive: activeTrans,
    gammaMag,
    gammaPhaseRad,
    reflectionR,
    transmissionT: transmissionTPrime,
    thetaIRad,
    thetaTRad,
    thetaTDeg,
    isTotalInternalReflection,
    thetaLimitDeg,
    brewsterDeg,
    // Chapitre 3
    tos,
    ros,
    eMax,
    eMin,
    dFirstMin,
    // Guidé
    fc,
    fcRatio: fc / fHz,
    isCutoff,
    vPhaseGuided,
    lambdaGuided,
    kGuided,
    attenuationAlpha,
  };
}

/**
 * Profil géométrique x_front(z) de la barrière
 */
export function getSurfaceTextureDisplacement(
  z: number,
  profile: SurfaceTextureProfile,
  depth: number,
  period: number
): number {
  if (depth <= 0.01 || period <= 0.05) return 0;
  const periodNorm = Math.max(0.2, period);
  const u = (((z % periodNorm) + periodNorm) % periodNorm) / periodNorm;

  switch (profile) {
    case 'triangulaire': {
      const tri = 1.0 - 2.0 * Math.abs(u - 0.5);
      return depth * tri;
    }
    case 'fentes_cavites': {
      // Canal ouvert ("Col d'air") centré sur u = 0.5
      const inSlot = Math.abs(u - 0.5) < 0.22;
      return inSlot ? 0 : depth;
    }
    case 'creneaux':
    case 'rectangulaire': {
      return u < 0.5 ? depth : 0;
    }
    case 'circulaire': {
      const centered = (u - 0.5) * 2.0;
      if (Math.abs(centered) <= 1.0) {
        return depth * Math.sqrt(Math.max(0, 1.0 - centered * centered));
      }
      return 0;
    }
    case 'sinusoidale': {
      return depth * 0.5 * (1.0 + Math.sin(2.0 * Math.PI * u));
    }
    default:
      return 0;
  }
}

export function isInsideOpenAirSlot(
  z: number,
  wall: WallGeometry
): boolean {
  if (wall.textureProfile !== 'fentes_cavites') return false;
  const periodNorm = Math.max(0.5, wall.texturePeriod);
  const u = (((z % periodNorm) + periodNorm) % periodNorm) / periodNorm;
  return Math.abs(u - 0.5) < 0.22;
}

export function isPointInWall(
  x: number,
  z: number,
  wall: WallGeometry
): { inside: boolean; depthIntoWall: number } {
  if (isInsideOpenAirSlot(z, wall)) {
    return { inside: false, depthIntoWall: 0 };
  }
  const halfThickness = wall.thickness / 2;
  const xBack = wall.posX + halfThickness;
  const baseFront = wall.posX - halfThickness;
  const deltaX = getSurfaceTextureDisplacement(
    z,
    wall.textureProfile,
    wall.textureDepth,
    wall.texturePeriod
  );
  const xFront = baseFront - deltaX;

  if (x >= xFront && x <= xBack) {
    return { inside: true, depthIntoWall: x - xFront };
  }
  return { inside: false, depthIntoWall: 0 };
}

/**
 * Évaluation scalaire interne exacte du champ E(x, z, t) pour la scène 3D,
 * cohérente à 100% avec les équations analytiques de calculateElectromagneticParameters.
 */
function evaluateFieldComponents(
  x: number,
  z: number,
  t: number,
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  params: ReturnType<typeof calculateElectromagneticParameters>
): { ampY: number; ampZ: number; inWall: boolean; isCutoff: boolean } {
  const cSim = getVisualCSim(wave); // Échelle visuelle 3D anti-aliasing (m_scene / s_sim)
  const f = wave.frequency;
  const omegaSim = 2 * Math.PI * f;
  const k0Sim = omegaSim / cSim;
  const k1Sim = k0Sim * params.n1;
  const k2Sim = k0Sim * params.n2;

  const halfThickness = wall.thickness / 2;
  const baseFront = wall.posX - halfThickness;
  const xBack = wall.posX + halfThickness;
  const textureDelta = getSurfaceTextureDisplacement(
    z,
    wall.textureProfile,
    wall.textureDepth,
    wall.texturePeriod
  );
  const xFront = baseFront - textureDelta;

  const inSlot = isInsideOpenAirSlot(z, wall);
  const inSolidWall = !inSlot && x >= xFront && x <= xBack;
  const inWallBounds = x >= xFront && x <= xBack;

  const isGuided = wave.boundaryModel === 'guide_ondes';
  // Cohérence stricte entre 3D et KaTeX pour la fréquence de coupure fc
  const isCutoff = isGuided && params.isCutoff;
  const fcRatio = params.fcRatio;
  const kGuidedSim = isGuided
    ? isCutoff
      ? 0
      : k2Sim * Math.sqrt(Math.max(0, 1.0 - fcRatio * fcRatio))
    : k2Sim;
  const alphaCutoffSim =
    isGuided && isCutoff ? k2Sim * Math.sqrt(Math.max(0, fcRatio * fcRatio - 1.0)) : 0;

  // Atténuation physique issue du Chapitre 2 (rapport α/β exact appliqué au k de la scène)
  const lossRatio = params.beta > 1e-9 ? params.alpha / params.beta : 0;
  const alphaLossSim = material.isPEC || material.isConductor ? 4.5 : k2Sim * lossRatio;

  const gammaMag = params.gammaMag;
  const gammaPhase = params.gammaPhaseRad;
  const transMag = cAbs(params.transActive);
  const transPhase = cArg(params.transActive);

  // Direction d'incidence (Chapitre 1 : θi sur dioptre/lame, 0° en guide d'onde)
  const thetaI = isGuided ? 0 : params.thetaIRad;
  const cosI = Math.cos(thetaI);
  const sinI = Math.sin(thetaI);
  const cosT = params.isTotalInternalReflection ? 0 : Math.cos(params.thetaTRad);
  const sinT = Math.min(1, (params.n1 / params.n2) * sinI);

  let ampY = 0;
  let ampZ = 0;
  const sourceX = -15;

  if (wave.polarization === 'source_surfacique') {
    const srcX = -10;
    const dist = Math.abs(x - srcX);
    const phase = omegaSim * t - k1Sim * dist;
    ampY = wave.amplitude * 0.85 * Math.cos(phase);
    if (inSolidWall) {
      if (material.isPEC) {
        ampY = 0;
      } else {
        ampY *= transMag * Math.exp(-alphaLossSim * (x - xFront));
      }
    } else if (x > xBack && material.isPEC) {
      ampY = 0;
    }
  } else if (x < xFront) {
    // --- Milieu 1 (z_fiche < 0, ici x < xFront) : Onde incidente + Onde réfléchie exactes ---
    // Convention e^{j(ωt - k·r)} : cos(ωt - k·r)
    const phaseInc = omegaSim * t - k1Sim * ((x - sourceX) * cosI + z * sinI);
    const incWave = wave.amplitude * Math.cos(phaseInc);

    // Onde réfléchie partant de xFront : k_r = k1 (-cos θi ex + sin θi ez)
    const phaseAtWall = k1Sim * ((xFront - sourceX) * cosI + z * sinI);
    const phaseRef =
      omegaSim * t - phaseAtWall - k1Sim * (xFront - x) * cosI + gammaPhase;
    const refAmp = wave.amplitude * gammaMag;
    const refWave = refAmp * Math.cos(phaseRef);

    ampY = incWave + refWave;
    if (wave.polarization === 'circulaire') {
      ampZ = wave.amplitude * Math.sin(phaseInc) + refAmp * Math.sin(phaseRef);
    }
  } else if (inWallBounds) {
    // --- Dans l'obstacle (xFront <= x <= xBack) ---
    if (inSlot) {
      // Canal d'air ouvert ("Col d'air") : propagation directe dans le milieu 1 à v1
      const phaseSlot = omegaSim * t - k1Sim * ((x - sourceX) * cosI + z * sinI);
      ampY = wave.amplitude * Math.cos(phaseSlot);
      if (wave.polarization === 'circulaire') {
        ampZ = wave.amplitude * Math.sin(phaseSlot);
      }
    } else if (material.isPEC) {
      // Conducteur parfait : le champ ne pénètre pas (δ = 0, E = 0)
      ampY = 0;
      ampZ = 0;
    } else if (isCutoff) {
      // Mode guidé sous fréquence de coupure : onde purement évanescente e^{-α x}
      const dx = Math.max(0, x - xFront);
      const phaseAtFront = omegaSim * t - k1Sim * (xFront - sourceX);
      const decay = Math.exp(-alphaCutoffSim * dx);
      ampY = wave.amplitude * transMag * decay * Math.cos(phaseAtFront + transPhase);
      if (wave.polarization === 'circulaire') {
        ampZ = wave.amplitude * transMag * decay * Math.sin(phaseAtFront + transPhase);
      }
    } else if (params.isTotalInternalReflection) {
      // Chapitre 1 : Réflexion totale (θi > θl) -> onde évanescente dans le milieu 2
      const dx = Math.max(0, x - xFront);
      const kappaSim = k2Sim * Math.sqrt(Math.max(0, Math.pow((params.n1 / params.n2) * sinI, 2) - 1));
      const decay = Math.exp(-kappaSim * dx);
      const phaseSurf = omegaSim * t - k1Sim * ((xFront - sourceX) * cosI + z * sinI) + transPhase;
      ampY = wave.amplitude * transMag * decay * Math.cos(phaseSurf);
    } else {
      // Propagation dispersive/dissipative exacte dans le milieu 2
      const dx = Math.max(0, x - xFront);
      const lossDecay = Math.exp(-alphaLossSim * dx);
      const kProp = isGuided ? kGuidedSim : k2Sim;
      const phaseFront = k1Sim * ((xFront - sourceX) * cosI + z * sinI);
      const phaseInside = kProp * (dx * cosT) + k2Sim * (z * sinT - z * sinI);
      const phaseTotal = omegaSim * t - phaseFront - phaseInside + transPhase;
      ampY = wave.amplitude * transMag * lossDecay * Math.cos(phaseTotal);
      if (wave.polarization === 'circulaire') {
        ampZ = wave.amplitude * transMag * lossDecay * Math.sin(phaseTotal);
      }
    }

    // Profil transverse TE/TM du guide d'onde rectangulaire (sin/cos selon Z)
    if (isGuided && !inSlot && wave.guidedMode === 'TE') {
      const zWidth = 24;
      const m = Math.max(1, wave.modeM);
      const modZ = Math.sin((m * Math.PI * (z + zWidth / 2)) / zWidth);
      ampY *= modZ;
      ampZ *= modZ;
    } else if (isGuided && !inSlot && wave.guidedMode === 'TM') {
      const zWidth = 24;
      const m = Math.max(1, wave.modeM);
      const modZ = Math.cos((m * Math.PI * (z + zWidth / 2)) / zWidth);
      ampY *= modZ;
      ampZ *= modZ;
    }
  } else {
    // --- Milieu 3 (x > xBack) : Onde transmise ---
    if (wall.textureProfile === 'fentes_cavites') {
      // Superposition Huygens-Fresnel multi-fentes après la grille ("Col d'air")
      const distOut = Math.max(0.05, x - xBack);
      const period = Math.max(0.5, wall.texturePeriod);
      const lossDecay = Math.exp(-alphaLossSim * wall.thickness);
      const baseTransFactor = material.isPEC || material.isConductor
        ? 0
        : Math.sqrt(Math.max(0, params.transmissionT)) * lossDecay;

      // Contribution directe transmise à travers les colonnes diélectriques (atténuée)
      const phaseBulk =
        k1Sim * ((xFront - sourceX) * cosI + z * sinI) +
        k2Sim * (wall.thickness * cosT) +
        k1Sim * ((x - xBack) * cosI);
      let reSum = inSlot ? 0 : baseTransFactor * Math.cos(omegaSim * t - phaseBulk);
      let imSum = inSlot ? 0 : baseTransFactor * Math.sin(omegaSim * t - phaseBulk);

      // Somme cohérente sur les fentes ouvertes voisines (diffraction cylindrique 2D)
      const baseSlotIdx = Math.floor(z / period);
      const slotWeight = 0.52 / Math.sqrt(1 + distOut * 0.32);
      for (let dk = -2; dk <= 2; dk++) {
        const zCenter = (baseSlotIdx + dk + 0.5) * period;
        const dz = z - zCenter;
        const r = Math.hypot(distOut, dz);
        const phaseSlot = omegaSim * t - k1Sim * ((xBack - sourceX) * cosI + r);
        const dirEnv = Math.exp(-(dz * dz) / (2 * Math.pow(0.42 + distOut * 0.48, 2)));
        reSum += slotWeight * dirEnv * Math.cos(phaseSlot);
        imSum += slotWeight * dirEnv * Math.sin(phaseSlot);
      }
      ampY = wave.amplitude * Math.max(-1.6, Math.min(1.6, reSum));
      if (wave.polarization === 'circulaire') {
        ampZ = wave.amplitude * Math.max(-1.6, Math.min(1.6, imSum));
      }
    } else if (material.isPEC) {
      // Blindage parfait derrière le conducteur parfait
      ampY = 0;
      ampZ = 0;
    } else if (isCutoff) {
      const totalDecay = Math.exp(-alphaCutoffSim * wall.thickness);
      const phaseOut = omegaSim * t - k1Sim * ((xFront - sourceX) + (x - xBack));
      ampY = wave.amplitude * transMag * totalDecay * Math.cos(phaseOut);
    } else if (params.isTotalInternalReflection) {
      const kappaSim = k2Sim * Math.sqrt(Math.max(0, Math.pow((params.n1 / params.n2) * sinI, 2) - 1));
      const totalDecay = Math.exp(-kappaSim * (x - xFront));
      const phaseSurf = omegaSim * t - k1Sim * ((xFront - sourceX) * cosI + z * sinI) + transPhase;
      ampY = wave.amplitude * transMag * totalDecay * Math.cos(phaseSurf);
    } else {
      // Transmission en énergie conservatrice (T_sortie à la face arrière xBack)
      const lossDecay = Math.exp(-alphaLossSim * wall.thickness);
      const ampScale =
        wave.boundaryModel === 'lame_finie' || material.isConductor
          ? transMag
          : thetaI < 1e-4 && params.regime === 'sans_pertes'
          ? params.n1 > 0 && params.n2 > 0
            ? (4 * params.n1 * params.n2) / Math.pow(params.n1 + params.n2, 2)
            : transMag
          : Math.sqrt(params.transmissionT * (params.eta1 / Math.max(1, params.eta)));
      const kProp = isGuided ? kGuidedSim : k2Sim;
      const phaseWall =
        k1Sim * ((xFront - sourceX) * cosI + z * sinI) +
        kProp * (wall.thickness * cosT) +
        k1Sim * ((x - xBack) * cosI);
      const phaseTotal = omegaSim * t - phaseWall;
      const outAmp = wave.amplitude * Math.min(2.0, ampScale) * (wave.boundaryModel === 'lame_finie' ? 1 : lossDecay);
      ampY = outAmp * Math.cos(phaseTotal);
      if (wave.polarization === 'circulaire') {
        ampZ = outAmp * Math.sin(phaseTotal);
      }
    }
  }

  return { ampY, ampZ, inWall: inSolidWall, isCutoff };
}

/**
 * Calcul complet du champ E(x, z, t) et du gradient / flux de Poynting réel.
 */
export function calculateWaveField(
  x: number,
  z: number,
  t: number,
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset
): FieldValue {
  const params = calculateElectromagneticParameters(wave, material, wall);
  const center = evaluateFieldComponents(x, z, t, wave, wall, material, params);

  const delta = 0.08;
  const px1 = evaluateFieldComponents(x + delta, z, t, wave, wall, material, params).ampY;
  const px0 = evaluateFieldComponents(x - delta, z, t, wave, wall, material, params).ampY;
  const pz1 = evaluateFieldComponents(x, z + delta, t, wave, wall, material, params).ampY;
  const pz0 = evaluateFieldComponents(x, z - delta, t, wave, wall, material, params).ampY;

  const gradX = (px1 - px0) / (2 * delta);
  const gradZ = (pz1 - pz0) / (2 * delta);

  // Direction physique du flux de Poynting <S> selon l'angle d'incidence / réfraction
  let dirX = 1;
  let dirZ = 0;
  if (center.inWall && !material.isPEC) {
    dirX = params.isTotalInternalReflection ? 0 : Math.cos(params.thetaTRad);
    dirZ = Math.sin(params.thetaTRad);
  } else if (x < wall.posX - wall.thickness / 2) {
    // Flux net moyen dans le milieu 1 : réduit par (1 - R)
    const netTransmit = Math.max(0.05, 1 - params.reflectionR);
    dirX = Math.cos(params.thetaIRad) * netTransmit;
    dirZ = Math.sin(params.thetaIRad);
  } else if ((material.isPEC || material.isConductor) && x >= wall.posX - wall.thickness / 2) {
    dirX = 0;
    dirZ = 0;
  } else {
    dirX = Math.cos(params.thetaIRad);
    dirZ = Math.sin(params.thetaIRad);
  }

  const fluxMag = Math.hypot(dirX, dirZ);
  const fluxX = fluxMag > 1e-4 ? dirX / fluxMag : 0;
  const fluxZ = fluxMag > 1e-4 ? dirZ / fluxMag : 0;

  return {
    amplitude: center.ampY,
    amplitudeZ: center.ampZ,
    gradientX: gradX,
    gradientZ: gradZ,
    fluxX,
    fluxZ,
    inObstacle: center.inWall,
    isEvanescent: center.isCutoff && center.inWall,
  };
}

/**
 * Chapitre 3 : Enveloppe spatiale |E(x)| le long de l'axe x du banc optique.
 */
export function calculateStandingWaveEnvelope(
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  xMin = -14,
  xMax = 14,
  numPoints = 140
): { points: { x: number; envAbs: number }[]; xFront: number; xBack: number; lambda1Sim: number; dFirstMinSim: number } {
  const params = calculateElectromagneticParameters(wave, material, wall);
  const cSim = getVisualCSim(wave);
  const k1Sim = ((2 * Math.PI * wave.frequency) / cSim) * params.n1 * Math.cos(wave.boundaryModel === 'guide_ondes' ? 0 : params.thetaIRad);
  const k2Sim = ((2 * Math.PI * wave.frequency) / cSim) * params.n2;
  const lambda1Sim = k1Sim > 1e-5 ? (2 * Math.PI) / k1Sim : Infinity;

  const xFront = wall.posX - wall.thickness / 2 - wall.textureDepth;
  const xBack = wall.posX + wall.thickness / 2;
  const lossRatio = params.beta > 1e-9 ? params.alpha / params.beta : 0;
  const alphaLossSim = material.isPEC || material.isConductor ? 4.5 : k2Sim * lossRatio;

  let phiNorm = params.gammaPhaseRad;
  while (phiNorm <= -Math.PI) phiNorm += 2 * Math.PI;
  while (phiNorm > Math.PI) phiNorm -= 2 * Math.PI;
  const dFirstMinSim =
    params.gammaMag < 1e-4 || k1Sim <= 1e-5
      ? 0
      : (((Math.PI - phiNorm) % (2 * Math.PI)) / (2 * k1Sim));

  const points: { x: number; envAbs: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = xMin + (i / (numPoints - 1)) * (xMax - xMin);
    let envAbs = 0;
    if (x < xFront) {
      // |E(z)| = E0i sqrt(1 + |Γ|^2 + 2|Γ| cos(2 k1 (x - xFront) + φ))
      const zRel = x - xFront;
      const g = params.gammaMag;
      envAbs = wave.amplitude * Math.sqrt(Math.max(0, 1 + g * g + 2 * g * Math.cos(2 * k1Sim * zRel + params.gammaPhaseRad)));
    } else if (x <= xBack) {
      if (material.isPEC) envAbs = 0;
      else if (params.isCutoff) {
        const fcRatio = params.fcRatio;
        const aCut = k2Sim * Math.sqrt(Math.max(0, fcRatio * fcRatio - 1));
        envAbs = wave.amplitude * cAbs(params.transActive) * Math.exp(-aCut * (x - xFront));
      } else {
        envAbs = wave.amplitude * cAbs(params.transActive) * Math.exp(-alphaLossSim * (x - xFront));
      }
    } else {
      if (material.isPEC) envAbs = 0;
      else if (params.isCutoff) {
        const fcRatio = params.fcRatio;
        const aCut = k2Sim * Math.sqrt(Math.max(0, fcRatio * fcRatio - 1));
        envAbs = wave.amplitude * cAbs(params.transActive) * Math.exp(-aCut * wall.thickness);
      } else {
        const outScale = Math.sqrt(Math.max(0, params.transmissionT));
        envAbs = wave.amplitude * outScale * Math.exp(-alphaLossSim * wall.thickness);
      }
    }
    points.push({ x, envAbs });
  }

  return { points, xFront, xBack, lambda1Sim, dFirstMinSim };
}

/**
 * Chapitre 1 (§1.7.6) : Courbes de Fresnel Γ_TE, Γ_TM, R, T' en fonction de θi (0°..89°).
 */
export function calculateFresnelCurve(
  wave: WaveConfig,
  material: MaterialPreset
): {
  angleDeg: number;
  gammaTE: number;
  gammaTM: number;
  rTE: number;
  rTM: number;
  tPrimeTE: number;
  tPrimeTM: number;
}[] {
  const out: {
    angleDeg: number;
    gammaTE: number;
    gammaTM: number;
    rTE: number;
    rTM: number;
    tPrimeTE: number;
    tPrimeTM: number;
  }[] = [];

  for (let deg = 0; deg <= 88; deg += 2) {
    const pTE = calculateElectromagneticParameters(
      { ...wave, guidedMode: 'TE', incidenceAngleDeg: deg, boundaryModel: 'dioptre_semi_infini' },
      material
    );
    const pTM = calculateElectromagneticParameters(
      { ...wave, guidedMode: 'TM', incidenceAngleDeg: deg, boundaryModel: 'dioptre_semi_infini' },
      material
    );
    out.push({
      angleDeg: deg,
      gammaTE: pTE.gammaMag,
      gammaTM: pTM.gammaMag,
      rTE: pTE.reflectionR,
      rTM: pTM.reflectionR,
      tPrimeTE: pTE.transmissionT,
      tPrimeTM: pTM.transmissionT,
    });
  }
  return out;
}

/**
 * Chapitre 3 (§3.4.2) : Remonter à η2 inconnu à partir des mesures (Emax, Emin, d).
 */
export function reconstructUnknownMedium(
  eMax: number,
  eMin: number,
  dFirstMin: number,
  lambda1: number,
  eta1: number
): {
  ros: number;
  gammaMag: number;
  phiRad: number;
  gamma: Complex;
  eta2: Complex;
  eta2Abs: number;
  eta2PhaseDeg: number;
} {
  const safeMin = Math.max(1e-6, eMin);
  const ros = eMax / safeMin;
  const gammaMag = (ros - 1) / (ros + 1);
  const phiRad = lambda1 > 1e-12 ? (4 * Math.PI * dFirstMin) / lambda1 - Math.PI : -Math.PI;
  const gamma = cplx(gammaMag * Math.cos(phiRad), gammaMag * Math.sin(phiRad));
  const one = cplx(1, 0);
  const ratio = cDiv(cAdd(one, gamma), cSub(one, gamma));
  const eta2 = cplx(eta1 * ratio.re, eta1 * ratio.im);
  return {
    ros,
    gammaMag,
    phiRad,
    gamma,
    eta2,
    eta2Abs: cAbs(eta2),
    eta2PhaseDeg: (cArg(eta2) * 180) / Math.PI,
  };
}
