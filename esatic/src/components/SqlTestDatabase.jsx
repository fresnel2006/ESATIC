import { useRef, useState } from 'react'
import { Database, FileUp, CheckCircle2, Loader2 } from 'lucide-react'
import { sqlDatabaseTool } from '../lib/browserRunner.js'
import { SQL_LIMITS, sqlSizeKb } from '../lib/format.js'
import { ICON, Notice } from './ui.jsx'

// Base de test d'une question SQL : schéma (CREATE) et données (INSERT), saisis à la main ou importés
// depuis un fichier .sql (export MySQL / phpMyAdmin compris) ou une base SQLite (.db, .sqlite).
// La base reste enregistrée en texte SQL dans l'épreuve : l'étudiant et la correction n'y voient aucune différence.
// Limites (SQL_LIMITS) : lignes et taille, pour que le sujet reste léger sur tous les postes.

const MAX_FILE = 2 * 1024 * 1024 // fichier choisi (avant conversion)

const plural = (n, word) => `${n.toLocaleString('fr-FR')} ${word}${n > 1 ? 's' : ''}`
const fmtKb = (kb) => (kb < 10 ? kb.toFixed(1).replace('.', ',') : String(Math.round(kb)))

export default function SqlTestDatabase({ schema, seed, onChange }) {
  const input = useRef(null)
  const [state, setState] = useState(null) // { busy } | { ok, tables, totalRows, source } | { error }
  const kb = sqlSizeKb(schema, seed)
  const tooBig = kb > SQL_LIMITS.maxKb

  function report(r, source) {
    if (r.stderr || !r.tables) {
      setState({ error: r.stderr || 'Base illisible.' })
      return false
    }
    const size = sqlSizeKb(r.schema, r.seed)
    if (size > SQL_LIMITS.maxKb) {
      setState({ error: `Base trop volumineuse : ${fmtKb(size)} Ko une fois convertie, maximum ${SQL_LIMITS.maxKb} Ko. Gardez seulement les lignes utiles à l'exercice.` })
      return false
    }
    setState({ ok: true, tables: r.tables, totalRows: r.totalRows, source })
    return true
  }

  async function onFile(file) {
    if (!file) return
    if (file.size > MAX_FILE) {
      setState({ error: `Fichier trop gros (${Math.round(file.size / 1024)} Ko). Une base de test de quelques Ko suffit pour un exercice.` })
      return
    }
    setState({ busy: true })
    const isSqlite = /\.(db|sqlite3?|db3)$/i.test(file.name)
    const r = isSqlite
      ? await sqlDatabaseTool({ importDb: true, dbBytes: await file.arrayBuffer(), maxRows: SQL_LIMITS.maxRows })
      : await sqlDatabaseTool({ importDb: true, sqlText: await file.text(), convertMysql: true, maxRows: SQL_LIMITS.maxRows })
    if (report(r, file.name)) onChange(r.schema, r.seed)
  }

  async function verify() {
    setState({ busy: true })
    report(await sqlDatabaseTool({ inspect: true, schema, seed, maxRows: SQL_LIMITS.maxRows }), null)
  }

  return (
    <div className="span-2 stack-sm sql-db">
      <div className="row-wrap">
        <span className="label" style={{ marginRight: 'auto' }}><Database size={15} strokeWidth={1.7} /> Base de test</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={state?.busy}>
          <FileUp {...ICON} /> Importer une base (.sql, .db)
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={verify} disabled={state?.busy || !(schema || '').trim()}>
          <CheckCircle2 {...ICON} /> Vérifier la base
        </button>
        <input ref={input} type="file" accept=".sql,.txt,.db,.sqlite,.sqlite3,.db3" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = '' }} />
      </div>
      <span className="hint">
        Un export SQL (phpMyAdmin, MySQL Workbench, DB Browser...) ou une base SQLite. Les instructions propres à MySQL sont adaptées automatiquement.
        {' '}Maximum {plural(SQL_LIMITS.maxRows, 'ligne')} et {SQL_LIMITS.maxKb} Ko par question, pour que le sujet reste léger sur tous les postes.
      </span>

      {state?.busy && <div className="small muted row"><Loader2 size={14} className="spin" /> Lecture de la base...</div>}
      {state?.error && <Notice kind="danger">{state.error}</Notice>}
      {state?.ok && (
        <Notice kind="success">
          {state.source ? <>Base « {state.source} » importée : </> : <>Base valide : </>}
          {plural(state.tables.length, 'table')}, {plural(state.totalRows ?? 0, 'ligne')}
          {' - '}
          {state.tables.map((t) => `${t.name} (${plural(t.rows, 'ligne')})`).join(', ')}
        </Notice>
      )}

      <div className="form-grid cols-2">
        <div className="field">
          <label>Schéma (CREATE TABLE...)</label>
          <textarea className="textarea mono" value={schema} onChange={(e) => { setState(null); onChange(e.target.value, seed) }} />
          <span className="hint">Montré à l'étudiant.</span>
        </div>
        <div className="field">
          <label>Données (INSERT...)</label>
          <textarea className="textarea mono" value={seed} onChange={(e) => { setState(null); onChange(schema, e.target.value) }} />
          <span className={`hint ${tooBig ? 'error-text' : ''}`}>Taille : {fmtKb(kb)} Ko sur {SQL_LIMITS.maxKb} Ko{tooBig ? ' : trop volumineux, l\'épreuve ne pourra pas être enregistrée' : ''}</span>
        </div>
      </div>
    </div>
  )
}
