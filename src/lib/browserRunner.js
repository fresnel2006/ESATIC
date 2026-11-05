// Exécution de code dans le navigateur pour le mode test (Python, JavaScript, SQL).
// Un Web Worker par langage, gardé chaud entre deux exécutions ; arrêté et recréé s'il dépasse le temps limite.

const WORKERS = {
  python: { url: '/runtimes/run-python.js', type: 'module' },
  javascript: { url: '/runtimes/run-js.js', type: 'classic' },
  sql: { url: '/runtimes/run-sql.js', type: 'classic' },
  c: { url: '/runtimes/run-c.js', type: 'classic' },
  // PHP : worker construit par Vite (il importe le moteur PHP 8.3 et son fichier WebAssembly)
  php: { create: () => new Worker(new URL('../workers/php-worker.js', import.meta.url), { type: 'module' }) },
}

export const BROWSER_LANGS = Object.keys(WORKERS)

const pool = {}
let seq = 0

function getWorker(lang) {
  if (!pool[lang]) {
    const { url, type, create } = WORKERS[lang]
    pool[lang] = create ? create() : new Worker(url, { type })
  }
  return pool[lang]
}

function kill(lang) {
  pool[lang]?.terminate()
  delete pool[lang]
}

// Le chargement du moteur (Python surtout) peut prendre quelques secondes la première fois :
// le chronomètre du programme ne démarre qu'au message "started".
export function runInBrowser(lang, payload, timeLimitMs = 2000) {
  return new Promise((resolve) => {
    const worker = getWorker(lang)
    const id = ++seq
    let timer = null
    const loadTimer = setTimeout(() => finish({ stdout: '', stderr: 'Le moteur d\'exécution n\'a pas pu démarrer.', failed: true }, true), 90000)

    function finish(result, restart) {
      clearTimeout(timer)
      clearTimeout(loadTimer)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (restart) kill(lang)
      resolve(result)
    }
    function onMessage(e) {
      if (e.data.id !== id) return
      if (e.data.type === 'started') {
        clearTimeout(loadTimer)
        timer = setTimeout(() => finish({ stdout: '', stderr: '', timeout: true }, true), timeLimitMs)
      } else if (e.data.type === 'done') {
        finish(e.data, false)
      }
    }
    function onError(e) {
      e.preventDefault()
      finish({ stdout: '', stderr: e.message || 'Erreur du moteur d\'exécution.', failed: true }, true)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ id, ...payload })
  })
}

// Base de test SQL de l'enseignant : import d'un fichier ou vérification du SQL saisi.
// payload : { importDb: true, dbBytes } | { importDb: true, sqlText, convertMysql: true } | { inspect: true, schema, seed }
// Réponse : { schema, seed, tables: [{ name, rows, truncated }] } ou { stderr } en cas d'erreur
export function sqlDatabaseTool(payload) {
  return runInBrowser('sql', payload, 15000)
}

// Démarre le moteur à l'avance (le premier chargement de Python prend quelques secondes)
const warming = {}
export function warmUp(lang) {
  if (!WORKERS[lang] || warming[lang]) return warming[lang]
  const payload = lang === 'sql' ? { schema: '', seed: '', query: 'SELECT 1' } : { code: '', stdin: '' }
  warming[lang] = runInBrowser(lang, payload, 5000).finally(() => { delete warming[lang] })
  return warming[lang]
}

// Comparaison de sortie : espaces en fin de ligne et lignes vides finales ignorés
export function sameOutput(a = '', b = '') {
  const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n+$/, '')
  return norm(a) === norm(b)
}
