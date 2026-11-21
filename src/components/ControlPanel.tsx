import React, { useMemo, useRef, useState } from 'react';
import { Button, SegmentedControl, Slider, Switch } from 'glisse';
import {
  AcademicProfile,
  CameraMode,
  DualProbeState,
  MaterialPreset,
  WallGeometry,
  WaveConfig,
  SimulationState,
  SurfaceTextureProfile,
} from '../types';
import {
  MATERIAL_PRESETS,
  calculateElectromagneticParameters,
} from '../physics/waveEngine';
import { KatexEquations } from './KatexEquations';
import { Oscilloscope } from './Oscilloscope';
import { ParamTooltip } from './ParamTooltip';
import {
  Box,
  Radio,
  Eye,
  GraduationCap,
  User,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Waves,
  Activity,
} from 'lucide-react';

export type ChapterTab = 'ch1' | 'ch2' | 'ch3';
export type SheetDetent = 'peek' | 'half' | 'full';

interface ControlPanelProps {
  activeChapter: ChapterTab;
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent) => void;
  onToggleExpand: () => void;
  wall: WallGeometry;
  onWallChange: (wall: WallGeometry) => void;
  material: MaterialPreset;
  onMaterialChange: (mat: MaterialPreset) => void;
  wave: WaveConfig;
  onWaveChange: (wave: WaveConfig) => void;
  probe: DualProbeState;
  onProbePreset: (probeId: 1 | 2, zone: 'incident' | 'inside' | 'transmitted') => void;
  onIncidenceAngleChange: (angleDeg: number) => void;
  simulation: SimulationState;
  onSimulationChange: (sim: SimulationState) => void;
  academicProfile: AcademicProfile;
  onOpenAcademicModal: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = React.memo(({
  activeChapter,
  detent,
  onDetentChange,
  onToggleExpand,
  wall,
  onWallChange,
  material,
  onMaterialChange,
  wave,
  onWaveChange,
  probe,
  onProbePreset,
  onIncidenceAngleChange,
  simulation,
  onSimulationChange,
  academicProfile,
  onOpenAcademicModal,
}) => {
  const params = useMemo(
    () => calculateElectromagneticParameters(wave, material, wall),
    [wave, material, wall]
  );
  const fcGHz = params.fc / 1e9;
  const isMobileDefault = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // 3-detent swipeable drag handle state (peek / half / full)
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    startY: number;
    basePx: number;
    halfPx: number;
    fullPx: number;
    lastDy: number;
  } | null>(null);

  const getDetentBounds = () => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const halfPx = Math.round(vh * 0.43);
    const fullPx = Math.max(halfPx + 72, vh - 248);
    return { halfPx, fullPx };
  };

  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const { halfPx, fullPx } = getDetentBounds();
    const basePx = detent === 'peek' ? 0 : detent === 'half' ? halfPx : fullPx;
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      basePx,
      halfPx,
      fullPx,
      lastDy: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragHeightPx(basePx);
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    const dy = session.startY - e.clientY;
    session.lastDy = dy;
    const clamped = Math.max(0, Math.min(session.fullPx, session.basePx + dy));
    setDragHeightPx(clamped);
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const dy = session.lastDy;
    const currentH = Math.max(0, Math.min(session.fullPx, session.basePx + dy));
    dragSessionRef.current = null;
    setDragHeightPx(null);

    // Tap (minimal drag) cycles peek -> half -> full -> peek
    if (Math.abs(dy) < 6) {
      const next: SheetDetent =
        detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'peek';
      onDetentChange(next);
      return;
    }

    // Flick bias or midpoint snapping across 3 detents
    if (dy > 44) {
      onDetentChange(detent === 'peek' ? 'half' : 'full');
    } else if (dy < -44) {
      onDetentChange(detent === 'full' ? 'half' : 'peek');
    } else if (currentH < session.halfPx * 0.45) {
      onDetentChange('peek');
    } else if (currentH > (session.halfPx + session.fullPx) * 0.5) {
      onDetentChange('full');
    } else {
      onDetentChange('half');
    }
  };

  const handleDragKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onDetentChange(detent === 'peek' ? 'half' : 'full');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onDetentChange(detent === 'full' ? 'half' : 'peek');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDetentChange(detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'peek');
    }
  };

  const isBodyVisible = detent !== 'peek' || (dragHeightPx !== null && dragHeightPx > 8);

  const textureProfiles: {
    id: SurfaceTextureProfile;
    name: string;
  }[] = [
    { id: 'triangulaire', name: 'Triangulaire / Dents de scie' },
    { id: 'fentes_cavites', name: 'Fentes & Cavités (« Col d’air »)' },
    { id: 'rectangulaire', name: 'Créneaux / Rectangulaire' },
    { id: 'circulaire', name: 'Circulaire / Demi-cylindrique' },
    { id: 'sinusoidale', name: 'Sinusoïdale (Réseau de Bragg)' },
  ];

  const chapterMeta: Record<ChapterTab, { title: string }> = {
    ch1: {
      title: 'Chapitre 1 — Dioptre, Incidence Oblique & Fresnel',
    },
    ch2: {
      title: 'Chapitre 2 — Milieu Dissipatif & Géométrie de Paroi',
    },
    ch3: {
      title: 'Chapitre 3 — Ondes Stationnaires & Oscilloscope',
    },
  };

  const renderVisualSwitches = () => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 pb-1">
        <Eye className="w-3.5 h-3.5 text-[#0a84ff] shrink-0" />
        <span>Couches d&apos;affichage 3D</span>
      </div>
      <div className="divide-y divide-white/[0.06] text-xs">
        <label className="flex items-center justify-between gap-2 min-h-[38px] cursor-pointer hover:bg-white/[0.03] px-1 -mx-1 rounded">
          <span className="text-slate-200">Nappe E(x,z)</span>
          <Switch
            aria-label="Afficher la nappe E(x,z)"
            checked={simulation.showSurface}
            onCheckedChange={(checked) =>
              onSimulationChange({ ...simulation, showSurface: checked })
            }
          />
        </label>

        <label className="flex items-center justify-between gap-2 min-h-[38px] cursor-pointer hover:bg-white/[0.03] px-1 -mx-1 rounded">
          <span className="text-slate-200">Vecteurs &lt;S&gt;</span>
          <Switch
            aria-label="Afficher les vecteurs de Poynting <S>"
            checked={simulation.showVectors}
            onCheckedChange={(checked) =>
              onSimulationChange({ ...simulation, showVectors: checked })
            }
          />
        </label>

        <label className="flex items-center justify-between gap-2 min-h-[38px] cursor-pointer hover:bg-white/[0.03] px-1 -mx-1 rounded">
          <span className="text-slate-200">Rayons θi / θt</span>
          <Switch
            aria-label="Afficher les rayons θi et θt"
            checked={simulation.showRays}
            onCheckedChange={(checked) =>
              onSimulationChange({ ...simulation, showRays: checked })
            }
          />
        </label>

        <label className="flex items-center justify-between gap-2 min-h-[38px] cursor-pointer hover:bg-white/[0.03] px-1 -mx-1 rounded">
          <span className="text-slate-200">Enveloppe |E|</span>
          <Switch
            aria-label="Afficher l'enveloppe stationnaire |E|"
            checked={simulation.showEnvelope}
            onCheckedChange={(checked) =>
              onSimulationChange({ ...simulation, showEnvelope: checked })
            }
          />
        </label>

        <label className="flex items-center justify-between gap-2 min-h-[38px] cursor-pointer hover:bg-white/[0.03] px-1 -mx-1 rounded">
          <span className="text-slate-200">Trièdre (E, H, k) sur Sonde 1</span>
          <Switch
            aria-label="Afficher le trièdre (E, H, k) sur Sonde 1"
            checked={simulation.showTrihedron}
            onCheckedChange={(checked) =>
              onSimulationChange({ ...simulation, showTrihedron: checked })
            }
          />
        </label>
      </div>
    </div>
  );

  const renderAcademicCard = () => (
    <section aria-label="Profil académique" className="pt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0a84ff]">
        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
        <span>Profil académique · {academicProfile.institution}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
        <div className="flex items-start gap-2 min-w-0">
          <User className="w-3.5 h-3.5 text-[#0a84ff] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-slate-100 font-semibold truncate">
              {academicProfile.studentName || 'Étudiant non renseigné'}
            </div>
            <div className="text-slate-400 truncate text-[10px]">
              {[academicProfile.studentClass, academicProfile.studentId]
                .filter(Boolean)
                .join(' · ') || 'Mod-M115'}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 min-w-0">
          <GraduationCap className="w-3.5 h-3.5 text-[#0a84ff] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            {academicProfile.teacherName ? (
              <>
                <div className="text-slate-100 font-semibold truncate">
                  {academicProfile.teacherName}
                </div>
                <div className="text-slate-400 truncate text-[10px]">
                  {[academicProfile.teacherTitle, academicProfile.teacherDepartment]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAcademicModal}
                className="text-left text-[#0a84ff] hover:underline underline-offset-2"
              >
                Enseignant(e) — ajouter
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const detentHeightClass =
    detent === 'full'
      ? 'max-h-[calc(100dvh-248px)]'
      : detent === 'half'
      ? 'max-h-[43vh]'
      : 'max-h-0';

  return (
    <aside
      aria-label="Panneau de paramètres bottom sheet"
      data-detent={detent}
      className="fixed left-1/2 -translate-x-1/2 bottom-[74px] z-20 w-[calc(100vw-16px)] sm:w-[calc(100vw-32px)] max-w-[1040px] rounded-2xl bottom-sheet-glass text-slate-100 select-none overflow-hidden"
    >
      {/* Poignée tactile 3-états (peek / half / full) */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hauteur du panneau de paramètres"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={detent === 'peek' ? 0 : detent === 'half' ? 1 : 2}
        aria-valuetext={detent}
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
        onKeyDown={handleDragKeyDown}
        title="Glisser pour ajuster (Réduit / Demi / Complet)"
        className="group pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:bg-white/[0.06]"
      >
        <span className="w-10 h-1 rounded-full bg-white/30 group-hover:bg-white/55 transition-colors" />
      </div>

      {/* En-tête de la bottom sheet (toujours visible) */}
      <div className="px-4 sm:px-5 pb-2.5 flex items-center justify-between gap-2 border-b border-white/[0.09]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#0a84ff]/20 border border-[#0a84ff]/40 flex items-center justify-center shrink-0">
            {activeChapter === 'ch1' ? (
              <Waves className="w-3.5 h-3.5 text-[#0a84ff]" />
            ) : activeChapter === 'ch2' ? (
              <Box className="w-3.5 h-3.5 text-[#0a84ff]" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-[#0a84ff]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {chapterMeta[activeChapter].title}
            </div>
            <div className="text-[10.5px] font-mono tabular-nums text-slate-300/85 truncate flex items-center gap-2">
              <span>{wave.guidedMode}</span>
              <span>· f={wave.frequency.toFixed(2)} GHz</span>
              {wave.boundaryModel !== 'guide_ondes' ? (
                <span>· θi={Math.round(wave.incidenceAngleDeg)}°</span>
              ) : (
                <span>· fc={fcGHz.toFixed(2)} GHz</span>
              )}
              <span className="hidden sm:inline">· |Γ|={params.gammaMag.toFixed(2)}</span>
              <span className="hidden md:inline">
                · S1({probe.x1.toFixed(1)}m) / S2({probe.x2.toFixed(1)}m)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden lg:inline text-[11px] text-slate-300/80 font-medium truncate max-w-[230px] mr-1">
            {academicProfile.studentName} · {academicProfile.teacherName}
          </span>
          {detent !== 'peek' && (
            <Button
              icon={
                detent === 'full' ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )
              }
              onClick={() => onDetentChange(detent === 'full' ? 'half' : 'full')}
              aria-label={
                detent === 'full'
                  ? 'Revenir à la hauteur moyenne'
                  : 'Agrandir le panneau en plein écran'
              }
              title={detent === 'full' ? 'Hauteur moyenne' : 'Agrandir'}
            />
          )}
          <Button
            icon={detent === 'peek' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            onClick={onToggleExpand}
            aria-label={
              detent === 'peek'
                ? 'Développer le panneau de paramètres'
                : 'Réduire le panneau de paramètres'
            }
            aria-expanded={detent !== 'peek'}
          />
        </div>
      </div>

      {/* Corps de la bottom sheet (sections aérées à séparateurs fins, verre CSS pur) */}
      {isBodyVisible && (
        <div
          style={dragHeightPx !== null ? { maxHeight: `${dragHeightPx}px` } : undefined}
          className={`${
            dragHeightPx === null ? `sheet-body-transition ${detentHeightClass}` : ''
          } overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3.5`}
        >
          {/* Contrôles segmentés principaux : TE/TM + Config propagation + Vue mobile */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.09]">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                aria-label="Mode de polarisation TE ou TM"
                value={wave.guidedMode}
                onValueChange={(val) =>
                  onWaveChange({ ...wave, guidedMode: val === 'TM' ? 'TM' : 'TE' })
                }
                style={{ '--lg-tab-width': '98px' } as React.CSSProperties}
                items={[
                  { value: 'TE', label: 'Mode TE' },
                  { value: 'TM', label: 'Mode TM' },
                ]}
              />

              <SegmentedControl
                aria-label="Configuration de propagation"
                value={wave.boundaryModel ?? 'dioptre_semi_infini'}
                onValueChange={(val) =>
                  onWaveChange({
                    ...wave,
                    boundaryModel: val as WaveConfig['boundaryModel'],
                  })
                }
                style={{ '--lg-tab-width': '84px' } as React.CSSProperties}
                items={[
                  { value: 'dioptre_semi_infini', label: 'Dioptre' },
                  { value: 'lame_finie', label: 'Lame e' },
                  { value: 'guide_ondes', label: 'Guide (fc)' },
                ]}
              />
            </div>

            <div className="flex lg:hidden items-center max-w-full overflow-x-auto">
              <SegmentedControl
                aria-label="Modes de vue 3D (mobile)"
                value={simulation.cameraMode}
                onValueChange={(val) =>
                  onSimulationChange({ ...simulation, cameraMode: val as CameraMode })
                }
                style={{ '--lg-tab-width': '58px' } as React.CSSProperties}
                items={[
                  { value: 'perspective', label: '3D' },
                  { value: 'top', label: 'Dessus' },
                  { value: 'profile', label: 'Profil' },
                  { value: 'incident', label: 'Face' },
                  { value: 'isometric', label: 'Arrière' },
                ]}
              />
            </div>
          </div>

          {/* CHAPITRE 1 : Dioptre, Incidence Oblique, Fréquence, Amplitude & Descartes */}
          {activeChapter === 'ch1' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-7 divide-y divide-white/[0.09]">
                {wave.boundaryModel !== 'guide_ondes' ? (
                  <div className="pb-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-[#0a84ff]" />
                        <span>
                          Milieu 1 incident (n₁ ={' '}
                          <span className="font-mono tabular-nums">
                            {Math.sqrt(wave.medium1EpsilonR).toFixed(2)}
                          </span>
                          )
                        </span>
                      </span>
                      <SegmentedControl
                        aria-label="Milieu 1 incident"
                        value={Math.abs(wave.medium1EpsilonR - 2.25) < 0.05 ? '2.25' : '1'}
                        onValueChange={(val) =>
                          onWaveChange({ ...wave, medium1EpsilonR: parseFloat(val) })
                        }
                        style={{ '--lg-tab-width': '104px' } as React.CSSProperties}
                        items={[
                          { value: '1', label: 'Vide n₁=1' },
                          { value: '2.25', label: 'Verre n₁=1,5' },
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                      <div className="flex justify-between items-center text-xs gap-2">
                        <label htmlFor="incidence-angle" className="text-slate-200 font-medium flex items-center">
                          Angle d&apos;incidence (θi)
                          <ParamTooltip
                            title="Lois de Descartes & Brewster"
                            explanation="Mesuré par rapport à la normale au dioptre (0° à 85°). En mode TM, Γ s'annule à l'angle de Brewster θB = arctan(n₂/n₁). Si n₁ > n₂, réflexion totale pour θi > θl."
                            formula="n_1\sin\theta_i = n_2\sin\theta_t"
                          />
                        </label>
                        <div className="flex items-center gap-1.5 font-mono tabular-nums">
                          <span className="text-[#0a84ff] font-semibold">
                            {Math.round(wave.incidenceAngleDeg)}°
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className={params.isTotalInternalReflection ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
                            {material.isPEC
                              ? 'PEC : θt = —'
                              : params.isTotalInternalReflection
                              ? 'TIR (évanescent)'
                              : `θt = ${params.thetaTDeg.toFixed(1)}°`}
                          </span>
                        </div>
                      </div>

                      <Slider
                        id="incidence-angle"
                        aria-label="Angle d'incidence θi"
                        min={0}
                        max={85}
                        step={1}
                        value={wave.incidenceAngleDeg}
                        onValueChange={(val) =>
                          onWaveChange({ ...wave, incidenceAngleDeg: val })
                        }
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          {[0, 30, 45, 60, 75].map((deg) => (
                            <button
                              key={deg}
                              type="button"
                              onClick={() => onWaveChange({ ...wave, incidenceAngleDeg: deg })}
                              className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-mono tabular-nums border transition-colors ${
                                Math.round(wave.incidenceAngleDeg) === deg
                                  ? 'bg-[#0a84ff] border-[#0a84ff] text-white font-semibold'
                                  : 'bg-white/[0.05] border-white/10 text-slate-300 hover:text-white'
                              }`}
                            >
                              {deg}°
                            </button>
                          ))}
                        </div>

                        {params.brewsterDeg !== null && (
                          <div className="flex items-center gap-2.5 text-[11px] tabular-nums">
                            <button
                              type="button"
                              onClick={() =>
                                onWaveChange({
                                  ...wave,
                                  guidedMode: 'TM',
                                  incidenceAngleDeg: Math.round(params.brewsterDeg!),
                                })
                              }
                              className="text-[#0a84ff] hover:underline underline-offset-2 font-medium"
                            >
                              θB = {params.brewsterDeg.toFixed(1)}°
                            </button>
                            {params.thetaLimitDeg !== null && (
                              <button
                                type="button"
                                onClick={() =>
                                  onWaveChange({
                                    ...wave,
                                    incidenceAngleDeg: Math.min(85, Math.ceil(params.thetaLimitDeg! + 5)),
                                  })
                                }
                                className="text-rose-300 hover:underline underline-offset-2 font-medium"
                              >
                                TIR (&gt; {params.thetaLimitDeg.toFixed(1)}°)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06]">
                      <span className="text-[11px] text-slate-300">Type d&apos;onde source</span>
                      <SegmentedControl
                        aria-label="Type d'onde source"
                        value={wave.polarization}
                        onValueChange={(val) =>
                          onWaveChange({
                            ...wave,
                            polarization: val as WaveConfig['polarization'],
                          })
                        }
                        style={{ '--lg-tab-width': '92px' } as React.CSSProperties}
                        items={[
                          { value: 'rectiligne', label: 'Rectiligne' },
                          { value: 'circulaire', label: 'Circulaire' },
                          { value: 'source_surfacique', label: 'Nappe js' },
                        ]}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pb-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-200 font-medium">Fréquence de coupure fc</span>
                      <span className={`font-mono tabular-nums font-semibold ${params.isCutoff ? 'text-rose-300' : 'text-[#0a84ff]'}`}>
                        {fcGHz.toFixed(3)} GHz ({params.isCutoff ? 'Coupure' : 'Propagatif'})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-200">
                          <label htmlFor="guide-a">Largeur a</label>
                          <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                            {(wave.guideA * 100).toFixed(1)} cm
                          </span>
                        </div>
                        <Slider
                          id="guide-a"
                          aria-label="Largeur guide a"
                          min={0.04}
                          max={0.24}
                          step={0.01}
                          value={wave.guideA}
                          onValueChange={(val) => onWaveChange({ ...wave, guideA: val })}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-200">
                          <label htmlFor="guide-b">Hauteur b</label>
                          <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                            {(wave.guideB * 100).toFixed(1)} cm
                          </span>
                        </div>
                        <Slider
                          id="guide-b"
                          aria-label="Hauteur guide b"
                          min={0.02}
                          max={0.16}
                          step={0.01}
                          value={wave.guideB}
                          onValueChange={(val) => onWaveChange({ ...wave, guideB: val })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <label className="flex items-center justify-between bg-black/25 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-slate-200">Indice m</span>
                        <select
                          value={wave.modeM}
                          onChange={(e) =>
                            onWaveChange({ ...wave, modeM: parseInt(e.target.value, 10) })
                          }
                          className="bg-transparent font-mono text-[#0a84ff] font-semibold focus:outline-none"
                        >
                          {[0, 1, 2, 3].map((v) => (
                            <option key={v} value={v} className="bg-[#0b1326] text-white">
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center justify-between bg-black/25 px-3 py-1.5 rounded-lg border border-white/10">
                        <span className="text-slate-200">Indice n</span>
                        <select
                          value={wave.modeN}
                          onChange={(e) =>
                            onWaveChange({ ...wave, modeN: parseInt(e.target.value, 10) })
                          }
                          className="bg-transparent font-mono text-[#0a84ff] font-semibold focus:outline-none"
                        >
                          {[0, 1, 2].map((v) => (
                            <option key={v} value={v} className="bg-[#0b1326] text-white">
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {/* Fréquence f & Amplitude E0 (flat row with hairline top separator) */}
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs">
                      <label htmlFor="wave-freq" className="text-slate-200 font-medium">
                        Fréquence (f)
                      </label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wave.frequency.toFixed(2)} GHz
                      </span>
                    </div>
                    <Slider
                      id="wave-freq"
                      aria-label="Fréquence f en GHz"
                      min={0.25}
                      max={10.0}
                      step={0.05}
                      value={wave.frequency}
                      onValueChange={(val) => onWaveChange({ ...wave, frequency: val })}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <label htmlFor="wave-amp" className="text-slate-200 font-medium">
                        Amplitude E₀
                      </label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wave.amplitude.toFixed(2)} V/m
                      </span>
                    </div>
                    <Slider
                      id="wave-amp"
                      aria-label="Amplitude E0"
                      min={0.4}
                      max={2.2}
                      step={0.1}
                      value={wave.amplitude}
                      onValueChange={(val) => onWaveChange({ ...wave, amplitude: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 md:border-l md:border-white/[0.09] md:pl-5 divide-y divide-white/[0.09] space-y-3">
                {renderVisualSwitches()}
                <div className="pt-3">
                  <KatexEquations
                    wave={wave}
                    wall={wall}
                    material={material}
                    probeX1={probe.x1}
                    probeX2={probe.x2}
                    activeChapter="ch1"
                    defaultCollapsed={isMobileDefault}
                  />
                </div>
                {renderAcademicCard()}
              </div>
            </div>
          )}

          {/* CHAPITRE 2 : Milieu 2, Pertes & Géométrie de la barrière */}
          {activeChapter === 'ch2' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-7 divide-y divide-white/[0.09]">
                <div className="pb-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="material-select" className="text-[11px] text-slate-300 block">
                        Matériau du dioptre (Milieu 2)
                      </label>
                      <select
                        id="material-select"
                        value={material.id}
                        onChange={(e) => {
                          const found = MATERIAL_PRESETS.find((m) => m.id === e.target.value);
                          if (found) onMaterialChange(found);
                        }}
                        className="w-full bg-black/25 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#0a84ff]"
                      >
                        {MATERIAL_PRESETS.map((mat) => (
                          <option key={mat.id} value={mat.id} className="bg-[#0b1326] text-white">
                            {mat.name} (
                            {mat.isPEC
                              ? 'PEC σ→∞'
                              : mat.isConductor
                              ? `σ=${mat.conductivity.toExponential(1)}`
                              : `εr=${mat.epsilonR}, tanδ=${mat.lossTangent}`}
                            )
                          </option>
                        ))}
                        {material.id === 'custom' && (
                          <option value="custom" className="bg-[#0b1326] text-white">
                            Personnalisé (εr={material.epsilonR.toFixed(2)}, tanδ={material.lossTangent.toFixed(3)})
                          </option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="profile-select" className="text-[11px] text-slate-300 block">
                        Profil géométrique de surface
                      </label>
                      <select
                        id="profile-select"
                        value={wall.textureProfile}
                        onChange={(e) =>
                          onWallChange({
                            ...wall,
                            textureProfile: e.target.value as SurfaceTextureProfile,
                          })
                        }
                        className="w-full bg-black/25 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#0a84ff]"
                      >
                        {textureProfiles.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#0b1326] text-white">
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300/85 leading-snug">{material.description}</p>

                  {!material.isPEC && !material.isConductor && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-200">
                          <label htmlFor="custom-eps">εr personnalisé</label>
                          <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                            {material.epsilonR.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          id="custom-eps"
                          aria-label="Permittivité relative εr"
                          min={1.0}
                          max={12.0}
                          step={0.05}
                          value={material.epsilonR}
                          onValueChange={(epsilonR) => {
                            onMaterialChange({
                              ...material,
                              id: 'custom',
                              name: 'Matériau personnalisé',
                              epsilonR,
                              isPEC: false,
                              isConductor: false,
                              description: `Diélectrique personnalisé (εr = ${epsilonR.toFixed(2)}, tan δ = ${material.lossTangent.toFixed(4)}).`,
                            });
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-200">
                          <label htmlFor="custom-tand">Pertes tan δ</label>
                          <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                            {material.lossTangent.toFixed(3)}
                          </span>
                        </div>
                        <Slider
                          id="custom-tand"
                          aria-label="Tangente de pertes tan delta"
                          min={0.0}
                          max={0.5}
                          step={0.005}
                          value={Math.min(0.5, material.lossTangent)}
                          onValueChange={(lossTangent) => {
                            onMaterialChange({
                              ...material,
                              id: 'custom',
                              name: 'Matériau personnalisé',
                              lossTangent,
                              isPEC: false,
                              isConductor: false,
                              description: `Diélectrique personnalisé (εr = ${material.epsilonR.toFixed(2)}, tan δ = ${lossTangent.toFixed(3)}).`,
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-200">
                      <label htmlFor="wall-thick">Épaisseur e</label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wall.thickness.toFixed(1)} m
                      </span>
                    </div>
                    <Slider
                      id="wall-thick"
                      aria-label="Épaisseur de paroi e"
                      min={0.6}
                      max={5.0}
                      step={0.2}
                      value={wall.thickness}
                      onValueChange={(val) => onWallChange({ ...wall, thickness: val })}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-200">
                      <label htmlFor="wall-depth">Relief h</label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wall.textureDepth.toFixed(1)} m
                      </span>
                    </div>
                    <Slider
                      id="wall-depth"
                      aria-label="Profondeur de relief h"
                      min={0.0}
                      max={2.2}
                      step={0.1}
                      value={wall.textureDepth}
                      onValueChange={(val) => onWallChange({ ...wall, textureDepth: val })}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-200">
                      <label htmlFor="wall-period">Pas Λ</label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wall.texturePeriod.toFixed(1)} m
                      </span>
                    </div>
                    <Slider
                      id="wall-period"
                      aria-label="Pas périodique Lambda"
                      min={1.0}
                      max={6.0}
                      step={0.2}
                      value={wall.texturePeriod}
                      onValueChange={(val) => onWallChange({ ...wall, texturePeriod: val })}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-200">
                      <label htmlFor="wall-height">Hauteur H</label>
                      <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                        {wall.height.toFixed(1)} m
                      </span>
                    </div>
                    <Slider
                      id="wall-height"
                      aria-label="Hauteur H"
                      min={1.6}
                      max={6.0}
                      step={0.2}
                      value={wall.height}
                      onValueChange={(val) => onWallChange({ ...wall, height: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 md:border-l md:border-white/[0.09] md:pl-5 divide-y divide-white/[0.09] space-y-3">
                {renderVisualSwitches()}
                <div className="pt-3">
                  <KatexEquations
                    wave={wave}
                    wall={wall}
                    material={material}
                    probeX1={probe.x1}
                    probeX2={probe.x2}
                    activeChapter="ch2"
                    defaultCollapsed={isMobileDefault}
                  />
                </div>
                {renderAcademicCard()}
              </div>
            </div>
          )}

          {/* CHAPITRE 3 : Ondes stationnaires, Sondes & Oscilloscope complet */}
          {activeChapter === 'ch3' && (
            <div className="divide-y divide-white/[0.09] space-y-3.5">
              <Oscilloscope
                probe={probe}
                wave={wave}
                wall={wall}
                material={material}
                onProbePreset={onProbePreset}
                onIncidenceAngleChange={onIncidenceAngleChange}
              />

              <div className="pt-3.5 grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-6 divide-y divide-white/[0.09] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor="ch3-freq" className="text-slate-200 font-medium">
                          Fréquence (f)
                        </label>
                        <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                          {wave.frequency.toFixed(2)} GHz
                        </span>
                      </div>
                      <Slider
                        id="ch3-freq"
                        aria-label="Fréquence f (Chapitre 3)"
                        min={0.25}
                        max={10.0}
                        step={0.05}
                        value={wave.frequency}
                        onValueChange={(val) => onWaveChange({ ...wave, frequency: val })}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor="ch3-angle" className="text-slate-200 font-medium">
                          Angle θi
                        </label>
                        <span className="font-mono tabular-nums text-[#0a84ff] font-semibold">
                          {Math.round(wave.incidenceAngleDeg)}°
                        </span>
                      </div>
                      <Slider
                        id="ch3-angle"
                        aria-label="Angle d'incidence θi (Chapitre 3)"
                        min={0}
                        max={85}
                        step={1}
                        value={wave.incidenceAngleDeg}
                        onValueChange={(val) =>
                          onWaveChange({
                            ...wave,
                            boundaryModel:
                              wave.boundaryModel === 'guide_ondes'
                                ? 'dioptre_semi_infini'
                                : wave.boundaryModel,
                            incidenceAngleDeg: val,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="pt-3">{renderVisualSwitches()}</div>
                </div>

                <div className="md:col-span-6 md:border-l md:border-white/[0.09] md:pl-5 divide-y divide-white/[0.09] space-y-3">
                  <KatexEquations
                    wave={wave}
                    wall={wall}
                    material={material}
                    probeX1={probe.x1}
                    probeX2={probe.x2}
                    activeChapter="ch3"
                    defaultCollapsed={isMobileDefault}
                  />
                  {renderAcademicCard()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
});
ControlPanel.displayName = 'ControlPanel';
