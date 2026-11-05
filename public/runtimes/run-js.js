// Exécution JavaScript dans le navigateur (mode test), dans un Web Worker isolé.
// Le programme lit l'entrée comme sous Node.js : require('fs').readFileSync(0), require('readline') ou prompt().
// Pas d'accès réseau ni aux fichiers ; le temps limite est appliqué par la page.
// Le déroulé (sorties et lectures de l'entrée, dans l'ordre) est renvoyé pour l'affichage façon terminal.

const MAX_OUTPUT = 64 * 1024
const blocked = () => { throw new Error('Accès réseau désactivé pendant l\'épreuve') }
self.fetch = blocked
self.XMLHttpRequest = undefined
self.WebSocket = undefined
self.importScripts = blocked

function show(v) {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

self.onmessage = (e) => {
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
  const lines = stdin.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  let i = 0
  const readLine = () => {
    if (i >= lines.length) return null
    const l = lines[i++]
    push('in', l + '\n')
    return l
  }
  const listeners = { line: [], close: [] }

  const fakeConsole = {
    log: (...a) => push('out', a.map(show).join(' ') + '\n'),
    info: (...a) => push('out', a.map(show).join(' ') + '\n'),
    warn: (...a) => push('err', a.map(show).join(' ') + '\n'),
    error: (...a) => push('err', a.map(show).join(' ') + '\n'),
  }
  let exitCode = 0
  const fakeProcess = {
    stdout: { write: (s) => { push('out', String(s)); return true } },
    stderr: { write: (s) => { push('err', String(s)); return true } },
    stdin: {},
    argv: ['node', 'main.js'],
    exit: (c = 0) => { exitCode = c; throw { __exit: true } },
  }
  const fakeRequire = (name) => {
    if (name === 'fs') {
      return {
        readFileSync: () => {
          const rest = lines.slice(i).join('\n') + (i < lines.length ? '\n' : '')
          for (; i < lines.length; i++) push('in', lines[i] + '\n')
          return rest
        },
      }
    }
    if (name === 'readline') {
      return {
        createInterface: () => ({
          on(ev, cb) { (listeners[ev] ||= []).push(cb); return this },
          close() {},
          question(q, cb) { push('out', String(q)); cb(readLine() ?? '') },
        }),
      }
    }
    throw new Error(`Le module « ${name} » n'est pas disponible ici`)
  }
  const fakePrompt = (q) => { if (q) push('out', String(q)); return readLine() }

  self.postMessage({ id, type: 'started' })
  const t0 = performance.now()
  try {
    const run = new Function('console', 'require', 'process', 'prompt', 'fetch', '"use strict";\n' + code)
    run(fakeConsole, fakeRequire, fakeProcess, fakePrompt, blocked)
    // Programmes écrits avec readline : on envoie les lignes restantes puis "close"
    if (listeners.line.length || listeners.close.length) {
      let l
      while ((l = readLine()) !== null) for (const cb of listeners.line) cb(l)
      for (const cb of listeners.close) cb()
    }
  } catch (ex) {
    if (!(ex && ex.__exit)) {
      push('err', `${ex && ex.name ? ex.name : 'Erreur'}: ${ex && ex.message ? ex.message : String(ex)}\n`)
      exitCode = 1
    }
  }
  const durationMs = Math.round(performance.now() - t0)
  const stdout = transcript.filter((x) => x.k === 'out').map((x) => x.s).join('')
  const stderr = transcript.filter((x) => x.k === 'err').map((x) => x.s).join('').trim()
  self.postMessage({ id, type: 'done', stdout, stderr, transcript, exitCode, durationMs })
}
