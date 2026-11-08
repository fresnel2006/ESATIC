import { useEffect, useRef } from 'react'
import monaco, { MONACO_LANG } from '../lib/monaco.js'
import { internalClipboard } from '../lib/clipboard.js'

// Éditeur Monaco.
// - Copier/couper dans l'éditeur : le texte est retenu comme "presse-papiers interne".
// - Le contrôle du collage est fait par le garde de la page de composition (useExamGuard).
// - onBigInsert : signalé quand un gros bloc apparaît d'un coup sans venir du presse-papiers interne.
export default function CodeEditor({ value, onChange, language = 'python', height = 360, readOnly = false, onBigInsert, theme }) {
  const hostRef = useRef(null)
  const editorRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onBigInsertRef = useRef(onBigInsert)
  const emitted = useRef(new Set()) // valeurs envoyées par l'éditeur lui-même

  useEffect(() => {
    onChangeRef.current = onChange
    onBigInsertRef.current = onBigInsert
  }, [onChange, onBigInsert])

  useEffect(() => {
    const dark = (theme || document.documentElement.dataset.theme) === 'dark'
    const editor = monaco.editor.create(hostRef.current, {
      value: value ?? '',
      language: MONACO_LANG[language] || language,
      readOnly,
      theme: dark ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', 'Courier New', monospace",
      fontLigatures: false,
      tabSize: 4,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      contextmenu: false, // pas de menu "Coller" alternatif
      dragAndDrop: false,
      dropIntoEditor: { enabled: false },
      pasteAs: { enabled: false },
      emptySelectionClipboard: false,
      copyWithSyntaxHighlighting: false,
      quickSuggestions: false, // pas d'autocomplétion "intelligente" pendant un examen
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      renderLineHighlight: 'line',
      lineNumbersMinChars: 3,
      padding: { top: 10, bottom: 10 },
      accessibilitySupport: 'off',
    })
    editorRef.current = editor

    const host = hostRef.current
    const rememberSelection = () => {
      const sel = editor.getSelection()
      if (sel && !sel.isEmpty()) internalClipboard.set(editor.getModel().getValueInRange(sel))
    }
    host.addEventListener('copy', rememberSelection, true)
    host.addEventListener('cut', rememberSelection, true)

    const sub = editor.onDidChangeModelContent((e) => {
      const inserted = e.changes.reduce((n, c) => n + c.text.length, 0)
      if (!e.isFlush && inserted > 150 && !internalClipboard.recentlyAllowed()) {
        onBigInsertRef.current?.(inserted)
      }
      if (!e.isFlush) {
        const v = editor.getValue()
        emitted.current.add(v)
        if (emitted.current.size > 200) emitted.current.delete(emitted.current.values().next().value)
        onChangeRef.current?.(v)
      }
    })

    return () => {
      sub.dispose()
      host.removeEventListener('copy', rememberSelection, true)
      host.removeEventListener('cut', rememberSelection, true)
      editor.getModel()?.dispose()
      editor.dispose()
    }
    // L'éditeur est créé une seule fois ; la valeur est synchronisée plus bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly])

  // Valeur modifiée de l'extérieur (reprise, changement de question).
  // Une valeur que l'éditeur a lui-même produite peut revenir en retard pendant une frappe rapide :
  // on l'ignore, sinon le texte récent serait écrasé et le curseur sauterait.
  useEffect(() => {
    const ed = editorRef.current
    if (!ed || value === undefined || value === ed.getValue() || emitted.current.has(value)) return
    ed.setValue(value ?? '')
  }, [value])

  return <div ref={hostRef} className="answer-zone code-editor" style={{ height, width: '100%' }} />
}
