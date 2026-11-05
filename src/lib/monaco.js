// Monaco servi localement (pas de CDN). Seuls les langages de la plateforme sont chargés.
import * as monaco from 'monaco-esm/editor/editor.api.js'

import 'monaco-esm/base/browser/ui/codicons/codicon/codicon.css'
import 'monaco-esm/base/browser/ui/codicons/codicon/codicon-modifiers.css'
import 'monaco-esm/editor/browser/coreCommands.js'
import 'monaco-esm/editor/browser/widget/codeEditor/codeEditorWidget.js'
import 'monaco-esm/editor/contrib/bracketMatching/browser/bracketMatching.js'
import 'monaco-esm/editor/contrib/clipboard/browser/clipboard.js'
import 'monaco-esm/editor/contrib/comment/browser/comment.js'
import 'monaco-esm/editor/contrib/cursorUndo/browser/cursorUndo.js'
import 'monaco-esm/editor/contrib/folding/browser/folding.js'
import 'monaco-esm/editor/contrib/indentation/browser/indentation.js'
import 'monaco-esm/editor/contrib/linesOperations/browser/linesOperations.js'
import 'monaco-esm/editor/contrib/multicursor/browser/multicursor.js'
import 'monaco-esm/editor/contrib/wordHighlighter/browser/wordHighlighter.js'
import 'monaco-esm/editor/contrib/wordOperations/browser/wordOperations.js'
import 'monaco-esm/editor/contrib/suggest/browser/suggestController.js'
import 'monaco-esm/editor/contrib/find/browser/findController.js'
import 'monaco-esm/editor/contrib/tokenization/browser/tokenization.js'
import 'monaco-esm/editor/common/standaloneStrings.js'

import 'monaco-esm/languages/definitions/cpp/register.js'
import 'monaco-esm/languages/definitions/python/register.js'
import 'monaco-esm/languages/definitions/java/register.js'
import 'monaco-esm/languages/definitions/javascript/register.js'
import 'monaco-esm/languages/definitions/php/register.js'
import 'monaco-esm/languages/definitions/sql/register.js'
import 'monaco-esm/languages/definitions/html/register.js'
import 'monaco-esm/languages/definitions/css/register.js'

// Worker de l'éditeur. La forme `new Worker(new URL(...), import.meta.url)` est traitée de la même façon
// par Vite en développement et en production (l'import `?worker` cassait en `npm run dev`).
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(new URL('../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' })
  },
}

// La police du code (JetBrains Mono) peut arriver après la création de l'éditeur : on remesure
document.fonts?.load('14px "JetBrains Mono"').then(() => monaco.editor.remeasureFonts()).catch(() => {})

// Identifiants Monaco pour nos langages
export const MONACO_LANG = { c: 'cpp', cpp: 'cpp', python: 'python', java: 'java', javascript: 'javascript', php: 'php', sql: 'sql', html: 'html', css: 'css' }

export default monaco
