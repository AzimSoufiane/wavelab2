import React, { useEffect, useState } from 'react';
import { AcademicProfile } from '../types';
import { DEFAULT_ACADEMIC_PROFILE } from '../utils/academicProfile';
import { GraduationCap, User, BookOpen, RotateCcw } from 'lucide-react';

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draft,
      studentName: draft.studentName.trim(),
      studentId: draft.studentId.trim(),
      studentClass: draft.studentClass.trim(),
      studentEmail: draft.studentEmail.trim(),
      teacherName: draft.teacherName.trim(),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0b1220] border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Informations Étudiant &amp; Enseignant
              </h3>
              <p className="text-[11px] text-slate-400">
                Affichées dans l&apos;interface et intégrées automatiquement dans le rapport PDF.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer la fenêtre des informations académiques"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold px-2"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bloc Étudiant */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
              <User className="w-4 h-4 text-cyan-400" />
              <span>Mes informations (Étudiant)</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-student-name" className="text-[11px] text-slate-300 block">
                Nom &amp; Prénom
              </label>
              <input
                id="acad-student-name"
                type="text"
                placeholder="Ex: AZIM Soufiane"
                value={draft.studentName}
                onChange={(e) => setDraft({ ...draft, studentName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="acad-student-class" className="text-[11px] text-slate-300 block">
                  Filière / Groupe
                </label>
                <input
                  id="acad-student-class"
                  type="text"
                  placeholder="Ex: GSR1-S1"
                  value={draft.studentClass}
                  onChange={(e) => setDraft({ ...draft, studentClass: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="acad-student-id" className="text-[11px] text-slate-300 block">
                  CNE / Code Apogée
                </label>
                <input
                  id="acad-student-id"
                  type="text"
                  placeholder="Ex: P123456789"
                  value={draft.studentId}
                  onChange={(e) => setDraft({ ...draft, studentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-student-email" className="text-[11px] text-slate-300 block">
                Email académique
              </label>
              <input
                id="acad-student-email"
                type="email"
                placeholder="prenom.nom@etu.uae.ac.ma"
                value={draft.studentEmail}
                onChange={(e) => setDraft({ ...draft, studentEmail: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Bloc Enseignant */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span>Informations de l&apos;enseignant(e)</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-teacher-name" className="text-[11px] text-slate-300 block">
                Nom de l&apos;enseignant(e) / Encadrant(e)
              </label>
              <input
                id="acad-teacher-name"
                type="text"
                placeholder="Ex: Pr. Nom Prénom"
                value={draft.teacherName}
                onChange={(e) => setDraft({ ...draft, teacherName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="acad-teacher-title" className="text-[11px] text-slate-300 block">
                  Titre / Grade
                </label>
                <input
                  id="acad-teacher-title"
                  type="text"
                  placeholder="Ex: Professeur"
                  value={draft.teacherTitle}
                  onChange={(e) => setDraft({ ...draft, teacherTitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="acad-teacher-dept" className="text-[11px] text-slate-300 block">
                  Département
                </label>
                <input
                  id="acad-teacher-dept"
                  type="text"
                  placeholder="Ex: GSR / TIC"
                  value={draft.teacherDepartment}
                  onChange={(e) => setDraft({ ...draft, teacherDepartment: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acad-teacher-email" className="text-[11px] text-slate-300 block">
                Email de l&apos;enseignant(e)
              </label>
              <input
                id="acad-teacher-email"
                type="email"
                placeholder="enseignant@uae.ac.ma"
                value={draft.teacherEmail}
                onChange={(e) => setDraft({ ...draft, teacherEmail: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Bloc Établissement & Module */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="acad-institution" className="text-[11px] text-slate-300 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Établissement</span>
            </label>
            <input
              id="acad-institution"
              type="text"
              placeholder="ENSA Tanger"
              value={draft.institution}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="acad-module" className="text-[11px] text-slate-300 block">
              Module / Intitulé du TP
            </label>
            <input
              id="acad-module"
              type="text"
              placeholder="Mod-M115 : Propagation dans les milieux"
              value={draft.moduleName}
              onChange={(e) => setDraft({ ...draft, moduleName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_ACADEMIC_PROFILE })}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
