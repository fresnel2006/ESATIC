import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileCode2, RotateCw, Maximize2, X, Trash2, Globe } from 'lucide-react'
import CodeEditor from './CodeEditor.jsx'

// Questions web : index.html, style.css et script.js, avec un aperçu en direct à côté du code.
// L'aperçu tourne dans une iframe isolée (allow-scripts sans allow-same-origin) : le code de l'étudiant
// n'a accès ni à la page de l'examen, ni à la session, ni à Internet (règle CSP).

export const WEB_FILES = [
  { key: 'html', file: 'index.html', lang: 'html', label: 'HTML' },
  { key: 'css', file: 'style.css', lang: 'css', label: 'CSS' },
  { key: 'js', file: 'script.js', lang: 'javascript', label: 'JS' },
]

// Valeur d'une réponse web (les anciennes réponses n'avaient que html et css)
export function webValue(value, data = {}) {
  const v = value && typeof value === 'object' ? value : {}
  return {
    html: v.html ?? data.starterHtml ?? '',
    css: v.css ?? data.starterCss ?? '',
    js: v.js ?? data.starterJs ?? '',
  }
}

const CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:"

// Relais vers la console de la page : console.log, erreurs, alert. Les liens et formulaires restent dans l'aperçu.
const BRIDGE = `(function(){
var CH = '__CH__', OFFSET = __OFFSET__;
function fmt(v){ if (typeof v === 'string') return v; if (v instanceof Error) return v.name + ': ' + v.message;
  try { var s = JSON.stringify(v); return s === undefined ? String(v) : s } catch (e) { return String(v) } }
function send(level, args){ try { parent.postMessage({ esaticPreview: CH, level: level, text: Array.prototype.map.call(args, fmt).join(' ') }, '*') } catch (e) {} }
['log','info','warn','error','debug'].forEach(function(l){ var o = console[l]; console[l] = function(){ send(l === 'debug' ? 'log' : l, arguments); if (o) o.apply(console, arguments) } });
window.alert = function(m){ send('info', ['alert : ' + fmt(m === undefined ? '' : m)]) };
window.confirm = function(m){ send('info', ['confirm : ' + fmt(m) + ' (réponse simulée : OK)']); return true };
window.prompt = function(m){ send('info', ['prompt : ' + fmt(m) + ' (pas de saisie dans l\\'aperçu)']); return null };
window.addEventListener('error', function(e){ var l = e.lineno ? e.lineno - OFFSET : 0;
  send('error', [(e.message || 'Erreur') + (l > 0 ? ' (script.js, ligne ' + l + ')' : '')]) });
window.addEventListener('unhandledrejection', function(e){ send('error', ['Promesse rejetée : ' + fmt(e.reason && e.reason.message || e.reason)]) });
document.addEventListener('click', function(e){ var a = e.target.closest && e.target.closest('a[href]');
  if (a && a.getAttribute('href').charAt(0) !== '#') { e.preventDefault(); send('info', ['Lien vers « ' + a.getAttribute('href') + ' » : la navigation est désactivée dans l\\'aperçu.']) } });
window.addEventListener('submit', function(e){ if (!e.defaultPrevented) { e.preventDefault(); send('info', ['Formulaire envoyé (l\\'envoi réel est désactivé dans l\\'aperçu).']) } });
})();`

export function webDoc({ html = '', css = '', js = '' }, channel = 'x') {
  // Si l'étudiant écrit une page complète, on garde son <body> ; sinon tout son HTML va dans le body
  const body = /<body[\s>]/i.test(html) ? html.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') : html.replace(/<!doctype[^>]*>/i, '')
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script')
  const head = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><script>${BRIDGE}</script><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body>\n${body}\n<script>\n`
  const offset = head.split('\n').length - 1
  return head.replace('__OFFSET__', String(offset)).replace('__CH__', channel) + `${safe(js)}\n</script></body></html>`
}

let channelSeq = 0

// Aperçu façon navigateur, avec sa console
export function WebPreview({ value, auto = true, height = 420, title = 'Aperçu' }) {
  const [channel] = useState(() => `p${++channelSeq}-${Math.random().toString(36).slice(2, 8)}`)
  const [shown, setShown] = useState(value)
  const [runId, setRunId] = useState(0)
  const [logs, setLogs] = useState([])
  const [big, setBig] = useState(false)
  const frames = useRef({})
  const consoleRef = useRef(null)

  // La console suit les derniers messages
  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  const bigOpen = useRef(false)
  useEffect(() => { bigOpen.current = big }, [big])

  // Mise à jour automatique un court instant après la dernière frappe.
  // Comparée sur le contenu : un simple rafraîchissement de la page ne recharge pas l'aperçu.
  const content = JSON.stringify([value.html, value.css, value.js])
  const shownContent = JSON.stringify([shown.html, shown.css, shown.js])
  useEffect(() => {
    if (!auto || content === shownContent) return
    const id = setTimeout(() => { setShown(value); setLogs([]) }, 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, shownContent, auto])

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.esaticPreview !== channel) return
      // Une seule source à la fois : l'aperçu agrandi quand il est ouvert, sinon le petit
      const from = bigOpen.current ? frames.current.big : frames.current.small
      if (!from || from.contentWindow !== e.source) return
      setLogs((l) => [...l.slice(-199), { level: e.data.level, text: String(e.data.text).slice(0, 2000) }])
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [channel])

  const doc = useMemo(() => webDoc(shown, channel), [shown, channel])
  const refresh = () => { setShown(value); setLogs([]); setRunId((n) => n + 1) }
  const errors = logs.filter((l) => l.level === 'error').length

  const frame = (h, key) => (
    <iframe
      key={`${key}-${runId}`}
      ref={(el) => { frames.current[key] = el }}
      className="web-frame"
      style={{ height: h }}
      title={title}
      sandbox="allow-scripts allow-forms"
      srcDoc={doc}
    />
  )

  const bar = (onBig) => (
    <div className="web-bar">
      <span className="web-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="web-url"><Globe size={13} strokeWidth={1.6} /> apercu/index.html</span>
      <button type="button" className="web-btn" onClick={refresh} title="Actualiser l'aperçu"><RotateCw size={14} strokeWidth={1.7} /> Actualiser</button>
      {onBig}
    </div>
  )

  return (
    <div className="web-preview">
      {bar(<button type="button" className="web-btn" onClick={() => { setLogs([]); setBig(true) }} title="Agrandir l'aperçu"><Maximize2 size={14} strokeWidth={1.7} /></button>)}
      {frame(height, 'small')}
      <div className="web-console">
        <div className="web-console-head">
          <span>Console</span>
          {errors > 0 && <span className="web-err-count">{errors} erreur{errors > 1 ? 's' : ''}</span>}
          <span className="spacer" />
          <button type="button" className="web-btn" onClick={() => setLogs([])} disabled={!logs.length}><Trash2 size={13} strokeWidth={1.7} /> Effacer</button>
        </div>
        <div className="web-console-body" ref={consoleRef} role="log" aria-live="polite">
          {logs.length === 0 && <div className="t-dim">Les messages de console.log() et les erreurs du script s'affichent ici.</div>}
          {logs.map((l, i) => <div key={i} className={`web-log ${l.level}`}>{l.text}</div>)}
        </div>
      </div>
      {big && createPortal(
        <div className="web-big" role="dialog" aria-label="Aperçu agrandi" onKeyDown={(e) => e.key === 'Escape' && setBig(false)}>
          <div className="web-big-box">
            {bar(<button type="button" className="web-btn" onClick={() => setBig(false)} autoFocus><X size={14} strokeWidth={1.7} /> Fermer</button>)}
            {frame('calc(100vh - 110px)', 'big')}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// Éditeur en deux parties : fichiers à gauche, rendu à droite
export function WebEditor({ value, onChange, onBigInsert, readOnly = false, height = 460 }) {
  const [tab, setTab] = useState('html')
  return (
    <div className="web-wrap">
    <div className="web-split">
      <div className="web-code">
        <div className="web-tabs" role="tablist" aria-label="Fichiers">
          {WEB_FILES.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={tab === f.key} className={`web-tab ${tab === f.key ? 'active' : ''}`} onClick={() => setTab(f.key)}>
              <FileCode2 size={14} strokeWidth={1.6} /> {f.file}
            </button>
          ))}
        </div>
        {/* Les trois éditeurs restent ouverts pour garder l'historique d'annulation de chaque fichier */}
        {WEB_FILES.map((f) => (
          <div key={f.key} style={{ display: tab === f.key ? 'block' : 'none' }}>
            <CodeEditor value={value[f.key]} language={f.lang} readOnly={readOnly} onChange={(v) => onChange?.({ ...value, [f.key]: v })} onBigInsert={onBigInsert} height={height + 80} />
          </div>
        ))}
      </div>
      <WebPreview value={value} height={height - 60} />
    </div>
    </div>
  )
}
