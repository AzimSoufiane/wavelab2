import React from 'react';
import {
  AcademicProfile,
  MaterialPreset,
  WallGeometry,
  WaveConfig,
  SimulationState,
  SurfaceTextureProfile,
  DualProbeState,
} from '../types';
import {
  MATERIAL_PRESETS,
  calculateElectromagneticParameters,
} from '../physics/waveEngine';
import { KatexEquations } from './KatexEquations';
import { ParamTooltip } from './ParamTooltip';
import { Sliders, Box, Radio, Eye, Waves, GraduationCap, Pencil, User } from 'lucide-react';

interface ControlPanelProps {
  wall: WallGeometry;
  onWallChange: (wall: WallGeometry) => void;
  material: MaterialPreset;
  onMaterialChange: (mat: MaterialPreset) => void;
  wave: WaveConfig;
  onWaveChange: (wave: WaveConfig) => void;
  probe: DualProbeState;
  onProbeChange: (probe: DualProbeState) => void;
  simulation: SimulationState;
  onSimulationChange: (sim: SimulationState) => void;
  academicProfile: AcademicProfile;
  onOpenAcademicModal: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  wall,
  onWallChange,
  material,
  onMaterialChange,
  wave,
  onWaveChange,
  probe,
  simulation,
  onSimulationChange,
  academicProfile,
  onOpenAcademicModal,
}) => {
  const params = calculateElectromagneticParameters(wave, material, wall);
  const fcGHz = params.fc / 1e9;

  const textureProfiles: {
    id: SurfaceTextureProfile;
    name: string;
    description: string;
  }[] = [
    {
      id: 'triangulaire',
      name: 'Triangulaire / Dents de scie',
      description: 'Dièdres anéchoïques en V pour réduction d’écho spéculaire',
    },
    {
      id: 'fentes_cavites',
      name: 'Fentes & Cavités (« Col d’air »)',
      description: 'Colonnes diélectriques séparées par de véritables canaux d’air ouverts',
    },
    {
      id: 'rectangulaire',
      name: 'Créneaux / Rectangulaire',
      description: 'Réseau périodique à fronts raides et diffraction d’ordre supérieur',
    },
    {
      id: 'circulaire',
      name: 'Circulaire / Demi-cylindrique',
      description: 'Bossages convexes lisses pour diffusion cylindrique',
    },
    {
      id: 'sinusoidale',
      name: 'Sinusoïdale (Réseau de Bragg)',
      description: 'Modulation harmonique continue pour filtrage sélectif',
    },
  ];

  return (
    <aside
      aria-label="Panneau de contrôle électromagnétique"
      className="w-full h-full block bg-[#0b1120] border-r border-slate-800 text-slate-100 overflow-y-auto p-4 pb-8 space-y-5 select-none"
    >
      {/* En-tête de section */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Waves className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Paramètres physiques
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              {academicProfile.institution} · {academicProfile.studentClass || 'Mod-M115'}
            </p>
          </div>
        </div>
      </div>

      {/* Profil Académique (Étudiant & Enseignant) */}
      <section
        aria-label="Profil académique"
        className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Profil académique</span>
          </div>
          <button
            type="button"
            onClick={onOpenAcademicModal}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-cyan-200 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            <span>Modifier</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <div className="flex items-start gap-2 bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 font-semibold truncate">
                {academicProfile.studentName || 'Étudiant non renseigné'}
                {academicProfile.studentId && (
                  <span className="ml-1.5 font-mono text-[10px] text-cyan-300 font-normal">
                    ({academicProfile.studentId})
                  </span>
                )}
              </div>
              <div className="text-slate-400 truncate">
                {[academicProfile.studentClass, academicProfile.studentEmail]
                  .filter(Boolean)
                  .join(' · ') || 'Filière / Email non renseignés'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              {academicProfile.teacherName ? (
                <>
                  <div className="text-slate-200 font-semibold truncate">
                    {academicProfile.teacherName}
                    {academicProfile.teacherTitle && (
                      <span className="ml-1.5 text-[10px] text-amber-300 font-normal">
                        ({academicProfile.teacherTitle})
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 truncate">
                    {[academicProfile.teacherDepartment, academicProfile.teacherEmail]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAcademicModal}
                  className="text-left text-amber-300/90 hover:text-amber-200 underline underline-offset-2"
                >
                  Enseignant(e) : Non renseigné — cliquer pour ajouter
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1 : Mode de Propagation (TE / TM) & Configuration */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
            <Radio className="w-4 h-4 text-cyan-400" />
            Mode de propagation
            <ParamTooltip
              title="Modes TE et TM"
              explanation="TE (Transverse Électrique) : champ E perpendiculaire au plan d'incidence. TM (Transverse Magnétique) : champ E parallèle au plan d'incidence (angle de Brewster θB). En régime guidé, fréquence de coupure fc."
              formula="f_c = \frac{c}{2\sqrt{\epsilon_r}}\sqrt{(m/a)^2 + (n/b)^2}"
            />
          </span>
          <span className="font-mono text-xs text-slate-300">{wave.guidedMode}</span>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['TE', 'TM'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onWaveChange({ ...wave, guidedMode: mode })}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                wave.guidedMode === mode
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {mode === 'TE' ? 'Mode TE (E ⊥ plan)' : 'Mode TM (E ∥ plan)'}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <span className="text-[11px] text-slate-400 block">Configuration de propagation</span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            {(
              [
                { id: 'dioptre_semi_infini', label: 'Dioptre' },
                { id: 'lame_finie', label: 'Lame e' },
                { id: 'guide_ondes', label: 'Guide (fc)' },
              ] as const
            ).map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => onWaveChange({ ...wave, boundaryModel: cfg.id })}
                className={`py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  (wave.boundaryModel ?? 'dioptre_semi_infini') === cfg.id
                    ? 'bg-slate-800 border border-cyan-500/70 text-cyan-300'
                    : 'border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paramètres Dioptre / Lame finie (Ch. 1 à 3, incidence oblique TE / TM) */}
        {wave.boundaryModel !== 'guide_ondes' && (
          <div className="space-y-2.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Milieu 1 incident (n₁)</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  n₁ = {Math.sqrt(wave.medium1EpsilonR).toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onWaveChange({ ...wave, medium1EpsilonR: 1.0 })}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-medium border transition-colors ${
                    Math.abs(wave.medium1EpsilonR - 1.0) < 0.05
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Vide / Air (n₁ = 1)
                </button>
                <button
                  type="button"
                  onClick={() => onWaveChange({ ...wave, medium1EpsilonR: 2.25 })}
                  className={`py-1.5 px-2 rounded-md text-[11px] font-medium border transition-colors ${
                    Math.abs(wave.medium1EpsilonR - 2.25) < 0.05
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Verre (n₁ = 1,5)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs gap-2">
                <label htmlFor="incidence-angle" className="text-slate-300 font-medium flex items-center">
                  Angle d&apos;incidence (θi)
                  <ParamTooltip
                    title="Lois de Descartes & Brewster"
                    explanation="Mesuré par rapport à la normale au dioptre (0° à 85°). En mode TM, Γ s'annule à l'angle de Brewster θB = arctan(n₂/n₁). Si n₁ > n₂, réflexion totale pour θi > θl."
                    formula="n_1\sin\theta_i = n_2\sin\theta_t"
                  />
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    aria-label="Valeur numérique de l'angle d'incidence en degrés"
                    min={0}
                    max={85}
                    step={1}
                    value={Math.round(wave.incidenceAngleDeg)}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      if (!Number.isNaN(parsed)) {
                        onWaveChange({
                          ...wave,
                          incidenceAngleDeg: Math.max(0, Math.min(85, parsed)),
                        });
                      }
                    }}
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-400"
                  />
                  <span className="font-mono text-xs text-cyan-300 font-semibold">°</span>
                </div>
              </div>
              <input
                id="incidence-angle"
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
              <div className="flex items-center gap-1">
                {[0, 30, 45, 60, 75].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => onWaveChange({ ...wave, incidenceAngleDeg: deg })}
                    className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      Math.round(wave.incidenceAngleDeg) === deg
                        ? 'bg-cyan-500/20 border-cyan-500/70 text-cyan-200 font-semibold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                <span className="text-slate-400">
                  θr = <b className="text-rose-300">{wave.incidenceAngleDeg.toFixed(0)}°</b>
                </span>
                <span className={params.isTotalInternalReflection ? 'text-rose-300 font-semibold' : 'text-emerald-300'}>
                  {material.isPEC
                    ? 'PEC : θt = —'
                    : params.isTotalInternalReflection
                      ? 'Réflexion totale (évanescent)'
                      : `θt = ${params.thetaTDeg.toFixed(1)}°`}
                </span>
              </div>
              {params.brewsterDeg !== null && (
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onWaveChange({
                        ...wave,
                        guidedMode: 'TM',
                        incidenceAngleDeg: Math.round(params.brewsterDeg!),
                      })
                    }
                    className="text-[11px] text-amber-300 hover:text-amber-200 underline underline-offset-2"
                  >
                    Aller à θB = {params.brewsterDeg.toFixed(1)}°
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
                      className="text-[11px] text-rose-300 hover:text-rose-200 underline underline-offset-2"
                    >
                      Tester TIR (&gt; {params.thetaLimitDeg.toFixed(1)}°)
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 block">Type d&apos;onde source</span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'rectiligne', label: 'Rectiligne' },
                    { id: 'circulaire', label: 'Circulaire' },
                    { id: 'source_surfacique', label: 'Nappe js' },
                  ] as const
                ).map((pol) => (
                  <button
                    key={pol.id}
                    type="button"
                    onClick={() => onWaveChange({ ...wave, polarization: pol.id })}
                    className={`py-1 px-1.5 rounded text-[11px] font-medium border transition-colors ${
                      wave.polarization === pol.id
                        ? 'bg-slate-800 border-indigo-400 text-indigo-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pol.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Paramètres guide d'ondes TE / TM */}
        {wave.boundaryModel === 'guide_ondes' && (
          <div className="bg-slate-900/60 p-3 rounded-lg border border-cyan-900/50 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Fréquence de coupure fc</span>
              <span
                className={`font-mono font-semibold ${
                  params.isCutoff ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {fcGHz.toFixed(3)} GHz ({params.isCutoff ? 'Coupure' : 'Propagatif'})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="guide-a">Largeur a</label>
                  <span className="font-mono text-cyan-300">{(wave.guideA * 100).toFixed(1)} cm</span>
                </div>
                <input
                  id="guide-a"
                  type="range"
                  min="0.04"
                  max="0.24"
                  step="0.01"
                  value={wave.guideA}
                  onChange={(e) =>
                    onWaveChange({ ...wave, guideA: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="guide-b">Hauteur b</label>
                  <span className="font-mono text-cyan-300">{(wave.guideB * 100).toFixed(1)} cm</span>
                </div>
                <input
                  id="guide-b"
                  type="range"
                  min="0.02"
                  max="0.16"
                  step="0.01"
                  value={wave.guideB}
                  onChange={(e) =>
                    onWaveChange({ ...wave, guideB: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800">
                <span className="text-slate-300">Indice m</span>
                <select
                  value={wave.modeM}
                  onChange={(e) => onWaveChange({ ...wave, modeM: parseInt(e.target.value, 10) })}
                  className="bg-transparent font-mono text-cyan-300 font-semibold focus:outline-none"
                >
                  {[0, 1, 2, 3].map((v) => (
                    <option key={v} value={v} className="bg-slate-900">
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800">
                <span className="text-slate-300">Indice n</span>
                <select
                  value={wave.modeN}
                  onChange={(e) => onWaveChange({ ...wave, modeN: parseInt(e.target.value, 10) })}
                  className="bg-transparent font-mono text-cyan-300 font-semibold focus:outline-none"
                >
                  {[0, 1, 2].map((v) => (
                    <option key={v} value={v} className="bg-slate-900">
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Fréquence f & Amplitude E0 */}
        <div className="grid grid-cols-1 gap-2.5">
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs">
              <label htmlFor="wave-freq" className="text-slate-300 font-medium">
                Fréquence (f)
              </label>
              <span className="font-mono text-cyan-300 font-semibold">
                {wave.frequency.toFixed(2)} GHz
              </span>
            </div>
            <input
              id="wave-freq"
              type="range"
              min="0.25"
              max="10.0"
              step="0.05"
              value={wave.frequency}
              onChange={(e) =>
                onWaveChange({ ...wave, frequency: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <div className="flex justify-between text-xs">
              <label htmlFor="wave-amp" className="text-slate-300 font-medium">
                Amplitude E₀
              </label>
              <span className="font-mono text-cyan-300 font-semibold">
                {wave.amplitude.toFixed(2)} V/m
              </span>
            </div>
            <input
              id="wave-amp"
              type="range"
              min="0.4"
              max="2.2"
              step="0.1"
              value={wave.amplitude}
              onChange={(e) =>
                onWaveChange({ ...wave, amplitude: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </section>

      {/* SECTION 2 : Milieu 2 & Géométrie de la Barrière */}
      <section className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
          <Box className="w-4 h-4 text-cyan-400" />
          <span>Milieu 2 &amp; Géométrie de paroi</span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="material-select" className="text-[11px] text-slate-400 block">
            Matériau du dioptre (Milieu 2)
          </label>
          <select
            id="material-select"
            value={material.id}
            onChange={(e) => {
              const found = MATERIAL_PRESETS.find((m) => m.id === e.target.value);
              if (found) onMaterialChange(found);
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            {MATERIAL_PRESETS.map((mat) => (
              <option key={mat.id} value={mat.id} className="bg-slate-900">
                {mat.name} ({mat.isPEC ? 'PEC σ→∞' : mat.isConductor ? `σ=${mat.conductivity.toExponential(1)}` : `εr=${mat.epsilonR}, tanδ=${mat.lossTangent}`})
              </option>
            ))}
            {material.id === 'custom' && (
              <option value="custom" className="bg-slate-900">
                Personnalisé (εr={material.epsilonR.toFixed(2)}, tanδ={material.lossTangent.toFixed(3)})
              </option>
            )}
          </select>
          <p className="text-[11px] text-slate-400 leading-snug">{material.description}</p>

          {!material.isPEC && !material.isConductor && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="custom-eps">εr personnalisé</label>
                  <span className="font-mono text-cyan-300">{material.epsilonR.toFixed(2)}</span>
                </div>
                <input
                  id="custom-eps"
                  type="range"
                  min="1.0"
                  max="12.0"
                  step="0.05"
                  value={material.epsilonR}
                  onChange={(e) => {
                    const epsilonR = parseFloat(e.target.value);
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
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <label htmlFor="custom-tand">tan δ</label>
                  <span className="font-mono text-cyan-300">{material.lossTangent.toFixed(3)}</span>
                </div>
                <input
                  id="custom-tand"
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.005"
                  value={Math.min(0.5, material.lossTangent)}
                  onChange={(e) => {
                    const lossTangent = parseFloat(e.target.value);
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
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-select" className="text-[11px] text-slate-400 block">
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
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
          >
            {textureProfiles.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="wall-thick">Épaisseur e</label>
              <span className="font-mono text-cyan-300">{wall.thickness.toFixed(1)} m</span>
            </div>
            <input
              id="wall-thick"
              type="range"
              min="0.6"
              max="5.0"
              step="0.2"
              value={wall.thickness}
              onChange={(e) =>
                onWallChange({ ...wall, thickness: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="wall-depth">Relief h</label>
              <span className="font-mono text-cyan-300">{wall.textureDepth.toFixed(1)} m</span>
            </div>
            <input
              id="wall-depth"
              type="range"
              min="0.0"
              max="2.2"
              step="0.1"
              value={wall.textureDepth}
              onChange={(e) =>
                onWallChange({ ...wall, textureDepth: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="wall-period">Pas Λ</label>
              <span className="font-mono text-cyan-300">{wall.texturePeriod.toFixed(1)} m</span>
            </div>
            <input
              id="wall-period"
              type="range"
              min="1.0"
              max="6.0"
              step="0.2"
              value={wall.texturePeriod}
              onChange={(e) =>
                onWallChange({ ...wall, texturePeriod: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <label htmlFor="wall-height">Hauteur H</label>
              <span className="font-mono text-cyan-300">{wall.height.toFixed(1)} m</span>
            </div>
            <input
              id="wall-height"
              type="range"
              min="1.6"
              max="6.0"
              step="0.2"
              value={wall.height}
              onChange={(e) =>
                onWallChange({ ...wall, height: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        {/* Couches d'affichage 3D */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, showSurface: !simulation.showSurface })
            }
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors ${
              simulation.showSurface
                ? 'bg-slate-800 border-cyan-500/70 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Nappe E(x,z)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, showVectors: !simulation.showVectors })
            }
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors ${
              simulation.showVectors
                ? 'bg-slate-800 border-cyan-500/70 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Vecteurs &lt;S&gt;</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, showRays: !simulation.showRays })
            }
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors ${
              simulation.showRays
                ? 'bg-slate-800 border-emerald-500/70 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>Rayons θi/θt</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, showEnvelope: !simulation.showEnvelope })
            }
            className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors ${
              simulation.showEnvelope
                ? 'bg-slate-800 border-amber-500/70 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>Enveloppe |E|</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, showTrihedron: !simulation.showTrihedron })
            }
            className={`col-span-2 py-1.5 px-2 rounded-lg text-[11px] font-medium border flex items-center justify-center gap-1.5 transition-colors ${
              simulation.showTrihedron
                ? 'bg-slate-800 border-indigo-400/70 text-indigo-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <span>Trièdre (E, H, k) sur Sonde 1</span>
          </button>
        </div>
      </section>

      {/* SECTION 3 : Équations KaTeX en direct */}
      <KatexEquations wave={wave} wall={wall} material={material} probe={probe} />
    </aside>
  );
};
