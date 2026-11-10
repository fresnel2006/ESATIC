// Éditeur de diagrammes draw.io (questions de modélisation UML et Merise), servi par la plateforme elle-même :
// aucun appel à un site extérieur pendant les épreuves.
// Télécharge une seule fois la version officielle (logiciel libre, licence Apache 2.0) depuis GitHub,
// la garde dans node_modules/.cache, puis copie dans public/drawio/ seulement les fichiers utiles (~34 Mo sur 123).
// Lancé automatiquement avant `npm run dev` et `npm run build` (aussi sur Vercel).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { DRAWIO_VERSION, DRAWIO_PATCH, DRAWIO_DIR } from '../src/lib/drawioVersion.js'

// Version et numéro des réglages : src/lib/drawioVersion.js (à changer pour publier une nouvelle version)
const VERSION = DRAWIO_VERSION
const PATCH = DRAWIO_PATCH
const URL_WAR = `https://github.com/jgraph/drawio/releases/download/v${VERSION}/draw.war`

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// Un dossier par version (public/drawio/<version>) : les navigateurs ne gardent jamais une ancienne version
const base = path.join(root, 'public', 'drawio')
const dest = path.join(root, 'public', ...DRAWIO_DIR.split('/').filter(Boolean))
const cacheDir = path.join(root, 'node_modules', '.cache', 'esatic-drawio')
const cacheFile = path.join(cacheDir, `draw-${VERSION}.war`)
const marker = path.join(dest, '.version')

// Fichiers gardés : l'éditeur et ses ressources (interface en français et en anglais).
// Écartés : intégrations Google Drive / OneDrive, modèles, sources non compilées, bibliothèques d'images.
const KEEP_FILES = new Set([
  'index.html', 'favicon.ico',
  'js/bootstrap.js', 'js/main.js', 'js/PreConfig.js', 'js/PostConfig.js',
  'js/app.min.js', 'js/extensions.min.js', 'js/stencils.min.js', 'js/shapes-14-6-5.min.js',
  'resources/dia.txt', 'resources/dia_fr.txt',
])
const KEEP_DIRS = ['styles/', 'mxgraph/', 'images/', 'shapes/', 'stencils/', 'img/']
const SKIP_DIRS = ['img/lib/', 'img/clipart/']
const keep = (name) => !name.endsWith('/') && !name.endsWith('.map')
  && (KEEP_FILES.has(name) || (KEEP_DIRS.some((d) => name.startsWith(d)) && !SKIP_DIRS.some((d) => name.startsWith(d))))

if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === `${VERSION}+${PATCH}`) {
  process.exit(0)
}

if (!fs.existsSync(cacheFile)) {
  console.log(`[drawio] Téléchargement de draw.io ${VERSION} (environ 47 Mo, une seule fois)...`)
  const res = await fetch(URL_WAR)
  if (!res.ok) {
    console.error(`[drawio] Téléchargement impossible (${res.status}). Les questions de modélisation ne fonctionneront pas.`)
    process.exit(1)
  }
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(cacheFile, Buffer.from(await res.arrayBuffer()))
}

const files = unzipSync(new Uint8Array(fs.readFileSync(cacheFile)), { filter: (f) => keep(f.name) })
fs.rmSync(base, { recursive: true, force: true }) // anciennes versions comprises
let size = 0
for (const [name, data] of Object.entries(files)) {
  // Chemins venant de l'archive : on refuse tout ce qui sortirait du dossier de destination
  const to = path.resolve(dest, name)
  if (!to.startsWith(path.resolve(dest) + path.sep)) continue
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.writeFileSync(to, data)
  size += data.length
}
// Réglages de la plateforme (scripts/drawio-esatic.js), chargés par draw.io juste après l'éditeur
fs.appendFileSync(path.join(dest, 'js', 'PostConfig.js'), fs.readFileSync(path.join(root, 'scripts', 'drawio-esatic.js'), 'utf8'))
fs.writeFileSync(marker, `${VERSION}+${PATCH}\n`)
console.log(`[drawio] ${Object.keys(files).length} fichiers copiés dans public/drawio (${(size / 1048576).toFixed(1)} Mo)`)
