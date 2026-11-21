// Niveaux et comptes de démonstration : petites constantes utilisées par les pages, sans les données de démo
// (seed.js), pour que la première page reste légère.

// Niveaux, dans l'ordre d'affichage (menus, cases à cocher, filtres)
export const LEVELS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Prépa 1', 'Prépa 2']
// Noms affichés des niveaux
export const LEVEL_NAMES = { L1: 'Licence 1', L2: 'Licence 2', L3: 'Licence 3', M1: 'Master 1', M2: 'Master 2', 'Prépa 1': 'Prépa 1 (MP2I)', 'Prépa 2': 'Prépa 2 (MPI)' }

export const DEMO_ACCOUNTS = [
  { role: 'admin', login: 'ADM001', password: 'Admin2026!', label: 'Administrateur' },
  { role: 'teacher', login: 'ENS001', password: 'Prof2026!', label: 'Enseignant' },
  { role: 'proctor', login: 'SUR001', password: 'Surv2026!', label: 'Surveillant' },
  { role: 'educator', login: 'EDU001', password: 'Educ2026!', label: 'Éducateur' },
  { role: 'pedagogy', login: 'DIR001', password: 'Direction2026!', label: 'Direction pédagogique' },
  { role: 'student', login: 'ETU24001', password: 'Etudiant2026!', label: 'Étudiant' },
  { role: 'student', login: 'ETU24006', password: 'Provisoire1', label: 'Étudiant (1re connexion)' },
]
