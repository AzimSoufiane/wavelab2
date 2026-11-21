import React, { useEffect, useState } from 'react';
import { Button, Glass, Input } from 'glisse';
import { AcademicProfile } from '../types';
import {
  CONSTANT_INSTRUCTOR_NAME,
  DEFAULT_ACADEMIC_PROFILE,
} from '../utils/academicProfile';
import { GraduationCap, User, BookOpen, RotateCcw, Lock, X } from 'lucide-react';

interface AcademicProfileModalProps {
  isOpen: boolean;
  profile: AcademicProfile;
  onClose: () => void;
  onSave: (updated: AcademicProfile) => void;
}

export const AcademicProfileModal: React.FC<AcademicProfileModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<AcademicProfile>(profile);

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draft,
      studentName: draft.studentName.trim(),
      studentId: draft.studentId.trim(),
      studentClass: draft.studentClass.trim(),
      studentEmail: draft.studentEmail.trim(),
      teacherName: CONSTANT_INSTRUCTOR_NAME,
      teacherTitle: draft.teacherTitle.trim(),
      teacherDepartment: draft.teacherDepartment.trim(),
      teacherEmail: draft.teacherEmail.trim(),
      institution: draft.institution.trim() || DEFAULT_ACADEMIC_PROFILE.institution,
      moduleName: draft.moduleName.trim() || DEFAULT_ACADEMIC_PROFILE.moduleName,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Informations étudiant et enseignant"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-scrim)] backdrop-blur-xs p-4"
    >
      <Glass className="w-full max-w-2xl max-h-[90vh] overflow-y-auto lg-modal-glass rounded-2xl p-5 sm:p-6 text-[var(--text-primary)]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--hairline-subtle)] pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--app-accent-soft)] border border-[var(--app-accent-border)] flex items-center justify-center shrink-0">
                <GraduationCap className="w-4.5 h-4.5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-[var(--text-primary)] text-balance">
                  Informations Étudiant &amp; Enseignant
                </h3>
                <p className="text-[11.5px] text-[var(--text-muted)]">
                  Affichées dans l&apos;interface et intégrées automatiquement dans le rapport PDF.
                </p>
              </div>
            </div>
            <Button
              type="button"
              icon={<X className="w-4 h-4" />}
              aria-label="Fermer la fenêtre des informations académiques"
              onClick={onClose}
              className="lg-btn-compact-icon shrink-0"
            />
          </div>

        {/* Single-elevation architectural layout separated by hairline dividers */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-subtle)] gap-y-5 md:gap-y-0">
          {/* Colonne Étudiant */}
          <div className="pb-4 md:pb-0 md:pr-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-accent)]">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Mes informations (Étudiant)</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-student-name" className="text-[11px] text-[var(--text-secondary)] block">
                Nom &amp; Prénom
              </label>
              <Input
                id="acad-student-name"
                type="text"
                placeholder="Ex: AZIM Soufiane"
                value={draft.studentName}
                onValueChange={(val) => setDraft({ ...draft, studentName: val })}
                className="w-full lg-input-compact"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="acad-student-class" className="text-[11px] text-[var(--text-secondary)] block">
                  Filière / Groupe
                </label>
                <Input
                  id="acad-student-class"
                  type="text"
                  placeholder="Ex: GSR1-S1"
                  value={draft.studentClass}
                  onValueChange={(val) => setDraft({ ...draft, studentClass: val })}
                  className="w-full lg-input-compact"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="acad-student-id" className="text-[11px] text-[var(--text-secondary)] block">
                  CNE / Code Apogée
                </label>
                <Input
                  id="acad-student-id"
                  type="text"
                  placeholder="Ex: P123456789"
                  value={draft.studentId}
                  onValueChange={(val) => setDraft({ ...draft, studentId: val })}
                  className="w-full lg-input-compact font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-student-email" className="text-[11px] text-[var(--text-secondary)] block">
                Email académique
              </label>
              <Input
                id="acad-student-email"
                type="email"
                placeholder="prenom.nom@etu.uae.ac.ma"
                value={draft.studentEmail}
                onValueChange={(val) => setDraft({ ...draft, studentEmail: val })}
                className="w-full lg-input-compact"
              />
            </div>
          </div>

          {/* Colonne Enseignant */}
          <div className="pt-4 md:pt-0 md:pl-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-accent)]">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>Informations de l&apos;enseignant(e)</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="acad-teacher-name" className="text-[11px] text-[var(--text-secondary)]">
                  Nom de l&apos;enseignant(e) / Encadrant(e)
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)]">
                  <Lock className="w-3 h-3 text-[var(--app-accent)]" />
                  <span>Constante</span>
                </span>
              </div>
              <Input
                id="acad-teacher-name"
                type="text"
                readOnly
                disabled
                aria-readonly="true"
                value={CONSTANT_INSTRUCTOR_NAME || 'À définir (constante verrouillée)'}
                className="w-full lg-input-compact lg-input-locked"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="acad-teacher-title" className="text-[11px] text-[var(--text-secondary)] block">
                  Titre / Grade
                </label>
                <Input
                  id="acad-teacher-title"
                  type="text"
                  placeholder="Ex: Professeur"
                  value={draft.teacherTitle}
                  onValueChange={(val) => setDraft({ ...draft, teacherTitle: val })}
                  className="w-full lg-input-compact"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="acad-teacher-dept" className="text-[11px] text-[var(--text-secondary)] block">
                  Département
                </label>
                <Input
                  id="acad-teacher-dept"
                  type="text"
                  placeholder="Ex: GSR / TIC"
                  value={draft.teacherDepartment}
                  onValueChange={(val) => setDraft({ ...draft, teacherDepartment: val })}
                  className="w-full lg-input-compact"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-teacher-email" className="text-[11px] text-[var(--text-secondary)] block">
                Email de l&apos;enseignant(e)
              </label>
              <Input
                id="acad-teacher-email"
                type="email"
                placeholder="enseignant@uae.ac.ma"
                value={draft.teacherEmail}
                onValueChange={(val) => setDraft({ ...draft, teacherEmail: val })}
                className="w-full lg-input-compact"
              />
            </div>
          </div>
        </div>

        {/* Établissement & Module (hairline-separated row) */}
        <div className="pt-4 border-t border-[var(--hairline-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="acad-institution" className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[var(--app-accent)]" />
              <span>Établissement</span>
            </label>
            <Input
              id="acad-institution"
              type="text"
              placeholder="ENSA Tanger"
              value={draft.institution}
              onValueChange={(val) => setDraft({ ...draft, institution: val })}
              className="w-full lg-input-compact"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="acad-module" className="text-[11px] text-[var(--text-secondary)] block">
              Module / Intitulé du TP
            </label>
            <Input
              id="acad-module"
              type="text"
              placeholder="Mod-M115 : Propagation dans les milieux"
              value={draft.moduleName}
              onValueChange={(val) => setDraft({ ...draft, moduleName: val })}
              className="w-full lg-input-compact"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--hairline-subtle)]">
          <Button
            type="button"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setDraft({ ...DEFAULT_ACADEMIC_PROFILE })}
            className="lg-btn-compact-md font-medium"
          >
            Réinitialiser
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onClose}
              className="lg-btn-compact-md font-medium"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="filled"
              className="lg-btn-compact-md font-semibold"
            >
              Enregistrer
            </Button>
          </div>
        </div>
        </form>
      </Glass>
    </div>
  );
};
