import { MaterialPreset, WallGeometry, WaveConfig, DualProbeState } from '../types';

export interface SavedPreset {
  id: string;
  name: string;
  timestamp: number;
  wave: WaveConfig;
  wall: WallGeometry;
  materialId: string;
  probe: {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
  };
}

const STORAGE_KEY = 'wavelab_ensa_m115_saved_presets';

export function savePresetToLocalStorage(
  name: string,
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  probe: DualProbeState
): SavedPreset[] {
  try {
    const existing = loadPresetsFromLocalStorage();
    const newPreset: SavedPreset = {
      id: `preset_${Date.now()}`,
      name: name || `Configuration ${new Date().toLocaleTimeString('fr-FR')}`,
      timestamp: Date.now(),
      wave,
      wall,
      materialId: material.id,
      probe: {
        x1: probe.x1,
        z1: probe.z1,
        x2: probe.x2,
        z2: probe.z2,
      },
    };
    const updated = [newPreset, ...existing.slice(0, 9)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Erreur lors de la sauvegarde locale du preset', e);
    return [];
  }
}

export function loadPresetsFromLocalStorage(): SavedPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Erreur lors du chargement des presets', e);
    return [];
  }
}

export function exportOscilloscopeDataToCsv(
  probe: DualProbeState,
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset
) {
  const pointsCount = Math.min(probe.history1.length, probe.history2.length);
  const timeStepMs = 0.25;
  const headers = [
    'Indice',
    'Temps_ms',
    'VoieA_Sonde1_E_Vm',
    'VoieB_Sonde2_E_Vm',
    'Position_Sonde1_X_m',
    'Position_Sonde1_Z_m',
    'Position_Sonde2_X_m',
    'Position_Sonde2_Z_m',
    'Dephasage_Direct_rad',
    'Dephasage_Direct_deg',
    'Frequence_GHz',
    'Mode_Propagation',
    'Angle_Incidence_deg',
    'Polarisation_Dioptre',
    'Permittivite_Relative_epsR',
    'Profil_Texture_Paroi',
    'Epaisseur_Paroi_m',
  ];

  const rows: string[] = [headers.join(',')];
  for (let i = 0; i < pointsCount; i++) {
    const tMs = (i * timeStepMs).toFixed(3);
    const val1 = probe.history1[i]?.toFixed(4) ?? '0.0000';
    const val2 = probe.history2[i]?.toFixed(4) ?? '0.0000';
    rows.push(
      [
        i,
        tMs,
        val1,
        val2,
        probe.x1.toFixed(2),
        probe.z1.toFixed(2),
        probe.x2.toFixed(2),
        probe.z2.toFixed(2),
        probe.deltaPhiRad.toFixed(4),
        probe.deltaPhiDeg.toFixed(2),
        wave.frequency.toFixed(2),
        wave.guidedMode,
        wave.incidenceAngleDeg.toFixed(1),
        wave.boundaryModel ?? 'dioptre_semi_infini',
        material.epsilonR.toFixed(2),
        wall.textureProfile,
        wall.thickness.toFixed(2),
      ].join(',')
    );
  }

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `wavelab_m115_donnees_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function serializeStateToUrl(
  wave: WaveConfig,
  wall: WallGeometry,
  material: MaterialPreset,
  probe: DualProbeState
): string {
  const params = new URLSearchParams();
  params.set('f', wave.frequency.toString());
  params.set('e0', wave.amplitude.toString());
  params.set('mode', wave.guidedMode);
  params.set('bm', wave.boundaryModel ?? 'dioptre_semi_infini');
  params.set('pol', wave.polarization);
  params.set('theta', wave.incidenceAngleDeg.toString());
  params.set('eps1', wave.medium1EpsilonR.toString());
  params.set('ga', wave.guideA.toString());
  params.set('gb', wave.guideB.toString());
  params.set('m', wave.modeM.toString());
  params.set('n', wave.modeN.toString());
  params.set('prof', wall.textureProfile);
  params.set('thick', wall.thickness.toString());
  params.set('h', wall.textureDepth.toString());
  params.set('lambda', wall.texturePeriod.toString());
  params.set('mat', material.id);
  params.set('x1', probe.x1.toFixed(2));
  params.set('z1', probe.z1.toFixed(2));
  params.set('x2', probe.x2.toFixed(2));
  params.set('z2', probe.z2.toFixed(2));

  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}

export function deserializeStateFromUrl(): {
  wave?: Partial<WaveConfig>;
  wall?: Partial<WallGeometry>;
  materialId?: string;
  probe?: { x1: number; z1: number; x2: number; z2: number };
} | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('f') && !params.has('mode') && !params.has('prof')) {
      return null;
    }
    const wave: Partial<WaveConfig> = {};
    if (params.has('f')) wave.frequency = parseFloat(params.get('f')!);
    if (params.has('e0')) wave.amplitude = parseFloat(params.get('e0')!);
    if (params.has('mode')) {
      const m = params.get('mode');
      wave.guidedMode = m === 'TM' ? 'TM' : 'TE';
    }
    if (params.has('bm')) {
      const bm = params.get('bm');
      if (bm === 'dioptre_semi_infini' || bm === 'lame_finie' || bm === 'guide_ondes') {
        wave.boundaryModel = bm;
      }
    }
    if (params.has('pol')) wave.polarization = params.get('pol') as WaveConfig['polarization'];
    if (params.has('theta')) wave.incidenceAngleDeg = parseFloat(params.get('theta')!);
    if (params.has('eps1')) wave.medium1EpsilonR = parseFloat(params.get('eps1')!);
    if (params.has('ga')) wave.guideA = parseFloat(params.get('ga')!);
    if (params.has('gb')) wave.guideB = parseFloat(params.get('gb')!);
    if (params.has('m')) wave.modeM = parseInt(params.get('m')!, 10);
    if (params.has('n')) wave.modeN = parseInt(params.get('n')!, 10);

    const wall: Partial<WallGeometry> = {};
    if (params.has('prof')) wall.textureProfile = params.get('prof') as WallGeometry['textureProfile'];
    if (params.has('thick')) wall.thickness = parseFloat(params.get('thick')!);
    if (params.has('h')) wall.textureDepth = parseFloat(params.get('h')!);
    if (params.has('lambda')) wall.texturePeriod = parseFloat(params.get('lambda')!);

    const materialId = params.get('mat') || undefined;

    let probe: { x1: number; z1: number; x2: number; z2: number } | undefined;
    if (params.has('x1') && params.has('x2')) {
      probe = {
        x1: parseFloat(params.get('x1')!),
        z1: parseFloat(params.get('z1') || '0'),
        x2: parseFloat(params.get('x2')!),
        z2: parseFloat(params.get('z2') || '0'),
      };
    }

    return { wave, wall, materialId, probe };
  } catch (e) {
    console.error("Erreur de désérialisation de l'URL", e);
    return null;
  }
}
