import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// PHP 8.3 (moteur WordPress Playground) : variante « asyncify » seulement, qui marche dans tous les navigateurs.
// Le paquet importe son fichier .wasm directement ; on le transforme en adresse de fichier (?url) pour Vite.
const PHP_LOADER = fileURLToPath(new URL('./node_modules/@php-wasm/web-8-3/asyncify/php_8_3.js', import.meta.url))
// Son fichier WebAssembly (le même que celui du worker) : la page le télécharge en affichant l'avancement
const PHP_WASM = fileURLToPath(new URL('./node_modules/@php-wasm/web-8-3/asyncify/8_3_33/php_8_3.wasm', import.meta.url))
// Même traitement en développement (npm run dev) et à la compilation : l'import du .wasm est redirigé vers
// sa version ?url avant que Vite ne tente de le charger comme module WebAssembly (import "env" introuvable).
function phpWasmAsUrl() {
  return {
    name: 'esatic-php-wasm-url',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!/php_8_3\.wasm$/.test(source) || !importer) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved ? `${resolved.id.split('?')[0]}?url` : null
    },
    transform(code, id) {
      if (!/\/asyncify\/php_8_3\.js(\?|$)/.test(id.replace(/\\/g, '/'))) return null
      return code.replace(/from '(\.\/[^']+\.wasm)';/, "from '$1?url';")
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), phpWasmAsUrl()],
  resolve: {
    alias: [
      // Accès direct aux modules ESM de Monaco : on n'embarque que les langages utiles
      { find: /^monaco-esm\//, replacement: fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs/', import.meta.url)) },
      { find: /^php-8-3-asyncify$/, replacement: PHP_LOADER },
      { find: /^php-8-3-wasm(\?.*)?$/, replacement: PHP_WASM + '$1' },
    ],
  },
  // Le moteur PHP n'est pas pré-assemblé par Vite en développement : sinon la règle ci-dessus ne s'applique pas
  optimizeDeps: {
    exclude: ['@php-wasm/universal', '@php-wasm/web-8-3', 'php-8-3-asyncify'],
    // ...mais sa dépendance « ini », écrite au format Node (CommonJS), doit être convertie pour le navigateur
    include: ['@php-wasm/universal > ini'],
  },
  worker: {
    format: 'es',
    plugins: () => [phpWasmAsUrl()],
  },
  server: {
    host: true, // accessible depuis les autres postes de la salle
    // Les appels de données vont au serveur Node.js (dossier server/, npm run dev)
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
})
