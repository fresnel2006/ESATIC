// Connexion à Firebase avec la clé du compte de service (accès complet, côté serveur uniquement).
// La clé vient, dans l'ordre :
//   - de FIREBASE_SERVICE_ACCOUNT_BASE64 (contenu du fichier JSON encodé en base64 : configuration Vercel) ;
//   - de FIREBASE_SERVICE_ACCOUNT (contenu JSON brut) ;
//   - du fichier server/firebase-key.json (développement sur le PC).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// firebase-admin passe lui-même sa clé à google-auth-library d'une manière que cette bibliothèque
// signale comme ancienne. Ce n'est pas une erreur et cela ne dépend pas de notre code : on masque ce seul message.
const warn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('option is deprecated. Please use the `auth` object constructor')) return
  warn(...args)
}

function readKey() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'))
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  const file = fileURLToPath(new URL('../' + (process.env.GOOGLE_APPLICATION_CREDENTIALS || './firebase-key.json'), import.meta.url))
  return JSON.parse(readFileSync(file, 'utf8'))
}

const key = readKey()
if (process.env.FIREBASE_PROJECT_ID && key.project_id !== process.env.FIREBASE_PROJECT_ID) {
  throw new Error(`La clé appartient au projet ${key.project_id}, pas à ${process.env.FIREBASE_PROJECT_ID}.`)
}

// Sur Vercel, le module peut être rechargé dans la même copie du serveur : une seule application Firebase
export const app = getApps()[0] ?? initializeApp({ credential: cert(key), projectId: key.project_id })
export const db = getFirestore(app)
if (!globalThis.__esaticFirestoreReady) {
  db.settings({ ignoreUndefinedProperties: true })
  globalThis.__esaticFirestoreReady = true
}
