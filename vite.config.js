import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// PHP 8.3 (moteur WordPress Playground) : variante « asyncify » seulement, qui marche dans tous les navigateurs.
// Le paquet importe son fichier .wasm directement ; on le transforme en adresse de fichier (?url) pour Vite.
const PHP_LOADER = fileURLToPath(new URL('./node_modules/@php-wasm/web-8-3/asyncify/php_8_3.js', import.meta.url))
function phpWasmAsUrl() {
  return {
    name: 'esatic-php-wasm-url',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/asyncify/php_8_3.js')) return null
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
    ],
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
