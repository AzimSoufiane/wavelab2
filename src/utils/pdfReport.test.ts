import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimulationReportData,
  createSimulationPdfDocument,
  toPdfSafeText,
} from './pdfReport';
import { MATERIAL_PRESETS } from '../physics/waveEngine';
import { AcademicProfile, DualProbeState, WallGeometry, WaveConfig } from '../types';

const sampleWall: WallGeometry = {
  textureProfile: 'circulaire',
  thickness: 2.0,
  textureDepth: 0.6,
  texturePeriod: 2.4,
  posX: 0,
  height: 3.0,
};

const sampleWave: WaveConfig = {
  frequency: 1.0,
  amplitude: 1.3,
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

const sampleProbe: DualProbeState = {
  x1: -6.0,
  z1: 0.0,
  val1: 1.15,
  history1: [0.0, 0.75, 1.2, 0.5, -0.8, -1.15, -0.3, 1.15],
  pkToPk1: 2.4,
  rms1: 0.85,
  x2: 5.5,
  z2: 0.0,
  val2: -0.62,
  history2: [0.0, 0.35, 0.88, 0.42, -0.4, -0.85, -0.18, -0.62],
  pkToPk2: 1.73,
  rms2: 0.61,
  activeProbe: 1,
  deltaPhiRad: 18.06,
  deltaPhiDeg: 315.0,
  distanceDeltaX: 11.5,
  transmissionCoeff: 0.948,
  isCutoff: false,
  cutoffFreq: 0,
  vPhaseGuided: 3e8,
  lambdaGuided: 0.3,
  attenuationAlpha: 0.008,
};

test('buildSimulationReportData summarizes parameters, Fresnel coefficients, and oscilloscope probes', () => {
  const material = MATERIAL_PRESETS[0]; // Polystyrene eps_r = 2.54
  const report = buildSimulationReportData(
    sampleWave,
    sampleWall,
    material,
    sampleProbe,
    { isPlaying: false, time: 1.25 },
    undefined,
    new Date('2026-11-18T12:00:00.000Z')
  );

  assert.match(report.title, /WaveLab 3D/);
  assert.equal(report.academic.studentName, 'AZIM Soufiane');
  assert.equal(report.academic.teacherName, 'EL MAMOUNI Anass');
  assert.ok(report.parametersLeft.some((p) => p.label.includes('Frequence') && p.value.includes('1.00 GHz')));
  assert.ok(report.parametersRight.some((p) => p.label.includes('Materiau') && p.value.includes('Polystyr')));

  // Check calculated Fresnel values for air -> polystyrene at normal incidence: |Gamma| ~ 0.229, R ~ 5.2%, T' ~ 94.8%
  const reflCard = report.highlights.find((h) => h.label.includes('Gamma'));
  const transCard = report.highlights.find((h) => h.label.includes('Transmission'));
  assert.ok(reflCard && reflCard.value.includes('0.229'));
  assert.ok(transCard && transCard.value.includes('94.8%'));

  // Check oscilloscope probe metrics
  assert.ok(report.oscilloscopeMetrics.some((m) => m.value.includes('x1 = -6.00 m')));
  assert.ok(report.oscilloscopeMetrics.some((m) => m.value.includes('RMS = 0.850 V/m')));
  assert.ok(report.oscilloscopeMetrics.some((m) => m.value.includes('x2 = 5.50 m')));
  assert.ok(report.oscilloscopeMetrics.some((m) => m.value.includes('Delta phi = 18.06 rad')));
  assert.equal(report.trace1.length, 8);
  assert.equal(report.trace2.length, 8);
});

test('buildSimulationReportData handles Brewster TM and PEC reflection extremes cleanly', () => {
  const brewsterWave: WaveConfig = {
    ...sampleWave,
    guidedMode: 'TM',
    incidenceAngleDeg: 57.89,
  };
  const brewsterReport = buildSimulationReportData(
    brewsterWave,
    sampleWall,
    MATERIAL_PRESETS[0],
    sampleProbe
  );
  const reflBrewster = brewsterReport.highlights.find((h) => h.label.includes('Gamma'));
  assert.ok(reflBrewster && parseFloat(reflBrewster.value) < 0.01);

  const pecReport = buildSimulationReportData(
    sampleWave,
    sampleWall,
    MATERIAL_PRESETS[3], // PEC
    sampleProbe
  );
  const pecRos = pecReport.highlights.find((h) => h.label.includes('ROS'));
  assert.equal(pecRos?.value, 'Infini');
});

test('createSimulationPdfDocument produces valid PDF bytes containing simulation summary', () => {
  const doc = createSimulationPdfDocument(
    sampleWave,
    sampleWall,
    MATERIAL_PRESETS[0],
    sampleProbe,
    { isPlaying: true, time: 2.5 }
  );
  const output = doc.output('arraybuffer');
  const bytes = new Uint8Array(output);
  const asciiHeader = String.fromCharCode(...bytes.slice(0, 5));
  assert.equal(asciiHeader, '%PDF-');
  assert.ok(bytes.byteLength > 2000);
});

test('toPdfSafeText strips unsupported Greek/typographic characters for WinAnsi PDF fonts', () => {
  const safe = toPdfSafeText('θi = 57.9° · εr = 2.54 · |Γ| = 0.229 · Ω · ∞');
  assert.equal(safe, 'thetai = 57.9° | epsr = 2.54 | |Gamma| = 0.229 | Ohm | Infini');
});

test('buildSimulationReportData and createSimulationPdfDocument embed student and teacher academic info', () => {
  const customProfile: AcademicProfile = {
    studentName: 'AZIM Soufiane',
    studentId: 'P130042519',
    studentClass: 'GSR1-S1',
    studentEmail: 'soufianeazim.academic@gmail.com',
    teacherName: 'Pr. El Amrani',
    teacherTitle: 'Professeur Habilité',
    teacherDepartment: 'Génie des Systèmes et Réseaux',
    teacherEmail: 'elamrani@uae.ac.ma',
    institution: 'ENSA Tanger',
    moduleName: 'Mod-M115 : Propagation dans les milieux',
  };

  const report = buildSimulationReportData(
    sampleWave,
    sampleWall,
    MATERIAL_PRESETS[0],
    sampleProbe,
    { isPlaying: false, time: 0.5 },
    customProfile,
    new Date('2026-11-18T12:00:00.000Z')
  );

  assert.equal(report.academic.studentName, 'AZIM Soufiane');
  assert.match(report.academic.studentMeta, /GSR1-S1/);
  assert.match(report.academic.studentMeta, /P130042519/);
  assert.equal(report.academic.studentEmail, 'soufianeazim.academic@gmail.com');
  assert.equal(report.academic.teacherName, 'Pr. El Amrani');
  assert.match(report.academic.teacherMeta, /Professeur Habilité/);
  assert.equal(report.academic.teacherEmail, 'elamrani@uae.ac.ma');
  assert.match(report.subtitle, /ENSA Tanger/);

  const doc = createSimulationPdfDocument(
    sampleWave,
    sampleWall,
    MATERIAL_PRESETS[0],
    sampleProbe,
    { isPlaying: false, time: 0.5 },
    customProfile
  );
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  const asciiHeader = String.fromCharCode(...bytes.slice(0, 5));
  assert.equal(asciiHeader, '%PDF-');
  assert.ok(bytes.byteLength > 2500);
});
