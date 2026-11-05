import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/runtimes/vendor']),
  {
    // Programmes d'exécution (Web Workers) et scripts Node
    files: ['public/runtimes/*.js'],
    languageOptions: { globals: globals.worker },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Les fichiers de composants exportent aussi quelques constantes et hooks partagés
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
