// Vercel : chaque appel POST /api/<fonction> du site arrive ici, puis suit le même chemin que sur le serveur local
// (server/src/handler.js : droits, logique de esatic/src/api/core.js, enregistrement dans Firestore).
import { handleApi } from '../server/src/handler.js'

export default async function handler(req, res) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const { status, body } = await handleApi({
    method: req.method,
    name: String(req.query.name || ''),
    body: req.body ?? {},
    tokenHeader: req.headers['x-esatic-token'],
    ip: forwarded || req.socket?.remoteAddress || 'inconnue',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}
