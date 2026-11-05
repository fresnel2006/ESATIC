// Exécution Python dans le navigateur (mode test) : Pyodide dans un Web Worker.
// Le worker n'a accès ni aux fichiers du poste ni au serveur ; le réseau est coupé une fois Pyodide chargé.
// Le temps limite est appliqué par la page, qui arrête le worker s'il dépasse.
// Le déroulé (sorties et lectures de l'entrée, dans l'ordre) est renvoyé pour l'affichage façon terminal.

const MAX_OUTPUT = 64 * 1024
let ready = null

function blockNetwork() {
  const blocked = () => { throw new Error('Accès réseau désactivé pendant l\'épreuve') }
  self.fetch = blocked
  self.XMLHttpRequest = undefined
  self.WebSocket = undefined
  self.importScripts = blocked
}

async function getPython() {
  if (!ready) {
    ready = (async () => {
      const { loadPyodide } = await import('./vendor/pyodide/pyodide.mjs')
      const py = await loadPyodide({ indexURL: new URL('./vendor/pyodide/', self.location.href).href })
      blockNetwork()
      return py
    })()
  }
  return ready
}

// Garde la partie utile de la trace Python (sans les lignes internes de Pyodide)
function cleanError(message) {
  const lines = String(message).split('\n')
  const start = lines.findIndex((l) => l.includes('File "<exec>"'))
  return (start >= 0 ? ['Traceback (most recent call last):', ...lines.slice(start)] : lines).join('\n').trim()
}

self.onmessage = async (e) => {
  const { id, code, stdin = '' } = e.data
  const transcript = []
  let size = 0
  const push = (k, s) => {
    if (!s || size > MAX_OUTPUT) return
    size += s.length
    const last = transcript[transcript.length - 1]
    if (last && last.k === k) last.s += s
    else transcript.push({ k, s })
  }
  // Octets UTF-8 accumulés, décodés au moment de les afficher
  const decoder = new TextDecoder()
  let outBytes = []
  let errBytes = []
  const flush = () => {
    if (outBytes.length) { push('out', decoder.decode(new Uint8Array(outBytes))); outBytes = [] }
    if (errBytes.length) { push('err', decoder.decode(new Uint8Array(errBytes))); errBytes = [] }
  }
  let exitCode = 0
  const t0 = performance.now()
  try {
    const py = await getPython()
    const lines = stdin.split(/\r?\n/)
    if (lines.length && lines[lines.length - 1] === '') lines.pop()
    let i = 0
    py.setStdin({
      stdin: () => {
        flush()
        if (i >= lines.length) return undefined
        const line = lines[i++]
        push('in', line + '\n')
        return line
      },
    })
    py.setStdout({ raw: (c) => { outBytes.push(c); if (c === 10) flush() } })
    py.setStderr({ raw: (c) => { errBytes.push(c); if (c === 10) flush() } })
    self.postMessage({ id, type: 'started' })
    const scope = py.globals.get('dict')()
    try {
      await py.runPythonAsync(code, { globals: scope })
    } finally {
      scope.destroy()
    }
  } catch (err) {
    flush()
    const msg = cleanError(err.message)
    // sys.exit(n) n'est pas une erreur à afficher comme une trace
    const exit = msg.match(/SystemExit: ?(\d*)\s*$/)
    if (exit) exitCode = Number(exit[1] || 0)
    else { push('err', (transcript.length && !transcript[transcript.length - 1].s.endsWith('\n') ? '\n' : '') + msg + '\n'); exitCode = 1 }
  }
  flush()
  const durationMs = Math.round(performance.now() - t0)
  const stdout = transcript.filter((x) => x.k === 'out').map((x) => x.s).join('')
  const stderr = transcript.filter((x) => x.k === 'err').map((x) => x.s).join('').trim()
  self.postMessage({ id, type: 'done', stdout, stderr, transcript, exitCode, durationMs })
}
