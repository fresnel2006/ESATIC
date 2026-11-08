// Préparation des moteurs d'exécution du navigateur, avec l'avancement visible par l'étudiant.
// Réservé aux pages du site (le serveur Node.js charge browserRunner.js, pas ce fichier).
import { BROWSER_LANGS, warmUp } from './browserRunner.js'
// Fichier WebAssembly du moteur PHP (même fichier que celui chargé par le worker PHP)
import phpWasmUrl from 'php-8-3-wasm?url'

// La page télécharge elle-même les fichiers du moteur en comptant les octets ; le navigateur les garde,
// et le moteur les reprend ensuite sans les retélécharger.

const ENGINE_FILES = {
  python: ['/runtimes/vendor/pyodide/pyodide.asm.wasm', '/runtimes/vendor/pyodide/python_stdlib.zip', '/runtimes/vendor/pyodide/pyodide.asm.mjs'],
  php: [phpWasmUrl],
  c: ['/runtimes/vendor/picoc/picoc.js'],
  sql: ['/runtimes/vendor/sqljs/sql-wasm-browser.wasm'],
  javascript: [],
}

// État par langage : idle | downloading (loaded, total en octets) | starting | ready | error
const engines = {}
const engineListeners = new Set()
const setEngine = (lang, patch) => {
  engines[lang] = { ...(engines[lang] || {}), ...patch }
  for (const fn of engineListeners) fn(lang)
}
const IDLE = { state: 'idle' }
export const engineState = (lang) => engines[lang] || IDLE
export function onEngineChange(fn) {
  engineListeners.add(fn)
  return () => engineListeners.delete(fn)
}

async function downloadEngine(lang) {
  const files = ENGINE_FILES[lang] || []
  const sizes = files.map(() => 0)
  const loaded = files.map(() => 0)
  setEngine(lang, { state: 'downloading', loaded: 0, total: 0 })
  const update = () => setEngine(lang, { loaded: loaded.reduce((a, b) => a + b, 0), total: sizes.reduce((a, b) => a + b, 0) })
  await Promise.all(files.map(async (url, i) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url} : ${res.status}`)
    sizes[i] = Number(res.headers.get('content-length')) || 0
    update()
    if (!res.body) { await res.arrayBuffer(); loaded[i] = sizes[i]; update(); return }
    const reader = res.body.getReader()
    let last = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      loaded[i] += value.length
      if (loaded[i] > sizes[i]) sizes[i] = loaded[i] // taille inconnue (envoi compressé) : on affiche ce qui est reçu
      if (Date.now() - last > 200) { last = Date.now(); update() }
    }
    update()
  }))
}

// Télécharge puis démarre le moteur d'un langage (une seule fois par page)
const preparing = {}
export function prepareEngine(lang) {
  if (!BROWSER_LANGS.includes(lang)) return Promise.resolve()
  if (preparing[lang]) return preparing[lang]
  preparing[lang] = downloadEngine(lang)
    .then(() => {
      setEngine(lang, { state: 'starting' })
      return warmUp(lang)
    })
    .then((r) => {
      if (r?.failed) throw new Error(r.stderr || "Le moteur n'a pas démarré.")
      setEngine(lang, { state: 'ready' })
    })
    .catch((err) => {
      delete preparing[lang]
      setEngine(lang, { state: 'error', error: err?.message || String(err) })
    })
  return preparing[lang]
}
