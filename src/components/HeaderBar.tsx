import React, { useState, useEffect } from 'react';
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
  Camera,
  Layers,
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
  onToggleSidebar: () => void;
  wave: WaveConfig;
  wall: WallGeometry;
  material: MaterialPreset;
  probe: DualProbeState;
  onLoadSavedPreset: (preset: SavedPreset) => void;
  academicProfile: AcademicProfile;
  onOpenAcademicModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  simulation,
  onSimulationChange,
  onApplyPreset,
  onToggleSidebar,
  wave,
  wall,
  material,
  probe,
  onLoadSavedPreset,
  academicProfile,
  onOpenAcademicModal,
}) => {
  const speeds = [0.25, 0.5, 1.0, 1.5, 2.0];
  const cameraModes: { id: CameraMode; label: string }[] = [
    { id: 'perspective', label: 'Vue 3D' },
    { id: 'top', label: 'Dessus' },
    { id: 'profile', label: 'Profil' },
    { id: 'incident', label: 'Face Avant' },
    { id: 'isometric', label: 'Arrière 3/4' },
  ];
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
    exportOscilloscopeDataToCsv(probe, wave, wall, material);
    showToast('Données CSV téléchargées.');
  };

  const handleExportPdf = () => {
    try {
      exportSimulationPdfReport(wave, wall, material, probe, simulation, academicProfile);
      showToast('Rapport PDF généré et téléchargé.');
    } catch (err) {
      console.error('Erreur lors de la génération du rapport PDF', err);
      showToast('Erreur lors de la génération du rapport PDF.');
    }
  };

  const handleShareLink = async () => {
    const shareableUrl = serializeStateToUrl(wave, wall, material, probe);
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
    const updated = savePresetToLocalStorage(name, wave, wall, material, probe);
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
          MATERIAL_PRESETS[2], // Air
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
            medium1EpsilonR: 2.25, // Verre n1 = 1.5
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
          MATERIAL_PRESETS[3], // PEC
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
          MATERIAL_PRESETS[5], // Cuivre réel
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
          MATERIAL_PRESETS[1], // Béton
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

  return (
    <>
      <header className="w-full min-h-13 bg-[#090e1a] border-b border-slate-800 px-2.5 sm:px-4 py-1.5 flex items-center justify-between gap-2 sm:gap-4 z-30 select-none shrink-0">
        {/* Zone 1 : Bouton panneau & Identité */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Afficher ou masquer le panneau latéral"
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition-colors shrink-0"
          >
            <Layers className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-baseline gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-sm text-slate-100 tracking-tight">
                WaveLab 3D
              </span>
            </div>
            <span className="hidden md:inline text-xs text-slate-400 truncate">
              {academicProfile.institution} · Mod-M115
            </span>
          </div>
        </div>

        {/* Zone 2 : Sélecteur de scénarios pédagogiques */}
        <div className="flex-1 flex justify-center min-w-0">
          <label htmlFor="preset-selector" className="sr-only">
            Scénario pédagogique Mod-M115
          </label>
          <select
            id="preset-selector"
            value={selectedPreset}
            onChange={(e) => handlePresetSelect(e.target.value)}
            className="w-full max-w-[190px] sm:max-w-[290px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 truncate"
          >
            <option value="dielectric_barrier">Ch. 1/3 : Dioptre Polystyrène (εr=2,54)</option>
            <option value="brewster_tm">Ch. 1 : Angle de Brewster TM (θB ≈ 57,9°)</option>
            <option value="glass_air_tir">Ch. 1 : Verre → Air · Réflexion Totale</option>
            <option value="pec_standing">Ch. 2/3 : Conducteur Parfait (PEC · Γ=-1)</option>
            <option value="copper_conductor">Ch. 2 : Cuivre Réel 10 GHz (δs = 0,66 µm)</option>
            <option value="cavity_slot">Réseau à Fentes (« Col d’air »)</option>
            <option value="te10_propagating">Guide TE10 Propagatif (f &gt; fc)</option>
            <option value="cutoff_evanescent">Guide sous Coupure (Évanescent)</option>
          </select>
        </div>

        {/* Zone 3 : Outils de simulation & export */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSavedModal(true)}
            aria-label="Présélections enregistrées"
            className="hidden sm:inline-flex p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="Exporter les traces CSV"
            title="Exporter les traces CSV"
            className="hidden md:inline-flex p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenAcademicModal}
            aria-label="Informations étudiant et enseignant"
            title="Informations étudiant & enseignant"
            className="inline-flex items-center gap-1 p-2 md:px-2.5 md:py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition-colors shrink-0"
          >
            <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Infos</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            aria-label="Générer un rapport PDF"
            title="Générer un rapport PDF"
            className="inline-flex items-center gap-1 p-2 md:px-2.5 md:py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-emerald-300 transition-colors shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">PDF</span>
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            aria-label="Copier le lien de simulation"
            className="hidden md:inline-flex p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-indigo-300 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-800 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={() =>
              onSimulationChange({ ...simulation, isPlaying: !simulation.isPlaying })
            }
            aria-label={simulation.isPlaying ? 'Mettre en pause' : 'Lancer la simulation'}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              simulation.isPlaying
                ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 hover:bg-amber-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {simulation.isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Lire</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              onSimulationChange({
                ...simulation,
                isPlaying: false,
                time: simulation.time + 0.05,
              })
            }
            aria-label="Avancer d'un pas"
            className="hidden sm:inline-flex p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <StepForward className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onSimulationChange({ ...simulation, time: 0 })}
            aria-label="Réinitialiser le temps"
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="hidden xl:flex items-center gap-0.5 bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono text-[11px]">
            {speeds.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSimulationChange({ ...simulation, speed: s })}
                className={`px-1.5 py-0.5 rounded font-semibold transition-colors ${
                  simulation.speed === s
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const idx = cameraModes.findIndex((c) => c.id === simulation.cameraMode);
              const next = cameraModes[(idx + 1) % cameraModes.length];
              onSimulationChange({
                ...simulation,
                cameraMode: next.id,
              });
            }}
            aria-label="Changer d'angle de vue 3D"
            className="p-2 sm:px-2.5 sm:py-1.5 flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">
              {cameraModes.find((c) => c.id === simulation.cameraMode)?.label ?? 'Vue 3D'}
            </span>
          </button>
        </div>
      </header>

      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-[#0c1425] border border-cyan-500/70 text-cyan-200 rounded-lg shadow-xl text-xs font-medium"
        >
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {showSavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestion des présélections"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md bg-[#0b1220] border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-400" />
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
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleSaveState}
                  className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs"
                >
                  Enregistrer
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                  Sauvegardes ({savedPresets.length})
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1">
                    <Upload className="w-3 h-3 text-cyan-400" />
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
                    className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3 text-indigo-400" />
                    Exporter
                  </button>
                </div>
              </div>

              {savedPresets.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 bg-slate-900/50 rounded-lg text-center border border-slate-800">
                  Aucune configuration enregistrée.
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {savedPresets.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
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
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-semibold text-xs border border-slate-700 transition-colors"
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          aria-label={`Supprimer ${p.name}`}
                          onClick={() => handleDeletePreset(p.id, p.name)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
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
};
