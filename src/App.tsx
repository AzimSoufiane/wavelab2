import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { TabBar } from 'glisse';
import {
  AcademicProfile,
  MaterialPreset,
  WallGeometry,
  WaveConfig,
  DualProbeState,
  SimulationState,
} from './types';
import {
  MATERIAL_PRESETS,
  calculateElectromagneticParameters,
  calculateProbePhaseDelta,
} from './physics/waveEngine';
import { HeaderBar } from './components/HeaderBar';
import { ControlPanel, ChapterTab, SheetDetent } from './components/ControlPanel';
import { ThreeViewport } from './components/ThreeViewport';
import { AcademicProfileModal } from './components/AcademicProfileModal';
import { loadAcademicProfile, saveAcademicProfile } from './utils/academicProfile';
import { deserializeStateFromUrl, SavedPreset } from './utils/exportUtils';
import { Waves, Layers, Activity } from 'lucide-react';

function detectBackdropRefractionSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reducedTransparency = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
  if (reducedMotion || reducedTransparency) return false;

  const isChromium = /Chrom(?:e|ium)\//.test(navigator.userAgent);
  const supportsBackdropBlur =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  return isChromium && supportsBackdropBlur;
}

export const App: React.FC = () => {
  const [wall, setWall] = useState<WallGeometry>({
    textureProfile: 'circulaire',
    thickness: 2.0,
    textureDepth: 0.6,
    texturePeriod: 2.4,
    posX: 0.0,
    height: 3.2,
  });

  const [wave, setWave] = useState<WaveConfig>({
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
  });

  const [material, setMaterial] = useState<MaterialPreset>(MATERIAL_PRESETS[0]);

  const [probe, setProbe] = useState<DualProbeState>({
    x1: -6.0,
    z1: 0.0,
    val1: 0.0,
    history1: new Array(80).fill(0),
    pkToPk1: 0,
    rms1: 0,
    x2: 5.5,
    z2: 0.0,
    val2: 0.0,
    history2: new Array(80).fill(0),
    pkToPk2: 0,
    rms2: 0,
    activeProbe: 1,
    deltaPhiRad: 0.0,
    deltaPhiDeg: 0.0,
    distanceDeltaX: 11.5,
    transmissionCoeff: 0.95,
    isCutoff: false,
    cutoffFreq: 0.0,
    vPhaseGuided: 3e8,
    lambdaGuided: 0.3,
    attenuationAlpha: 0.0,
  });

  const [simulation, setSimulation] = useState<SimulationState>({
    isPlaying: true,
    speed: 1.0,
    time: 0.0,
    showVectors: true,
    showSurface: true,
    showRays: true,
    showEnvelope: false,
    showTrihedron: false,
    cameraMode: 'perspective',
    showKatexPanel: true,
  });

  const [activeChapter, setActiveChapter] = useState<ChapterTab>('ch1');
  const [sheetDetent, setSheetDetent] = useState<SheetDetent>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'peek' : 'half'
  );
  const [academicProfile, setAcademicProfile] = useState<AcademicProfile>(() =>
    loadAcademicProfile()
  );
  const [academicModalOpen, setAcademicModalOpen] = useState(false);

  // Feature-detect live refraction support and activate plain CSS blur fallback when unsupported
  useEffect(() => {
    const syncRefractionMode = () => {
      const supported = detectBackdropRefractionSupport();
      document.documentElement.dataset.refraction = supported ? 'live' : 'fallback';
    };
    syncRefractionMode();
    const motionMq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const transMq = window.matchMedia?.('(prefers-reduced-transparency: reduce)');
    motionMq?.addEventListener?.('change', syncRefractionMode);
    transMq?.addEventListener?.('change', syncRefractionMode);
    return () => {
      motionMq?.removeEventListener?.('change', syncRefractionMode);
      transMq?.removeEventListener?.('change', syncRefractionMode);
    };
  }, []);

  const handleSaveAcademicProfile = useCallback((updated: AcademicProfile) => {
    setAcademicProfile(updated);
    saveAcademicProfile(updated);
  }, []);

  const probeRef = useRef<DualProbeState>(probe);
  probeRef.current = probe;

  const history1Ref = useRef<number[]>(new Array(80).fill(0));
  const history2Ref = useRef<number[]>(new Array(80).fill(0));
  const peakBuffer1Ref = useRef<number[]>([]);
  const peakBuffer2Ref = useRef<number[]>([]);

  const params = useMemo(
    () => calculateElectromagneticParameters(wave, material, wall),
    [wave, material, wall]
  );

  const handleTimeUpdate = useCallback(
    (_t: number, val1: number, val2: number) => {
      history1Ref.current.push(val1);
      if (history1Ref.current.length > 80) history1Ref.current.shift();
      peakBuffer1Ref.current.push(val1);
      if (peakBuffer1Ref.current.length > 40) peakBuffer1Ref.current.shift();

      history2Ref.current.push(val2);
      if (history2Ref.current.length > 80) history2Ref.current.shift();
      peakBuffer2Ref.current.push(val2);
      if (peakBuffer2Ref.current.length > 40) peakBuffer2Ref.current.shift();

      const min1 = Math.min(...peakBuffer1Ref.current);
      const max1 = Math.max(...peakBuffer1Ref.current);
      const pkToPk1 = max1 - min1;
      const rms1 = Math.sqrt(
        peakBuffer1Ref.current.reduce((acc, v) => acc + v * v, 0) /
          Math.max(1, peakBuffer1Ref.current.length)
      );

      const min2 = Math.min(...peakBuffer2Ref.current);
      const max2 = Math.max(...peakBuffer2Ref.current);
      const pkToPk2 = max2 - min2;
      const rms2 = Math.sqrt(
        peakBuffer2Ref.current.reduce((acc, v) => acc + v * v, 0) /
          Math.max(1, peakBuffer2Ref.current.length)
      );

      setProbe((prev) => {
        const deltaX = Math.abs(prev.x2 - prev.x1);
        const { deltaPhiRad, deltaPhiDeg } = calculateProbePhaseDelta(
          wave,
          params.n1,
          params.n2,
          params.fcRatio,
          params.isCutoff,
          deltaX
        );
        const tCoeff = params.transmissionT;

        return {
          ...prev,
          val1,
          val2,
          history1: [...history1Ref.current],
          history2: [...history2Ref.current],
          pkToPk1,
          rms1,
          pkToPk2,
          rms2,
          distanceDeltaX: deltaX,
          deltaPhiRad,
          deltaPhiDeg: deltaPhiDeg % 360,
          transmissionCoeff: tCoeff,
          isCutoff: params.isCutoff,
          cutoffFreq: params.fc / 1e9,
          vPhaseGuided: params.vPhaseGuided,
          lambdaGuided: params.lambdaGuided,
          attenuationAlpha: params.attenuationAlpha,
        };
      });
    },
    [wave, params]
  );

  useEffect(() => {
    const urlState = deserializeStateFromUrl();
    if (urlState) {
      if (urlState.wave) setWave((prev) => ({ ...prev, ...urlState.wave }));
      if (urlState.wall) setWall((prev) => ({ ...prev, ...urlState.wall }));
      if (urlState.materialId) {
        const found = MATERIAL_PRESETS.find((m) => m.id === urlState.materialId);
        if (found) setMaterial(found);
      }
      if (urlState.probe) {
        setProbe((prev) => ({
          ...prev,
          x1: urlState.probe!.x1,
          z1: urlState.probe!.z1,
          x2: urlState.probe!.x2,
          z2: urlState.probe!.z2,
        }));
      }
    }
  }, []);

  const handleProbeMove = useCallback((probeId: 1 | 2, x: number, z: number) => {
    setProbe((prev) =>
      probeId === 1
        ? { ...prev, x1: x, z1: z, activeProbe: 1 }
        : { ...prev, x2: x, z2: z, activeProbe: 2 }
    );
  }, []);

  const handleProbePreset = useCallback(
    (probeId: 1 | 2, zone: 'incident' | 'inside' | 'transmitted') => {
      const halfE = wall.thickness / 2;
      let targetX = 0;
      if (zone === 'incident') targetX = wall.posX - halfE - 4.5;
      else if (zone === 'inside') targetX = wall.posX;
      else targetX = wall.posX + halfE + 5.0;

      setProbe((prev) =>
        probeId === 1
          ? { ...prev, x1: targetX, z1: 0.0, activeProbe: 1 }
          : { ...prev, x2: targetX, z2: 0.0, activeProbe: 2 }
      );
    },
    [wall]
  );

  const resetOscilloscopeBuffers = useCallback(() => {
    history1Ref.current = new Array(80).fill(0);
    history2Ref.current = new Array(80).fill(0);
    peakBuffer1Ref.current = [];
    peakBuffer2Ref.current = [];
  }, []);

  const handleApplyPreset = useCallback((
    _presetName: string,
    newWall: WallGeometry,
    newMaterial: MaterialPreset,
    newWave: WaveConfig
  ) => {
    resetOscilloscopeBuffers();
    setWall({ ...newWall, height: Math.min(newWall.height, 3.4) });
    setMaterial(newMaterial);
    setWave(newWave);
    setProbe((prev) => ({
      ...prev,
      x1: newWall.posX - newWall.thickness / 2 - 5.0,
      z1: 0.0,
      x2: newWall.posX + newWall.thickness / 2 + 5.0,
      z2: 0.0,
      rms1: 0,
      rms2: 0,
      pkToPk1: 0,
      pkToPk2: 0,
    }));
  }, [resetOscilloscopeBuffers]);

  const handleLoadSavedPreset = useCallback((savedPreset: SavedPreset) => {
    resetOscilloscopeBuffers();
    const normalizedMode = savedPreset.wave.guidedMode === 'TM' ? 'TM' : 'TE';
    setWave({
      ...savedPreset.wave,
      guidedMode: normalizedMode,
      boundaryModel: savedPreset.wave.boundaryModel ?? 'dioptre_semi_infini',
    });
    setWall(savedPreset.wall);
    const mat =
      MATERIAL_PRESETS.find((m) => m.id === savedPreset.materialId) || MATERIAL_PRESETS[0];
    setMaterial(mat);
    setProbe((prev) => ({
      ...prev,
      x1: savedPreset.probe.x1,
      z1: savedPreset.probe.z1,
      x2: savedPreset.probe.x2,
      z2: savedPreset.probe.z2,
      rms1: 0,
      rms2: 0,
      pkToPk1: 0,
      pkToPk2: 0,
    }));
  }, [resetOscilloscopeBuffers]);

  const handleToggleSheet = useCallback(
    () => setSheetDetent((prev) => (prev === 'peek' ? 'half' : 'peek')),
    []
  );
  const handleOpenAcademicModal = useCallback(() => setAcademicModalOpen(true), []);
  const handleCloseAcademicModal = useCallback(() => setAcademicModalOpen(false), []);
  const handleIncidenceAngleChange = useCallback(
    (incidenceAngleDeg: number) =>
      setWave((prev) => ({
        ...prev,
        boundaryModel:
          prev.boundaryModel === 'guide_ondes' ? 'dioptre_semi_infini' : prev.boundaryModel,
        incidenceAngleDeg,
      })),
    []
  );

  const handleChapterChange = useCallback((val: string) => {
    setActiveChapter(val as ChapterTab);
    setSheetDetent((prev) => (prev === 'peek' ? 'half' : prev));
  }, []);

  return (
    <div
      data-testid="wavelab-app"
      data-cutoff={String(params.isCutoff)}
      data-tir={String(params.isTotalInternalReflection)}
      data-profile={wall.textureProfile}
      data-material={material.id}
      data-chapter={activeChapter}
      className="relative w-screen h-screen overflow-hidden text-slate-100"
    >
      {/* Couche 0 (Sibling) : Canvas Three.js plein écran enveloppé dans [data-glisse-backdrop] sur fond dégradé profond */}
      <div
        data-glisse-backdrop
        data-testid="glisse-backdrop"
        className="fixed inset-0 z-0 deep-scene-gradient"
      >
        <ThreeViewport
          wave={wave}
          wall={wall}
          material={material}
          probe={probe}
          onProbeMove={handleProbeMove}
          simulation={simulation}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>

      {/* Couche 1 : Barre flottante supérieure (Glisse Button, SegmentedControl, Menu) */}
      <HeaderBar
        simulation={simulation}
        onSimulationChange={setSimulation}
        onApplyPreset={handleApplyPreset}
        sheetExpanded={sheetDetent !== 'peek'}
        onToggleSheet={handleToggleSheet}
        wave={wave}
        wall={wall}
        material={material}
        probeRef={probeRef}
        onLoadSavedPreset={handleLoadSavedPreset}
        academicProfile={academicProfile}
        onOpenAcademicModal={handleOpenAcademicModal}
      />

      {/* Couche 2 : Panneau de paramètres flottant 3-états en bottom sheet (verre CSS pur backdrop-filter) */}
      <ControlPanel
        activeChapter={activeChapter}
        detent={sheetDetent}
        onDetentChange={setSheetDetent}
        onToggleExpand={handleToggleSheet}
        wall={wall}
        onWallChange={setWall}
        material={material}
        onMaterialChange={setMaterial}
        wave={wave}
        onWaveChange={setWave}
        probe={probe}
        onProbePreset={handleProbePreset}
        onIncidenceAngleChange={handleIncidenceAngleChange}
        simulation={simulation}
        onSimulationChange={setSimulation}
        academicProfile={academicProfile}
        onOpenAcademicModal={handleOpenAcademicModal}
      />

      {/* Couche 3 : TabBar fixe en bas pour Chapitres 1 / 2 / 3 */}
      <nav
        aria-label="Navigation des chapitres Mod-M115"
        className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-30"
      >
        <TabBar
          aria-label="Chapitres 1, 2 et 3"
          value={activeChapter}
          onValueChange={handleChapterChange}
          style={{ '--lg-tab-width': '114px' } as React.CSSProperties}
          items={[
            {
              value: 'ch1',
              label: 'Ch. 1 · Dioptre',
              icon: <Waves className="w-5 h-5" />,
            },
            {
              value: 'ch2',
              label: 'Ch. 2 · Pertes',
              icon: <Layers className="w-5 h-5" />,
            },
            {
              value: 'ch3',
              label: 'Ch. 3 · Scope',
              icon: <Activity className="w-5 h-5" />,
            },
          ]}
        />
      </nav>

      <AcademicProfileModal
        isOpen={academicModalOpen}
        profile={academicProfile}
        onClose={handleCloseAcademicModal}
        onSave={handleSaveAcademicProfile}
      />
    </div>
  );
};

export default App;
