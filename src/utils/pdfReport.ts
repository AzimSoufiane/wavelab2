import { jsPDF } from 'jspdf';
import {
  AcademicProfile,
  DualProbeState,
  MaterialPreset,
  SimulationState,
  WallGeometry,
  WaveConfig,
} from '../types';
import { calculateElectromagneticParameters } from '../physics/waveEngine';
import { DEFAULT_ACADEMIC_PROFILE } from './academicProfile';

export interface ReportKeyValue {
  label: string;
  value: string;
}

export interface SimulationReportData {
  generatedAtIso: string;
  generatedAtLocal: string;
  title: string;
  subtitle: string;
  academic: {
    institution: string;
    moduleName: string;
    studentName: string;
    studentMeta: string;
    studentEmail: string;
    teacherName: string;
    teacherMeta: string;
    teacherEmail: string;
  };
  parametersLeft: ReportKeyValue[];
  parametersRight: ReportKeyValue[];
  highlights: {
    label: string;
    value: string;
    unit?: string;
  }[];
  coefficientsLeft: ReportKeyValue[];
  coefficientsRight: ReportKeyValue[];
  oscilloscopeMetrics: ReportKeyValue[];
  trace1: number[];
  trace2: number[];
  amplitudeScale: number;
}

const PROFILE_LABELS: Record<WallGeometry['textureProfile'], string> = {
  triangulaire: 'Triangulaire / Dents de scie',
  fentes_cavites: "Fentes & Cavites (Col d'air)",
  creneaux: 'Creneaux / Rectangulaire',
  rectangulaire: 'Paroi plane / Rectangulaire',
  circulaire: 'Circulaire / Demi-cylindrique',
  sinusoidale: 'Sinusoidale (Reseau de Bragg)',
};

const REGIME_LABELS: Record<string, string> = {
  sans_pertes: 'Dielectrique sans pertes',
  faibles_pertes: 'Dielectrique a faibles pertes',
  bon_conducteur: 'Bon conducteur reel',
  pec: 'Conducteur parfait (PEC)',
};

const POLARIZATION_SOURCE_LABELS: Record<WaveConfig['polarization'], string> = {
  rectiligne: 'Rectiligne (Ey)',
  circulaire: 'Circulaire (Ey + jEz)',
  source_surfacique: 'Nappe de courant js',
};

function fmtNum(val: number, decimals = 2): string {
  if (!Number.isFinite(val)) return 'Infini';
  return val.toFixed(decimals);
}

function fmtSci(val: number, unit = ''): string {
  if (!Number.isFinite(val)) return 'Infini';
  if (val === 0) return `0${unit ? ' ' + unit : ''}`;
  const abs = Math.abs(val);
  if (abs >= 0.01 && abs < 10000) {
    return `${val.toFixed(3)}${unit ? ' ' + unit : ''}`;
  }
  return `${val.toExponential(2)}${unit ? ' ' + unit : ''}`;
}

/**
 * Normalise une chaîne pour les polices Type1 WinAnsi de jsPDF (accents latins conservés,
 * symboles grecs remplacés par notation ASCII lisible).
 */
export function toPdfSafeText(text: string): string {
  return text
    .replace(/[«»]/g, '"')
    .replace(/’/g, "'")
    .replace(/—/g, '-')
    .replace(/·/g, '|')
    .replace(/≈/g, '~')
    .replace(/θ/g, 'theta')
    .replace(/ε/g, 'eps')
    .replace(/η/g, 'eta')
    .replace(/Γ/g, 'Gamma')
    .replace(/Δ/g, 'Delta ')
    .replace(/φ/g, 'phi')
    .replace(/λ/g, 'lambda')
    .replace(/δ/g, 'delta')
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/σ/g, 'sigma')
    .replace(/Ω/g, 'Ohm')
    .replace(/∞/g, 'Infini');
}

export function buildSimulationReportData(
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  probe: DualProbeState,
  simulation?: Partial<SimulationState>,
  academicProfile: AcademicProfile = DEFAULT_ACADEMIC_PROFILE,
  now: Date = new Date()
): SimulationReportData {
  const params = calculateElectromagneticParameters(wave, material, wall);
  const isGuided = wave.boundaryModel === 'guide_ondes';
  const boundaryLabel = isGuided
    ? "Guide d'ondes rectangulaire"
    : wave.boundaryModel === 'lame_finie'
      ? 'Lame finie (Fabry-Perot)'
      : 'Dioptre semi-infini';

  const medium1Label =
    Math.abs(wave.medium1EpsilonR - 1.0) < 0.05
      ? `Vide / Air (n1 = ${fmtNum(params.n1, 2)})`
      : `Milieu 1 (eps_r1 = ${fmtNum(wave.medium1EpsilonR, 2)}, n1 = ${fmtNum(params.n1, 2)})`;

  const parametersLeft: ReportKeyValue[] = [
    { label: 'Mode de propagation', value: `${wave.guidedMode} (${boundaryLabel})` },
    { label: 'Frequence (f)', value: `${fmtNum(wave.frequency, 2)} GHz` },
    { label: 'Amplitude source (E0)', value: `${fmtNum(wave.amplitude, 2)} V/m` },
    { label: 'Milieu 1 incident', value: medium1Label },
    {
      label: 'Angle incidence (theta_i)',
      value: isGuided ? '0.0 deg (axial)' : `${fmtNum(wave.incidenceAngleDeg, 1)} deg`,
    },
    {
      label: 'Onde source',
      value: `${wave.guidedMode} / ${POLARIZATION_SOURCE_LABELS[wave.polarization]}`,
    },
  ];

  if (isGuided) {
    parametersLeft.push({
      label: 'Guide rectangulaire',
      value: `Mode ${wave.guidedMode}${wave.modeM}${wave.modeN} | a=${fmtNum(wave.guideA * 100, 1)} cm, b=${fmtNum(wave.guideB * 100, 1)} cm`,
    });
  } else {
    parametersLeft.push({
      label: 'Temps simulation (t)',
      value: `${fmtNum(simulation?.time ?? 0, 2)} s (${simulation?.isPlaying ? 'En cours' : 'Pause'})`,
    });
  }

  const parametersRight: ReportKeyValue[] = [
    { label: 'Materiau (Milieu 2)', value: toPdfSafeText(material.name) },
    {
      label: 'Permittivite / Pertes',
      value: material.isPEC
        ? 'PEC (sigma -> Infini)'
        : material.isConductor
          ? `eps_r = ${fmtNum(material.epsilonR, 2)}, sigma = ${fmtSci(material.conductivity, 'S/m')}`
          : `eps_r = ${fmtNum(material.epsilonR, 2)}, tan(delta) = ${material.lossTangent.toFixed(4)}`,
    },
    { label: 'Regime electromagnetique', value: REGIME_LABELS[params.regime] || params.regime },
    { label: 'Profil geometrique', value: PROFILE_LABELS[wall.textureProfile] || wall.textureProfile },
    {
      label: 'Dimensions paroi',
      value: `e=${fmtNum(wall.thickness, 2)} m | h=${fmtNum(wall.textureDepth, 2)} m | Pas=${fmtNum(wall.texturePeriod, 2)} m | H=${fmtNum(wall.height, 2)} m`,
    },
    { label: 'Position centrale paroi', value: `x_paroi = ${fmtNum(wall.posX, 2)} m` },
  ];

  const gammaDeg = (params.gammaPhaseRad * 180) / Math.PI;
  const rosLabel = Number.isFinite(params.ros) ? fmtNum(params.ros, 2) : 'Infini';

  const highlights = [
    {
      label: 'Reflexion |Gamma|',
      value: fmtNum(params.gammaMag, 3),
      unit: `${gammaDeg.toFixed(1)} deg`,
    },
    {
      label: 'Pouvoir reflecteur R',
      value: `${fmtNum(params.reflectionR * 100, 1)}%`,
      unit: `|Gamma|^2`,
    },
    {
      label: "Transmission T'",
      value: `${fmtNum(params.transmissionT * 100, 1)}%`,
      unit: params.isTotalInternalReflection ? 'Refl. totale' : 'Energie',
    },
    {
      label: 'ROS (SWR)',
      value: rosLabel,
      unit: `TOS = ${fmtNum(params.tos, 3)}`,
    },
  ];

  const coefficientsLeft: ReportKeyValue[] = [
    {
      label: 'Coeff. reflexion Gamma',
      value: `${params.gammaActive.re >= 0 ? '' : '-'}${Math.abs(params.gammaActive.re).toFixed(3)} ${params.gammaActive.im >= 0 ? '+' : '-'} j${Math.abs(params.gammaActive.im).toFixed(3)} (|Gamma|=${fmtNum(params.gammaMag, 3)})`,
    },
    {
      label: 'Coeff. transmission |T|',
      value: `${fmtNum(Math.hypot(params.transActive.re, params.transActive.im), 3)} (T' = ${fmtNum(params.transmissionT * 100, 1)}%)`,
    },
    {
      label: 'Angle transmis (theta_t)',
      value: params.isTotalInternalReflection
        ? 'Reflexion totale interne (onde evanescente)'
        : `${fmtNum(params.thetaTDeg, 2)} deg (n2 = ${fmtNum(params.n2, 3)})`,
    },
    {
      label: 'Angles remarquables',
      value: `Brewster theta_B = ${params.brewsterDeg !== null ? fmtNum(params.brewsterDeg, 1) + ' deg' : 'N/A'} | Critique = ${params.thetaLimitDeg !== null ? fmtNum(params.thetaLimitDeg, 1) + ' deg' : 'N/A'}`,
    },
    {
      label: 'Impedance milieu 2 (eta_2)',
      value: material.isPEC
        ? '0 Ohm (court-circuit)'
        : `${fmtNum(params.eta, 2)} Ohm < ${fmtNum(params.etaPhaseDeg, 1)} deg`,
    },
    {
      label: 'Vitesse de phase (v_phi)',
      value: `${fmtSci(params.vPhase, 'm/s')} (lambda_2 = ${fmtSci(params.lambdaMedium, 'm')})`,
    },
  ];

  const coefficientsRight: ReportKeyValue[] = [
    {
      label: 'Attenuation (alpha / dB)',
      value: `${fmtSci(params.alpha, 'Np/m')} | ${Number.isFinite(params.attenuationDbPerM) ? fmtNum(params.attenuationDbPerM, 2) + ' dB/m' : 'Infini'}`,
    },
    {
      label: 'Epaisseur de peau (delta_s)',
      value: Number.isFinite(params.skinDepth) ? fmtSci(params.skinDepth, 'm') : 'Infini (sans pertes)',
    },
    {
      label: 'Onde stationnaire (Emax/Emin)',
      value: `Emax = ${fmtNum(params.eMax, 2)} V/m | Emin = ${fmtNum(params.eMin, 2)} V/m`,
    },
    {
      label: '1er minimum (d_1er min)',
      value: `${fmtSci(params.dFirstMin, 'm')} (lambda_1/2 = ${fmtSci(params.lambda1 / 2, 'm')})`,
    },
    {
      label: 'Densite Poynting <S_inc>',
      value: fmtSci(params.poyntingMean, 'W/m^2'),
    },
    {
      label: 'Propagation guidee',
      value: !isGuided
        ? 'Propagation libre (non guidee)'
        : `fc = ${fmtNum(params.fc / 1e9, 2)} GHz | ${params.isCutoff ? 'SOUS COUPURE (Evanescent)' : `lambda_g = ${fmtSci(params.lambdaGuided, 'm')}`}`,
    },
  ];

  const h1 = probe.history1.length > 0 ? probe.history1 : [probe.val1];
  const h2 = probe.history2.length > 0 ? probe.history2 : [probe.val2];
  const min1 = Math.min(...h1);
  const max1 = Math.max(...h1);
  const min2 = Math.min(...h2);
  const max2 = Math.max(...h2);

  const oscilloscopeMetrics: ReportKeyValue[] = [
    {
      label: 'Sonde 1 (Voie CH1 - Cyan)',
      value: `Position: x1 = ${fmtNum(probe.x1, 2)} m, z1 = ${fmtNum(probe.z1, 2)} m`,
    },
    {
      label: 'Mesures CH1 (Sonde 1)',
      value: `E1 = ${fmtNum(probe.val1, 3)} V/m | RMS = ${fmtNum(probe.rms1, 3)} V/m | E_pp = ${fmtNum(probe.pkToPk1, 3)} V/m`,
    },
    {
      label: 'Sonde 2 (Voie CH2 - Ambre)',
      value: `Position: x2 = ${fmtNum(probe.x2, 2)} m, z2 = ${fmtNum(probe.z2, 2)} m`,
    },
    {
      label: 'Mesures CH2 (Sonde 2)',
      value: `E2 = ${fmtNum(probe.val2, 3)} V/m | RMS = ${fmtNum(probe.rms2, 3)} V/m | E_pp = ${fmtNum(probe.pkToPk2, 3)} V/m`,
    },
    {
      label: 'Analyse differentielle',
      value: `|x2 - x1| = ${fmtNum(probe.distanceDeltaX, 2)} m | Delta phi = ${fmtNum(probe.deltaPhiRad, 2)} rad (${fmtNum(probe.deltaPhiDeg, 1)} deg)`,
    },
    {
      label: 'Plage capturee (echantillons)',
      value: `CH1 [${fmtNum(min1, 2)}, ${fmtNum(max1, 2)}] V/m | CH2 [${fmtNum(min2, 2)}, ${fmtNum(max2, 2)}] V/m (${h1.length} pts)`,
    },
  ];

  const peakSample = Math.max(
    0.5,
    wave.amplitude * 1.4,
    ...h1.map((v) => Math.abs(v)),
    ...h2.map((v) => Math.abs(v))
  );

  const institution =
    academicProfile.institution.trim() || DEFAULT_ACADEMIC_PROFILE.institution;
  const moduleName =
    academicProfile.moduleName.trim() || DEFAULT_ACADEMIC_PROFILE.moduleName;
  const studentName = academicProfile.studentName.trim() || 'Etudiant non renseigne';
  const studentMetaParts = [
    academicProfile.studentClass.trim() ? `Filiere: ${academicProfile.studentClass.trim()}` : '',
    academicProfile.studentId.trim() ? `CNE/Apogee: ${academicProfile.studentId.trim()}` : '',
  ].filter(Boolean);
  const studentMeta = studentMetaParts.join(' | ') || 'Filiere non renseignee';
  const studentEmail = academicProfile.studentEmail.trim() || 'Email non renseigne';

  const teacherName = academicProfile.teacherName.trim() || 'Enseignant non renseigne';
  const teacherMetaParts = [
    academicProfile.teacherTitle.trim(),
    academicProfile.teacherDepartment.trim(),
  ].filter(Boolean);
  const teacherMeta = teacherMetaParts.join(' | ') || 'Encadrement pedagogique';
  const teacherEmail = academicProfile.teacherEmail.trim() || 'Email non renseigne';

  return {
    generatedAtIso: now.toISOString(),
    generatedAtLocal: now.toLocaleString('fr-FR'),
    title: 'WaveLab 3D - Rapport de Simulation Electromagnetique',
    subtitle: `${institution} | ${moduleName}`,
    academic: {
      institution,
      moduleName,
      studentName,
      studentMeta,
      studentEmail,
      teacherName,
      teacherMeta,
      teacherEmail,
    },
    parametersLeft,
    parametersRight,
    highlights,
    coefficientsLeft,
    coefficientsRight,
    oscilloscopeMetrics,
    trace1: [...h1],
    trace2: [...h2],
    amplitudeScale: peakSample,
  };
}

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 182, 6.5, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(14, y, 2.5, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(248, 250, 252);
  doc.text(toPdfSafeText(title), 19, y + 4.5);
  return y + 8.5;
}

function drawTwoColTable(
  doc: jsPDF,
  left: ReportKeyValue[],
  right: ReportKeyValue[],
  startY: number
): number {
  const rowCount = Math.max(left.length, right.length);
  const rowH = 8.2;
  const colW = 89;

  for (let i = 0; i < rowCount; i++) {
    const ry = startY + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, ry, colW, rowH, 'F');
      doc.rect(107, ry, colW, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(14, ry, colW, rowH, 'S');
    doc.rect(107, ry, colW, rowH, 'S');

    const lItem = left[i];
    if (lItem) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(toPdfSafeText(lItem.label), 16, ry + 3.1);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(toPdfSafeText(lItem.value).slice(0, 52), 16, ry + 6.7);
    }

    const rItem = right[i];
    if (rItem) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(toPdfSafeText(rItem.label), 109, ry + 3.1);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(toPdfSafeText(rItem.value).slice(0, 52), 109, ry + 6.7);
    }
  }

  return startY + rowCount * rowH + 3.5;
}

export function createSimulationPdfDocument(
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  probe: DualProbeState,
  simulation?: Partial<SimulationState>,
  academicProfile: AcademicProfile = DEFAULT_ACADEMIC_PROFILE
): jsPDF {
  const report = buildSimulationReportData(
    wave,
    wall,
    material,
    probe,
    simulation,
    academicProfile
  );
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // En-tête sombre technique
  doc.setFillColor(9, 14, 26);
  doc.rect(0, 0, 210, 24.5, 'F');
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 23.8, 210, 1.0, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(248, 250, 252);
  doc.text(toPdfSafeText(report.title), 14, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(148, 163, 184);
  doc.text(toPdfSafeText(report.subtitle).slice(0, 82), 14, 16.5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(103, 232, 249);
  doc.text(toPdfSafeText(`Genere le : ${report.generatedAtLocal}`), 196, 20.5, {
    align: 'right',
  });

  // Bandeau académique 2 colonnes (Étudiant / Enseignant)
  const acadY = 27.5;
  const acadH = 14.5;

  // Carte Étudiant
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, acadY, 89, acadH, 1.5, 1.5, 'FD');
  doc.setFillColor(6, 182, 212);
  doc.rect(14, acadY, 2, acadH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(14, 116, 144);
  doc.text('ETUDIANT(E) / AUTEUR', 18, acadY + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(toPdfSafeText(report.academic.studentName).slice(0, 42), 18, acadY + 8.0);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(toPdfSafeText(report.academic.studentMeta).slice(0, 50), 18, acadY + 11.2);
  doc.setTextColor(100, 116, 139);
  doc.text(toPdfSafeText(report.academic.studentEmail).slice(0, 50), 18, acadY + 13.7);

  // Carte Enseignant
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(107, acadY, 89, acadH, 1.5, 1.5, 'FD');
  doc.setFillColor(245, 158, 11);
  doc.rect(107, acadY, 2, acadH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(180, 83, 9);
  doc.text('ENSEIGNANT(E) / ENCADRANT(E)', 111, acadY + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(toPdfSafeText(report.academic.teacherName).slice(0, 42), 111, acadY + 8.0);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(toPdfSafeText(report.academic.teacherMeta).slice(0, 50), 111, acadY + 11.2);
  doc.setTextColor(100, 116, 139);
  doc.text(toPdfSafeText(report.academic.teacherEmail).slice(0, 50), 111, acadY + 13.7);

  let y = 44.5;

  // Cartes KPI Réflexion / Transmission / ROS
  const cardW = 43.2;
  const gap = 3.05;
  report.highlights.forEach((h, idx) => {
    const cx = 14 + idx * (cardW + gap);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, 14.5, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(toPdfSafeText(h.label), cx + 2.5, y + 4.0);

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(toPdfSafeText(h.value), cx + 2.5, y + 9.8);

    if (h.unit) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(100, 116, 139);
      doc.text(toPdfSafeText(h.unit), cx + 2.5, y + 13.2);
    }
  });
  y += 17.5;

  // Section 1 : Paramètres de simulation
  y = drawSectionHeader(doc, '1. Parametres de la simulation', y);
  y = drawTwoColTable(doc, report.parametersLeft, report.parametersRight, y);

  // Section 2 : Coefficients de réflexion, transmission et propagation
  y = drawSectionHeader(
    doc,
    '2. Coefficients de reflexion, transmission et propagation (Ch. 1 - 3)',
    y
  );
  y = drawTwoColTable(doc, report.coefficientsLeft, report.coefficientsRight, y);

  // Section 3 : Mesures de l'oscilloscope bifaisceau
  y = drawSectionHeader(doc, "3. Mesures de l'oscilloscope bifaisceau (Sonde 1 & Sonde 2)", y);
  const oscLeft = report.oscilloscopeMetrics.slice(0, 3);
  const oscRight = report.oscilloscopeMetrics.slice(3, 6);
  y = drawTwoColTable(doc, oscLeft, oscRight, y);

  // Tracé vectoriel des deux voies de l'oscilloscope
  const plotX = 14;
  const plotY = y;
  const plotW = 182;
  const plotH = Math.min(50, Math.max(28, 280 - plotY));

  doc.setFillColor(10, 15, 28);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(plotX, plotY, plotW, plotH, 1.5, 1.5, 'FD');

  // Grille oscilloscope
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.15);
  for (let gx = 1; gx < 8; gx++) {
    const xPos = plotX + (gx * plotW) / 8;
    doc.line(xPos, plotY + 5, xPos, plotY + plotH - 2);
  }
  const midY = plotY + plotH / 2 + 1.5;
  doc.setDrawColor(71, 85, 105);
  doc.line(plotX + 2, midY, plotX + plotW - 2, midY);

  // Légende du tracé
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(34, 211, 238);
  doc.text('CH1 Sonde 1 (Cyan)', plotX + 3, plotY + 4);
  doc.setTextColor(251, 191, 36);
  doc.text('CH2 Sonde 2 (Ambre)', plotX + 42, plotY + 4);
  doc.setTextColor(148, 163, 184);
  doc.setFont('courier', 'normal');
  doc.text(`Echelle +/- ${report.amplitudeScale.toFixed(2)} V/m`, plotX + plotW - 3, plotY + 4, {
    align: 'right',
  });

  const drawWaveform = (samples: number[], r: number, g: number, b: number) => {
    if (samples.length < 2) return;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    const usableW = plotW - 6;
    const usableHalfH = (plotH - 9) / 2;
    const invScale = 1 / Math.max(0.1, report.amplitudeScale);
    for (let i = 1; i < samples.length; i++) {
      const x0 = plotX + 3 + ((i - 1) / (samples.length - 1)) * usableW;
      const x1 = plotX + 3 + (i / (samples.length - 1)) * usableW;
      const y0 = midY - Math.max(-1, Math.min(1, samples[i - 1] * invScale)) * usableHalfH;
      const y1 = midY - Math.max(-1, Math.min(1, samples[i] * invScale)) * usableHalfH;
      doc.line(x0, y0, x1, y1);
    }
  };

  drawWaveform(report.trace1, 34, 211, 238);
  drawWaveform(report.trace2, 245, 158, 11);

  // Pied de page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    toPdfSafeText(`WaveLab 3D | ${report.academic.institution} | ${report.academic.studentName}`).slice(0, 88),
    14,
    289
  );
  doc.text('Page 1 / 1', 196, 289, { align: 'right' });

  return doc;
}

export function exportSimulationPdfReport(
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  probe: DualProbeState,
  simulation?: Partial<SimulationState>,
  academicProfile: AcademicProfile = DEFAULT_ACADEMIC_PROFILE
): string {
  const doc = createSimulationPdfDocument(
    wave,
    wall,
    material,
    probe,
    simulation,
    academicProfile
  );
  const filename = `wavelab_m115_rapport_${Date.now()}.pdf`;
  doc.save(filename);
  return filename;
}
