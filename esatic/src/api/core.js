// Logique métier de la plateforme (rôles, session unique, échéances, notes, bulletins...).
// Le même fichier tourne à deux endroits :
// - sur le serveur Node.js (dossier server/), qui enregistre les données dans Firestore ;
// - dans le navigateur en mode démo, avec les données dans localStorage.
// Ce qui dépend de l'endroit (stockage, jeton de session, hachage) passe par "platform".

import { buildSeed, hashPassword, DEFAULT_TOOLS, applyDemoSections, schoolStructure, STRUCTURE_VERSION } from './seed.js'
import { buildExtraExams } from './seedExams.js'
import { TOOLS, SQL_LIMITS, sqlSizeKb, DIAGRAM_MAX_KB } from '../lib/format.js'
import { TEST_MODE } from '../config.js'
import { BROWSER_LANGS, runInBrowser, sameOutput } from '../lib/browserRunner.js'

// Changer la version recrée les données de démo (dates recalculées à partir d'aujourd'hui)
const DB_KEY = 'esatic-demo-db-v2'
const TOKEN_KEY = 'esatic-token' // sessionStorage : un onglet = un poste

// Fonctionnement par défaut : démo dans le navigateur
const platform = {
  server: false,
  readDb: async () => {
    localStorage.removeItem('esatic-demo-db-v1')
    try { return JSON.parse(localStorage.getItem(DB_KEY)) } catch { return null }
  },
  writeDb: (data) => localStorage.setItem(DB_KEY, JSON.stringify(data)),
  clearDb: async () => localStorage.removeItem(DB_KEY),
  getToken: () => { try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY)) } catch { return null } },
  setToken: (t) => sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t)),
  clearToken: () => platform.clearToken(),
  hash: hashPassword,
  delay: (ms) => new Promise((r) => setTimeout(r, ms)),
  // Fichiers déposés (bulletins) : gardés dans le navigateur en mode démo
  files: {
    put: async (key, bytes) => {
      demoFiles.set(key, bytes)
      try { localStorage.setItem(`esatic-demo-file-${key}`, JSON.stringify(Array.from(bytes))) } catch { /* stockage plein : gardé jusqu'au rechargement */ }
    },
    get: async (key) => {
      if (demoFiles.has(key)) return demoFiles.get(key)
      try { const a = JSON.parse(localStorage.getItem(`esatic-demo-file-${key}`)); return a ? new Uint8Array(a) : null } catch { return null }
    },
    remove: (key) => { demoFiles.delete(key); localStorage.removeItem(`esatic-demo-file-${key}`) },
  },
}
const demoFiles = new Map()

// Le serveur remplace le stockage, le jeton et le hachage
export function configurePlatform(overrides) {
  Object.assign(platform, overrides)
  demoDb = null
}

export class ApiError extends Error {
  constructor(message, code = 'error', status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

// Données de travail. En démo : une seule base, celle du navigateur.
// Sur le serveur : les données de la requête en cours (platform.getDb), préparées avant l'appel et
// enregistrées après ; deux requêtes simultanées ne partagent donc jamais le même objet.
let demoDb = null
const currentDb = () => (platform.server ? platform.getDb() : demoDb)
const db = new Proxy({}, {
  get: (_, k) => currentDb()?.[k],
  set: (_, k, v) => { currentDb()[k] = v; return true },
  has: (_, k) => !!currentDb() && k in currentDb(),
  ownKeys: () => Reflect.ownKeys(currentDb() || {}),
  getOwnPropertyDescriptor: (_, k) => {
    const d = Object.getOwnPropertyDescriptor(currentDb() || {}, k)
    return d && { ...d, configurable: true }
  },
})

async function load() {
  if (platform.server) return db
  if (demoDb) return demoDb
  const stored = await platform.readDb()
  if (stored?.users) {
    demoDb = stored
    migrate()
    await addDemoEducator()
    return demoDb
  }
  demoDb = await buildSeed(platform.hash)
  save()
  return demoDb
}

// Serveur : création de la base et mises à niveau, sur les données de la requête en cours
export async function buildInitialData() {
  return buildSeed(platform.hash)
}
export async function migrateData() {
  migrate()
  await addDemoEducator()
}

// Base de démonstration créée avant le rôle Éducateur : ajout du compte EDU001 (dépôt des bulletins)
async function addDemoEducator() {
  const isDemo = db.school?.demo ?? db.users.some((u) => u.matricule === 'ETU24001')
  if (!isDemo || db.users.some((u) => u.matricule === 'EDU001')) return
  db.users.push({
    id: nextId('user'), schoolId: db.school.id ?? 1, role: 'educator', matricule: 'EDU001', firstName: 'Adjoua', lastName: 'Brou',
    email: 'adjoua.brou@esatic.ci', passwordHash: await platform.hash('Educ2026!'), mustChangePassword: false, active: true,
    classeId: null, createdAt: now(), lastLoginAt: null, activeToken: null,
  })
  save()
}

// Mise à niveau d'une base de démo créée par une version précédente
function migrate() {
  let changed = false
  for (const m of db.matieres) {
    if (!Array.isArray(m.tools)) {
      m.tools = DEFAULT_TOOLS[m.code] ?? []
      changed = true
    }
    // Outils retirés de la plateforme (C#) : enlevés des matières
    const kept = m.tools.filter((t) => t in TOOLS)
    if (kept.length !== m.tools.length) { m.tools = kept; changed = true }
  }
  for (const a of db.assessments) {
    if (!Array.isArray(a.languages)) {
      a.languages = languagesOf(a.questions)
      changed = true
    }
    // Avertissement puis envoi de la copie : activé par défaut pour les examens surveillés
    if (a.security && a.security.exitWarnings === undefined) {
      a.security.exitWarnings = a.kind === 'examen' && a.security.fullscreen ? 1 : null
      changed = true
    }
  }
  // Ajouts de démonstration : seulement dans une base de démonstration, jamais dans la vraie base de l'école.
  // (Base de démo : school.demo vrai ; les bases de démo plus anciennes se reconnaissent au compte ETU24001.)
  const isDemo = db.school?.demo ?? db.users.some((u) => u.matricule === 'ETU24001')
  if (isDemo) {
    // Nouveaux outils des matières de démonstration (ajoutés, jamais retirés)
    for (const m of db.matieres) {
      for (const t of DEFAULT_TOOLS[m.code] || []) {
        if (Array.isArray(m.tools) && !m.tools.includes(t)) { m.tools.push(t); changed = true }
      }
    }
    // Questions de démonstration dans un langage retiré (C#) : enlevées, épreuve renommée
    for (const a of db.assessments) {
      const qs = (a.questions || []).filter((x) => x.type !== 'code' || x.data?.language in TOOLS)
      if (qs.length !== (a.questions || []).length) {
        a.questions = qs
        a.languages = languagesOf(qs)
        if (a.id === 17) a.title = 'TP noté - OCaml'
        changed = true
      }
    }
    // Descriptions de démonstration qui parlaient du service d'exécution (retiré)
    const DEMO_DESC = {
      14: 'C exécuté dans le navigateur ; C++ et Java écrits dans l\'éditeur et corrigés par l\'enseignant.',
      17: 'Programme OCaml écrit dans l\'éditeur et corrigé par l\'enseignant.',
    }
    for (const a of db.assessments) {
      if (DEMO_DESC[a.id] && /Docker|service d'exécution/.test(a.description || '')) { a.description = DEMO_DESC[a.id]; changed = true }
    }
    // TP de modélisation de démonstration : devoir (sans code d'accès), et non plus examen surveillé
    const tp = db.assessments.find((a) => a.id === 18 && a.kind === 'examen' && /^TP noté - Modélisation/.test(a.title || ''))
    if (tp) {
      tp.kind = 'devoir'
      tp.security = { ...tp.security, fullscreen: false, exitWarnings: null }
      db.sessions = db.sessions.filter((s) => s.assessmentId !== 18)
      changed = true
    }
    // Nouveaux examens de programmation de démonstration (ajoutés sans toucher au reste)
    const extra = buildExtraExams()
    for (const a of extra.assessments) {
      if (!db.assessments.some((x) => x.id === a.id)) {
        db.assessments.push(a)
        changed = true
      }
    }
    for (const s of extra.sessions) {
      if (!db.sessions.some((x) => x.id === s.id || x.assessmentId === s.assessmentId)) {
        db.sessions.push(s)
        changed = true
      }
    }
    db.seq.session = Math.max(db.seq.session, 40)
    // Exercices des épreuves de démonstration (épreuves jamais réenregistrées par l'enseignant)
    for (const a of db.assessments) if (applyDemoSections(a)) changed = true
  }
  // Vraies classes de l'ESATIC à la place des 3 classes de démonstration d'origine.
  // Les classes 1 à 3 sont renommées (comptes et épreuves restent rattachés) ; les autres sont ajoutées.
  // Rejoué aussi quand la liste des classes s'allonge (STRUCTURE_VERSION) : seules les classes absentes sont
  // ajoutées, une classe supprimée par l'administration entre deux versions n'est pas recréée ensuite.
  const OLD_CLASSES = ['L2-INFO-A', 'L2-INFO-B', 'L1-RT']
  if (db.classes.some((c) => OLD_CLASSES.includes(c.code)) || (db.seq.structure ?? 1) < STRUCTURE_VERSION) {
    db.seq.structure = STRUCTURE_VERSION
    const { filieres, classes } = schoolStructure(db.school?.settings?.academicYear || '2026-2027')
    for (const f of filieres) {
      const old = db.filieres.find((x) => x.id === f.id && (x.code === 'INFO' || x.code === 'RT'))
      if (old) Object.assign(old, f)
      else if (!db.filieres.some((x) => x.code === f.code)) db.filieres.push(db.filieres.some((x) => x.id === f.id) ? { ...f, id: nextId('filiere') } : f)
    }
    for (const c of classes) {
      const old = db.classes.find((x) => x.id === c.id && OLD_CLASSES.includes(x.code))
      if (old) Object.assign(old, c)
      else if (!db.classes.some((x) => x.code === c.code)) db.classes.push(db.classes.some((x) => x.id === c.id) ? { ...c, id: nextId('classe') } : c)
    }
    db.seq.classe = Math.max(db.seq.classe, ...db.classes.map((c) => c.id))
    db.seq.filiere = Math.max(db.seq.filiere, ...db.filieres.map((f) => f.id))
    changed = true
  }
  // Bulletins : fichiers déposés par l'établissement. Les anciens bulletins calculés à partir des notes
  // (sans fichier) sont retirés.
  if (!Array.isArray(db.bulletins)) { db.bulletins = []; changed = true }
  if (db.bulletins.some((b) => !b.fileKey)) { db.bulletins = db.bulletins.filter((b) => b.fileKey); changed = true }
  db.seq.bulletin ??= 100
  if (changed) save()
}

// Classes concernées par une épreuve : une ou plusieurs (classeIds). Les épreuves créées avant n'ont que classeId.
export function classIdsOf(a) {
  if (Array.isArray(a?.classeIds) && a.classeIds.length) return a.classeIds.map(Number)
  return a?.classeId ? [Number(a.classeId)] : []
}
const classNamesOf = (a) => classIdsOf(a).map((id) => db.classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ')
const studentsOf = (a) => {
  const ids = classIdsOf(a)
  return db.users.filter((u) => u.role === 'student' && ids.includes(u.classeId))
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

function save() {
  platform.writeDb(platform.server ? null : demoDb)
}

// Démo : un autre onglet a modifié la base, on la relit.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!platform.server && e.key === DB_KEY && e.newValue) demoDb = JSON.parse(e.newValue)
  })
}

// Petit délai de la démo pour imiter le réseau (aucun sur le serveur)
const wait = (ms = 120) => (platform.server ? Promise.resolve() : platform.delay(ms))
const now = () => new Date().toISOString()
// Le serveur fournit ses propres identifiants pour les données créées en masse (copies, journal,
// notifications) : pas de compteur partagé que 30 étudiants modifieraient en même temps
const nextId = (kind) => platform.nextId?.(kind) ?? ++db.seq[kind]
const clone = (x) => JSON.parse(JSON.stringify(x))

function randomCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = crypto.getRandomValues(new Uint32Array(len))
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}

export function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

function currentToken() {
  return platform.getToken()
}

function requireUser(...roles) {
  const t = currentToken()
  if (!t) throw new ApiError('Session expirée, reconnectez-vous.', 'unauthenticated', 401)
  const user = db.users.find((u) => u.id === t.userId)
  if (!user || !user.active) {
    platform.clearToken()
    throw new ApiError('Compte indisponible.', 'unauthenticated', 401)
  }
  if (user.activeToken !== t.token) {
    platform.clearToken()
    throw new ApiError(
      'Votre compte vient d\'être ouvert sur un autre poste. Cette session a été fermée.',
      'session_replaced',
      401,
    )
  }
  if (roles.length && !roles.includes(user.role)) {
    throw new ApiError('Accès non autorisé pour votre rôle.', 'forbidden', 403)
  }
  return user
}

function publicUser(u) {
  if (!u) return null
  const rest = { ...u }
  delete rest.passwordHash
  delete rest.activeToken
  const classe = db.classes.find((c) => c.id === u.classeId)
  return { ...rest, fullName: `${u.firstName} ${u.lastName}`, classe: classe ? classe.name : null }
}

function audit(user, action, target, detail = '') {
  db.audit.unshift({ id: nextId('audit'), schoolId: user?.schoolId ?? 1, userId: user?.id ?? null, action, target, detail, at: now() })
  if (db.audit.length > 2000) db.audit.length = 2000
}

function notify(userId, title, body, link = '') {
  db.notifications.unshift({ id: nextId('notification'), userId, title, body, link, read: false, createdAt: now() })
}

// POST /api/auth/login
export async function login(identifier, password) {
  await load()
  await wait(250)
  const id = identifier.trim().toLowerCase()
  const user = db.users.find((u) => u.matricule.toLowerCase() === id || u.email.toLowerCase() === id)
  const hash = await platform.hash(password)
  if (!user || user.passwordHash !== hash) {
    throw new ApiError('Identifiant ou mot de passe incorrect.', 'bad_credentials', 401)
  }
  if (!user.active) throw new ApiError('Ce compte est désactivé. Contactez l\'administration.', 'inactive', 403)
  // Une seule session active : un nouveau jeton remplace l'ancien.
  // Pour le personnel aussi, si le paramètre de l'école le demande.
  const single = user.role === 'student' || db.school.settings.singleSession
  const token = single || !user.activeToken ? randomCode(24) : user.activeToken
  user.activeToken = token
  user.lastLoginAt = now()
  audit(user, 'connexion', user.matricule)
  save()
  platform.setToken({ userId: user.id, token })
  return publicUser(user)
}

// Mode test : entrer comme enseignant sans mot de passe (TEST_MODE.openTeacher). Refusé par le serveur sinon.
export async function testAccounts() {
  await load()
  if (!TEST_MODE.openTeacher) return []
  return db.users
    .filter((u) => u.role === 'teacher' && u.active)
    .map((u) => ({ matricule: u.matricule, name: `${u.firstName} ${u.lastName}` }))
}

export async function testLogin(matricule) {
  await load()
  if (!TEST_MODE.openTeacher) throw new ApiError('L\'accès sans mot de passe est désactivé sur ce serveur.', 'forbidden', 403)
  const user = db.users.find((u) => u.role === 'teacher' && u.active && u.matricule === String(matricule))
  if (!user) throw new ApiError('Enseignant introuvable.', 'not_found', 404)
  const single = db.school.settings.singleSession
  const token = single || !user.activeToken ? randomCode(24) : user.activeToken
  user.activeToken = token
  user.lastLoginAt = now()
  audit(user, 'connexion_mode_test', user.matricule, 'sans mot de passe')
  save()
  platform.setToken({ userId: user.id, token })
  return publicUser(user)
}

// POST /api/auth/logout
export async function logout() {
  await load()
  const t = currentToken()
  if (t) {
    const user = db.users.find((u) => u.id === t.userId)
    if (user && user.activeToken === t.token) {
      user.activeToken = null
      save()
    }
  }
  platform.clearToken()
}

// GET /api/auth/me
export async function me() {
  await load()
  if (!currentToken()) return null
  return publicUser(requireUser())
}

// POST /api/auth/change-password
export async function changePassword(current, next) {
  await load()
  const user = requireUser()
  if ((await platform.hash(current)) !== user.passwordHash) {
    throw new ApiError('Le mot de passe actuel est incorrect.')
  }
  checkPasswordStrength(next)
  if (current === next) throw new ApiError('Le nouveau mot de passe doit être différent de l\'ancien.')
  user.passwordHash = await platform.hash(next)
  user.mustChangePassword = false
  audit(user, 'changement_mot_de_passe', user.matricule)
  save()
  return publicUser(user)
}

export function checkPasswordStrength(pw) {
  const min = db?.school?.settings?.passwordMinLength ?? 8
  if (pw.length < min) throw new ApiError(`Le mot de passe doit contenir au moins ${min} caractères.`)
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw new ApiError('Le mot de passe doit contenir des lettres et des chiffres.')
  }
}

// Le profil (matricule, nom, prénom, email, classe) est tenu par l'école : pas de modification par l'utilisateur.

// Réinitialisation demandée à l'école (sans passer par l'email)
// POST /api/users/{id}/reset-password (admin, surveillant)
export async function resetPassword(userId) {
  await load()
  const actor = requireUser('admin', 'proctor')
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw new ApiError('Utilisateur introuvable.', 'not_found', 404)
  if (actor.role === 'proctor' && user.role !== 'student') {
    throw new ApiError('Un surveillant ne peut réinitialiser que les comptes étudiants.', 'forbidden', 403)
  }
  const temp = generatePassword()
  user.passwordHash = await platform.hash(temp)
  user.mustChangePassword = true
  user.activeToken = null
  audit(actor, 'reinitialisation_mot_de_passe', `${user.firstName} ${user.lastName} (${user.matricule})`)
  save()
  return { temporaryPassword: temp }
}

// ---------------------------------------------------------------------------
// Référentiels (structure)
// ---------------------------------------------------------------------------

export async function getStructure() {
  await load()
  requireUser()
  return clone({
    school: db.school,
    filieres: db.filieres,
    classes: db.classes,
    matieres: db.matieres,
    periodes: db.periodes,
    teaching: db.teaching,
  })
}

const STRUCT = {
  classes: { seq: 'classe', label: 'classe', required: ['name', 'code'] },
  filieres: { seq: 'filiere', label: 'filière', required: ['name', 'code'] },
  matieres: { seq: 'matiere', label: 'matière', required: ['name', 'code'] },
  periodes: { seq: 'periode', label: 'période', required: ['name', 'start', 'end'] },
  teaching: { seq: 'teaching', label: 'affectation', required: ['teacherId', 'classeId', 'matiereId'] },
}

// POST/PUT /api/structure/{kind}
export async function saveStructureItem(kind, item) {
  await load()
  const actor = requireUser('admin')
  const conf = STRUCT[kind]
  for (const f of conf.required) {
    if (item[f] === undefined || item[f] === null || String(item[f]).trim() === '') {
      throw new ApiError('Tous les champs obligatoires doivent être remplis.')
    }
  }
  const list = db[kind]
  if (item.code && list.some((x) => x.id !== item.id && x.code?.toLowerCase() === String(item.code).toLowerCase())) {
    throw new ApiError(`Ce code de ${conf.label} existe déjà.`)
  }
  if (kind === 'teaching' && list.some((x) => x.id !== item.id && x.teacherId === item.teacherId && x.classeId === item.classeId && x.matiereId === item.matiereId)) {
    throw new ApiError('Cette affectation existe déjà.')
  }
  if (kind === 'matieres') {
    item = { ...item, tools: (item.tools || []).filter((t) => t in TOOLS) }
    // Retirer un outil encore utilisé par une épreuve publiée casserait ces épreuves
    const prev = list.find((x) => x.id === item.id)
    const removed = (prev?.tools || []).filter((t) => !item.tools.includes(t))
    const used = db.assessments.filter((x) => x.matiereId === item.id && x.status === 'publie' && x.questions.some((q) => removed.includes(questionTool(q))))
    if (used.length) {
      throw new ApiError(`Impossible de retirer ${removed.map((t) => TOOLS[t].label).join(', ')} : utilisé dans « ${used[0].title} »${used.length > 1 ? ` et ${used.length - 1} autre(s) épreuve(s)` : ''}.`)
    }
  }
  if (item.id) {
    const idx = list.findIndex((x) => x.id === item.id)
    list[idx] = { ...list[idx], ...item }
    audit(actor, 'modification_' + conf.seq, item.name || item.code || String(item.id))
  } else {
    list.push({ ...item, id: nextId(conf.seq), schoolId: actor.schoolId })
    audit(actor, 'creation_' + conf.seq, item.name || item.code || '')
  }
  save()
}

// DELETE /api/structure/{kind}/{id}
export async function deleteStructureItem(kind, id) {
  await load()
  const actor = requireUser('admin')
  if (kind === 'classes' && db.users.some((u) => u.classeId === id)) {
    throw new ApiError('Impossible de supprimer une classe qui contient des étudiants.')
  }
  if (kind === 'classes' && db.assessments.some((a) => classIdsOf(a).includes(id))) {
    throw new ApiError('Impossible de supprimer une classe liée à des épreuves.')
  }
  if (kind === 'matieres' && db.assessments.some((a) => a.matiereId === id)) {
    throw new ApiError('Impossible de supprimer une matière liée à des épreuves.')
  }
  if (kind === 'filieres' && db.classes.some((c) => c.filiereId === id)) {
    throw new ApiError('Impossible de supprimer une filière qui contient des classes.')
  }
  const item = db[kind].find((x) => x.id === id)
  db[kind] = db[kind].filter((x) => x.id !== id)
  audit(actor, 'suppression_' + STRUCT[kind].seq, item?.name || item?.code || String(id))
  save()
}

// GET /api/tools : pour chaque outil, les matières et épreuves qui l'utilisent
export async function toolsOverview() {
  await load()
  requireUser('admin')
  return Object.entries(TOOLS).map(([key, t]) => {
    const matieres = db.matieres.filter((m) => (m.tools || []).includes(key))
    const assessments = db.assessments.filter((a) => a.status !== 'annule' && a.questions.some((q) => questionTool(q) === key))
    return {
      key, ...t, matieres: matieres.map((m) => m.name), assessmentCount: assessments.length,
      runsInBrowser: key === 'html' || (t.browser && TEST_MODE.runCodeInBrowser),
    }
  })
}

// PUT /api/school/settings
export async function saveSettings(settings, schoolName) {
  await load()
  const actor = requireUser('admin')
  db.school.settings = { ...db.school.settings, ...settings }
  if (schoolName) db.school.name = schoolName
  audit(actor, 'modification_parametres', 'Paramètres de l\'école')
  save()
  return clone(db.school)
}

// ---------------------------------------------------------------------------
// Utilisateurs (administrateur)
// ---------------------------------------------------------------------------

// GET /api/users
// Liste de tous les comptes (données personnelles) : réservée à l'administration
export async function listUsers() {
  await load()
  requireUser('admin')
  return db.users.map(publicUser)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Email institutionnel attribué par l'école : prenom.nom@domaine (sans accents, unique)
export function institutionalEmail(firstName, lastName, taken = []) {
  const domain = db?.school?.settings?.emailDomain || 'esatic.ci'
  const clean = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const base = `${clean(firstName)}.${clean(lastName)}`
  const used = new Set([...db.users.map((u) => u.email.toLowerCase()), ...taken.map((e) => e.toLowerCase())])
  let email = `${base}@${domain}`
  for (let n = 2; used.has(email); n++) email = `${base}${n}@${domain}`
  return email
}

// POST/PUT /api/users
export async function saveUser(data) {
  await load()
  const actor = requireUser('admin')
  const matricule = (data.matricule || '').trim().toUpperCase()
  if (!matricule || !data.firstName?.trim() || !data.lastName?.trim() || !data.role) {
    throw new ApiError('Matricule, nom, prénom et rôle sont obligatoires.')
  }
  const current = data.id ? db.users.find((u) => u.id === data.id) : null
  const email = (data.email || '').trim() || current?.email || institutionalEmail(data.firstName, data.lastName)
  if (!EMAIL_RE.test(email)) throw new ApiError('L\'adresse email n\'est pas valide.')
  if (db.users.some((u) => u.id !== data.id && u.matricule.toUpperCase() === matricule)) {
    throw new ApiError('Ce matricule existe déjà.')
  }
  if (email && db.users.some((u) => u.id !== data.id && u.email.toLowerCase() === email.toLowerCase())) {
    throw new ApiError('Cet email est déjà utilisé.')
  }
  if (data.role === 'student' && !data.classeId) throw new ApiError('Un étudiant doit être rattaché à une classe.')
  const fields = {
    matricule, email, firstName: data.firstName.trim(), lastName: data.lastName.trim(), role: data.role,
    classeId: data.role === 'student' ? Number(data.classeId) : null,
  }
  if (data.id) {
    const user = db.users.find((u) => u.id === data.id)
    if (user.id === actor.id && fields.role !== 'admin') throw new ApiError('Vous ne pouvez pas retirer votre propre rôle d\'administrateur.')
    Object.assign(user, fields)
    audit(actor, 'modification_utilisateur', `${fields.firstName} ${fields.lastName} (${matricule})`)
    save()
    return { user: publicUser(user) }
  }
  const temp = generatePassword()
  const user = {
    id: nextId('user'), schoolId: actor.schoolId, ...fields, passwordHash: await platform.hash(temp),
    mustChangePassword: true, active: true, createdAt: now(), lastLoginAt: null, activeToken: null,
  }
  db.users.push(user)
  audit(actor, 'creation_utilisateur', `${fields.firstName} ${fields.lastName} (${matricule})`)
  save()
  return { user: publicUser(user), temporaryPassword: temp }
}

// PUT /api/users/{id}/teaching : classes et matières attribuées à un enseignant (remplace la liste entière).
// assignments : [{ classeId, matiereId }]
export async function setTeacherAssignments(teacherId, assignments = []) {
  await load()
  const actor = requireUser('admin')
  const teacher = db.users.find((u) => u.id === Number(teacherId) && u.role === 'teacher')
  if (!teacher) throw new ApiError('Enseignant introuvable.', 'not_found', 404)
  const wanted = []
  for (const x of Array.isArray(assignments) ? assignments : []) {
    const classeId = Number(x?.classeId)
    const matiereId = Number(x?.matiereId)
    if (!db.classes.some((c) => c.id === classeId)) throw new ApiError('Une des classes choisies n\'existe plus. Rechargez la page.')
    if (!db.matieres.some((m) => m.id === matiereId)) throw new ApiError('Une des matières choisies n\'existe plus. Rechargez la page.')
    if (!wanted.some((w) => w.classeId === classeId && w.matiereId === matiereId)) wanted.push({ classeId, matiereId })
  }
  const before = db.teaching.filter((t) => t.teacherId === teacher.id)
  const kept = before.filter((t) => wanted.some((w) => w.classeId === t.classeId && w.matiereId === t.matiereId))
  const added = wanted.filter((w) => !before.some((t) => t.classeId === w.classeId && t.matiereId === w.matiereId))
  if (kept.length === before.length && !added.length) return
  db.teaching = [
    ...db.teaching.filter((t) => t.teacherId !== teacher.id),
    ...kept,
    ...added.map((w) => ({ id: nextId('teaching'), schoolId: actor.schoolId, teacherId: teacher.id, classeId: w.classeId, matiereId: w.matiereId })),
  ]
  audit(actor, 'affectations_enseignant', `${teacher.firstName} ${teacher.lastName} (${teacher.matricule})`, `${wanted.length} affectation(s) : ${added.length} ajoutée(s), ${before.length - kept.length} retirée(s)`)
  save()
}

// PATCH /api/users/{id}/active
export async function setUserActive(userId, active) {
  await load()
  const actor = requireUser('admin')
  if (userId === actor.id) throw new ApiError('Vous ne pouvez pas désactiver votre propre compte.')
  const user = db.users.find((u) => u.id === userId)
  user.active = active
  if (!active) user.activeToken = null
  audit(actor, active ? 'activation_compte' : 'desactivation_compte', `${user.firstName} ${user.lastName} (${user.matricule})`)
  save()
}

// POST /api/users/import  (lignes déjà lues depuis le CSV)
export async function importStudents(rows) {
  await load()
  const actor = requireUser('admin')
  if (!Array.isArray(rows)) throw new ApiError('Fichier d\'import illisible.')
  const created = []
  const errors = []
  // Valeurs d'un tableur : nombres (matricule 24001), cases vides... toujours ramenées à du texte
  const text = (v) => (v === undefined || v === null ? '' : String(v)).trim()
  for (const [i, raw] of rows.entries()) {
    const line = Number(raw?.line) || i + 2
    const r = { matricule: text(raw?.matricule), nom: text(raw?.nom), prenom: text(raw?.prenom), email: text(raw?.email), classe: text(raw?.classe) }
    const matricule = r.matricule.toUpperCase()
    const classe = db.classes.find(
      (c) => c.code.toLowerCase() === r.classe.toLowerCase() || c.name.toLowerCase() === r.classe.toLowerCase(),
    )
    if (!matricule || !r.nom || !r.prenom) { errors.push({ line, message: 'matricule, nom ou prénom manquant' }); continue }
    // Email institutionnel : celui du fichier, sinon généré (prenom.nom@esatic.ci)
    const email = r.email || institutionalEmail(r.prenom, r.nom)
    if (!EMAIL_RE.test(email)) { errors.push({ line, message: `email « ${email} » invalide` }); continue }
    if (!classe) { errors.push({ line, message: `classe « ${r.classe || ''} » inconnue` }); continue }
    if (db.users.some((u) => u.matricule.toUpperCase() === matricule)) { errors.push({ line, message: `matricule ${matricule} déjà existant` }); continue }
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) { errors.push({ line, message: `email ${email} déjà utilisé` }); continue }
    const temp = generatePassword()
    const user = {
      id: nextId('user'), schoolId: actor.schoolId, role: 'student', matricule,
      firstName: r.prenom.trim(), lastName: r.nom.trim(), email, classeId: classe.id,
      passwordHash: await platform.hash(temp), mustChangePassword: true, active: true,
      createdAt: now(), lastLoginAt: null, activeToken: null,
    }
    db.users.push(user)
    created.push({ matricule, nom: user.lastName, prenom: user.firstName, email, classe: classe.name, motDePasseProvisoire: temp })
  }
  if (created.length) audit(actor, 'import_etudiants', `${created.length} compte(s)`, errors.length ? `${errors.length} ligne(s) rejetée(s)` : '')
  save()
  return { created, errors }
}

// GET /api/audit
export async function listAudit() {
  await load()
  requireUser('admin')
  return db.audit.map((a) => ({ ...a, user: publicUser(db.users.find((u) => u.id === a.userId)) }))
}

// GET /api/admin/stats
export async function adminStats() {
  await load()
  requireUser('admin')
  const students = db.users.filter((u) => u.role === 'student')
  return {
    students: students.length,
    teachers: db.users.filter((u) => u.role === 'teacher').length,
    proctors: db.users.filter((u) => u.role === 'proctor').length,
    classes: db.classes.length,
    assessments: db.assessments.filter((a) => a.status === 'publie').length,
    drafts: db.assessments.filter((a) => a.status === 'brouillon').length,
    openSessions: db.sessions.filter((s) => s.status === 'ouverte').length,
    toGrade: db.attempts.filter((a) => a.status === 'rendu').length,
    neverLogged: students.filter((u) => !u.lastLoginAt).length,
    recentAudit: db.audit.slice(0, 8).map((a) => ({ ...a, user: publicUser(db.users.find((u) => u.id === a.userId)) })),
  }
}

// ---------------------------------------------------------------------------
// Épreuves (devoirs et examens)
// ---------------------------------------------------------------------------

export function maxPoints(assessment) {
  return (assessment.questions || []).reduce((s, q) => s + Number(q.points || 0), 0)
}

function decorateAssessment(a) {
  return {
    ...a,
    matiere: db.matieres.find((m) => m.id === a.matiereId)?.name ?? '',
    classe: classNamesOf(a),
    classeIds: classIdsOf(a),
    teacher: publicUser(db.users.find((u) => u.id === a.teacherId))?.fullName ?? '',
    maxPoints: maxPoints(a),
    questionCount: (a.questions || []).length,
    session: a.kind === 'examen' ? clone(db.sessions.filter((s) => s.assessmentId === a.id).at(-1) ?? null) : null,
  }
}

// Version étudiante : on retire les corrigés et les tests cachés.
function studentQuestion(q) {
  const data = { ...q.data }
  delete data.correct
  delete data.answerModel
  delete data.answerModelXml
  delete data.expectedQuery
  delete data.criteria
  if (q.type === 'code') data.tests = (q.data.tests || []).filter((t) => !t.hidden).map(({ expected, ...t }) => ({ ...t, expected }))
  if (q.type === 'code') data.hiddenTestCount = (q.data.tests || []).filter((t) => t.hidden).length
  return { id: q.id, type: q.type, statement: q.statement, points: q.points, data, sectionId: q.sectionId ?? null }
}

// GET /api/assessments (enseignant : les siennes ; admin : toutes)
export async function listAssessments() {
  await load()
  const user = requireUser('teacher', 'admin', 'proctor')
  let list = db.assessments
  if (user.role === 'teacher') list = list.filter((a) => a.teacherId === user.id)
  if (user.role === 'proctor') list = list.filter((a) => a.kind === 'examen' && a.status === 'publie')
  return list.map((a) => {
    const atts = db.attempts.filter((t) => t.assessmentId === a.id)
    return {
      ...decorateAssessment(a),
      submitted: atts.filter((t) => t.status !== 'en_cours').length,
      toGrade: atts.filter((t) => t.status === 'rendu').length,
      classSize: studentsOf(a).length,
    }
  }).sort((x, y) => (y.createdAt > x.createdAt ? 1 : -1))
}

// GET /api/assessments/{id}
export async function getAssessment(id) {
  await load()
  const user = requireUser('teacher', 'admin')
  const a = db.assessments.find((x) => x.id === Number(id))
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  if (user.role === 'teacher' && a.teacherId !== user.id) throw new ApiError('Cette épreuve ne vous appartient pas.', 'forbidden', 403)
  return clone({ ...decorateAssessment(a), submitted: db.attempts.filter((t) => t.assessmentId === a.id).length })
}

// Classes et matières que l'enseignant peut viser
// Classes et matières proposées à l'enseignant : toutes celles de l'école (L1 à M2).
// `rows` : ses affectations (données par l'administration), pour mettre ses matières en premier.
const LEVEL_ORDER = ['L1', 'L2', 'L3', 'M1', 'M2']
const byLevel = (a, b) => {
  const la = LEVEL_ORDER.indexOf(a.level); const lb = LEVEL_ORDER.indexOf(b.level)
  return (la < 0 ? 99 : la) - (lb < 0 ? 99 : lb) || a.name.localeCompare(b.name)
}

export async function myTeaching() {
  await load()
  const user = requireUser('teacher')
  const rows = db.teaching.filter((t) => t.teacherId === user.id)
  return {
    rows: clone(rows),
    classes: clone([...db.classes].sort(byLevel)),
    matieres: clone(db.matieres),
  }
}

// Exercices d'une épreuve : [{ id, title, intro }], chaque question porte le sectionId de son exercice.
// Sans exercice, les questions forment une liste simple. Les questions sont rangées exercice par exercice.
function cleanSections(a) {
  const sections = (a.sections || [])
    .filter((x) => x && x.id)
    .map((x) => ({ id: String(x.id), title: String(x.title || '').trim(), intro: String(x.intro || '') }))
  if (!sections.length) {
    for (const q of a.questions || []) delete q.sectionId
    return []
  }
  const ids = sections.map((x) => x.id)
  for (const q of a.questions || []) if (!ids.includes(q.sectionId)) q.sectionId = ids[0]
  a.questions = ids.flatMap((id) => (a.questions || []).filter((q) => q.sectionId === id))
  return sections
}

function validateAssessment(a, publish) {
  if (!a.title?.trim()) throw new ApiError('Le titre est obligatoire.')
  // Bases de test SQL : légères pour tous les postes (vérifié aussi dans l'éditeur, avec le nombre de lignes)
  let sqlKb = 0
  for (const [i, q] of (a.questions || []).entries()) {
    if (q.type !== 'sql') continue
    const kb = sqlSizeKb(q.data?.schemaSql, q.data?.seedSql)
    sqlKb += kb
    if (kb > SQL_LIMITS.maxKb) throw new ApiError(`Question ${i + 1} : base de test trop volumineuse (${Math.round(kb)} Ko, maximum ${SQL_LIMITS.maxKb} Ko).`)
  }
  for (const [i, q] of (a.questions || []).entries()) {
    if (q.type !== 'diagram') continue
    const kb = (String(q.data?.starterXml || '').length + String(q.data?.answerModelXml || '').length) / 1024
    if (kb > DIAGRAM_MAX_KB) throw new ApiError(`Question ${i + 1} : diagrammes trop volumineux (${Math.round(kb)} Ko, maximum ${DIAGRAM_MAX_KB} Ko).`)
  }
  if (sqlKb > SQL_LIMITS.maxTotalKb) throw new ApiError(`Bases de test SQL trop volumineuses pour une seule épreuve (${Math.round(sqlKb)} Ko au total, maximum ${SQL_LIMITS.maxTotalKb} Ko). Utilisez la même petite base pour plusieurs questions.`)
  if (publish) {
    for (const [i, x] of (a.sections || []).entries()) {
      if (!x.title) throw new ApiError(`Exercice ${i + 1} : donnez-lui un titre.`)
      if (!(a.questions || []).some((q) => q.sectionId === x.id)) throw new ApiError(`Exercice ${i + 1} (${x.title}) : ajoutez au moins une question.`)
    }
  }
  if (!a.matiereId || !classIdsOf(a).length) throw new ApiError('Choisissez une matière et au moins une classe.')
  // Les outils utilisés doivent être prévus pour la matière (réglage de l'administrateur)
  const matiere = db.matieres.find((m) => m.id === Number(a.matiereId))
  for (const [i, q] of (a.questions || []).entries()) {
    const tool = questionTool(q)
    if (tool && !(matiere?.tools || []).includes(tool)) {
      throw new ApiError(`Question ${i + 1} : l'outil ${TOOLS[tool]?.label ?? tool} n'est pas prévu pour la matière « ${matiere?.name} ». Demandez à l'administration de l'ajouter, ou changez de langage.`)
    }
    // Langage choisi pour l'épreuve (étape Informations)
    if (q.type === 'code' && a.languages?.length && !a.languages.includes(q.data?.language)) {
      throw new ApiError(`Question ${i + 1} : le langage ${TOOLS[q.data?.language]?.label ?? q.data?.language} n'est pas un langage choisi pour cette épreuve (${a.languages.map((l) => TOOLS[l]?.label ?? l).join(', ')}).`)
    }
  }
  if (publish && a.questions?.some((q) => q.type === 'code') && !a.languages?.length) {
    throw new ApiError('Choisissez le langage de programmation de l\'épreuve (étape Informations).')
  }
  if (!publish) return
  if (!a.startAt || !a.endAt) throw new ApiError('Les dates de début et de fin sont obligatoires pour publier.')
  if (new Date(a.endAt) <= new Date(a.startAt)) throw new ApiError('La date de fin doit être après la date de début.')
  if (a.kind === 'examen' && !(a.durationMin > 0)) throw new ApiError('Indiquez la durée de l\'examen.')
  if (!a.questions?.length) throw new ApiError('Ajoutez au moins une question avant de publier.')
  for (const [i, q] of a.questions.entries()) {
    const n = i + 1
    if (!q.statement?.trim()) throw new ApiError(`Question ${n} : l'énoncé est vide.`)
    if (!(Number(q.points) > 0)) throw new ApiError(`Question ${n} : le barème doit être supérieur à 0.`)
    if (q.type === 'qcm') {
      if ((q.data.choices || []).filter((c) => c.text.trim()).length < 2) throw new ApiError(`Question ${n} : il faut au moins deux choix.`)
      if (!q.data.correct?.length) throw new ApiError(`Question ${n} : cochez la ou les bonnes réponses.`)
    }
    if (q.type === 'code') {
      if (!q.data.tests?.length) throw new ApiError(`Question ${n} : ajoutez au moins un test automatique.`)
      const sum = q.data.tests.reduce((s, t) => s + Number(t.points || 0), 0)
      if (Math.abs(sum - Number(q.points)) > 0.001) throw new ApiError(`Question ${n} : la somme des points des tests (${sum}) doit être égale au barème (${q.points}).`)
    }
    if (q.type === 'sql' && (!q.data.schemaSql?.trim() || !q.data.expectedQuery?.trim())) {
      throw new ApiError(`Question ${n} : le schéma et la requête attendue sont obligatoires.`)
    }
  }
}

// POST/PUT /api/assessments
export async function saveAssessment(input, publish = false) {
  await load()
  const user = requireUser('teacher')
  const a = clone(input)
  // Toutes les classes et matières de l'école sont ouvertes aux enseignants ; une épreuve peut viser plusieurs classes
  const classeIds = [...new Set(classIdsOf(a))].filter((id) => db.classes.some((c) => c.id === id))
  if (!classeIds.length || !db.matieres.some((m) => m.id === Number(a.matiereId))) {
    throw new ApiError('Choisissez au moins une classe et une matière.')
  }
  a.classeIds = classeIds
  a.classeId = classeIds[0]
  a.sections = cleanSections(a)
  validateAssessment(a, publish)
  for (const q of a.questions) if (!q.id || q.id < 0) q.id = nextId('question')
  const fields = {
    title: a.title.trim(), description: a.description || '', kind: a.kind,
    matiereId: Number(a.matiereId), classeId: a.classeId, classeIds: a.classeIds,
    startAt: a.startAt || null, endAt: a.endAt || null,
    durationMin: a.kind === 'examen' ? Number(a.durationMin) : null,
    maxAttempts: a.kind === 'devoir' ? Math.max(1, Number(a.maxAttempts) || 1) : 1,
    security: a.security, questions: a.questions, sections: a.sections,
    languages: (a.languages || []).filter((l) => TOOLS[l]?.code),
  }
  let saved
  if (a.id) {
    saved = db.assessments.find((x) => x.id === a.id)
    if (!saved || saved.teacherId !== user.id) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
    if (saved.status === 'publie' && db.attempts.some((t) => t.assessmentId === saved.id)) {
      // Des copies existent : on interdit de modifier les questions.
      const sameQuestions = JSON.stringify(saved.questions) === JSON.stringify(fields.questions)
      if (!sameQuestions) throw new ApiError('Des étudiants ont déjà commencé : les questions ne peuvent plus être modifiées. Dupliquez l\'épreuve si besoin.')
    }
    Object.assign(saved, fields)
  } else {
    saved = { id: nextId('assessment'), schoolId: user.schoolId, teacherId: user.id, status: 'brouillon', resultsPublished: false, createdAt: now(), ...fields }
    db.assessments.push(saved)
  }
  if (publish && saved.status !== 'publie') {
    saved.status = 'publie'
    audit(user, 'publication_epreuve', saved.title)
    const students = studentsOf(saved)
    for (const s of students) notify(s.id, saved.kind === 'examen' ? 'Nouvel examen' : 'Nouveau devoir', saved.title, saved.kind === 'examen' ? '/etudiant/examens' : '/etudiant/devoirs')
    if (saved.kind === 'examen' && !db.sessions.some((s) => s.assessmentId === saved.id)) {
      db.sessions.push({ id: nextId('session'), schoolId: user.schoolId, assessmentId: saved.id, code: randomCode(), room: '', status: 'planifiee', proctorId: null, openedAt: null, closedAt: null })
    }
  } else if (!a.id) {
    audit(user, 'creation_brouillon', saved.title)
  }
  save()
  return clone(decorateAssessment(saved))
}

// POST /api/assessments/{id}/duplicate
export async function duplicateAssessment(id) {
  await load()
  const user = requireUser('teacher')
  const src = db.assessments.find((x) => x.id === id && x.teacherId === user.id)
  if (!src) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  const copy = clone(src)
  copy.id = nextId('assessment')
  copy.title = src.title + ' (copie)'
  copy.status = 'brouillon'
  copy.resultsPublished = false
  copy.createdAt = now()
  copy.questions = copy.questions.map((q) => ({ ...q, id: nextId('question') }))
  db.assessments.push(copy)
  audit(user, 'duplication_epreuve', src.title)
  save()
  return copy.id
}

// PATCH /api/assessments/{id}/status
export async function setAssessmentStatus(id, status) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === id && x.teacherId === user.id)
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  if (status === 'annule') {
    a.status = 'annule'
    for (const s of db.sessions.filter((x) => x.assessmentId === id && x.status !== 'fermee')) s.status = 'fermee'
    for (const st of studentsOf(a)) notify(st.id, 'Épreuve annulée', a.title)
  }
  if (status === 'brouillon') {
    if (db.attempts.some((t) => t.assessmentId === id)) throw new ApiError('Des copies existent déjà : impossible de repasser en brouillon.')
    a.status = 'brouillon'
  }
  audit(user, 'statut_epreuve_' + status, a.title)
  save()
}

// DELETE /api/assessments/{id}  (brouillons uniquement)
export async function deleteAssessment(id) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === id && x.teacherId === user.id)
  if (!a || a.status !== 'brouillon') throw new ApiError('Seuls les brouillons peuvent être supprimés.')
  db.assessments = db.assessments.filter((x) => x.id !== id)
  db.sessions = db.sessions.filter((s) => s.assessmentId !== id)
  audit(user, 'suppression_brouillon', a.title)
  save()
}

// ---------------------------------------------------------------------------
// Banque de questions
// ---------------------------------------------------------------------------

export async function listBank() {
  await load()
  const user = requireUser('teacher')
  return clone(db.bank.filter((b) => b.ownerId === user.id).map((b) => ({ ...b, matiere: db.matieres.find((m) => m.id === b.matiereId)?.name ?? '' })))
}

export async function saveBankQuestion(item) {
  await load()
  const user = requireUser('teacher')
  if (!item.statement?.trim()) throw new ApiError('L\'énoncé est obligatoire.')
  const data = clone(item)
  if (data.id && db.bank.some((b) => b.id === data.id && b.ownerId === user.id)) {
    const idx = db.bank.findIndex((b) => b.id === data.id)
    db.bank[idx] = { ...db.bank[idx], ...data, ownerId: user.id }
  } else {
    db.bank.push({ ...data, id: nextId('bank'), ownerId: user.id })
  }
  save()
}

export async function deleteBankQuestion(id) {
  await load()
  const user = requireUser('teacher')
  db.bank = db.bank.filter((b) => !(b.id === id && b.ownerId === user.id))
  save()
}

// ---------------------------------------------------------------------------
// Espace étudiant
// ---------------------------------------------------------------------------

function attemptsOf(studentId, assessmentId) {
  return db.attempts.filter((t) => t.studentId === studentId && t.assessmentId === assessmentId)
}

// Statut affiché : à faire (gris), en cours (bleu), rendu / corrigé (vert), non rendu.
function studentStatus(a, atts) {
  const t = Date.now()
  const inProgress = atts.find((x) => x.status === 'en_cours')
  if (inProgress) return 'en_cours'
  const done = atts.filter((x) => x.status !== 'en_cours')
  if (done.some((x) => x.status === 'corrige') && a.resultsPublished) return 'corrige'
  if (done.length) return 'rendu'
  if (a.endAt && new Date(a.endAt).getTime() < t) return 'non_rendu'
  if (a.startAt && new Date(a.startAt).getTime() > t) return 'a_venir'
  return 'a_faire'
}

function studentAssessmentView(a, student) {
  closeExpiredAttempts()
  const atts = attemptsOf(student.id, a.id)
  const d = decorateAssessment(a)
  const published = a.resultsPublished
  const best = atts.filter((x) => x.status === 'corrige').sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0]
  return {
    id: a.id, kind: a.kind, status: a.status, title: a.title, description: a.description,
    matiere: d.matiere, classe: d.classe, teacher: d.teacher, startAt: a.startAt, endAt: a.endAt,
    durationMin: a.durationMin, maxAttempts: a.maxAttempts, maxPoints: d.maxPoints, questionCount: d.questionCount,
    languages: a.languages || [],
    security: { fullscreen: a.security.fullscreen, blockPaste: a.security.blockPaste, sebRequired: a.security.sebRequired, exitWarnings: a.security.exitWarnings ?? null },
    sessionStatus: d.session?.status ?? null, room: d.session?.room ?? '',
    attemptsUsed: atts.length,
    attemptInProgress: atts.find((x) => x.status === 'en_cours')?.id ?? null,
    lastSubmittedAt: atts.filter((x) => x.submittedAt).map((x) => x.submittedAt).sort().at(-1) ?? null,
    studentStatus: studentStatus(a, atts),
    score: published && best ? best.score : null,
    note20: published && best ? Math.round((best.score / best.maxScore) * 200) / 10 : null,
  }
}

// GET /api/student/assessments
export async function studentAssessments() {
  await load()
  const user = requireUser('student')
  return db.assessments
    .filter((a) => classIdsOf(a).includes(user.classeId) && a.status !== 'brouillon')
    .map((a) => studentAssessmentView(a, user))
}

// GET /api/student/assessments/{id}
export async function studentAssessment(id) {
  await load()
  const user = requireUser('student')
  const a = db.assessments.find((x) => x.id === Number(id) && classIdsOf(x).includes(user.classeId) && x.status !== 'brouillon')
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  return studentAssessmentView(a, user)
}

// GET /api/student/home
export async function studentHome() {
  const list = await studentAssessments()
  const user = requireUser('student')
  const t = Date.now()
  const open = (a) => a.status === 'publie' && (!a.endAt || new Date(a.endAt).getTime() > t)
  const devoirs = list.filter((a) => a.kind === 'devoir' && open(a)).sort((x, y) => (x.endAt > y.endAt ? 1 : -1))
  const examens = list.filter((a) => a.kind === 'examen' && open(a)).sort((x, y) => (x.startAt > y.startAt ? 1 : -1))
  const pending = [...examens, ...devoirs].filter((a) => ['a_faire', 'en_cours', 'a_venir'].includes(a.studentStatus))
  pending.sort((x, y) => {
    const kx = x.kind === 'examen' ? x.startAt : x.endAt
    const ky = y.kind === 'examen' ? y.startAt : y.endAt
    return kx > ky ? 1 : -1
  })
  const results = (await studentResults()).slice(0, 4)
  return {
    next: pending[0] ?? null,
    devoirs: devoirs.slice(0, 4),
    examens: examens.slice(0, 4),
    results,
    bulletin: (await studentBulletins())[0] ?? null,
    announcements: (await listAnnouncements()).slice(0, 3),
    classe: db.classes.find((c) => c.id === user.classeId)?.name ?? '',
  }
}

// GET /api/student/results
export async function studentResults() {
  await load()
  const user = requireUser('student')
  return db.attempts
    .filter((t) => t.studentId === user.id && t.status === 'corrige')
    .map((t) => ({ t, a: db.assessments.find((x) => x.id === t.assessmentId) }))
    .filter(({ a }) => a && a.resultsPublished)
    .map(({ t, a }) => ({
      attemptId: t.id, assessmentId: a.id, title: a.title, kind: a.kind,
      matiere: db.matieres.find((m) => m.id === a.matiereId)?.name ?? '',
      score: t.score, maxScore: t.maxScore, note20: Math.round((t.score / t.maxScore) * 200) / 10,
      gradedAt: t.gradedAt, submittedAt: t.submittedAt,
    }))
    .sort((x, y) => (y.gradedAt > x.gradedAt ? 1 : -1))
}

// GET /api/student/results/{attemptId}
export async function studentResultDetail(attemptId) {
  await load()
  const user = requireUser('student')
  const t = db.attempts.find((x) => x.id === Number(attemptId) && x.studentId === user.id)
  const a = t && db.assessments.find((x) => x.id === t.assessmentId)
  if (!t || !a?.resultsPublished || t.status !== 'corrige') throw new ApiError('Résultat non disponible.', 'not_found', 404)
  return {
    title: a.title, matiere: db.matieres.find((m) => m.id === a.matiereId)?.name ?? '',
    score: t.score, maxScore: t.maxScore, note20: Math.round((t.score / t.maxScore) * 200) / 10,
    questions: a.questions.map((q) => {
      const an = t.answers[q.id] || {}
      return {
        id: q.id, type: q.type, statement: q.statement, points: q.points,
        data: studentQuestion(q).data, value: an.value ?? null,
        score: an.manualScore ?? an.autoScore ?? 0, feedback: an.feedback || '',
        testResults: an.testResults ?? null,
      }
    }),
  }
}

// POST /api/student/join  { code }
export async function joinWithCode(code) {
  await load()
  const user = requireUser('student')
  const s = db.sessions.find((x) => x.code === code.trim().toUpperCase())
  if (!s) throw new ApiError('Ce code ne correspond à aucun examen. Vérifiez-le auprès du surveillant.', 'bad_code', 404)
  const a = db.assessments.find((x) => x.id === s.assessmentId)
  if (!a || !classIdsOf(a).includes(user.classeId) || a.status !== 'publie') throw new ApiError('Cet examen ne concerne pas votre classe.', 'forbidden', 403)
  if (s.status === 'planifiee') throw new ApiError('La session n\'est pas encore ouverte. Attendez le signal du surveillant.', 'not_open', 409)
  if (s.status === 'fermee') throw new ApiError('Cette session est fermée.', 'closed', 409)
  return { assessmentId: a.id, sessionId: s.id }
}

// Heure limite d'une copie. En mode test, seule la durée compte (pas la fin du créneau).
function attemptLimit(att, a) {
  const own = att.deadlineAt ? new Date(att.deadlineAt).getTime() : Infinity
  if (att.testMode) return own
  return Math.min(own, a?.endAt ? new Date(a.endAt).getTime() : Infinity)
}

function closeExpiredAttempts() {
  const t = Date.now()
  let changed = false
  for (const att of db.attempts) {
    if (att.status !== 'en_cours') continue
    const a = db.assessments.find((x) => x.id === att.assessmentId)
    const limit = attemptLimit(att, a)
    // 2 minutes de tolérance pour la dernière sauvegarde
    if (t > limit + 2 * 60 * 1000) {
      att.status = 'rendu'
      att.submittedAt = new Date(limit).toISOString()
      att.events.push({ type: 'auto_submitted', at: now() })
      autoGrade(att, a)
      changed = true
    }
  }
  if (changed) save()
}

// POST /api/student/assessments/{id}/start
export async function startAttempt(assessmentId, sessionCode = null) {
  await load()
  const user = requireUser('student')
  closeExpiredAttempts()
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && classIdsOf(x).includes(user.classeId))
  if (!a || a.status !== 'publie') throw new ApiError('Épreuve indisponible.', 'not_found', 404)
  const t = Date.now()
  const existing = attemptsOf(user.id, a.id).find((x) => x.status === 'en_cours')
  if (existing) return existing.id // reprise après une coupure

  const free = a.kind === 'examen' && TEST_MODE.examsWithoutCode
  if (a.startAt && new Date(a.startAt).getTime() > t && a.kind === 'devoir') throw new ApiError('Ce devoir n\'est pas encore ouvert.')
  if (!free && a.endAt && new Date(a.endAt).getTime() < t) throw new ApiError('La date limite est dépassée.')
  if (!free && attemptsOf(user.id, a.id).length >= a.maxAttempts) throw new ApiError('Vous avez utilisé toutes vos tentatives.')

  let session = null
  if (a.kind === 'examen') {
    session = db.sessions.find((s) => s.assessmentId === a.id && s.status === 'ouverte') ?? null
    if (!free) {
      if (!session) throw new ApiError('La session d\'examen n\'est pas ouverte.', 'not_open', 409)
      if (!sessionCode || sessionCode.toUpperCase() !== session.code) throw new ApiError('Code d\'examen requis.', 'code_required', 403)
    }
  }
  const deadline = a.kind === 'examen'
    ? new Date(free ? t + a.durationMin * 60 * 1000 : Math.min(t + a.durationMin * 60 * 1000, new Date(a.endAt).getTime())).toISOString()
    : null
  const att = {
    id: nextId('attempt'), schoolId: user.schoolId, assessmentId: a.id, studentId: user.id,
    sessionId: session?.id ?? null, number: attemptsOf(user.id, a.id).length + 1,
    startedAt: now(), deadlineAt: deadline, submittedAt: null, status: 'en_cours',
    answers: {}, snapshots: [], events: [{ type: 'started', at: now() }],
    score: null, maxScore: maxPoints(a), gradedAt: null, lastSeenAt: now(),
    ...(free ? { testMode: true } : {}),
  }
  db.attempts.push(att)
  save()
  return att.id
}

function ownAttempt(user, attemptId) {
  const att = db.attempts.find((x) => x.id === Number(attemptId) && x.studentId === user.id)
  if (!att) throw new ApiError('Copie introuvable.', 'not_found', 404)
  return att
}

// Sorties de l'épreuve déjà comptées (avertissements), conservées même si la page est rechargée
function countExits(events = []) {
  return events.filter((e) => e.type === 'exit_counted').length
}

// Ordre des questions propre à chaque copie (stable entre deux rechargements)
// Ordre des questions pour une copie. Mélangé si l'épreuve le demande, mais à l'intérieur de chaque
// exercice : les exercices gardent leur ordre et leurs questions restent groupées.
function orderFor(att, a) {
  if (!a.security.shuffleQuestions) return a.questions
  let seed = att.id * 2654435761 % 4294967296
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const shuffle = (list) => {
    const qs = [...list]
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[qs[i], qs[j]] = [qs[j], qs[i]]
    }
    return qs
  }
  if (!a.sections?.length) return shuffle(a.questions)
  return a.sections.flatMap((x) => shuffle(a.questions.filter((q) => q.sectionId === x.id)))
}

// GET /api/student/attempts/{id}
export async function getAttempt(attemptId) {
  await load()
  const user = requireUser('student')
  closeExpiredAttempts()
  const att = ownAttempt(user, attemptId)
  const a = db.assessments.find((x) => x.id === att.assessmentId)
  att.lastSeenAt = now()
  save()
  return {
    id: att.id, status: att.status, startedAt: att.startedAt, deadlineAt: att.deadlineAt ?? a.endAt,
    submittedAt: att.submittedAt, number: att.number,
    answers: Object.fromEntries(Object.entries(att.answers).map(([k, v]) => [k, v.value])),
    assessment: {
      id: a.id, title: a.title, kind: a.kind, description: a.description,
      matiere: db.matieres.find((m) => m.id === a.matiereId)?.name ?? '',
      maxAttempts: a.maxAttempts, security: a.security, maxPoints: maxPoints(a),
      languages: a.languages || [],
      sections: (a.sections || []).map(({ id, title, intro }) => ({ id, title, intro })),
      questions: orderFor(att, a).map(studentQuestion),
    },
    exitCount: countExits(att.events),
    autosaveSeconds: db.school.settings.autosaveSeconds,
  }
}

function assertWritable(att) {
  if (att.status !== 'en_cours') throw new ApiError('Cette copie a déjà été rendue.', 'closed', 409)
  const a = db.assessments.find((x) => x.id === att.assessmentId)
  const limit = attemptLimit(att, a)
  if (Date.now() > limit + 2 * 60 * 1000) throw new ApiError('Le temps est écoulé.', 'time_over', 409)
  if (a.kind === 'examen') {
    const s = db.sessions.find((x) => x.id === att.sessionId)
    if (s && s.status === 'fermee') throw new ApiError('La session a été fermée par le surveillant.', 'closed', 409)
  }
  return a
}

// PUT /api/student/attempts/{id}/answers  { [questionId]: value }
export async function saveAnswers(attemptId, changes) {
  await load()
  const user = requireUser('student')
  const att = ownAttempt(user, attemptId)
  const a = assertWritable(att)
  for (const [qid, value] of Object.entries(changes)) {
    const q = a.questions.find((x) => String(x.id) === String(qid))
    if (!q) continue
    const prev = att.answers[qid]
    if (prev && JSON.stringify(prev.value) === JSON.stringify(value)) continue
    if (q.type === 'diagram' && String(value || '').length / 1024 > DIAGRAM_MAX_KB) {
      throw new ApiError(`Votre diagramme est trop volumineux (plus de ${DIAGRAM_MAX_KB} Ko). Retirez les images collées ou les éléments inutiles.`)
    }
    att.answers[qid] = { ...(prev || {}), value, updatedAt: now(), autoScore: null, manualScore: null, feedback: '' }
    // Instantanés horodatés du code
    if (q.type === 'code' || q.type === 'sql' || q.type === 'html') {
      att.snapshots.push({ qid: Number(qid), value, at: now() })
      if (att.snapshots.length > 400) att.snapshots.splice(0, att.snapshots.length - 400)
    }
  }
  att.lastSeenAt = now()
  save()
  return { savedAt: now() }
}

// POST /api/student/attempts/{id}/events
export async function logEvents(attemptId, events) {
  await load()
  const user = requireUser('student')
  const att = ownAttempt(user, attemptId)
  if (att.status !== 'en_cours') return
  for (const e of events) att.events.push({ type: e.type, at: e.at || now(), detail: e.detail || null })
  att.lastSeenAt = now()
  save()
}

// POST /api/student/attempts/{id}/submit
// reason : 'exits' quand la copie est envoyée automatiquement après des sorties répétées
export async function submitAttempt(attemptId, finalChanges = {}, reason = null) {
  await load()
  const user = requireUser('student')
  const att = ownAttempt(user, attemptId)
  if (att.status !== 'en_cours') return
  if (Object.keys(finalChanges).length) await saveAnswers(attemptId, finalChanges)
  const a = db.assessments.find((x) => x.id === att.assessmentId)
  att.status = 'rendu'
  att.submittedAt = now()
  att.events.push({ type: reason === 'exits' ? 'auto_submitted_exits' : 'submitted', at: now(), detail: reason === 'exits' ? { exits: countExits(att.events) + 1 } : null })
  autoGrade(att, a)
  notify(a.teacherId, reason === 'exits' ? 'Copie envoyée automatiquement' : 'Copie rendue',
    reason === 'exits'
      ? `${user.firstName} ${user.lastName} a quitté « ${a.title} » après l'avertissement : copie envoyée automatiquement.`
      : `${user.firstName} ${user.lastName} a rendu « ${a.title} ».`,
    '/enseignant/corrections')
  save()
}

// Correction automatique côté démo : QCM uniquement.
// Code et SQL : faite par le serveur de correction (bac à sable), pas encore branché.
function autoGrade(att, a) {
  for (const q of a.questions) {
    const an = att.answers[q.id]
    if (q.type === 'qcm') {
      const chosen = [...(an?.value || [])].sort()
      const correct = [...(q.data.correct || [])].sort()
      const ok = chosen.length && JSON.stringify(chosen) === JSON.stringify(correct)
      if (an) an.autoScore = ok ? Number(q.points) : 0
      else att.answers[q.id] = { value: null, updatedAt: null, autoScore: 0, manualScore: null, feedback: '' }
    }
  }
}

// POST /api/run
// Le code d'un étudiant s'exécute dans son navigateur (Web Worker isolé, temps limité), jamais sur le serveur :
// Python, JavaScript, SQL, PHP et C (de base). Les autres langages (C++, Java, OCaml, pseudo-code) s'écrivent
// sans s'exécuter : l'enseignant les corrige à la main.
// Le résultat montré à l'étudiant sert à essayer son code ; la note vient de la correction.
// { language, code, stdin, tests: [{ name, stdin, expected }], timeLimitMs, schemaSql, seedSql }
export async function runCode(params = {}) {
  await load()
  requireUser()
  return executeCode(params)
}

// Exécution seule, sans accès aux données
export async function executeCode({ language, code = '', stdin = '', tests = [], timeLimitMs = 2000, schemaSql = '', seedSql = '', runCustom = true } = {}) {
  if (!TEST_MODE.runCodeInBrowser || !BROWSER_LANGS.includes(language)) {
    await wait(300)
    return {
      available: false,
      message: `L'exécution du ${LANGUAGE_NAMES[language] || 'code'} n'est pas disponible sur la plateforme. Votre code est bien enregistré ; l'enseignant le corrigera.`,
    }
  }
  if (language === 'sql') {
    const r = await runInBrowser('sql', { schema: schemaSql, seed: seedSql, query: code }, Math.max(timeLimitMs, 3000))
    return { available: true, browser: true, ...r }
  }
  const results = []
  for (const t of tests) {
    const r = await runInBrowser(language, { code, stdin: t.stdin }, timeLimitMs)
    results.push({
      name: t.name, stdin: t.stdin, expected: t.expected, stdout: r.stdout, stderr: r.stderr, timeout: !!r.timeout,
      passed: !r.timeout && !r.stderr && sameOutput(r.stdout, t.expected),
    })
    if (r.failed) break
  }
  // Exécution libre avec l'entrée saisie (bouton Lancer) ; absente quand on ne teste que les exemples
  const custom = !runCustom ? { stdout: '', stderr: '', transcript: [] } : await runInBrowser(language, { code, stdin }, timeLimitMs)
  return {
    available: true, browser: true, results, timeLimitMs,
    stdout: custom.stdout, stderr: custom.stderr, timeout: !!custom.timeout,
    transcript: custom.transcript || [], exitCode: custom.timeout ? 124 : custom.exitCode ?? 0, durationMs: custom.durationMs,
  }
}

const LANGUAGE_NAMES = { c: 'code C', cpp: 'code C++', java: 'code Java', php: 'code PHP', python: 'code Python', javascript: 'code JavaScript', sql: 'SQL', ocaml: 'code OCaml', algo: 'pseudo-code' }

// ---------------------------------------------------------------------------
// Correction (enseignant)
// ---------------------------------------------------------------------------

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

// GET /api/grading?assessmentId=
export async function listCopies(assessmentId = null) {
  await load()
  const user = requireUser('teacher', 'admin')
  const mine = db.assessments.filter((a) => (user.role === 'admin' || a.teacherId === user.id) && (!assessmentId || a.id === Number(assessmentId)))
  return db.attempts
    .filter((t) => mine.some((a) => a.id === t.assessmentId) && t.status !== 'en_cours')
    .map((t) => {
      const a = mine.find((x) => x.id === t.assessmentId)
      const s = db.users.find((u) => u.id === t.studentId)
      return {
        id: t.id, assessmentId: a.id, assessment: a.title, kind: a.kind, resultsPublished: a.resultsPublished,
        student: `${s.lastName} ${s.firstName}`, matricule: s.matricule,
        submittedAt: t.submittedAt, status: t.status, score: t.score, maxScore: t.maxScore,
        risk: riskScore(t.events), eventCount: t.events.filter((e) => EVENT_WEIGHTS[e.type]).length,
      }
    })
    .sort((x, y) => (y.submittedAt > x.submittedAt ? 1 : -1))
}

// GET /api/grading/{attemptId}
export async function getCopy(attemptId) {
  await load()
  const user = requireUser('teacher', 'admin')
  const t = db.attempts.find((x) => x.id === Number(attemptId))
  const a = t && db.assessments.find((x) => x.id === t.assessmentId)
  if (!t || !a || (user.role === 'teacher' && a.teacherId !== user.id)) throw new ApiError('Copie introuvable.', 'not_found', 404)
  const s = db.users.find((u) => u.id === t.studentId)
  return clone({
    attempt: t, assessment: decorateAssessment(a), student: publicUser(s), risk: riskScore(t.events),
    siblings: db.attempts.filter((x) => x.assessmentId === a.id && x.status !== 'en_cours').map((x) => x.id),
  })
}

// PUT /api/grading/{attemptId}
export async function gradeCopy(attemptId, grades, finalOverride = null) {
  await load()
  const user = requireUser('teacher')
  const t = db.attempts.find((x) => x.id === Number(attemptId))
  const a = t && db.assessments.find((x) => x.id === t.assessmentId && x.teacherId === user.id)
  if (!a) throw new ApiError('Copie introuvable.', 'not_found', 404)
  let total = 0
  for (const q of a.questions) {
    const g = grades[q.id] || {}
    const an = t.answers[q.id] || (t.answers[q.id] = { value: null, updatedAt: null, autoScore: null, manualScore: null, feedback: '' })
    if (g.score !== undefined && g.score !== '' && g.score !== null) {
      const sc = Number(g.score)
      if (Number.isNaN(sc) || sc < 0 || sc > Number(q.points)) throw new ApiError(`La note de la question doit être entre 0 et ${q.points}.`)
      an.manualScore = sc
    }
    an.feedback = g.feedback ?? an.feedback
    if (g.criteria) an.criteria = g.criteria
    total += Number(an.manualScore ?? an.autoScore ?? 0)
  }
  if (finalOverride !== null && finalOverride !== '') {
    const f = Number(finalOverride)
    if (Number.isNaN(f) || f < 0 || f > t.maxScore) throw new ApiError(`La note finale doit être entre 0 et ${t.maxScore}.`)
    total = f
    t.finalOverride = f
  } else {
    t.finalOverride = null
  }
  t.score = Math.round(total * 100) / 100
  t.status = 'corrige'
  t.gradedAt = now()
  audit(user, 'correction_copie', a.title, `copie n°${t.id} : ${t.score}/${t.maxScore}`)
  save()
}

// ---------------------------------------------------------------------------
// Aides à la correction
// ---------------------------------------------------------------------------

// Questions corrigeables sans intervention : QCM, code (tests), SQL (comparaison des résultats)
const AUTO_TYPES = ['qcm', 'code', 'sql']

function teacherAttempt(user, attemptId) {
  const t = db.attempts.find((x) => x.id === Number(attemptId))
  const a = t && db.assessments.find((x) => x.id === t.assessmentId)
  if (!t || !a || (user.role === 'teacher' && a.teacherId !== user.id)) throw new ApiError('Copie introuvable.', 'not_found', 404)
  return { t, a }
}

// Recalcule la note d'une copie ; elle devient « corrigée » quand chaque question a une note
function recomputeAttempt(t, a) {
  const scores = a.questions.map((q) => {
    const an = t.answers[q.id]
    return an ? an.manualScore ?? an.autoScore ?? null : null
  })
  const complete = scores.every((s) => s !== null)
  if (complete) {
    t.score = t.finalOverride ?? round2(scores.reduce((s, x) => s + x, 0))
    t.status = 'corrige'
    t.gradedAt = now()
  }
  return complete
}

// POST /api/grading/{attemptId}/autograde : exécute TOUS les tests (cachés compris) et compare le SQL.
// Se fait en trois temps pour que le code tourne dans le navigateur de l'enseignant et jamais sur le
// serveur : autoGradeJobs (données) -> runAutoGradeJobs (exécution) -> applyAutoGrade (notes).
export async function autoGradeCopy(attemptId) {
  return autoGradeCopyWith({ autoGradeJobs, applyAutoGrade }, attemptId)
}

export async function autoGradeCopyWith(api, attemptId) {
  const jobs = await api.autoGradeJobs(attemptId)
  return api.applyAutoGrade(attemptId, await runAutoGradeJobs(jobs))
}

// Codes à exécuter pour une copie (tests cachés compris : réservé à l'enseignant de l'épreuve)
export async function autoGradeJobs(attemptId) {
  await load()
  const user = requireUser('teacher')
  const { t, a } = teacherAttempt(user, attemptId)
  const jobs = []
  for (const q of a.questions) {
    const value = t.answers[q.id]?.value
    if (typeof value !== 'string' || !value.trim()) continue
    // Seuls les langages exécutables dans le navigateur sont corrigés automatiquement ;
    // les autres (C++, Java, OCaml, pseudo-code) restent à corriger à la main
    const lang = q.data?.language
    const inBrowser = TEST_MODE.runCodeInBrowser && BROWSER_LANGS.includes(lang)
    if (q.type === 'code' && inBrowser) {
      jobs.push({ questionId: q.id, kind: 'code', language: lang, code: value, timeLimitMs: q.data.timeLimitMs || 2000, tests: (q.data.tests || []).map((x) => ({ stdin: x.stdin })) })
    }
    if (q.type === 'sql') {
      jobs.push({ questionId: q.id, kind: 'sql', schema: q.data.schemaSql, seed: q.data.seedSql, query: value, expected: q.data.expectedQuery, orderMatters: !!q.data.orderMatters })
    }
  }
  return jobs
}

// Exécution des codes à corriger, dans le navigateur de l'enseignant
export async function runAutoGradeJobs(jobs) {
  const out = {}
  for (const job of jobs) {
    if (job.kind === 'sql') {
      const r = await runInBrowser('sql', { schema: job.schema, seed: job.seed, query: job.query, expected: job.expected, orderMatters: job.orderMatters }, 3000)
      out[job.questionId] = { match: !!r.match, stderr: r.stderr || '' }
    } else {
      out[job.questionId] = []
      for (const test of job.tests) {
        const r = await runInBrowser(job.language, { code: job.code, stdin: test.stdin }, job.timeLimitMs)
        out[job.questionId].push({ stdout: (r.stdout || '').slice(0, 2000), stderr: r.stderr || '', timeout: !!r.timeout })
      }
    }
  }
  return out
}

// Applique les résultats : la comparaison aux sorties attendues et les points restent calculés ici
export async function applyAutoGrade(attemptId, outputs = {}) {
  await load()
  const user = requireUser('teacher')
  const { t, a } = teacherAttempt(user, attemptId)
  const report = { graded: 0, skipped: [] }
  for (const q of a.questions) {
    const an = t.answers[q.id] || (t.answers[q.id] = { value: null, updatedAt: null, autoScore: null, manualScore: null, feedback: '' })
    if (q.type === 'qcm') {
      const ok = JSON.stringify([...(an.value || [])].sort()) === JSON.stringify([...(q.data.correct || [])].sort()) && (an.value || []).length > 0
      an.autoScore = ok ? Number(q.points) : 0
      report.graded++
    }
    if (q.type === 'code') {
      const lang = q.data.language
      if (!an.value?.trim()) { an.autoScore = 0; an.testResults = []; report.graded++; continue }
      const runs = outputs[q.id]
      if (!Array.isArray(runs)) { report.skipped.push(`${TOOLS[lang]?.label ?? lang} (serveur)`); continue }
      const results = (q.data.tests || []).map((test, i) => {
        const r = runs[i] || { stdout: '', stderr: 'Non exécuté', timeout: false }
        const passed = !r.timeout && !r.stderr && sameOutput(r.stdout, test.expected)
        return { name: test.name, hidden: !!test.hidden, points: Number(test.points), passed, timeout: !!r.timeout, stdout: String(r.stdout || '').slice(0, 300), stderr: String(r.stderr || '').split('\n').slice(-1)[0] }
      })
      an.testResults = results
      an.autoScore = round2(results.filter((r) => r.passed).reduce((s, r) => s + r.points, 0))
      report.graded++
    }
    if (q.type === 'sql') {
      if (!an.value?.trim()) { an.autoScore = 0; report.graded++; continue }
      const r = outputs[q.id] || { match: false, stderr: 'Non exécuté' }
      an.autoScore = r.match ? Number(q.points) : 0
      an.testResults = [{ name: 'Résultat comparé à la requête de référence', points: Number(q.points), passed: !!r.match, stderr: String(r.stderr || '') }]
      report.graded++
    }
  }
  t.autoGradedAt = now()
  save()
  return report
}

// Corrige automatiquement toutes les copies rendues d'une épreuve (onProgress(n, total))
export async function autoGradeAll(assessmentId, onProgress) {
  return autoGradeAllWith({ autoGradeTargets, autoGradeCopy, autoGradeDone }, assessmentId, onProgress)
}

export async function autoGradeAllWith(api, assessmentId, onProgress) {
  const { ids, autoOnly } = await api.autoGradeTargets(assessmentId)
  const skipped = new Set()
  let i = 0
  for (const id of ids) {
    const r = await api.autoGradeCopy(id)
    r.skipped.forEach((s) => skipped.add(s))
    onProgress?.(++i, ids.length)
  }
  await api.autoGradeDone(assessmentId, ids.length)
  return { count: ids.length, skipped: [...skipped], autoOnly }
}

function ownAssessment(user, assessmentId) {
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && x.teacherId === user.id)
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  return a
}

export async function autoGradeTargets(assessmentId) {
  await load()
  const a = ownAssessment(requireUser('teacher'), assessmentId)
  const ids = db.attempts.filter((t) => t.assessmentId === a.id && t.status !== 'en_cours').map((t) => t.id)
  return { ids, autoOnly: a.questions.every((q) => AUTO_TYPES.includes(q.type)) }
}

export async function autoGradeDone(assessmentId, count) {
  await load()
  const user = requireUser('teacher')
  const a = ownAssessment(user, assessmentId)
  audit(user, 'correction_automatique', a.title, `${Number(count) || 0} copie(s)`)
  save()
}

// Valide les copies dont toutes les questions ont une note (automatique ou manuelle)
export async function validateGradedCopies(assessmentId) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && x.teacherId === user.id)
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  let validated = 0
  let remaining = 0
  for (const t of db.attempts.filter((x) => x.assessmentId === a.id && x.status === 'rendu')) {
    if (recomputeAttempt(t, a)) validated++
    else remaining++
  }
  audit(user, 'validation_copies', a.title, `${validated} copie(s) validée(s)`)
  save()
  return { validated, remaining }
}

// GET /api/grading/question?assessmentId=&questionId=  : la même question dans toutes les copies
export async function copiesForQuestion(assessmentId, questionId) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && x.teacherId === user.id)
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  const q = a.questions.find((x) => x.id === Number(questionId)) ?? a.questions[0]
  const copies = db.attempts.filter((t) => t.assessmentId === a.id && t.status !== 'en_cours').map((t) => {
    const s = db.users.find((u) => u.id === t.studentId)
    const an = t.answers[q.id] || {}
    return {
      attemptId: t.id, student: `${s.lastName} ${s.firstName}`, matricule: s.matricule, status: t.status,
      value: an.value ?? null, autoScore: an.autoScore ?? null, manualScore: an.manualScore ?? null,
      feedback: an.feedback || '', criteria: an.criteria || {}, testResults: an.testResults || null,
    }
  }).sort((x, y) => x.student.localeCompare(y.student))
  return clone({ assessment: decorateAssessment(a), question: q, copies })
}

// PUT /api/grading/question  { [attemptId]: { score, feedback, criteria } }
export async function gradeQuestion(assessmentId, questionId, grades) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && x.teacherId === user.id)
  const q = a?.questions.find((x) => x.id === Number(questionId))
  if (!q) throw new ApiError('Question introuvable.', 'not_found', 404)
  let completed = 0
  for (const [attemptId, g] of Object.entries(grades)) {
    const t = db.attempts.find((x) => x.id === Number(attemptId) && x.assessmentId === a.id)
    if (!t) continue
    const an = t.answers[q.id] || (t.answers[q.id] = { value: null, updatedAt: null, autoScore: null, manualScore: null, feedback: '' })
    if (g.score !== '' && g.score !== null && g.score !== undefined) {
      const sc = Number(String(g.score).replace(',', '.'))
      if (Number.isNaN(sc) || sc < 0 || sc > Number(q.points)) throw new ApiError(`Les notes doivent être entre 0 et ${q.points}.`)
      an.manualScore = sc
    }
    an.feedback = g.feedback ?? an.feedback
    if (g.criteria) an.criteria = g.criteria
    if (t.status !== 'en_cours' && recomputeAttempt(t, a)) completed++
  }
  audit(user, 'correction_par_question', a.title, `${Object.keys(grades).length} copie(s)`)
  save()
  return { completed }
}

// Commentaires types de l'enseignant
export async function listComments() {
  await load()
  const user = requireUser('teacher')
  db.commentBank ||= []
  const mine = db.commentBank.filter((c) => c.ownerId === user.id)
  if (mine.length) return clone(mine)
  // Suggestions de départ
  return ['Très bonne réponse, bien argumentée.', 'Réponse incomplète : il manque des éléments essentiels.', 'Le code ne gère pas tous les cas (vérifiez les cas limites).', 'Pensez à commenter et nommer clairement vos variables.', 'Hors sujet.']
    .map((text, i) => ({ id: -1 - i, ownerId: user.id, text, suggested: true }))
}

export async function saveComment(text) {
  await load()
  const user = requireUser('teacher')
  db.commentBank ||= []
  if (!text?.trim()) return
  if (!db.commentBank.some((c) => c.ownerId === user.id && c.text === text.trim())) {
    db.seq.comment = (db.seq.comment ?? 0) + 1
    db.commentBank.push({ id: db.seq.comment, ownerId: user.id, text: text.trim() })
    save()
  }
}

export async function deleteComment(id) {
  await load()
  const user = requireUser('teacher')
  db.commentBank = (db.commentBank || []).filter((c) => !(c.id === id && c.ownerId === user.id))
  save()
}

// POST /api/assessments/{id}/publish-results
export async function publishResults(assessmentId, publish = true) {
  await load()
  const user = requireUser('teacher')
  const a = db.assessments.find((x) => x.id === Number(assessmentId) && x.teacherId === user.id)
  if (!a) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  const ungraded = db.attempts.filter((t) => t.assessmentId === a.id && t.status === 'rendu').length
  if (publish && ungraded) throw new ApiError(`${ungraded} copie(s) restent à corriger avant de publier.`)
  a.resultsPublished = publish
  if (publish) {
    for (const t of db.attempts.filter((x) => x.assessmentId === a.id && x.status === 'corrige')) {
      notify(t.studentId, 'Note publiée', `${a.title} : votre note est disponible.`, '/etudiant/resultats')
    }
  }
  audit(user, publish ? 'publication_notes' : 'retrait_notes', a.title)
  save()
}

// GET /api/assessments/{id}/results
export async function assessmentResults(assessmentId) {
  await load()
  const user = requireUser('teacher', 'admin')
  const a = db.assessments.find((x) => x.id === Number(assessmentId))
  if (!a || (user.role === 'teacher' && a.teacherId !== user.id)) throw new ApiError('Épreuve introuvable.', 'not_found', 404)
  const students = studentsOf(a)
  const rows = students.map((s) => {
    const atts = attemptsOf(s.id, a.id)
    const graded = atts.filter((t) => t.status === 'corrige').sort((x, y) => y.score - x.score)[0]
    const last = atts.at(-1)
    return {
      studentId: s.id, student: `${s.lastName} ${s.firstName}`, matricule: s.matricule, classe: db.classes.find((c) => c.id === s.classeId)?.name ?? '',
      status: graded ? 'corrige' : last ? last.status : 'absent',
      score: graded?.score ?? null, note20: graded ? Math.round((graded.score / graded.maxScore) * 200) / 10 : null,
      attemptId: graded?.id ?? last?.id ?? null, risk: last ? riskScore(last.events) : 0,
    }
  }).sort((x, y) => x.student.localeCompare(y.student))
  const notes = rows.filter((r) => r.note20 !== null).map((r) => r.note20)
  return {
    assessment: decorateAssessment(a),
    rows,
    stats: notes.length ? {
      count: notes.length,
      average: Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10,
      min: Math.min(...notes), max: Math.max(...notes),
      passRate: Math.round((notes.filter((n) => n >= 10).length / notes.length) * 100),
    } : null,
  }
}

// GET /api/teacher/classes
// Toutes les classes de l'école (L1 à M2) ; `mine` : classes où l'enseignant a une affectation
export async function teacherClasses() {
  await load()
  const user = requireUser('teacher')
  const rows = db.teaching.filter((t) => t.teacherId === user.id)
  return [...db.classes].sort(byLevel).map((c) => ({
    ...c,
    mine: rows.some((r) => r.classeId === c.id),
    filiere: db.filieres.find((f) => f.id === c.filiereId)?.name ?? '',
    matieres: rows.filter((r) => r.classeId === c.id).map((r) => db.matieres.find((m) => m.id === r.matiereId)?.name).filter(Boolean),
    students: db.users.filter((u) => u.role === 'student' && u.classeId === c.id && u.active).map(publicUser).sort((x, y) => x.lastName.localeCompare(y.lastName)),
  }))
}

// ---------------------------------------------------------------------------
// Surveillance
// ---------------------------------------------------------------------------

// GET /api/proctor/sessions
export async function listSessions() {
  await load()
  requireUser('proctor', 'admin')
  closeExpiredAttempts()
  return db.sessions.map((s) => {
    const a = db.assessments.find((x) => x.id === s.assessmentId)
    if (!a || a.status === 'brouillon') return null
    const atts = db.attempts.filter((t) => t.sessionId === s.id)
    // Session fermée : chiffres figés à la fermeture (s.summary)
    const counts = s.status === 'fermee' && s.summary ? s.summary : {
      inProgress: atts.filter((t) => t.status === 'en_cours').length,
      submitted: atts.filter((t) => t.status !== 'en_cours').length,
      alerts: atts.reduce((n, t) => n + t.events.filter((e) => EVENT_WEIGHTS[e.type]).length, 0),
    }
    return {
      ...clone(s), title: a.title, startAt: a.startAt, endAt: a.endAt, durationMin: a.durationMin,
      classe: classNamesOf(a),
      matiere: db.matieres.find((m) => m.id === a.matiereId)?.name ?? '',
      cancelled: a.status === 'annule',
      classSize: studentsOf(a).length,
      ...counts,
    }
  }).filter(Boolean)
}

// GET /api/proctor/sessions/{id}
export async function sessionDetail(sessionId) {
  await load()
  requireUser('proctor', 'admin')
  closeExpiredAttempts()
  const s = db.sessions.find((x) => x.id === Number(sessionId))
  if (!s) throw new ApiError('Session introuvable.', 'not_found', 404)
  const a = db.assessments.find((x) => x.id === s.assessmentId)
  const students = studentsOf(a)
  const participants = students.map((st) => {
    const t = db.attempts.find((x) => x.sessionId === s.id && x.studentId === st.id)
    const answered = t ? Object.values(t.answers).filter((v) => v.value !== null && v.value !== '' && !(Array.isArray(v.value) && !v.value.length)).length : 0
    return {
      studentId: st.id, name: `${st.lastName} ${st.firstName}`, matricule: st.matricule,
      status: t ? t.status : 'absent', attemptId: t?.id ?? null,
      startedAt: t?.startedAt ?? null, lastSeenAt: t?.lastSeenAt ?? null, deadlineAt: t?.deadlineAt ?? null,
      answered, total: a.questions.length,
      risk: t ? riskScore(t.events) : 0,
      events: t ? t.events.filter((e) => EVENT_WEIGHTS[e.type]) : [],
    }
  }).sort((x, y) => x.name.localeCompare(y.name))
  return { session: clone(s), title: a.title, durationMin: a.durationMin, startAt: a.startAt, endAt: a.endAt, participants }
}

// POST /api/proctor/sessions/{id}/open | close
export async function setSessionState(sessionId, state, room) {
  await load()
  const user = requireUser('proctor', 'admin')
  if (state !== 'ouverte' && state !== 'fermee') throw new ApiError('Action inconnue sur la session.')
  const s = db.sessions.find((x) => x.id === Number(sessionId))
  const a = s && db.assessments.find((x) => x.id === s.assessmentId)
  if (!s || !a) throw new ApiError('Session introuvable.', 'not_found', 404)
  if (a.status !== 'publie') throw new ApiError('Cette épreuve n\'est pas publiée.')
  if (state === 'ouverte') {
    delete s.summary
    if (s.status === 'fermee') s.code = randomCode() // nouveau code à la réouverture
    s.status = 'ouverte'
    s.openedAt = now()
    s.proctorId = user.id
    if (room !== undefined) s.room = room
    audit(user, 'ouverture_session', a.title, `Code ${s.code}`)
  } else {
    s.status = 'fermee'
    s.closedAt = now()
    for (const t of db.attempts.filter((x) => x.sessionId === s.id && x.status === 'en_cours')) {
      t.status = 'rendu'
      t.submittedAt = now()
      t.events.push({ type: 'closed_by_proctor', at: now() })
      autoGrade(t, a)
    }
    // Chiffres figés à la fermeture : la liste des sessions n'a plus besoin de relire ces copies
    const atts = db.attempts.filter((x) => x.sessionId === s.id)
    s.summary = {
      inProgress: 0,
      submitted: atts.length,
      alerts: atts.reduce((n, t) => n + t.events.filter((e) => EVENT_WEIGHTS[e.type]).length, 0),
    }
    audit(user, 'fermeture_session', a.title)
  }
  save()
}

// POST /api/proctor/sessions/{id}/regenerate-code
export async function regenerateCode(sessionId) {
  await load()
  const user = requireUser('proctor', 'admin')
  const s = db.sessions.find((x) => x.id === Number(sessionId))
  s.code = randomCode()
  audit(user, 'nouveau_code_session', String(s.id), s.code)
  save()
  return s.code
}

// GET /api/proctor/alerts
export async function listAlerts() {
  await load()
  requireUser('proctor', 'admin')
  const out = []
  for (const t of db.attempts) {
    const s = db.sessions.find((x) => x.id === t.sessionId)
    if (!s) continue
    const a = db.assessments.find((x) => x.id === t.assessmentId)
    const st = db.users.find((u) => u.id === t.studentId)
    for (const e of t.events) {
      if (!EVENT_WEIGHTS[e.type]) continue
      out.push({ ...e, attemptId: t.id, sessionId: s.id, sessionOpen: s.status === 'ouverte', title: a.title, student: `${st.lastName} ${st.firstName}`, matricule: st.matricule })
    }
  }
  return out.sort((x, y) => (y.at > x.at ? 1 : -1))
}

// ---------------------------------------------------------------------------
// Annonces, notifications, recherche
// ---------------------------------------------------------------------------

export async function listAnnouncements() {
  await load()
  const user = requireUser()
  return db.announcements
    .filter((n) => !n.classeId || user.role !== 'student' || n.classeId === user.classeId)
    .map((n) => ({ ...n, author: publicUser(db.users.find((u) => u.id === n.authorId))?.fullName ?? '', classe: db.classes.find((c) => c.id === n.classeId)?.name ?? 'Toute l\'école' }))
    .sort((x, y) => (y.createdAt > x.createdAt ? 1 : -1))
}

export async function createAnnouncement(data) {
  await load()
  const user = requireUser('admin', 'teacher')
  if (!data.title?.trim() || !data.body?.trim()) throw new ApiError('Le titre et le message sont obligatoires.')
  const item = { id: nextId('announcement'), schoolId: user.schoolId, authorId: user.id, title: data.title.trim(), body: data.body.trim(), classeId: data.classeId ? Number(data.classeId) : null, createdAt: now() }
  db.announcements.push(item)
  const targets = db.users.filter((u) => u.role === 'student' && (!item.classeId || u.classeId === item.classeId))
  for (const t of targets) notify(t.id, 'Nouvelle annonce', item.title, '/etudiant/annonces')
  audit(user, 'publication_annonce', item.title)
  save()
}

export async function listNotifications() {
  await load()
  const user = requireUser()
  return db.notifications.filter((n) => n.userId === user.id).slice(0, 30)
}

export async function markNotificationsRead() {
  await load()
  const user = requireUser()
  for (const n of db.notifications) if (n.userId === user.id) n.read = true
  save()
}

// GET /api/search?q=
export async function search(qs) {
  await load()
  const user = requireUser()
  const q = qs.trim().toLowerCase()
  if (q.length < 2) return []
  const has = (s) => (s || '').toLowerCase().includes(q)
  const out = []
  if (user.role === 'student') {
    for (const a of await studentAssessments()) {
      if (has(a.title) || has(a.matiere)) out.push({ type: a.kind === 'examen' ? 'Examen' : 'Devoir', label: a.title, sub: a.matiere, link: `/etudiant/epreuve/${a.id}` })
    }
    for (const n of await listAnnouncements()) if (has(n.title)) out.push({ type: 'Annonce', label: n.title, sub: n.author, link: '/etudiant/annonces' })
  } else {
    if (user.role === 'admin') {
      for (const u of db.users) {
        if (has(u.matricule) || has(`${u.firstName} ${u.lastName}`) || has(u.email)) {
          out.push({ type: 'Utilisateur', label: `${u.firstName} ${u.lastName}`, sub: u.matricule, link: `/admin/utilisateurs?q=${encodeURIComponent(u.matricule)}` })
        }
      }
    }
    if (user.role === 'proctor') {
      for (const s of await listSessions()) if (has(s.title) || has(s.code)) out.push({ type: 'Session', label: s.title, sub: s.room || s.classe, link: `/surveillant/sessions/${s.id}` })
      for (const u of db.users.filter((x) => x.role === 'student')) {
        if (has(u.matricule) || has(`${u.firstName} ${u.lastName}`)) out.push({ type: 'Étudiant', label: `${u.firstName} ${u.lastName}`, sub: u.matricule, link: '/surveillant/sessions' })
      }
    }
    if (user.role === 'teacher' || user.role === 'admin') {
      for (const a of db.assessments) {
        if ((user.role === 'admin' || a.teacherId === user.id) && (has(a.title))) {
          out.push({ type: a.kind === 'examen' ? 'Examen' : 'Devoir', label: a.title, sub: classNamesOf(a), link: user.role === 'admin' ? '/admin/epreuves' : `/enseignant/epreuves/${a.id}` })
        }
      }
    }
  }
  return out.slice(0, 12)
}

// ---------------------------------------------------------------------------
// Bulletins
// Les bulletins sont faits par l'établissement (hors plateforme). Les éducateurs (ou l'administration)
// déposent le fichier de chaque étudiant (PDF ou image) ; l'étudiant le retrouve dans son espace et le
// télécharge. Les notes des épreuves en ligne ne servent pas à calculer les bulletins.
// Le fichier est rangé à part (platform.files), la liste des bulletins ne garde que sa description.
// ---------------------------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100

export function mentionFor(avg) {
  if (avg === null || avg === undefined) return '-'
  if (avg >= 16) return 'Très bien'
  if (avg >= 14) return 'Bien'
  if (avg >= 12) return 'Assez bien'
  if (avg >= 10) return 'Passable'
  return 'Insuffisant'
}

export const BULLETIN_MAX_BYTES = 2 * 1024 * 1024
const BULLETIN_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
]
const BULLETIN_STAFF = ['admin', 'educator']

function decodeBase64(b64) {
  const bin = atob(String(b64 || ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Clé du fichier : empreinte de son contenu (un même dépôt rejoué ne crée pas de doublon)
async function fileKey(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return 'b' + Array.from(hash.slice(0, 16), (x) => x.toString(16).padStart(2, '0')).join('')
}

const bulletinInfo = (b) => ({
  id: b.id, periodeId: b.periodeId, classeId: b.classeId, studentId: b.studentId,
  fileName: b.fileName, mime: b.mime, size: b.size, version: b.version,
  uploadedAt: b.uploadedAt, uploadedBy: userName(b.uploadedBy),
})
function userName(id) {
  const u = db.users.find((x) => x.id === id)
  return u ? `${u.firstName} ${u.lastName}` : ''
}

// Périodes et classes proposées pour le dépôt
export async function bulletinOptions() {
  await load()
  requireUser(...BULLETIN_STAFF)
  const counts = {}
  for (const u of db.users) if (u.role === 'student' && u.active) counts[u.classeId] = (counts[u.classeId] || 0) + 1
  return clone({
    periodes: [...db.periodes].sort((a, b) => (a.start > b.start ? -1 : 1)),
    classes: db.classes.map((c) => ({ id: c.id, name: c.name, level: c.level, filiereId: c.filiereId, students: counts[c.id] || 0 })),
    maxBytes: BULLETIN_MAX_BYTES,
  })
}

// Étudiants d'une classe et bulletin déposé (ou non) pour la période
export async function listBulletins(periodeId, classeId) {
  await load()
  requireUser(...BULLETIN_STAFF)
  const p = db.periodes.find((x) => x.id === Number(periodeId))
  const c = db.classes.find((x) => x.id === Number(classeId))
  if (!p || !c) throw new ApiError('Choisissez une période et une classe.')
  const students = db.users
    .filter((u) => u.role === 'student' && u.classeId === c.id && u.active)
    .sort((x, y) => x.lastName.localeCompare(y.lastName) || x.firstName.localeCompare(y.firstName))
  return clone({
    periode: p,
    classe: { id: c.id, name: c.name },
    rows: students.map((s) => {
      const b = db.bulletins.find((x) => x.periodeId === p.id && x.studentId === s.id)
      return { student: publicUser(s), bulletin: b ? bulletinInfo(b) : null }
    }),
  })
}

// Dépôt (ou remplacement) du bulletin d'un étudiant pour une période
// file : { name, base64 } (contenu du fichier encodé en base64)
export async function uploadBulletin(periodeId, studentId, file) {
  await load()
  const actor = requireUser(...BULLETIN_STAFF)
  const p = db.periodes.find((x) => x.id === Number(periodeId))
  const s = db.users.find((u) => u.id === Number(studentId) && u.role === 'student')
  if (!p) throw new ApiError('Période introuvable.')
  if (!s) throw new ApiError('Étudiant introuvable.')
  let bytes
  try { bytes = decodeBase64(file?.base64) } catch { throw new ApiError('Fichier illisible.') }
  if (!bytes.length) throw new ApiError('Le fichier est vide.')
  if (bytes.length > BULLETIN_MAX_BYTES) throw new ApiError(`Fichier trop lourd (${(bytes.length / 1048576).toFixed(1)} Mo) : 2 Mo au maximum. Enregistrez le bulletin en PDF ou réduisez la qualité du scan.`)
  const type = BULLETIN_TYPES.find((t) => t.magic.every((x, i) => bytes[i] === x))
  if (!type) throw new ApiError('Format non accepté : déposez un PDF, un JPG ou un PNG.')
  const key = await fileKey(bytes)
  await platform.files.put(key, bytes)
  const fileName = String(file?.name || `bulletin.${type.ext}`).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)

  const existing = db.bulletins.find((x) => x.periodeId === p.id && x.studentId === s.id)
  if (existing) {
    if (existing.fileKey !== key && !db.bulletins.some((x) => x !== existing && x.fileKey === existing.fileKey)) platform.files.remove(existing.fileKey)
    Object.assign(existing, { classeId: s.classeId, fileKey: key, fileName, mime: type.mime, size: bytes.length, version: (existing.version || 1) + 1, uploadedAt: now(), uploadedBy: actor.id })
  } else {
    db.bulletins.push({
      id: nextId('bulletin'), schoolId: actor.schoolId, periodeId: p.id, classeId: s.classeId, studentId: s.id,
      fileKey: key, fileName, mime: type.mime, size: bytes.length, version: 1, uploadedAt: now(), uploadedBy: actor.id,
    })
  }
  notify(s.id, existing ? 'Bulletin remplacé' : 'Bulletin disponible',
    existing ? `Votre bulletin du ${p.name} a été remplacé par une nouvelle version.` : `Votre bulletin du ${p.name} est disponible.`,
    '/etudiant/resultats?onglet=bulletins')
  audit(actor, existing ? 'remplacement_bulletin' : 'depot_bulletin', `${s.lastName} ${s.firstName} (${s.matricule})`, `${p.name} - ${fileName}`)
  save()
  return clone(bulletinInfo(db.bulletins.find((x) => x.periodeId === p.id && x.studentId === s.id)))
}

export async function deleteBulletin(bulletinId) {
  await load()
  const actor = requireUser(...BULLETIN_STAFF)
  const b = db.bulletins.find((x) => x.id === Number(bulletinId))
  if (!b) throw new ApiError('Bulletin introuvable.', 'not_found', 404)
  db.bulletins = db.bulletins.filter((x) => x !== b)
  if (!db.bulletins.some((x) => x.fileKey === b.fileKey)) platform.files.remove(b.fileKey)
  const s = db.users.find((u) => u.id === b.studentId)
  const p = db.periodes.find((x) => x.id === b.periodeId)
  audit(actor, 'suppression_bulletin', s ? `${s.lastName} ${s.firstName} (${s.matricule})` : '', `${p?.name ?? ''} - ${b.fileName}`)
  save()
}

// Contenu du fichier : éducateurs et administration, ou l'étudiant concerné
export async function getBulletinFile(bulletinId) {
  await load()
  const user = requireUser(...BULLETIN_STAFF, 'student')
  const b = db.bulletins.find((x) => x.id === Number(bulletinId))
  if (!b || (user.role === 'student' && b.studentId !== user.id)) throw new ApiError('Bulletin introuvable.', 'not_found', 404)
  const bytes = await platform.files.get(b.fileKey)
  if (!bytes) throw new ApiError('Le fichier de ce bulletin est introuvable. Demandez à l\'établissement de le déposer à nouveau.', 'not_found', 404)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { fileName: b.fileName, mime: b.mime, base64: btoa(bin) }
}

// GET /api/student/bulletins
export async function studentBulletins() {
  await load()
  const user = requireUser('student')
  return db.bulletins.filter((b) => b.studentId === user.id)
    .map((b) => ({
      id: b.id,
      periode: db.periodes.find((p) => p.id === b.periodeId)?.name ?? '',
      classe: db.classes.find((c) => c.id === b.classeId)?.name ?? '',
      fileName: b.fileName, mime: b.mime, size: b.size, version: b.version, uploadedAt: b.uploadedAt,
    }))
    .sort((x, y) => (y.uploadedAt > x.uploadedAt ? 1 : -1))
}

// Remise à zéro de la démo (bouton dans les paramètres)
export async function resetDemo() {
  await load()
  // Sur le serveur, seul un administrateur peut tout remettre à zéro
  if (platform.server) {
    audit(requireUser('admin'), 'reinitialisation_demo', 'Base de démonstration')
    await platform.clearDb()
    platform.clearToken()
    return
  }
  await platform.clearDb()
  platform.clearToken()
  demoDb = null
  await load()
}
