// Copie les moteurs d'exécution (Pyodide pour Python, sql.js pour SQL) depuis node_modules
// vers public/runtimes/vendor/, pour qu'ils soient servis localement (aucun CDN).
// Lancé automatiquement avant `npm run dev` et `npm run build`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dest = path.join(root, 'public', 'runtimes', 'vendor')

const files = {
  pyodide: ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'],
  'sql.js/dist': ['sql-wasm-browser.js', 'sql-wasm-browser.wasm'],
}
const target = { pyodide: 'pyodide', 'sql.js/dist': 'sqljs' }

let copied = 0
for (const [pkg, list] of Object.entries(files)) {
  const out = path.join(dest, target[pkg])
  fs.mkdirSync(out, { recursive: true })
  for (const f of list) {
    const from = path.join(root, 'node_modules', pkg, f)
    const to = path.join(out, f)
    if (!fs.existsSync(from)) {
      console.error(`[runtimes] fichier manquant : ${from} (lancez npm install)`)
      process.exitCode = 1
      continue
    }
    const same = fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size
    if (!same) {
      fs.copyFileSync(from, to)
      copied++
    }
  }
}
// C (picoc) : un seul fichier. On y expose la fonction qui crée l'interpréteur (le module ne publie que runC,
// qui ne dit pas quand le programme se termine) : le worker contrôle ainsi le début et la fin de chaque exécution.
{
  const from = path.join(root, 'node_modules', 'picoc-js', 'dist', 'bundle.umd.js')
  const out = path.join(dest, 'picoc')
  const to = path.join(out, 'picoc.js')
  fs.mkdirSync(out, { recursive: true })
  if (!fs.existsSync(from)) {
    console.error(`[runtimes] fichier manquant : ${from} (lancez npm install)`)
    process.exitCode = 1
  } else {
    const src = fs.readFileSync(from, 'utf8')
    if (!src.includes('exports.runC = runC;')) {
      console.error('[runtimes] picoc-js : version inattendue, exécution du C indisponible')
      process.exitCode = 1
    } else {
      // Après le programme, on vide la sortie en attente : sinon un dernier printf sans retour à la ligne est perdu
      // (fflush n'est pas exporté par le module : un mini-programme C l'appelle sur la même mémoire)
      const flush = [
        'callMain(["file.c"]);',
        '\t  try { FS.writeFile("flush.c", "#include <stdio.h>\\nint main() { fflush(stdout); return 0; }\\n"); callMain(["flush.c"]); } catch (e) {}',
        '\t  try { var so = FS.streams[1]; if (so && so.tty && so.tty.ops && so.tty.ops.flush) so.tty.ops.flush(so.tty); } catch (e) {}',
      ].join('\n')
      const patched = src
        .replace('exports.runC = runC;', 'exports.runC = runC;\n\texports.createPicoc = picoc;')
        .replace('callMain(["file.c"]);', flush)
      if (!fs.existsSync(to) || fs.readFileSync(to, 'utf8') !== patched) {
        fs.writeFileSync(to, patched)
        copied++
      }
    }
  }
}

console.log(`[runtimes] moteurs d'exécution prêts dans public/runtimes/vendor (${copied} fichier(s) copié(s))`)
