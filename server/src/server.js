// Serveur de la plateforme : POST /api/<fonction> et, en production, le site compilé (esatic/dist).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi, ensureReady } from './handler.js'

const PORT = Number(process.env.PORT) || 4000
const DIST = fileURLToPath(new URL('../../esatic/dist/', import.meta.url))
const MAX_BODY = 4 * 1024 * 1024 // bulletin de 2 Mo maximum, encodé en base64

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
const fail = (message, code, status) => ({ error: { message, code, status } })

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY) return null
    chunks.push(c)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function handleRequest(req, res, name) {
  const body = await readBody(req)
  if (body === null) return send(res, 413, fail('Requête trop volumineuse.', 'too_large', 413))
  const out = await handleApi({ method: req.method, name, body, tokenHeader: req.headers['x-esatic-token'], ip: req.socket.remoteAddress })
  send(res, out.status, out.body)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.zip': 'application/zip',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

// Site compilé ; toute adresse inconnue renvoie index.html (la navigation est gérée par React)
async function handleStatic(req, res, pathname) {
  let file = normalize(join(DIST, decodeURIComponent(pathname)))
  if (!file.startsWith(normalize(DIST))) return send(res, 403, fail('Accès interdit.', 'forbidden', 403))
  try {
    if (!(await stat(file)).isFile()) throw new Error('dossier')
  } catch {
    file = join(DIST, 'index.html')
  }
  try {
    const data = await readFile(file)
    const immutable = pathname.startsWith('/assets/')
    // Moteurs d'exécution (Python, C, SQL) : gros fichiers qui ne changent qu'avec une mise à jour, gardés 7 jours
    const vendor = pathname.startsWith('/runtimes/vendor/')
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      // Taille annoncée : la page affiche « x Mo sur y Mo » pendant le téléchargement
      'Content-Length': data.length,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : vendor ? 'public, max-age=604800' : 'no-cache',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Site non compilé : lancez "npm run build" dans le dossier esatic, ou utilisez "npm run dev".')
  }
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  if (pathname.startsWith('/api/')) return handleRequest(req, res, pathname.slice(5))
  return handleStatic(req, res, pathname)
})

// Prépare la base avant d'accepter les connexions (la crée avec la démo si Firestore est vide)
await ensureReady()
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Le port ${PORT} est déjà utilisé : un serveur ESATIC tourne peut-être déjà.` : err.message)
  process.exit(1)
})
server.listen(PORT, () => console.log(`Serveur ESATIC prêt sur http://localhost:${PORT} (Firestore : ${process.env.FIREBASE_PROJECT_ID})`))

function stop() {
  server.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
