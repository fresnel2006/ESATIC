// Point d'entrée des données pour toutes les pages.
// Mode 'serveur' : chaque fonction appelle le serveur Node.js (POST /api/<nom>), qui applique les règles
// et enregistre dans Firestore. Mode 'demo' : la même logique tourne dans le navigateur (core.js).
// L'exécution du code des étudiants reste toujours dans le navigateur, dans un Web Worker isolé.

import * as core from './core.js'
import { API_MODE } from '../config.js'

export { ApiError, languagesOf, questionTool, generatePassword, checkPasswordStrength, institutionalEmail, maxPoints, EVENT_WEIGHTS, riskScore, mentionFor } from './core.js'

const REMOTE = API_MODE !== 'demo'
const TOKEN_KEY = 'esatic-token' // un onglet = un poste

function readToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

async function call(name, args) {
  let res
  try {
    const token = readToken()
    res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Esatic-Token': token } : {}) },
      body: JSON.stringify({ args }),
    })
  } catch {
    throw new core.ApiError('Serveur injoignable. Vérifiez votre connexion puis réessayez.', 'network', 0)
  }
  const body = await res.json().catch(() => null)
  // 502 à 504 : le site répond mais le serveur Node.js derrière lui est arrêté
  if (!body && res.status >= 502 && res.status <= 504) {
    throw new core.ApiError('Le serveur de la plateforme ne répond pas. Lancez-le (dossier server, commande npm run dev) puis réessayez.', 'network', res.status)
  }
  if (!body) throw new core.ApiError(`Réponse invalide du serveur (${res.status}).`, 'server', res.status)
  if (body.token === null) sessionStorage.removeItem(TOKEN_KEY)
  else if (body.token) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(body.token))
  if (body.error) throw new core.ApiError(body.error.message, body.error.code, body.error.status)
  return body.result
}

const remote = (name) => (...args) => call(name, args)
const pick = (name) => (REMOTE ? remote(name) : core[name])

export const login = pick('login')
export const testAccounts = pick('testAccounts')
export const testLogin = pick('testLogin')
export const logout = pick('logout')
export const me = pick('me')
export const changePassword = pick('changePassword')
export const resetPassword = pick('resetPassword')
export const getStructure = pick('getStructure')
export const saveStructureItem = pick('saveStructureItem')
export const deleteStructureItem = pick('deleteStructureItem')
export const toolsOverview = pick('toolsOverview')
export const saveSettings = pick('saveSettings')
export const listUsers = pick('listUsers')
export const saveUser = pick('saveUser')
export const setUserActive = pick('setUserActive')
export const importStudents = pick('importStudents')
export const listAudit = pick('listAudit')
export const adminStats = pick('adminStats')
export const listAssessments = pick('listAssessments')
export const getAssessment = pick('getAssessment')
export const myTeaching = pick('myTeaching')
export const saveAssessment = pick('saveAssessment')
export const duplicateAssessment = pick('duplicateAssessment')
export const setAssessmentStatus = pick('setAssessmentStatus')
export const deleteAssessment = pick('deleteAssessment')
export const listBank = pick('listBank')
export const saveBankQuestion = pick('saveBankQuestion')
export const deleteBankQuestion = pick('deleteBankQuestion')
export const studentAssessments = pick('studentAssessments')
export const studentAssessment = pick('studentAssessment')
export const studentHome = pick('studentHome')
export const studentResults = pick('studentResults')
export const studentResultDetail = pick('studentResultDetail')
export const joinWithCode = pick('joinWithCode')
export const startAttempt = pick('startAttempt')
export const getAttempt = pick('getAttempt')
export const saveAnswers = pick('saveAnswers')
export const logEvents = pick('logEvents')
export const submitAttempt = pick('submitAttempt')
export const listCopies = pick('listCopies')
export const getCopy = pick('getCopy')
export const gradeCopy = pick('gradeCopy')
export const autoGradeJobs = pick('autoGradeJobs')
export const applyAutoGrade = pick('applyAutoGrade')
export const autoGradeTargets = pick('autoGradeTargets')
export const autoGradeDone = pick('autoGradeDone')
export const validateGradedCopies = pick('validateGradedCopies')
export const copiesForQuestion = pick('copiesForQuestion')
export const gradeQuestion = pick('gradeQuestion')
export const listComments = pick('listComments')
export const saveComment = pick('saveComment')
export const deleteComment = pick('deleteComment')
export const publishResults = pick('publishResults')
export const assessmentResults = pick('assessmentResults')
export const teacherClasses = pick('teacherClasses')
export const listSessions = pick('listSessions')
export const sessionDetail = pick('sessionDetail')
export const setSessionState = pick('setSessionState')
export const regenerateCode = pick('regenerateCode')
export const listAlerts = pick('listAlerts')
export const listAnnouncements = pick('listAnnouncements')
export const createAnnouncement = pick('createAnnouncement')
export const listNotifications = pick('listNotifications')
export const markNotificationsRead = pick('markNotificationsRead')
export const search = pick('search')
export const bulletinPreview = pick('bulletinPreview')
export const publishBulletins = pick('publishBulletins')
export const setBulletinAppreciation = pick('setBulletinAppreciation')
export const getBulletin = pick('getBulletin')
export const studentBulletins = pick('studentBulletins')
export const verifyBulletin = pick('verifyBulletin')
export const listManualGrades = pick('listManualGrades')
export const saveManualGrade = pick('saveManualGrade')
export const deleteManualGrade = pick('deleteManualGrade')
export const getBulletinTemplate = pick('getBulletinTemplate')
export const saveBulletinTemplate = pick('saveBulletinTemplate')

// Exécution du code : dans le navigateur, sans passer par le serveur
export const runCode = REMOTE ? core.executeCode : core.runCode

// Correction automatique : le serveur fournit les codes, le navigateur les exécute, le serveur note
const gradeApi = { autoGradeJobs: remote('autoGradeJobs'), applyAutoGrade: remote('applyAutoGrade') }
export const autoGradeCopy = REMOTE ? (id) => core.autoGradeCopyWith(gradeApi, id) : core.autoGradeCopy
export const autoGradeAll = REMOTE
  ? (id, onProgress) => core.autoGradeAllWith({ autoGradeTargets: remote('autoGradeTargets'), autoGradeCopy, autoGradeDone: remote('autoGradeDone') }, id, onProgress)
  : core.autoGradeAll

export const resetDemo = REMOTE
  ? async () => { await call('resetDemo', []); sessionStorage.removeItem(TOKEN_KEY) }
  : core.resetDemo
