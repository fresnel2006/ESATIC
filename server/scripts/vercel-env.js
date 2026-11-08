// Prépare les variables secrètes à coller dans Vercel (Settings > Environment Variables), à partir de
// server/.env (PASSWORD_PEPPER) et server/firebase-key.json (clé Firebase, encodée en base64).
// Le fichier est écrit sur le Bureau, HORS du projet : il n'est jamais envoyé ni publié. Supprimez-le après usage.
// Usage : npm run vercel-env (dans le dossier server). Avec --demo : ajoute VITE_DEMO_TOOLS=true (démonstration).
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const pepper = process.env.PASSWORD_PEPPER
if (!pepper) throw new Error('PASSWORD_PEPPER introuvable dans server/.env')
const key = readFileSync(here('../firebase-key.json'))
const project = JSON.parse(key.toString('utf8')).project_id

const lines = [
  `FIREBASE_SERVICE_ACCOUNT_BASE64=${key.toString('base64')}`,
  `PASSWORD_PEPPER=${pepper}`,
]
if (process.argv.includes('--demo')) lines.push('VITE_DEMO_TOOLS=true')

const out = join(homedir(), 'Desktop', 'vercel-variables-ESATIC.env')
writeFileSync(out, lines.join('\n') + '\n')
console.log(`Fichier écrit : ${out}`)
console.log(`Projet Firebase : ${project}`)
console.log('Variables :', lines.map((l) => l.split('=')[0]).join(', '))
