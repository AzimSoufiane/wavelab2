import React, { useState, useEffect, useRef } from 'react';
import { Button, Glass, Input, Menu, SegmentedControl } from 'glisse';
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
  X,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedPresets(loadPresetsFromLocalStorage());
  }, []);

  useEffect(() => {
    if (!showSavedModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSavedModal(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSavedModal]);

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

          <Glass className="flex items-center gap-2.5 pl-3 pr-2 h-10 rounded-full min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Waves className="w-4 h-4 text-[var(--app-accent)]" />
              <span className="font-semibold text-[13px] text-[var(--text-primary)] tracking-tight">
                WaveLab 3D
              </span>
              <span className="hidden xl:inline text-[11px] text-[var(--text-muted)] font-mono">
                · {academicProfile.institution}
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-[var(--hairline-strong)] shrink-0" aria-hidden="true" />

            <label htmlFor="preset-selector" className="sr-only">
              Scénario pédagogique Mod-M115
            </label>
            <div className="relative flex items-center min-w-0">
              <select
                id="preset-selector"
                value={selectedPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="appearance-none w-[150px] sm:w-[214px] md:w-[234px] pr-5 bg-transparent text-xs text-[var(--text-primary)] font-medium focus:outline-none cursor-pointer truncate"
              >
                <option value="dielectric_barrier" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Ch. 1/3 : Dioptre Polystyrène
                </option>
                <option value="brewster_tm" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Ch. 1 : Angle de Brewster TM
                </option>
                <option value="glass_air_tir" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Ch. 1 : Verre → Air (TIR)
                </option>
                <option value="pec_standing" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Ch. 2/3 : Conducteur Parfait (PEC)
                </option>
                <option value="copper_conductor" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Ch. 2 : Cuivre Réel 10 GHz
                </option>
                <option value="cavity_slot" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Réseau à Fentes (« Col d’air »)
                </option>
                <option value="te10_propagating" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Guide TE10 Propagatif (f &gt; fc)
                </option>
                <option value="cutoff_evanescent" className="bg-[var(--surface-option)] text-[var(--text-primary)]">
                  Guide sous Coupure (Évanescent)
                </option>
              </select>
              <ChevronDown
                className="w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none absolute right-0.5"
                aria-hidden="true"
              />
            </div>
          </Glass>
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

          <div className="hidden md:inline-flex">
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
                label: 'Avancer d’un pas',
                icon: <StepForward className="w-4 h-4" />,
                onSelect: () =>
                  onSimulationChange({
                    ...simulation,
                    isPlaying: false,
                    time: simulation.time + 0.05,
                  }),
              },
              {
                label: 'Présélections',
                icon: <Bookmark className="w-4 h-4" />,
                onSelect: () => setShowSavedModal(true),
              },
              'separator',
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
            ]}
          />
        </div>
      </header>

      {/* Vitesse de simulation : contrôle Glisse glissable (SegmentedControl) */}
      <div
        role="group"
        aria-label="Contrôle de vitesse de simulation"
        className="fixed top-[58px] left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-3 z-20 pointer-events-auto flex items-center gap-1.5 select-none"
      >
        <Glass
          className="h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] whitespace-nowrap"
          title="Glisser sur la barre pour ajuster la vitesse"
        >
          <Gauge className="w-3.5 h-3.5 text-[var(--app-accent)] shrink-0" />
          <span className="hidden sm:inline">Vitesse</span>
        </Glass>

        <SegmentedControl
          aria-label="Vitesse de simulation"
          className="speed-segmented"
          title="Glisser ou cliquer pour changer la vitesse de simulation"
          value={String(simulation.speed)}
          onValueChange={(val) =>
            onSimulationChange({ ...simulation, speed: parseFloat(val) })
          }
          items={speeds.map((spd) => ({
            value: String(spd),
            label: `${spd}×`,
          }))}
        />
      </div>

      {toastMessage && (
        <Glass
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[var(--text-primary)]"
        >
          <Check className="w-4 h-4 text-[var(--app-accent)]" />
          <span>{toastMessage}</span>
        </Glass>
      )}

      {showSavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestion des présélections"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSavedModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-scrim)] backdrop-blur-xs p-4"
        >
          <Glass className="w-full max-w-md lg-modal-glass rounded-2xl p-5 sm:p-6 space-y-4 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--hairline-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--app-accent-soft)] border border-[var(--app-accent-border)] flex items-center justify-center shrink-0">
                  <Bookmark className="w-4 h-4 text-[var(--app-accent)]" />
                </div>
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  Configurations enregistrées
                </h3>
              </div>
              <Button
                icon={<X className="w-4 h-4" />}
                aria-label="Fermer la fenêtre"
                onClick={() => setShowSavedModal(false)}
                className="lg-btn-compact-icon"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="preset-name-input" className="text-xs font-medium text-[var(--text-secondary)] block">
                Nommer la configuration courante
              </label>
              <div className="flex gap-2">
                <Input
                  id="preset-name-input"
                  type="text"
                  placeholder="Ex: TP M115 Mesure ROS Dioptre"
                  value={saveNameInput}
                  onValueChange={setSaveNameInput}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveState()}
                  className="flex-1 lg-input-compact"
                />
                <Button
                  variant="filled"
                  onClick={handleSaveState}
                  className="lg-btn-compact-md font-semibold"
                >
                  Enregistrer
                </Button>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-[var(--hairline-subtle)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                  <span>Sauvegardes ({savedPresets.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                  <Button
                    icon={<Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />}
                    onClick={() => fileInputRef.current?.click()}
                    className="lg-btn-compact font-medium"
                  >
                    Importer
                  </Button>
                  <Button
                    icon={<Download className="w-3.5 h-3.5 text-[var(--app-accent)]" />}
                    onClick={handleExportJson}
                    className="lg-btn-compact font-medium"
                  >
                    Exporter
                  </Button>
                </div>
              </div>

              {savedPresets.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4 border-y border-[var(--hairline-subtle)] text-center">
                  Aucune configuration enregistrée.
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-[var(--hairline-subtle)] border-y border-[var(--hairline-subtle)] pr-1">
                  {savedPresets.map((p) => (
                    <div
                      key={p.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--text-primary)] truncate">{p.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                          f={p.wave.frequency}GHz · {p.wave.guidedMode} · {p.materialId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="filled"
                          onClick={() => {
                            onLoadSavedPreset(p);
                            setShowSavedModal(false);
                            showToast(`Configuration « ${p.name} » chargée.`);
                          }}
                          className="lg-btn-compact font-semibold"
                        >
                          Charger
                        </Button>
                        <Button
                          destructive
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          aria-label={`Supprimer ${p.name}`}
                          onClick={() => handleDeletePreset(p.id, p.name)}
                          className="lg-btn-compact-icon"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Glass>
        </div>
      )}
    </>
  );
});
HeaderBar.displayName = 'HeaderBar';
