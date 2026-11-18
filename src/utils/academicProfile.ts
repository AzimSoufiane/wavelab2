import { AcademicProfile } from '../types';

const ACADEMIC_STORAGE_KEY = 'wavelab_ensa_m115_academic_profile';

export const DEFAULT_ACADEMIC_PROFILE: AcademicProfile = {
  studentName: 'AZIM Soufiane',
  studentId: '',
  studentClass: 'GSR1-S1',
  studentEmail: 'soufianeazim.academic@gmail.com',
  teacherName: '',
  teacherTitle: 'Enseignant / Encadrant',
  teacherDepartment: 'Génie des Systèmes et Réseaux',
  teacherEmail: '',
  institution: 'ENSA Tanger',
  moduleName: 'Mod-M115 : Propagation dans les milieux',
};

export function loadAcademicProfile(): AcademicProfile {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_ACADEMIC_PROFILE };
    }
    const raw = window.localStorage.getItem(ACADEMIC_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACADEMIC_PROFILE };
    const parsed = JSON.parse(raw) as Partial<AcademicProfile>;
    return {
      ...DEFAULT_ACADEMIC_PROFILE,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_ACADEMIC_PROFILE };
  }
}

export function saveAcademicProfile(profile: AcademicProfile): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch (err) {
    console.error('Erreur lors de la sauvegarde du profil académique', err);
  }
}
