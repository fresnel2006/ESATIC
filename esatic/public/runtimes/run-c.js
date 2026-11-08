// Exécution du C dans le navigateur, dans un Web Worker isolé, avec picoc (interpréteur C en WebAssembly).
// Le programme lit l'entrée avec scanf, getchar, fgets... ; pas d'accès réseau ni aux fichiers ;
// le temps limite est appliqué par la page (le worker est arrêté s'il le dépasse).
// picoc couvre le C des cours (types, tableaux, pointeurs, structures, malloc, chaînes, math.h) ;
// ce n'est pas gcc : quelques constructions avancées peuvent être refusées.

importScripts('/runtimes/vendor/picoc/picoc.js')

const MAX_OUTPUT = 64 * 1024
const blocked = () => { throw new Error('Accès réseau désactivé pendant l\'épreuve') }
// Le moteur charge son code WebAssembly depuis une adresse data: (intégrée au fichier, pas de réseau) : seule autorisée
const localFetch = self.fetch.bind(self)
self.fetch = (url, ...rest) => (String(url).startsWith('data:') ? localFetch(url, ...rest) : blocked())
self.XMLHttpRequest = undefined
self.WebSocket = undefined
self.importScripts = blocked

// Messages de picoc ("file.c:3:28 ';' expected") : remis au nom de fichier vu par l'étudiant
const PICOC_ERROR = /^file\.c:(\d+):(\d+):?\s*(.*)$/

// picoc ne connaît pas le mot-clé const. Il ne change rien à l'exécution d'un programme correct : on le retire
// (hors chaînes et commentaires), sans décaler les lignes ni les colonnes des messages d'erreur.
const TOKENS = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|\bconst\b/g
const adapt = (code) => code.replace(TOKENS, (m, keep) => keep ?? '     ')

// Limites connues du moteur, expliquées à l'étudiant (son code n'est pas forcément faux)
const LIMIT_NOTE = {
  'out of memory': 'Limite du moteur C du navigateur : récursivité trop profonde (environ 1 000 appels), ou opérateur ternaire ?: autour d\'un appel récursif. Votre code peut être juste : essayez un if / else.',
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

  // Entrée du programme : l'émulateur de terminal d'Emscripten appelle readline() ligne par ligne
  const lines = stdin.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  let i = 0
  self.readline = () => {
    if (i >= lines.length) return null
    const l = lines[i++]
    push('in', l + '\n')
    return l
  }

  let failed = false
  const write = (line) => {
    const m = PICOC_ERROR.exec(String(line))
    if (m) {
      failed = true
      // picoc affiche la ligne fautive et un ^ juste avant le message : ils vont avec l'erreur
      const last = transcript[transcript.length - 1]
      let context = ''
      if (last && last.k === 'out') {
        const parts = last.s.split('\n')
        parts.pop()
        if (parts.length >= 2 && /^\s*\^\s*$/.test(parts[parts.length - 1])) {
          context = parts.splice(-2).join('\n') + '\n'
          last.s = parts.length ? parts.join('\n') + '\n' : ''
          if (!last.s) transcript.pop()
        }
      }
      const note = LIMIT_NOTE[m[3].trim()]
      push('err', `main.c:${m[1]}:${m[2]}: erreur : ${m[3]}\n${context}${note ? note + '\n' : ''}`)
    } else {
      push('out', String(line) + '\n')
    }
  }

  let t0 = performance.now()
  const finish = (extraErr) => {
    if (extraErr) { failed = true; push('err', extraErr + '\n') }
    const durationMs = Math.round(performance.now() - t0)
    const stdout = transcript.filter((x) => x.k === 'out').map((x) => x.s).join('')
    const stderr = transcript.filter((x) => x.k === 'err').map((x) => x.s).join('').trim()
    self.postMessage({ id, type: 'done', stdout, stderr, transcript, exitCode: failed ? 1 : 0, durationMs })
  }

  try {
    const pc = self.picocjs.createPicoc({ printErr: (s) => push('err', String(s) + '\n') })
    pc.onRuntimeInitialized = () => {
      // Le chronomètre du programme démarre ici, une fois le moteur chargé
      self.postMessage({ id, type: 'started' })
      t0 = performance.now()
      try {
        pc.runc(adapt(code), write)
        finish()
      } catch (ex) {
        finish(`Erreur d'exécution : ${ex && ex.message ? ex.message : String(ex)}`)
      }
    }
  } catch (ex) {
    finish(`Le moteur C n'a pas pu démarrer : ${ex && ex.message ? ex.message : String(ex)}`)
  }
}
