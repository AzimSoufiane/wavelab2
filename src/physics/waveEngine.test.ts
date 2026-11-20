import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_PRESETS,
  calculateElectromagneticParameters,
  calculateWaveField,
  evaluateSurfaceField,
  SurfaceFieldScratch,
  calculateStandingWaveEnvelope,
  calculateFresnelCurve,
  reconstructUnknownMedium,
  ETA_0,
} from './waveEngine';
import { WaveConfig, WallGeometry } from '../types';

const baseWave: WaveConfig = {
  frequency: 1.0,
  amplitude: 1.0,
  guidedMode: 'TE',
  guideA: 0.12,
  guideB: 0.06,
  modeM: 1,
  modeN: 0,
  polarization: 'rectiligne',
  incidenceAngleDeg: 0,
  medium1EpsilonR: 1.0,
  boundaryModel: 'dioptre_semi_infini',
  waveSpeedC: 4.0,
};

const baseWall: WallGeometry = {
  textureProfile: 'rectangulaire',
  thickness: 2.0,
  textureDepth: 0.0,
  texturePeriod: 2.0,
  posX: 0,
  height: 4.0,
};

test('Chapitre 1 : Exercice 2 Dioptre verre-air (n1=1.5, n2=1)', () => {
  const air = MATERIAL_PRESETS.find((m) => m.id === 'air')!;
  const glassToAirWave: WaveConfig = {
    ...baseWave,
    medium1EpsilonR: 2.25, // n1 = 1.5
    incidenceAngleDeg: 0,
  };
  const p = calculateElectromagneticParameters(glassToAirWave, air);
  assert.ok(Math.abs(p.thetaLimitDeg! - 41.8103) < 0.05, `Expected θl ≈ 41.81°, got ${p.thetaLimitDeg}`);
  assert.ok(Math.abs(p.brewsterDeg! - 33.6901) < 0.05, `Expected θB ≈ 33.69°, got ${p.brewsterDeg}`);
  assert.ok(Math.abs(p.reflectionR - 0.04) < 1e-4, `Expected R = 4%, got ${p.reflectionR}`);
  assert.ok(Math.abs(p.transmissionT - 0.96) < 1e-4, `Expected T' = 96%, got ${p.transmissionT}`);
});

test('Chapitre 1 : Angle de Brewster annule Γ_TM et conservation R + T\' = 1', () => {
  const poly = MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!; // epsR = 2.54, tan δ = 0.0005
  const losslessPoly = { ...poly, lossTangent: 0, conductivity: 0 };
  const brewsterAngle = (Math.atan(Math.sqrt(2.54)) * 180) / Math.PI;
  const tmBrewsterLossless = calculateElectromagneticParameters(
    { ...baseWave, guidedMode: 'TM', incidenceAngleDeg: brewsterAngle },
    losslessPoly
  );
  assert.ok(tmBrewsterLossless.gammaMag < 1e-6, `Expected Γ_TM = 0 at Brewster (lossless), got ${tmBrewsterLossless.gammaMag}`);
  assert.ok(Math.abs(tmBrewsterLossless.reflectionR + tmBrewsterLossless.transmissionT - 1.0) < 1e-6);

  const tmBrewsterPoly = calculateElectromagneticParameters(
    { ...baseWave, guidedMode: 'TM', incidenceAngleDeg: brewsterAngle },
    poly
  );
  assert.ok(tmBrewsterPoly.gammaMag < 5e-4, `Expected near-zero Γ_TM on low-loss polystyrene, got ${tmBrewsterPoly.gammaMag}`);

  const teObliqueWave: WaveConfig = {
    ...baseWave,
    guidedMode: 'TE',
    incidenceAngleDeg: 40,
  };
  const pTE = calculateElectromagneticParameters(teObliqueWave, losslessPoly);
  assert.ok(Math.abs(pTE.reflectionR + pTE.transmissionT - 1.0) < 1e-6);
});

test('Chapitre 1 : Réflexion totale (θi > θl) pour verre -> air', () => {
  const air = MATERIAL_PRESETS.find((m) => m.id === 'air')!;
  const tirWave: WaveConfig = {
    ...baseWave,
    medium1EpsilonR: 2.25,
    incidenceAngleDeg: 50, // > 41.8°
  };
  const p = calculateElectromagneticParameters(tirWave, air);
  assert.equal(p.isTotalInternalReflection, true);
  assert.ok(Math.abs(p.gammaMag - 1.0) < 1e-6);
  assert.equal(p.transmissionT, 0);
});

test('Chapitre 2 : Conducteur parfait (PEC) Γ = -1, T = 0, R = 1, E=0 dans le métal', () => {
  const metal = MATERIAL_PRESETS.find((m) => m.id === 'metal')!;
  const p = calculateElectromagneticParameters(baseWave, metal);
  assert.equal(p.rFresnel, -1);
  assert.equal(p.tFresnel, 0);
  assert.equal(p.reflectionR, 1);
  assert.equal(p.transmissionT, 0);
  assert.equal(p.tos, 1);
  assert.equal(p.ros, Infinity);

  const inside = calculateWaveField(0, 0, 0.25, baseWave, baseWall, metal);
  assert.equal(inside.amplitude, 0);
  // Nœud sur l'interface x = -1.0 (baseWall thickness=2, posX=0 => xFront=-1)
  const atInterface = calculateWaveField(-1.0, 0, 0.25, baseWave, baseWall, metal);
  assert.ok(Math.abs(atInterface.amplitude) < 1e-6, `Expected node at PEC interface, got ${atInterface.amplitude}`);
});

test('Chapitre 2 : Épaisseur de peau cuivre à 10 GHz ≈ 0.66 µm', () => {
  const metal = MATERIAL_PRESETS.find((m) => m.id === 'metal')!;
  const p = calculateElectromagneticParameters({ ...baseWave, frequency: 10 }, metal);
  assert.ok(Math.abs(p.skinDepth - 0.66e-6) < 0.03e-6, `Expected δ ≈ 0.66 µm, got ${p.skinDepth}`);
});

test('Chapitre 3 : Définitions TOS = |Γ| et ROS = (1 + |Γ|)/(1 - |Γ|)', () => {
  const concrete = MATERIAL_PRESETS.find((m) => m.id === 'concrete')!;
  const p = calculateElectromagneticParameters(baseWave, concrete);
  assert.ok(Math.abs(p.tos - p.gammaMag) < 1e-9);
  assert.ok(Math.abs(p.ros - (1 + p.gammaMag) / (1 - p.gammaMag)) < 1e-9);
  assert.ok(Math.abs(p.eta - ETA_0 / Math.sqrt(6)) < 1.0); // faibles pertes tan δ = 0.05
});

test('Cohérence 3D / Analytique : le preset cutoff_evanescent est bien sous coupure en 3D', () => {
  const poly = MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!;
  const cutoffWave: WaveConfig = {
    ...baseWave,
    frequency: 0.45,
    guidedMode: 'TE',
    boundaryModel: 'guide_ondes',
    guideA: 0.08,
    guideB: 0.04,
    modeM: 1,
    modeN: 0,
  };
  const p = calculateElectromagneticParameters(cutoffWave, poly);
  assert.equal(p.isCutoff, true);
  const fIn = calculateWaveField(0, 0, 0.2, cutoffWave, baseWall, poly);
  assert.equal(fIn.isEvanescent, true);
  // L'amplitude doit décroître entre l'entrée (x=-0.9) et la sortie (x=+0.9)
  const fStart = calculateWaveField(-0.9, 0, 0.0, cutoffWave, baseWall, poly);
  const fEnd = calculateWaveField(0.9, 0, 0.0, cutoffWave, baseWall, poly);
  assert.ok(Math.abs(fEnd.amplitude) < Math.abs(fStart.amplitude));
});

test('Chapitre 2 (Exercice 3) : Cuivre réel à 10 GHz -> δ ≈ 0.66 µm, arg(η) = 45°, AdB(3δ) ≈ 26 dB', () => {
  const copper = MATERIAL_PRESETS.find((m) => m.id === 'copper')!;
  const p = calculateElectromagneticParameters({ ...baseWave, frequency: 10 }, copper);
  assert.equal(p.regime, 'bon_conducteur');
  assert.ok(Math.abs(p.skinDepth - 0.66e-6) < 0.02e-6, `Expected δ ≈ 0.66 µm, got ${p.skinDepth}`);
  assert.ok(Math.abs(p.etaPhaseDeg - 45.0) < 0.1, `Expected arg(η) = 45°, got ${p.etaPhaseDeg}`);
  const aDb3Delta = p.attenuationDbPerM * (3 * p.skinDepth);
  assert.ok(Math.abs(aDb3Delta - 26.06) < 0.15, `Expected AdB(3δ) ≈ 26.06 dB, got ${aDb3Delta}`);
  assert.ok(p.reflectionR > 0.99);
});

test('Lame diélectrique finie (Fabry-Pérot) : résonance demi-onde annule Γ_in', () => {
  const poly = { ...MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!, lossTangent: 0, conductivity: 0 };
  const n2 = Math.sqrt(poly.epsilonR);
  // k2Sim * thickness = π  => thickness = cSim / (2 * f * n2)
  const halfWaveThickness = baseWave.waveSpeedC / (2 * baseWave.frequency * n2);
  const slabWall: WallGeometry = { ...baseWall, thickness: halfWaveThickness };
  const p = calculateElectromagneticParameters({ ...baseWave, boundaryModel: 'lame_finie' }, poly, slabWall);
  assert.ok(p.gammaMag < 1e-4, `Expected Fabry-Perot transmission resonance Γ_in ≈ 0, got ${p.gammaMag}`);
  assert.ok(Math.abs(p.transmissionT - 1.0) < 1e-4);
});

test('Chapitre 3 (§3.4.2) : Remonter à η2 à partir des mesures (Emax, Emin, d) et courbe Fresnel', () => {
  const poly = { ...MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!, lossTangent: 0, conductivity: 0 };
  const p = calculateElectromagneticParameters(baseWave, poly);
  const rec = reconstructUnknownMedium(p.eMax, p.eMin, p.dFirstMin, p.lambda1, p.eta1);
  const expectedEta2 = ETA_0 / Math.sqrt(poly.epsilonR);
  assert.ok(Math.abs(rec.eta2Abs - expectedEta2) < 0.5, `Expected η2 ≈ ${expectedEta2}, got ${rec.eta2Abs}`);

  const curve = calculateFresnelCurve(baseWave, poly);
  assert.ok(curve.length > 40);
  const minTm = Math.min(...curve.map((pt) => pt.gammaTM));
  assert.ok(minTm < 0.02, `Expected Brewster dip near 0 in Fresnel TM curve, got ${minTm}`);

  const env = calculateStandingWaveEnvelope(baseWave, baseWall, poly);
  assert.equal(env.points.length, 140);
});

test('Incidence oblique (0°..85°) : loi de Snell-Descartes θt et inclinaison du flux 3D', () => {
  const poly = MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!;
  const oblique45: WaveConfig = { ...baseWave, incidenceAngleDeg: 45 };
  const p45 = calculateElectromagneticParameters(oblique45, poly);
  const expectedThetaT = (Math.asin(Math.sin((45 * Math.PI) / 180) / Math.sqrt(poly.epsilonR)) * 180) / Math.PI;
  assert.ok(Math.abs(p45.thetaTDeg - expectedThetaT) < 0.05);

  const fIn = calculateWaveField(-5, 0, 0.1, oblique45, baseWall, poly);
  assert.ok(fIn.fluxX > 0 && fIn.fluxZ > 0, 'Poynting flux should tilt toward +Z under oblique θi = 45°');

  const fInside = calculateWaveField(0, 0, 0.1, oblique45, baseWall, poly);
  const expectedTanT = Math.tan((expectedThetaT * Math.PI) / 180);
  assert.ok(Math.abs(fInside.fluxZ / fInside.fluxX - expectedTanT) < 0.05);

  const oblique85: WaveConfig = { ...baseWave, incidenceAngleDeg: 85 };
  const p85 = calculateElectromagneticParameters(oblique85, poly);
  assert.ok(p85.thetaTDeg > p45.thetaTDeg && p85.reflectionR > p45.reflectionR);
});

test('Courbes R(θi) et T\'(θi) : conservation R + T\' = 1, Brewster et réflexion totale', () => {
  const poly = { ...MATERIAL_PRESETS.find((m) => m.id === 'polystyrene')!, lossTangent: 0, conductivity: 0 };
  const curvePoly = calculateFresnelCurve(baseWave, poly);
  assert.equal(curvePoly.length, 45); // 0°..88° pas 2°

  for (const pt of curvePoly) {
    assert.ok(Math.abs(pt.rTE + pt.tPrimeTE - 1) < 1e-6, `TE energy conservation failed at ${pt.angleDeg}°`);
    assert.ok(Math.abs(pt.rTM + pt.tPrimeTM - 1) < 1e-6, `TM energy conservation failed at ${pt.angleDeg}°`);
    assert.ok(pt.rTE >= 0 && pt.rTE <= 1 && pt.tPrimeTE >= 0 && pt.tPrimeTE <= 1);
    assert.ok(pt.rTM >= 0 && pt.rTM <= 1 && pt.tPrimeTM >= 0 && pt.tPrimeTM <= 1);
  }

  // Au voisinage de Brewster (~57.9°), R_TM minimal ≈ 0 et T'_TM maximal ≈ 1
  const minRtm = Math.min(...curvePoly.map((pt) => pt.rTM));
  const maxTtm = Math.max(...curvePoly.map((pt) => pt.tPrimeTM));
  assert.ok(minRtm < 1e-3, `Expected R_TM ≈ 0 near Brewster, got ${minRtm}`);
  assert.ok(maxTtm > 0.999, `Expected T'_TM ≈ 1 near Brewster, got ${maxTtm}`);

  // Dioptre verre (n1=1.5) -> air (n2=1) : réflexion totale au-delà de θl ≈ 41.8°
  const air = MATERIAL_PRESETS.find((m) => m.id === 'air')!;
  const curveTir = calculateFresnelCurve({ ...baseWave, medium1EpsilonR: 2.25 }, air);
  for (const pt of curveTir) {
    if (pt.angleDeg >= 44) {
      assert.ok(Math.abs(pt.rTE - 1) < 1e-6, `Expected R_TE = 1 in TIR at ${pt.angleDeg}°, got ${pt.rTE}`);
      assert.ok(Math.abs(pt.rTM - 1) < 1e-6, `Expected R_TM = 1 in TIR at ${pt.angleDeg}°, got ${pt.rTM}`);
      assert.equal(pt.tPrimeTE, 0, `Expected T'_TE = 0 in TIR at ${pt.angleDeg}°`);
      assert.equal(pt.tPrimeTM, 0, `Expected T'_TM = 0 in TIR at ${pt.angleDeg}°`);
    }
  }
});

test('evaluateSurfaceField fast path matches calculateWaveField across all zones', () => {
  const poly = MATERIAL_PRESETS[0];
  const scratch: SurfaceFieldScratch = {
    amplitude: 0,
    amplitudeZ: 0,
    fluxX: 0,
    fluxZ: 0,
    inObstacle: false,
    isEvanescent: false,
  };
  const obliqueWave: WaveConfig = { ...baseWave, incidenceAngleDeg: 35, polarization: 'circulaire' };
  const params = calculateElectromagneticParameters(obliqueWave, poly, baseWall);

  for (const [x, z] of [
    [-6.0, 1.5],
    [0.0, -0.5],
    [5.5, 2.0],
  ]) {
    const ref = calculateWaveField(x, z, 0.37, obliqueWave, baseWall, poly);
    evaluateSurfaceField(x, z, 0.37, obliqueWave, baseWall, poly, params, scratch);
    assert.ok(Math.abs(scratch.amplitude - ref.amplitude) < 1e-12);
    assert.ok(Math.abs(scratch.amplitudeZ - ref.amplitudeZ) < 1e-12);
    assert.ok(Math.abs(scratch.fluxX - ref.fluxX) < 1e-12);
    assert.ok(Math.abs(scratch.fluxZ - ref.fluxZ) < 1e-12);
    assert.equal(scratch.inObstacle, ref.inObstacle);
    assert.equal(scratch.isEvanescent, ref.isEvanescent);
  }
});

