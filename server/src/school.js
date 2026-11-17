// Contenu de la VRAIE base de l'école, sans aucune donnée de démonstration :
// filières, classes, semestres de l'année, et un seul compte administrateur (mot de passe provisoire).
import { randomInt } from 'node:crypto'
import { schoolStructure, STRUCTURE_VERSION } from '../../esatic/src/api/seed.js'

const clean = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Mot de passe provisoire : 14 lettres sans caractères ambigus (0/O, 1/l), puis un chiffre
export function temporaryPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 14 }, () => chars[randomInt(chars.length)]).join('') + randomInt(10)
}

export async function buildSchoolData({ matricule, firstName, lastName, email }, password, hash, today = new Date()) {
  const year = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1
  const academicYear = `${year}-${year + 1}`
  const { filieres, classes } = schoolStructure(academicYear)
  const now = today.toISOString()
  return {
    version: 1,
    school: {
      id: 1, name: 'École Supérieure Africaine des TIC', shortName: 'ESATIC', city: 'Abidjan', demo: false,
      settings: { academicYear, autosaveSeconds: 25, singleSession: true, showRank: false, sebDefault: false, passwordMinLength: 8 },
    },
    filieres,
    classes,
    matieres: [],
    periodes: [
      { id: 1, schoolId: 1, name: 'Semestre 1', start: `${year}-10-01`, end: `${year + 1}-02-15`, active: true },
      { id: 2, schoolId: 1, name: 'Semestre 2', start: `${year + 1}-02-16`, end: `${year + 1}-07-15`, active: false },
    ],
    users: [{
      id: 1, schoolId: 1, role: 'admin', matricule: matricule.trim().toUpperCase(), firstName: firstName.trim(), lastName: lastName.trim(),
      email: (email || `${clean(firstName)}.${clean(lastName)}@esatic.ci`).trim().toLowerCase(),
      passwordHash: await hash(password), mustChangePassword: true, active: true, classeId: null,
      createdAt: now, lastLoginAt: null, activeToken: null,
    }],
    teaching: [], assessments: [], sessions: [], attempts: [], bank: [], announcements: [],
    notifications: [], audit: [], bulletins: [], manualGrades: [], commentBank: [],
    seq: {
      structure: STRUCTURE_VERSION, user: 10, classe: Math.max(50, classes.length), filiere: Math.max(20, filieres.length),
      matiere: 0, periode: 2, teaching: 0, assessment: 0, question: 0, session: 0, attempt: 0, bank: 0,
      announcement: 0, notification: 0, audit: 0, bulletin: 0, manualGrade: 0, comment: 0,
    },
  }
}
