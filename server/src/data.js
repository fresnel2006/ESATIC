// Accès aux données dans Firestore, prévu pour Vercel (plusieurs copies du serveur, sans mémoire durable)
// et pour une classe entière qui compose en même temps.
//
// Deux sortes de données :
// - Données de référence (users, classes, matieres, assessments, sessions...) : peu modifiées. Gardées en mémoire
//   par chaque copie du serveur et relues seulement quand meta/versions indique un changement (1 lecture par appel).
// - Données "chaudes" : copies (attempts), état de connexion (auth), journal (audit), notifications (inbox).
//   Lues et écrites document par document, sans jamais toucher à un document partagé par toute la classe.
//
// Un appel qui modifie des données se fait dans une transaction Firestore :
//   1. lecture des copies et de l'état de connexion utiles (verrouillés pendant la transaction) ;
//   2. exécution de la logique (esatic/src/api/core.js) ;
//   3. pour chaque donnée de référence modifiée : relecture et comparaison avec l'état de départ. Si quelqu'un
//      l'a changée entre-temps, l'appel est rejoué avec les données à jour (rien n'est écrasé) ;
//   4. écriture des seuls documents modifiés. Nouveaux documents créés avec create() : jamais d'écrasement.
// Les appels qui ne font que lire (la plupart) se font sans transaction, avec des lectures en parallèle.
//
// Organisation dans Firestore :
//   <collection>/<id>  données de référence et copies (attempts)
//   meta/<clé>         objets uniques (school, seq, version) sous la forme { value }
//   meta/versions      numéro de version de chaque donnée de référence, et leur nature (_kinds)
//   auth/<userId>      jeton de session et dernière connexion (modifiés à chaque connexion)
//   audit/<id>         journal (ajouts seulement)
//   inbox/<userId>     dernières notifications d'un utilisateur, en un seul document
//   bulletinFiles/<clé>_<n>  contenu des bulletins déposés, en morceaux de 900 Ko (jamais gardé en mémoire)
import { FieldValue } from 'firebase-admin/firestore'
import { db as firestore } from './firebase.js'

const VERSIONS = firestore.doc('meta/versions')
const SCOPED = ['attempts', 'audit', 'notifications']
const AUTH_FIELDS = ['activeToken', 'lastLoginAt']
const AUDIT_READERS = new Set(['listAudit', 'adminStats'])
const INBOX_READERS = new Set(['listNotifications', 'markNotificationsRead'])
const AUTH_READERS = new Set(['listUsers', 'adminStats'])
const INBOX_SIZE = 30

// ---------------------------------------------------------------------------
// Encodage : Firestore refuse les tableaux de tableaux. Ces documents sont rangés en texte JSON,
// en gardant les champs simples à côté pour que les recherches (studentId, sessionId...) fonctionnent.
// ---------------------------------------------------------------------------

function hasNestedArray(v) {
  if (Array.isArray(v)) return v.some((x) => Array.isArray(x) || hasNestedArray(x))
  if (v && typeof v === 'object') return Object.values(v).some(hasNestedArray)
  return false
}

export function encodeDoc(data) {
  if (!hasNestedArray(data)) return data
  const plain = Object.fromEntries(Object.entries(data).filter(([, v]) => v === null || typeof v !== 'object'))
  return { ...plain, _json: JSON.stringify(data) }
}

export const decodeDoc = (data) => (typeof data?._json === 'string' ? JSON.parse(data._json) : data)
const byId = (a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
const isCollection = (v) => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && x.id !== undefined && x.id !== null)
// Comparaison indépendante de l'ordre des champs (Firestore ne garde pas l'ordre d'écriture)
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x))
const plainCopy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)))
const withoutAuth = (u) => {
  const rest = { ...u }
  for (const f of AUTH_FIELDS) delete rest[f]
  return rest
}

// ---------------------------------------------------------------------------
// Identifiants des données créées en masse : uniques sans compteur partagé.
// Heure en millisecondes x 1000 + 3 chiffres au hasard (reste un entier exact en JavaScript).
// Un doublon est impossible à écrire : les nouveaux documents sont créés avec create().
// ---------------------------------------------------------------------------

const HOT_KINDS = new Set(['attempt', 'audit', 'notification'])
let lastStamp = 0
export function serverId(kind) {
  if (!HOT_KINDS.has(kind)) return undefined
  const stamp = Math.max(Date.now() * 1000 + Math.floor(Math.random() * 1000), lastStamp + 1)
  lastStamp = stamp
  return stamp
}

// ---------------------------------------------------------------------------
// Données de référence gardées en mémoire tant que cette copie du serveur reste allumée
// ---------------------------------------------------------------------------

const cache = { v: {}, data: {}, kinds: {} }

async function refreshRefs() {
  const snap = await VERSIONS.get()
  if (!snap.exists) return false
  const { _kinds = {}, ...v } = snap.data()
  const stale = Object.entries(_kinds).filter(([key]) => !(cache.v[key] === v[key] && key in cache.data))
  const fresh = await Promise.all(stale.map(async ([key, kind]) => {
    if (kind === 'collection') {
      const s = await firestore.collection(key).get()
      return [key, s.docs.map((d) => decodeDoc(d.data())).sort(byId)]
    }
    const s = await firestore.doc(`meta/${key}`).get()
    return [key, s.exists ? decodeDoc(s.data()).value : null]
  }))
  for (const [key, value] of fresh) { cache.data[key] = value; cache.v[key] = v[key] }
  for (const key of Object.keys(cache.data)) if (!(key in _kinds)) { delete cache.data[key]; delete cache.v[key] }
  cache.kinds = _kinds
  return true
}

export function clearCache() {
  cache.v = {}
  cache.data = {}
  cache.kinds = {}
}

// ---------------------------------------------------------------------------
// Copies à charger pour chaque appel. Les autres appels n'y touchent pas (vérifié par analyse de core.js) :
// s'ils y touchaient quand même, la liste protégée ci-dessous lève une erreur au lieu de répondre faux.
// ---------------------------------------------------------------------------

const none = () => ({ kind: 'none' })
const all = () => ({ kind: 'all' })
const own = () => ({ kind: 'own' })
const assessmentArg = (i) => (args) => ({ kind: 'assessment', id: Number(args[i]) })
const attemptArg = (i) => (args) => ({ kind: 'attemptAssessment', id: Number(args[i]) })
const byRole = (args, user) => {
  if (!user) return none()
  if (user.role === 'student') return own()
  if (user.role === 'teacher') return { kind: 'teacher' }
  if (user.role === 'proctor') return { kind: 'exam' }
  if (user.role === 'educator' || user.role === 'pedagogy') return none()
  return all()
}

const SCOPES = {
  // Tableau de bord : seul le nombre de copies à corriger sert
  adminStats: () => ({ kind: 'status', value: 'rendu' }),
  listAssessments: byRole,
  getAssessment: assessmentArg(0),
  saveAssessment: (args) => ({ kind: 'assessment', id: Number(args[0]?.id) || -1 }),
  setAssessmentStatus: assessmentArg(0),
  studentAssessments: own, studentAssessment: own, studentHome: own, studentResults: own, studentResultDetail: own,
  startAttempt: own, getAttempt: own, saveAnswers: own, logEvents: own, submitAttempt: own,
  listCopies: (args, user) => (args[0] ? assessmentArg(0)(args) : byRole(args, user)),
  getCopy: attemptArg(0), gradeCopy: attemptArg(0), autoGradeJobs: attemptArg(0), applyAutoGrade: attemptArg(0),
  autoGradeTargets: assessmentArg(0), validateGradedCopies: assessmentArg(0), copiesForQuestion: assessmentArg(0),
  gradeQuestion: assessmentArg(0), publishResults: assessmentArg(0), assessmentResults: assessmentArg(0),
  // Sessions fermées : chiffres figés à la fermeture, leurs copies ne sont pas relues
  listSessions: (args, user, data) => ({
    kind: 'session',
    ids: (data.sessions || []).filter((s) => s.status !== 'fermee' || !s.summary).map((s) => s.id),
  }),
  sessionDetail: (args) => ({ kind: 'session', ids: [Number(args[0])] }),
  setSessionState: (args) => ({ kind: 'session', ids: [Number(args[0])] }),
  // Suivi en direct : sessions ouvertes et sessions fermées depuis moins de 24 h
  listAlerts: (args, user, data) => ({
    kind: 'session',
    ids: (data.sessions || [])
      .filter((s) => s.status === 'ouverte' || (s.closedAt && Date.now() - new Date(s.closedAt).getTime() < 24 * 3600 * 1000))
      .map((s) => s.id),
  }),
  search: byRole,
}

// Appels qui, normalement, ne font que lire : exécutés d'abord sans transaction.
// S'ils demandent quand même à enregistrer, ils sont rejoués dans une transaction.
const READ_FIRST = new Set([
  'me', 'testAccounts', 'listNotifications', 'studentAssessments', 'studentAssessment', 'studentResults', 'studentResultDetail',
  'getStructure', 'toolsOverview', 'listUsers', 'listAudit', 'adminStats', 'listAssessments', 'getAssessment',
  'myTeaching', 'listBank', 'listCopies', 'getCopy', 'autoGradeJobs', 'autoGradeTargets', 'copiesForQuestion',
  'listComments', 'assessmentResults', 'teacherClasses', 'listSessions', 'sessionDetail', 'listAlerts',
  'listAnnouncements', 'search', 'bulletinOptions', 'listBulletins', 'getBulletinFile', 'studentBulletins',
  'listEvalCampaigns', 'evalResults', 'myEvalResults', 'studentEvaluations', 'submitEvaluation', 'evalAvailable',
  'studentHome',
])

const chunks = (list, n = 30) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

async function loadAttempts(get, scope, userId, data) {
  const col = firestore.collection('attempts')
  const docs = (s) => s.docs.map((d) => decodeDoc(d.data()))
  const byField = async (field, values) => {
    const out = []
    for (const part of chunks([...new Set(values)])) out.push(...docs(await get(col.where(field, 'in', part))))
    return out
  }
  switch (scope.kind) {
    case 'all': return docs(await get(col))
    case 'own': return userId ? docs(await get(col.where('studentId', '==', userId))) : []
    case 'assessment': return docs(await get(col.where('assessmentId', '==', scope.id)))
    case 'attemptAssessment': {
      const s = await get(col.doc(String(scope.id)))
      if (!s.exists) return []
      return docs(await get(col.where('assessmentId', '==', decodeDoc(s.data()).assessmentId)))
    }
    case 'teacher': {
      const ids = (data.assessments || []).filter((a) => a.teacherId === userId).map((a) => a.id)
      return ids.length ? byField('assessmentId', ids) : []
    }
    case 'exam': return docs(await get(col.where('sessionId', '!=', null)))
    case 'session': return scope.ids.length ? byField('sessionId', scope.ids) : []
    case 'assessments': return scope.ids.length ? byField('assessmentId', scope.ids) : []
    case 'status': return docs(await get(col.where('status', '==', scope.value)))
    default: return null
  }
}

// Liste vide qui signale tout usage : un appel qui lirait des copies non chargées échoue au lieu de mentir
const GUARD = Symbol('guard')
function guardedList(name) {
  return new Proxy([], {
    get(target, key) {
      if (key === GUARD) return true
      throw new Error(`Copies non chargées pour l'appel ${name} : ajoutez-le à SCOPES dans server/src/data.js`)
    },
  })
}
const isGuarded = (v) => { try { return v?.[GUARD] === true } catch { return false } }

// ---------------------------------------------------------------------------
// Exécution d'un appel
// ---------------------------------------------------------------------------

export class NotInitialized extends Error {}
class StaleReference extends Error {}

// Prépare les données, exécute la logique et, dans une transaction, enregistre
async function execute(name, args, ctx, call, ApiError, tx) {
  const get = tx ? (ref) => tx.get(ref) : (ref) => ref.get()
  const tokenUser = ctx.tokenIn?.userId ?? null
  // Lectures lancées en même temps : versions (hors transaction : aucun verrou partagé), état de connexion
  // du demandeur, et ses copies s'il s'agit d'un appel d'étudiant
  const [initialized, authSnap, ownAtts] = await Promise.all([
    refreshRefs(),
    tokenUser ? get(firestore.doc(`auth/${tokenUser}`)) : null,
    SCOPES[name] === own && tokenUser ? loadAttempts(get, own(), tokenUser) : null,
  ])
  if (!initialized) throw new NotInitialized('Base non initialisée')

  // Copie de travail ; base = l'état exact dont elle part, pour savoir ce qui a changé
  const base = { ...cache.data }
  const data = structuredClone(base)
  ctx.token = ctx.tokenIn
  ctx.out = undefined
  ctx.dirty = false
  ctx.removeFiles = new Set() // fichiers à supprimer une fois l'appel enregistré

  // État de connexion : celui de auth/<id> prime sur l'ancienne valeur rangée dans users
  const authLoaded = new Map()
  const applyAuth = (uid, a) => {
    const u = (data.users || []).find((x) => x.id === uid)
    if (!u || !a) return
    for (const f of AUTH_FIELDS) if (f in a) u[f] = a[f]
  }
  if (authSnap?.exists) applyAuth(tokenUser, authSnap.data())
  if (AUTH_READERS.has(name)) {
    const s = await get(firestore.collection('auth'))
    for (const d of s.docs) applyAuth(Number(d.id), d.data())
  }
  for (const u of data.users || []) authLoaded.set(u.id, JSON.stringify(AUTH_FIELDS.map((f) => u[f] ?? null)))

  const user = tokenUser ? (data.users || []).find((u) => u.id === tokenUser) ?? null : null
  const scope = (SCOPES[name] || none)(args, user, data)
  const [atts, audit, inbox] = await Promise.all([
    ownAtts ?? loadAttempts(get, scope, user?.id ?? null, data),
    AUDIT_READERS.has(name)
      ? get(firestore.collection('audit').orderBy('at', 'desc').limit(300)).then((s) => s.docs.map((d) => decodeDoc(d.data())))
      : [],
    INBOX_READERS.has(name) && user
      ? get(firestore.doc(`inbox/${user.id}`)).then((s) => (s.data()?.items ?? []).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)))
      : [],
  ])
  data.attempts = atts ?? guardedList(name)
  data.audit = audit
  data.notifications = inbox
  const loaded = {
    attempts: new Map((atts || []).map((a) => [a.id, JSON.stringify(a)])),
    audit: new Set(audit.map((a) => a.id)),
    notifications: new Map(inbox.map((n) => [n.id, JSON.stringify(n)])),
    auth: authLoaded,
  }

  ctx.db = data
  let result
  let error = null
  try {
    result = await call()
  } catch (err) {
    if (!(err instanceof ApiError)) throw err
    error = err
  }
  const outcome = { result: result === undefined ? null : plainCopy(result), error }
  if (!ctx.dirty) return { outcome }
  if (!tx) return { outcome, needsWrite: true }
  // Enregistré si la logique a demandé à enregistrer, même quand elle refuse ensuite l'action
  // (par exemple une copie rendue automatiquement parce que le temps est écoulé)
  const saved = await commit(tx, data, base, loaded, user, name)
  return { outcome, ...saved }
}

// ctx : { tokenIn, token, out, db, dirty } partagé avec la logique (voir platform.js)
// call : la fonction de core.js à exécuter. Renvoie { result, error }.
export async function runRequest(name, args, ctx, call, ApiError) {
  if (READ_FIRST.has(name)) {
    const first = await execute(name, args, ctx, call, ApiError, null)
    if (!first.needsWrite) return first.outcome
  }
  for (let attempt = 1; ; attempt++) {
    try {
      let done = null
      await firestore.runTransaction(async (tx) => {
        done = await execute(name, args, ctx, call, ApiError, tx)
      }, { maxAttempts: 8 })
      if (done.adopted) {
        for (const [key, { value, version }] of Object.entries(done.adopted)) {
          if ((cache.v[key] ?? -1) < version) { cache.data[key] = value; cache.v[key] = version }
        }
      }
      // Notifications : ajoutées après coup, sans transaction (30 copies rendues en même temps ne se gênent pas)
      if (done.notify?.length) await deliver(done.notify)
      // Fichiers remplacés ou supprimés : effacés seulement maintenant que le changement est enregistré
      if (ctx.removeFiles?.size) await removeFiles([...ctx.removeFiles])
      return done.outcome
    } catch (err) {
      // Donnée de référence changée par quelqu'un d'autre, ou identifiant déjà pris : on rejoue
      const retry = err instanceof StaleReference || err?.code === 6 /* ALREADY_EXISTS */
      if (!retry || attempt >= 5) throw err
      if (err instanceof StaleReference) clearCache()
      await new Promise((r) => setTimeout(r, 30 * attempt + Math.random() * 50))
    }
  }
}

async function commit(tx, data, base, loaded, user, name) {
  const reads = []
  const writes = []
  const bumped = new Set()
  const kinds = { ...cache.kinds }

  // Données de référence modifiées (rare : administration, enseignants)
  for (const [key, value] of Object.entries(data)) {
    if (SCOPED.includes(key)) continue
    if (isCollection(value)) {
      const strip = key === 'users' ? withoutAuth : (r) => r
      const before = new Map((Array.isArray(base[key]) ? base[key] : []).map((r) => [String(r.id), r]))
      const seen = new Set()
      for (const row of value) {
        const id = String(row.id)
        seen.add(id)
        const prev = before.get(id)
        if (prev && JSON.stringify(strip(prev)) === JSON.stringify(strip(row))) continue
        reads.push({ ref: firestore.doc(`${key}/${id}`), expect: prev ?? null })
        writes.push(['set', firestore.doc(`${key}/${id}`), strip(row)])
        bumped.add(key)
      }
      for (const [id, prev] of before) {
        if (seen.has(id)) continue
        reads.push({ ref: firestore.doc(`${key}/${id}`), expect: prev })
        writes.push(['delete', firestore.doc(`${key}/${id}`)])
        bumped.add(key)
      }
      if (kinds[key] !== 'collection') { kinds[key] = 'collection'; bumped.add(key) }
    } else if (JSON.stringify(value) !== JSON.stringify(base[key]) || kinds[key] !== 'meta') {
      reads.push({ ref: firestore.doc(`meta/${key}`), expect: key in base ? { value: base[key] } : null, meta: true })
      writes.push(['set', firestore.doc(`meta/${key}`), { value: plainCopy(value) }])
      kinds[key] = 'meta'
      bumped.add(key)
    }
  }

  // État de connexion : auth/<id>, un document par utilisateur
  for (const u of data.users || []) {
    const now = JSON.stringify(AUTH_FIELDS.map((f) => u[f] ?? null))
    if (loaded.auth.get(u.id) !== now) {
      writes.push(['merge', firestore.doc(`auth/${u.id}`), Object.fromEntries(AUTH_FIELDS.map((f) => [f, u[f] ?? null]))])
    }
  }

  // Copies : les nouvelles sont créées (refusé si l'identifiant existe déjà), les autres mises à jour
  if (!isGuarded(data.attempts)) {
    const seen = new Set()
    for (const att of data.attempts) {
      seen.add(att.id)
      const json = JSON.stringify(att)
      const prev = loaded.attempts.get(att.id)
      if (prev === json) continue
      writes.push([prev === undefined ? 'create' : 'set', firestore.doc(`attempts/${att.id}`), JSON.parse(json)])
    }
    for (const id of loaded.attempts.keys()) if (!seen.has(id)) writes.push(['delete', firestore.doc(`attempts/${id}`)])
  }

  // Journal : ajouts seulement
  for (const entry of data.audit) {
    if (!loaded.audit.has(entry.id)) writes.push(['create', firestore.doc(`audit/${entry.id}`), plainCopy(entry)])
  }

  // Notifications : la boîte du demandeur est réécrite s'il l'a lue (marquées lues) ;
  // les nouvelles pour les autres sont distribuées après la transaction
  const notify = []
  const ownInbox = INBOX_READERS.has(name) && user
  let ownChanged = false
  for (const n of data.notifications) {
    if (loaded.notifications.get(n.id) === JSON.stringify(n)) continue
    if (ownInbox && n.userId === user.id) ownChanged = true
    else notify.push(plainCopy(n))
  }
  if (ownChanged) {
    writes.push(['set', firestore.doc(`inbox/${user.id}`), { items: plainCopy(data.notifications.filter((n) => n.userId === user.id).slice(0, INBOX_SIZE)) }])
  }

  // Vérification : chaque donnée de référence modifiée est-elle toujours telle qu'au départ ?
  let nextV = null
  if (bumped.size) {
    const [vSnap, ...snaps] = await Promise.all([tx.get(VERSIONS), ...reads.map((r) => tx.get(r.ref))])
    snaps.forEach((s, i) => {
      const { expect, meta } = reads[i]
      const current = s.exists ? decodeDoc(s.data()) : null
      const a = meta ? current?.value : current
      const b = meta ? expect?.value : expect
      const strip = (x) => (x && reads[i].ref.parent.id === 'users' ? withoutAuth(x) : x)
      if (stable(strip(a) ?? null) !== stable(strip(b) ?? null)) throw new StaleReference(reads[i].ref.path)
    })
    const { _kinds, ...v } = vSnap.data() || {}
    nextV = { ...v }
    for (const key of bumped) nextV[key] = (nextV[key] || 0) + 1
    writes.push(['set', VERSIONS, { ...nextV, _kinds: { ..._kinds, ...kinds } }])
  }

  for (const [op, ref, doc] of writes) {
    if (op === 'delete') tx.delete(ref)
    else if (op === 'create') tx.create(ref, encodeDoc(doc))
    else if (op === 'merge') tx.set(ref, doc, { merge: true })
    else tx.set(ref, encodeDoc(plainCopy(doc)))
  }
  const adopted = nextV ? Object.fromEntries([...bumped].map((key) => [key, { value: data[key], version: nextV[key] }])) : null
  return { adopted, notify }
}

// ---------------------------------------------------------------------------
// Fichiers déposés (bulletins) : hors des données de référence, lus seulement quand on les télécharge
// ---------------------------------------------------------------------------

const FILES = firestore.collection('bulletinFiles')
const FILE_CHUNK = 900 * 1024

export async function putFile(key, bytes) {
  const buf = Buffer.from(bytes)
  const parts = Math.max(1, Math.ceil(buf.length / FILE_CHUNK))
  const batch = firestore.batch()
  for (let i = 0; i < parts; i++) {
    batch.set(FILES.doc(`${key}_${i}`), { key, part: i, parts, size: buf.length, data: buf.subarray(i * FILE_CHUNK, (i + 1) * FILE_CHUNK) })
  }
  await batch.commit()
}

export async function getFile(key) {
  const first = await FILES.doc(`${key}_0`).get()
  if (!first.exists) return null
  const { parts } = first.data()
  const rest = await Promise.all(Array.from({ length: parts - 1 }, (_, i) => FILES.doc(`${key}_${i + 1}`).get()))
  const chunks = [first, ...rest].map((s) => (s.exists ? Buffer.from(s.data().data) : null))
  if (chunks.some((c) => !c)) return null
  return new Uint8Array(Buffer.concat(chunks))
}

async function removeFiles(keys) {
  try {
    for (const part of chunks(keys, 30)) {
      const snap = await FILES.where('key', 'in', part).get()
      const batch = firestore.batch()
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  } catch (err) {
    console.error('Fichiers non supprimés :', keys.join(', '), err.message)
  }
}

// ---------------------------------------------------------------------------
// Petites collections lues et écrites directement (évaluation des enseignants : participations et réponses).
// Hors des données de référence : des milliers de réponses ne ralentissent pas la plateforme.
// ---------------------------------------------------------------------------

// Création de plusieurs documents d'un coup (tout ou rien). false si l'un d'eux existe déjà.
export async function storeCreateAll(items) {
  const batch = firestore.batch()
  for (const it of items) batch.create(firestore.collection(it.collection).doc(it.id), it.data)
  try {
    await batch.commit()
    return true
  } catch (err) {
    if (err?.code === 6) return false // ALREADY_EXISTS
    throw err
  }
}

const where = (collection, filters) => Object.entries(filters).reduce((q, [f, v]) => q.where(f, '==', v), firestore.collection(collection))
export async function storeQuery(collection, filters) {
  return (await where(collection, filters).get()).docs.map((d) => d.data())
}
export async function storeCount(collection, filters) {
  return (await where(collection, filters).count().get()).data().count
}

// Ajoute des notifications dans les boîtes de leurs destinataires (ajout atomique, sans transaction)
async function deliver(list) {
  const byUser = new Map()
  for (const n of list) {
    if (!byUser.has(n.userId)) byUser.set(n.userId, [])
    byUser.get(n.userId).push(n)
  }
  await Promise.all([...byUser].map(async ([uid, items]) => {
    for (let i = 1; i <= 5; i++) {
      try {
        await firestore.doc(`inbox/${uid}`).set({ items: FieldValue.arrayUnion(...items) }, { merge: true })
        return
      } catch (err) {
        if (i === 5) console.error(`Notification non distribuée à ${uid} :`, err.message)
        else await new Promise((r) => setTimeout(r, 100 * i))
      }
    }
  }))
}

// ---------------------------------------------------------------------------
// Création de la base, mise à niveau depuis l'organisation précédente, remise à zéro
// ---------------------------------------------------------------------------

// Écrit une base complète (données de démonstration) dans une base vide
export async function writeInitialData(data) {
  const writes = []
  const kinds = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'notifications') continue
    if (key === 'attempts' || key === 'audit' || isCollection(value)) {
      if (!SCOPED.includes(key)) kinds[key] = 'collection'
      for (const row of value) writes.push([firestore.doc(`${key}/${row.id}`), key === 'users' ? withoutAuth(row) : row])
    } else {
      kinds[key] = 'meta'
      writes.push([firestore.doc(`meta/${key}`), { value }])
    }
  }
  for (const u of data.users || []) {
    writes.push([firestore.doc(`auth/${u.id}`), Object.fromEntries(AUTH_FIELDS.map((f) => [f, u[f] ?? null]))])
  }
  const inbox = new Map()
  for (const n of data.notifications || []) {
    if (!inbox.has(n.userId)) inbox.set(n.userId, [])
    inbox.get(n.userId).push(n)
  }
  for (const [uid, items] of inbox) writes.push([firestore.doc(`inbox/${uid}`), { items: items.slice(0, INBOX_SIZE) }])
  // Numéros uniques (heure de création) : une copie du serveur restée allumée après une remise à zéro
  // ne peut pas confondre ses anciennes données avec les nouvelles
  const stamp = Date.now()
  const v = Object.fromEntries(Object.keys(kinds).map((k) => [k, stamp]))
  writes.push([VERSIONS, { ...v, _kinds: kinds }])
  for (let i = 0; i < writes.length; i += 400) {
    const batch = firestore.batch()
    for (const [ref, doc] of writes.slice(i, i + 400)) batch.set(ref, encodeDoc(plainCopy(doc)))
    await batch.commit()
  }
  clearCache()
}

// Lit l'organisation précédente (meta/_layout) pour la convertir
export async function readLegacyData() {
  const layoutSnap = await firestore.doc('meta/_layout').get()
  if (!layoutSnap.exists) return null
  const layout = layoutSnap.data()
  const data = {}
  for (const key of layout.meta) {
    const s = await firestore.doc(`meta/${key}`).get()
    data[key] = s.exists ? decodeDoc(s.data()).value : null
  }
  for (const key of layout.collections) {
    const s = await firestore.collection(key).get()
    data[key] = s.docs.map((d) => decodeDoc(d.data())).sort(byId)
  }
  return data
}

export async function deleteEverything() {
  for (const c of await firestore.listCollections()) {
    const refs = await c.listDocuments()
    for (let i = 0; i < refs.length; i += 400) {
      const b = firestore.batch()
      refs.slice(i, i + 400).forEach((r) => b.delete(r))
      await b.commit()
    }
  }
  clearCache()
}

export async function isInitialized() {
  return (await VERSIONS.get()).exists
}
