// Exécution PHP dans le navigateur, dans un Web Worker isolé, avec le vrai PHP 8.3 compilé en WebAssembly
// (projet WordPress Playground). Le moteur est chargé une fois puis réutilisé ; chaque exécution est une
// requête PHP neuve (variables et fonctions repartent de zéro). Le temps limite est appliqué par la page.
//
// Le programme lit l'entrée comme en ligne de commande : fgets(STDIN), fscanf(STDIN, ...), readline(),
// stream_get_contents(STDIN). Pas d'accès réseau.
import { PHP, loadPHPRuntime, setPhpIniEntries } from '@php-wasm/universal'
import * as phpLoader from 'php-8-3-asyncify'

const MAX_OUTPUT = 64 * 1024
const STDIN_FILE = '/tmp/stdin.txt'

// Réseau : seul le chargement du moteur lui-même (même origine) est permis
const localFetch = self.fetch.bind(self)
self.fetch = (url, ...rest) => {
  const target = new URL(String(url instanceof Request ? url.url : url), self.location.href)
  if (target.origin === self.location.origin || target.protocol === 'data:' || target.protocol === 'blob:') return localFetch(url, ...rest)
  return Promise.reject(new Error('Accès réseau désactivé pendant l\'épreuve'))
}
self.WebSocket = undefined

let phpReady = null
// Erreurs comme php-cli : jamais mélangées à la sortie du programme, envoyées à part en texte simple
const getPHP = () => (phpReady ??= loadPHPRuntime(phpLoader).then(async (id) => {
  const php = new PHP(id)
  await setPhpIniEntries(php, { display_errors: '0', display_startup_errors: '0', log_errors: '1', html_errors: '0', error_reporting: String(32767) })
  return php
}))

// Ajouté sur la ligne du <?php pour ne pas décaler les numéros de ligne des erreurs :
// STDIN et readline() comme en ligne de commande
const PRELUDE = [
  `if (!defined('STDIN')) define('STDIN', fopen('${STDIN_FILE}', 'r'));`,
  "if (!function_exists('readline')) { function readline($p = null) { if ($p !== null) echo $p; $l = fgets(STDIN); return $l === false ? false : rtrim($l, \"\\r\\n\"); } }",
].join(' ')

function prepare(code) {
  const m = /<\?php(\s|$)/i.exec(code)
  if (m) return code.slice(0, m.index) + '<?php ' + PRELUDE + code.slice(m.index + 5)
  // Pas de balise : PHP afficherait le texte tel quel, comme php-cli
  return code
}

// Messages de PHP : chemin interne du script remplacé par main.php, comme le voit l'étudiant
const cleanError = (s) => s
  .replace(/\/internal\/eval\.php/g, 'main.php')
  .replace(/\n{3,}/g, '\n\n')

self.onmessage = async (e) => {
  const { id, code = '', stdin = '' } = e.data
  const transcript = []
  let size = 0
  const push = (k, s) => {
    if (!s || size > MAX_OUTPUT) return
    s = s.length + size > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT - size) + '\n[sortie tronquée]\n' : s
    size += s.length
    const last = transcript[transcript.length - 1]
    if (last && last.k === k) last.s += s
    else transcript.push({ k, s })
  }

  let php
  try {
    php = await getPHP()
  } catch (err) {
    phpReady = null
    self.postMessage({ id, type: 'done', stdout: '', stderr: `Le moteur PHP n'a pas pu démarrer : ${err?.message || err}`, transcript: [], exitCode: 1, durationMs: 0 })
    return
  }

  php.writeFile(STDIN_FILE, stdin)
  // L'entrée est affichée telle que tapée, avant la sortie (comme une saisie anticipée au clavier)
  if (stdin && /STDIN|readline|php:\/\/stdin/.test(code)) push('in', stdin.endsWith('\n') ? stdin : stdin + '\n')

  self.postMessage({ id, type: 'started' })
  const t0 = performance.now()
  let exitCode
  try {
    const r = await php.run({ code: prepare(code) })
    exitCode = r.exitCode ?? 0
    push('out', r.text ?? '')
    const errors = (r.errors ?? '').trim()
    if (errors) push('err', cleanError(errors) + '\n')
  } catch (err) {
    // Erreur fatale : PHP s'arrête ; ce que le programme avait déjà affiché reste dans la sortie
    exitCode = err?.response?.exitCode || 255
    if (err?.response) {
      push('out', err.response.text || '')
      const errors = String(err.response.errors || '').trim()
      push('err', cleanError(errors || err.message || 'Erreur PHP') + '\n')
    } else {
      push('err', cleanError(String(err?.message || err)) + '\n')
    }
  }
  if (transcript.some((t) => t.k === 'err' && /Parse error|Fatal error|Uncaught/.test(t.s)) && !exitCode) exitCode = 255
  const durationMs = Math.round(performance.now() - t0)
  const stdout = transcript.filter((x) => x.k === 'out').map((x) => x.s).join('')
  const stderr = transcript.filter((x) => x.k === 'err').map((x) => x.s).join('').trim()
  self.postMessage({ id, type: 'done', stdout, stderr, transcript, exitCode, durationMs })
}
