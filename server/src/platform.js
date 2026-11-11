// Branche la logique du site (esatic/src/api/core.js) sur le serveur :
// données de la requête en cours, jeton de session par requête, mots de passe hachés avec scrypt.
import { AsyncLocalStorage } from 'node:async_hooks'
import { scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import * as core from '../../esatic/src/api/core.js'
import { serverId, putFile, getFile, storeCreateAll, storeQuery, storeCount } from './data.js'

const scryptAsync = promisify(scrypt)
const pepper = process.env.PASSWORD_PEPPER
if (!pepper || pepper.length < 32) throw new Error('PASSWORD_PEPPER manquant ou trop court (fichier server/.env ou configuration Vercel)')

export async function hashPassword(password) {
  const key = await scryptAsync(String(password), 'esatic:' + pepper, 32, { N: 16384, r: 8, p: 1 })
  return 'scrypt$' + key.toString('hex')
}

// Contexte de la requête en cours : données, jeton reçu et jeton à renvoyer
export const requestContext = new AsyncLocalStorage()
const ctx = () => requestContext.getStore()

core.configurePlatform({
  server: true,
  getDb: () => ctx()?.db,
  readDb: async () => null,
  writeDb: () => { const c = ctx(); if (c) c.dirty = true },
  clearDb: async () => {
    if (process.env.ALLOW_DEMO_RESET !== 'true') {
      throw new core.ApiError('La réinitialisation est désactivée sur ce serveur.', 'forbidden', 403)
    }
    ctx().reset = true
  },
  hash: hashPassword,
  nextId: serverId,
  // Bulletins déposés : rangés dans Firestore (bulletinFiles) ; la suppression attend que l'appel soit enregistré
  files: {
    put: putFile,
    get: getFile,
    remove: (key) => { ctx()?.removeFiles?.add(key) },
  },
  // Évaluation des enseignants : participations et réponses anonymes, rangées à part
  store: { createAll: storeCreateAll, query: storeQuery, count: storeCount },
  getToken: () => ctx()?.token ?? null,
  setToken: (t) => { const c = ctx(); if (c) { c.token = t; c.out = t } },
  clearToken: () => { const c = ctx(); if (c) { c.token = null; c.out = null } },
})

export { core }
