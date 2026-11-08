// Traitement d'un appel POST /api/<fonction>, commun au serveur local (server.js) et à Vercel (api/[name].js)
import { core, requestContext } from './platform.js'
import { runRequest, isInitialized, readLegacyData, writeInitialData, deleteEverything, NotInitialized } from './data.js'
import { createHash } from 'node:crypto'
import { db as firestore } from './firebase.js'
import { REMOTE_FUNCTIONS } from '../../esatic/src/api/remoteFunctions.js'

const ALLOWED = new Set(REMOTE_FUNCTIONS)
const fail = (message, code, status) => ({ error: { message, code, status } })

// ---------------------------------------------------------------------------
// Préparation de la base (une fois par copie du serveur)
// ---------------------------------------------------------------------------

async function initialize() {
  if (await isInitialized()) return
  // Un seul serveur crée la base : les autres attendent qu'elle soit prête
  const lock = firestore.doc('meta/_init')
  try {
    await lock.create({ at: new Date().toISOString() })
  } catch {
    for (let i = 0; i < 60 && !(await isInitialized()); i++) await new Promise((r) => setTimeout(r, 1000))
    return
  }
  try {
    const legacy = await readLegacyData()
    if (legacy) {
      // Organisation précédente (tout en mémoire) : convertie sans perdre de données
      await writeInitialData(legacy)
      const old = await firestore.collection('notifications').listDocuments()
      for (let i = 0; i < old.length; i += 400) {
        const b = firestore.batch()
        old.slice(i, i + 400).forEach((r) => b.delete(r))
        await b.commit()
      }
      await firestore.doc('meta/_layout').delete()
    } else {
      await writeInitialData(await requestContext.run({}, () => core.buildInitialData()))
    }
  } finally {
    await lock.delete().catch(() => {})
  }
}

let ready = null
export function ensureReady() {
  ready ??= (async () => {
    await initialize()
    // Mises à niveau des données (nouvelles épreuves de démonstration, nouveaux champs...)
    const ctx = { tokenIn: null }
    await requestContext.run(ctx, () => runRequest('__migrate', [], ctx, () => core.migrateData(), core.ApiError))
  })().catch((err) => { ready = null; throw err })
  return ready
}

// ---------------------------------------------------------------------------
// Limite des essais de connexion : 10 échecs en 10 minutes par adresse.
// Rangée dans Firestore (loginFailures/<empreinte de l'adresse>) : sur Vercel, chaque copie du serveur a sa
// propre mémoire, la limite doit donc être partagée. L'adresse elle-même n'est pas enregistrée.
// ---------------------------------------------------------------------------

const FAIL_WINDOW = 10 * 60 * 1000
const MAX_FAILURES = 10
const failureDoc = (ip) => firestore.doc(`loginFailures/${createHash('sha256').update(String(ip)).digest('hex').slice(0, 32)}`)

async function recentFailures(ip) {
  try {
    const snap = await failureDoc(ip).get()
    return (snap.data()?.times || []).filter((t) => Date.now() - t < FAIL_WINDOW)
  } catch {
    return [] // compteur illisible : on ne bloque personne
  }
}

async function recordFailure(ip) {
  try {
    const times = [...(await recentFailures(ip)), Date.now()].slice(-MAX_FAILURES * 2)
    await failureDoc(ip).set({ times, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Échec de connexion non compté :', err.message)
  }
}

function parseToken(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    const t = JSON.parse(raw)
    return t && typeof t.token === 'string' && Number.isInteger(t.userId) ? { userId: t.userId, token: t.token } : null
  } catch {
    return null
  }
}

// { method, name, body, tokenHeader, ip } -> { status, body }
export async function handleApi({ method, name, body, tokenHeader, ip }) {
  if (method !== 'POST') return { status: 405, body: fail('Méthode non autorisée.', 'method', 405) }
  if (!ALLOWED.has(name)) return { status: 404, body: fail('Fonction inconnue.', 'not_found', 404) }
  if (name === 'login' && (await recentFailures(ip)).length >= MAX_FAILURES) {
    return { status: 429, body: fail('Trop de tentatives de connexion. Réessayez dans quelques minutes.', 'rate_limited', 429) }
  }
  let parsed = body
  if (typeof body === 'string') {
    try { parsed = body ? JSON.parse(body) : {} } catch { return { status: 400, body: fail('Requête invalide.', 'bad_request', 400) } }
  }
  const args = Array.isArray(parsed?.args) ? parsed.args : []
  const ctx = { tokenIn: parseToken(tokenHeader) }
  const withToken = (b) => (ctx.out !== undefined ? { ...b, token: ctx.out } : b)

  try {
    await ensureReady()
    const { result, error } = await requestContext.run(ctx, () => runRequest(name, args, ctx, () => core[name](...args), core.ApiError))
    if (ctx.reset) {
      await deleteEverything()
      ready = null
      await ensureReady()
    }
    if (error) {
      if (name === 'login' && error.code === 'bad_credentials') await recordFailure(ip)
      return { status: 200, body: withToken(fail(error.message, error.code, error.status)) }
    }
    return { status: 200, body: withToken({ result }) }
  } catch (err) {
    if (err instanceof NotInitialized) ready = null
    console.error(`[${name}]`, err)
    // Données envoyées dans un format inattendu (champ manquant, texte au lieu d'un nombre...) : rien n'est enregistré
    if (err instanceof TypeError || err instanceof RangeError) {
      return { status: 400, body: fail('Les données envoyées sont incomplètes ou mal formées. Rechargez la page et réessayez.', 'bad_request', 400) }
    }
    return { status: 500, body: fail('Erreur interne du serveur. Réessayez dans un instant.', 'server', 500) }
  }
}
