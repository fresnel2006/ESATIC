// Petits utilitaires communs au site et à la logique (core.js), sans données ni dépendance.
// Séparés de core.js pour que la première page ne télécharge pas toute la logique de la démo.

export class ApiError extends Error {
  constructor(message, code = 'error', status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

// Langages de programmation utilisés par une liste de questions
export function languagesOf(questions = []) {
  return [...new Set(questions.filter((q) => q.type === 'code').map((q) => q.data?.language).filter(Boolean))]
}

// Outils d'une question : 'python', 'sql', 'html'... ; aucun pour QCM et questions ouvertes
export function questionTool(q) {
  if (q.type === 'code') return q.data?.language
  if (q.type === 'sql') return 'sql'
  if (q.type === 'html') return 'html'
  return null
}

export function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}

export function maxPoints(assessment) {
  return (assessment.questions || []).reduce((s, q) => s + Number(q.points || 0), 0)
}

export const EVENT_WEIGHTS = {
  fullscreen_exit: 3, tab_hidden: 3, window_blur: 1, paste_blocked: 4, copy_blocked: 1,
  drop_blocked: 2, contextmenu_blocked: 1, big_insert: 5, devtools_key: 2,
  navigation_away: 3,
  window_left: 3,
  auto_submitted_exits: 5, // signalé au surveillant et à l'enseignant
}

export function riskScore(events = []) {
  const s = events.reduce((sum, e) => sum + (EVENT_WEIGHTS[e.type] || 0), 0)
  return Math.min(100, s * 4)
}

export function mentionFor(avg) {
  if (avg === null || avg === undefined) return '-'
  if (avg >= 16) return 'Très bien'
  if (avg >= 14) return 'Bien'
  if (avg >= 12) return 'Assez bien'
  if (avg >= 10) return 'Passable'
  return 'Insuffisant'
}
