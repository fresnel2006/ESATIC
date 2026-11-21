// Pages chargées à la demande, et préparées à l'avance pour l'espace de la personne connectée :
// juste après la connexion, quand le navigateur n'a rien d'autre à faire, les pages de son espace sont
// téléchargées en arrière-plan ; un clic dans le menu les ouvre alors sans attente.
import { lazy } from 'react'

const registry = [] // { load, roles }

// page(() => import('./x.jsx'), ['teacher']) : composant chargé à la demande, rattaché à des espaces
export function page(load, roles = []) {
  registry.push({ load, roles })
  return lazy(load)
}

const done = new Set()
export function prefetchPages(role) {
  if (!role || done.has(role)) return
  done.add(role)
  // Connexion lente ou économie de données demandée : on ne télécharge rien d'avance
  const c = navigator.connection
  if (c?.saveData || /2g/.test(c?.effectiveType || '')) return
  const list = registry.filter((p) => p.roles.includes(role))
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200))
  let i = 0
  const next = () => {
    if (i >= list.length) return
    const p = list[i++]
    p.load().catch(() => {}).finally(() => idle(next))
  }
  idle(next)
}
