import React, { useState, useEffect } from 'react';
import { Button, Menu, SegmentedControl } from 'glisse';
import {
  AcademicProfile,
  SimulationState,
  WallGeometry,
  MaterialPreset,
  WaveConfig,
  DualProbeState,
  CameraMode,
} from '../types';
import { MATERIAL_PRESETS } from '../physics/waveEngine';
import {
  savePresetToLocalStorage,
  loadPresetsFromLocalStorage,
  exportOscilloscopeDataToCsv,
  serializeStateToUrl,
  SavedPreset,
} from '../utils/exportUtils';
import { exportSimulationPdfReport } from '../utils/pdfReport';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  SlidersHorizontal,
  ChevronDown,
  Waves,
  Download,
  FileText,
  Share2,
  Bookmark,
  Check,
  FolderOpen,
  Trash2,
  Upload,
  GraduationCap,
  MoreHorizontal,
  Gauge,
} from 'lucide-react';

interface HeaderBarProps {
  simulation: SimulationState;
  onSimulationChange: (sim: SimulationState) => void;
  onApplyPreset: (
    presetName: string,
    wall: WallGeometry,
    material: MaterialPreset,
    wave: WaveConfig
  ) => void;
  sheetExpanded: boolean;
  onToggleSheet: () => void;
  wave: WaveConfig;
  wall: WallGeometry;
  material: MaterialPreset;
  probeRef: React.RefObject<DualProbeState>;
  onLoadSavedPreset: (preset: SavedPreset) => void;
  academicProfile: AcademicProfile;
  onOpenAcademicModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = React.memo(({
  simulation,
  onSimulationChange,
  onApplyPreset,
  sheetExpanded,
  onToggleSheet,
  wave,
  wall,
  material,
  probeRef,
  onLoadSavedPreset,
  academicProfile,
  onOpenAcademicModal,
}) => {
  const speeds = [0.25, 0.5, 1.0, 1.5, 2.0];
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('dielectric_barrier');

  useEffect(() => {
    setSavedPresets(loadPresetsFromLocalStorage());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleExportCsv = () => {
    exportOscilloscopeDataToCsv(probeRef.current, wave, wall, material);
    showToast('Données CSV téléchargées.');
  };

  const handleExportPdf = () => {
    try {
      exportSimulationPdfReport(wave, wall, material, probeRef.current, simulation, academicProfile);
      showToast('Rapport PDF généré et téléchargé.');
    } catch (err) {
      console.error('Erreur lors de la génération du rapport PDF', err);
      showToast('Erreur lors de la génération du rapport PDF.');
    }
  };

  const handleShareLink = async () => {
    const shareableUrl = serializeStateToUrl(wave, wall, material, probeRef.current);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareableUrl);
        showToast('Lien de simulation copié.');
      } else {
        window.history.replaceState(null, '', shareableUrl);
        showToast('URL mise à jour dans la barre d’adresse.');
      }
    } catch {
      window.history.replaceState(null, '', shareableUrl);
      showToast('URL mise à jour dans la barre d’adresse.');
    }
  };

  const handleSaveState = () => {
    const defaultName = `TP M115 ${new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const name = saveNameInput.trim() || defaultName;
    const updated = savePresetToLocalStorage(name, wave, wall, material, probeRef.current);
    setSavedPresets(updated);
    setSaveNameInput('');
    setShowSavedModal(false);
    showToast(`Configuration « ${name} » enregistrée.`);
  };

  const handleDeletePreset = (id: string, name: string) => {
    const updated = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem('wavelab_ensa_m115_saved_presets', JSON.stringify(updated));
    showToast(`Configuration « ${name} » supprimée.`);
  };

  const handleExportJson = () => {
    if (savedPresets.length === 0) {
      showToast('Aucune configuration enregistrée à exporter.');
      return;
    }
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(savedPresets, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `wavelab_presets_${Date.now()}.json`);
    dlAnchorElem.click();
    showToast('Configurations exportées en JSON.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const merged = [...parsed, ...savedPresets].slice(0, 15);
            setSavedPresets(merged);
            localStorage.setItem('wavelab_ensa_m115_saved_presets', JSON.stringify(merged));
            showToast(`${parsed.length} configurations importées.`);
          }
        } catch {
          showToast('Erreur : fichier JSON invalide.');
        }
      };
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey);
    switch (presetKey) {
      case 'dielectric_barrier':
        onApplyPreset(
          'Dioptre Polystyrène (Ch. 1 & 3)',
          {
            textureProfile: 'circulaire',
            thickness: 2.0,
            textureDepth: 0.6,
            texturePeriod: 2.4,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[0],
          {
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
          }
        );
        break;

      case 'brewster_tm':
        onApplyPreset(
          'Angle de Brewster TM (θB ≈ 57,9°)',
          {
            textureProfile: 'rectangulaire',
            thickness: 2.4,
            textureDepth: 0.0,
            texturePeriod: 2.0,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[0],
          {
            frequency: 1.1,
            amplitude: 1.3,
            guidedMode: 'TM',
            guideA: 0.12,
            guideB: 0.06,
            modeM: 1,
            modeN: 0,
            polarization: 'rectiligne',
            incidenceAngleDeg: 58,
            medium1EpsilonR: 1.0,
            boundaryModel: 'dioptre_semi_infini',
            waveSpeedC: 4.0,
          }
        );
        break;

      case 'glass_air_tir':
        onApplyPreset(
          'Dioptre Verre → Air · Réflexion Totale (θi > θl)',
          {
            textureProfile: 'rectangulaire',
            thickness: 2.6,
            textureDepth: 0.0,
            texturePeriod: 2.0,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[2],
          {
            frequency: 1.0,
            amplitude: 1.3,
            guidedMode: 'TE',
            guideA: 0.12,
            guideB: 0.06,
            modeM: 1,
            modeN: 0,
            polarization: 'rectiligne',
            incidenceAngleDeg: 52,
            medium1EpsilonR: 2.25,
            boundaryModel: 'dioptre_semi_infini',
            waveSpeedC: 4.0,
          }
        );
        break;

      case 'pec_standing':
        onApplyPreset(
          'Conducteur Parfait (PEC · Onde Stationnaire Pure)',
          {
            textureProfile: 'rectangulaire',
            thickness: 1.6,
            textureDepth: 0.0,
            texturePeriod: 2.0,
            posX: 0,
            height: 3.0,
          },
          MATERIAL_PRESETS[3],
          {
            frequency: 1.0,
            amplitude: 1.2,
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
          }
        );
        break;

      case 'copper_conductor':
        onApplyPreset(
          'Cuivre Réel à 10 GHz (Exercice 3 · δs ≈ 0,66 µm)',
          {
            textureProfile: 'rectangulaire',
            thickness: 1.6,
            textureDepth: 0.0,
            texturePeriod: 2.0,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[5],
          {
            frequency: 10.0,
            amplitude: 1.2,
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
          }
        );
        break;

      case 'cavity_slot':
        onApplyPreset(
          'Fentes & Cavités d’air (« Col d’air »)',
          {
            textureProfile: 'fentes_cavites',
            thickness: 2.2,
            textureDepth: 1.0,
            texturePeriod: 2.8,
            posX: 0,
            height: 2.5,
          },
          MATERIAL_PRESETS[1],
          {
            frequency: 1.2,
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
          }
        );
        break;

      case 'te10_propagating':
        onApplyPreset(
          'Guide d’Ondes TE10 (Propagatif, f > fc)',
          {
            textureProfile: 'rectangulaire',
            thickness: 2.2,
            textureDepth: 0.5,
            texturePeriod: 2.0,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[0],
          {
            frequency: 1.8,
            amplitude: 1.4,
            guidedMode: 'TE',
            guideA: 0.12,
            guideB: 0.06,
            modeM: 1,
            modeN: 0,
            polarization: 'rectiligne',
            incidenceAngleDeg: 0,
            medium1EpsilonR: 1.0,
            boundaryModel: 'guide_ondes',
            waveSpeedC: 4.0,
          }
        );
        break;

      case 'cutoff_evanescent':
        onApplyPreset(
          'Guide sous Coupure (Onde Évanescente, f < fc)',
          {
            textureProfile: 'rectangulaire',
            thickness: 2.6,
            textureDepth: 0.5,
            texturePeriod: 2.0,
            posX: 0,
            height: 2.8,
          },
          MATERIAL_PRESETS[0],
          {
            frequency: 0.45,
            amplitude: 1.5,
            guidedMode: 'TE',
            guideA: 0.08,
            guideB: 0.04,
            modeM: 1,
            modeN: 0,
            polarization: 'rectiligne',
            incidenceAngleDeg: 0,
            medium1EpsilonR: 1.0,
            boundaryModel: 'guide_ondes',
            waveSpeedC: 4.0,
          }
        );
        break;
    }
  };

  const nextSpeed = speeds[(speeds.indexOf(simulation.speed) + 1) % speeds.length];

  return (
    <>
      <header className="fixed top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between gap-2 select-none">
        {/* Zone 1 : Bouton feuille & Identité + Sélecteur scénario */}
        <div className="pointer-events-auto flex items-center gap-2 min-w-0">
          <Button
            icon={sheetExpanded ? <ChevronDown className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
            onClick={onToggleSheet}
            aria-label={sheetExpanded ? 'Réduire le panneau de paramètres' : 'Afficher le panneau de paramètres'}
            title={sheetExpanded ? 'Réduire le panneau' : 'Ouvrir les paramètres'}
          />

          <div className="flex items-center gap-2 px-3 h-10 rounded-full bottom-sheet-glass min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Waves className="w-4 h-4 text-[#0a84ff]" />
              <span className="font-semibold text-[13px] text-white tracking-tight">
                WaveLab 3D
              </span>
              <span className="hidden xl:inline text-[11px] text-slate-300/80 font-mono">
                · {academicProfile.institution}
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-white/15 shrink-0" aria-hidden="true" />

            <label htmlFor="preset-selector" className="sr-only">
              Scénario pédagogique Mod-M115
            </label>
            <select
              id="preset-selector"
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-[148px] sm:w-[210px] md:w-[230px] bg-transparent text-xs text-slate-100 font-medium focus:outline-none cursor-pointer truncate"
            >
              <option value="dielectric_barrier" className="bg-[#0b1326] text-white">
                Ch. 1/3 : Dioptre Polystyrène
              </option>
              <option value="brewster_tm" className="bg-[#0b1326] text-white">
                Ch. 1 : Angle de Brewster TM
              </option>
              <option value="glass_air_tir" className="bg-[#0b1326] text-white">
                Ch. 1 : Verre → Air (TIR)
              </option>
              <option value="pec_standing" className="bg-[#0b1326] text-white">
                Ch. 2/3 : Conducteur Parfait (PEC)
              </option>
              <option value="copper_conductor" className="bg-[#0b1326] text-white">
                Ch. 2 : Cuivre Réel 10 GHz
              </option>
              <option value="cavity_slot" className="bg-[#0b1326] text-white">
                Réseau à Fentes (« Col d’air »)
              </option>
              <option value="te10_propagating" className="bg-[#0b1326] text-white">
                Guide TE10 Propagatif (f &gt; fc)
              </option>
              <option value="cutoff_evanescent" className="bg-[#0b1326] text-white">
                Guide sous Coupure (Évanescent)
              </option>
            </select>
          </div>
        </div>

        {/* Zone 2 : Modes de vue 3D (Glisse SegmentedControl sur desktop) */}
        <div className="pointer-events-auto hidden lg:flex items-center">
          <SegmentedControl
            aria-label="Angles de vue 3D"
            value={simulation.cameraMode}
            onValueChange={(val) =>
              onSimulationChange({ ...simulation, cameraMode: val as CameraMode })
            }
            style={{ '--lg-tab-width': '62px' } as React.CSSProperties}
            items={[
              { value: 'perspective', label: '3D' },
              { value: 'top', label: 'Dessus' },
              { value: 'profile', label: 'Profil' },
              { value: 'incident', label: 'Face' },
              { value: 'isometric', label: 'Arrière' },
            ]}
          />
        </div>

        {/* Zone 3 : Actions icônes Glisse Button + Glisse Menu */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <Button
            variant={simulation.isPlaying ? 'glass' : 'filled'}
            icon={simulation.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            onClick={() =>
              onSimulationChange({ ...simulation, isPlaying: !simulation.isPlaying })
            }
            aria-label={simulation.isPlaying ? 'Mettre en pause' : 'Lancer la simulation'}
            title={simulation.isPlaying ? 'Pause' : 'Lire'}
          />

          <div className="hidden sm:inline-flex">
            <Button
              icon={<StepForward className="w-4 h-4" />}
              onClick={() =>
                onSimulationChange({
                  ...simulation,
                  isPlaying: false,
                  time: simulation.time + 0.05,
                })
              }
              aria-label="Avancer d'un pas"
              title="Pas suivant"
            />
          </div>

          <Button
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => onSimulationChange({ ...simulation, time: 0 })}
            aria-label="Réinitialiser le temps"
            title="Réinitialiser t=0"
          />

          <div className="hidden md:inline-flex">
            <Button
              icon={<Bookmark className="w-4 h-4" />}
              onClick={() => setShowSavedModal(true)}
              aria-label="Présélections enregistrées"
              title="Présélections"
            />
          </div>

          <Menu
            aria-label="Menu Infos, PDF, Partage et Export"
            align="end"
            icon={<MoreHorizontal className="w-4 h-4" />}
            items={[
              {
                label: 'Infos académiques',
                icon: <GraduationCap className="w-4 h-4" />,
                onSelect: onOpenAcademicModal,
              },
              {
                label: 'Exporter rapport PDF',
                icon: <FileText className="w-4 h-4" />,
                onSelect: handleExportPdf,
              },
              {
                label: 'Partager le lien',
                icon: <Share2 className="w-4 h-4" />,
                onSelect: handleShareLink,
              },
              {
                label: 'Exporter données CSV',
                icon: <Download className="w-4 h-4" />,
                onSelect: handleExportCsv,
              },
              'separator',
              {
                label: 'Présélections',
                icon: <Bookmark className="w-4 h-4" />,
                onSelect: () => setShowSavedModal(true),
              },
              {
                label: `Vitesse ${simulation.speed}× → ${nextSpeed}×`,
                icon: <Gauge className="w-4 h-4" />,
                onSelect: () => onSimulationChange({ ...simulation, speed: nextSpeed }),
              },
            ]}
          />
        </div>
      </header>

      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bottom-sheet-glass rounded-xl text-xs font-medium text-white"
        >
          <Check className="w-4 h-4 text-[#0a84ff]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {showSavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestion des présélections"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-md bottom-sheet-glass rounded-2xl p-5 space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#0a84ff]" />
                <h3 className="font-semibold text-sm text-slate-100">
                  Configurations enregistrées
                </h3>
              </div>
              <button
                type="button"
                aria-label="Fermer la fenêtre"
                onClick={() => setShowSavedModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="preset-name-input" className="text-xs font-medium text-slate-300 block">
                Nommer la configuration courante
              </label>
              <div className="flex gap-2">
                <input
                  id="preset-name-input"
                  type="text"
                  placeholder="Ex: TP1 Mesure ROS Dioptre"
                  value={saveNameInput}
                  onChange={(e) => setSaveNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveState()}
                  className="flex-1 bg-black/30 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0a84ff]"
                />
                <button
                  type="button"
                  onClick={handleSaveState}
                  className="px-3.5 py-1.5 bg-[#0a84ff] hover:brightness-110 text-white font-semibold rounded-lg text-xs"
                >
                  Enregistrer
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[#0a84ff]" />
                  Sauvegardes ({savedPresets.length})
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 flex items-center gap-1">
                    <Upload className="w-3 h-3 text-[#0a84ff]" />
                    Importer
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJson}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3 text-[#0a84ff]" />
                    Exporter
                  </button>
                </div>
              </div>

              {savedPresets.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 bg-black/25 rounded-lg text-center border border-white/10">
                  Aucune configuration enregistrée.
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {savedPresets.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-black/25 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div className="flex-1 mr-2 min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          f={p.wave.frequency}GHz · {p.wave.guidedMode} · {p.materialId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadSavedPreset(p);
                            setShowSavedModal(false);
                            showToast(`Configuration « ${p.name} » chargée.`);
                          }}
                          className="px-2.5 py-1 rounded bg-[#0a84ff] hover:brightness-110 text-white font-semibold text-xs transition-all"
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          aria-label={`Supprimer ${p.name}`}
                          onClick={() => handleDeletePreset(p.id, p.name)}
                          className="p-1.5 rounded bg-white/10 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 border border-white/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
HeaderBar.displayName = 'HeaderBar';
