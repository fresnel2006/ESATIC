// Éléments communs aux écrans de correction
import { useEffect, useState } from 'react'
import { Plus, X, Check, EyeOff } from 'lucide-react'
import * as api from '../api/index.js'
import { fmtNote } from '../lib/format.js'

// Résultat des tests automatiques d'une réponse (code ou SQL)
export function TestResults({ results }) {
  if (!results) return null
  if (!results.length) return <div className="small muted">Aucun test exécuté (réponse vide).</div>
  const pts = results.filter((r) => r.passed).reduce((s, r) => s + r.points, 0)
  const total = results.reduce((s, r) => s + r.points, 0)
  return (
    <div className="test-results">
      <div className="test-results-head">
        <strong>Tests automatiques</strong>
        <span>{results.filter((r) => r.passed).length}/{results.length} réussi(s) - {fmtNote(pts)} / {fmtNote(total)} pts</span>
      </div>
      {results.map((r, i) => (
        <div key={i} className={`test-result ${r.passed ? 'ok' : 'ko'}`}>
          {r.passed ? <Check size={14} /> : <X size={14} />}
          <span className="grow">{r.name}{r.hidden && <span className="muted small"> <EyeOff size={12} /> caché</span>}</span>
          <span className="small">{r.passed ? `${fmtNote(r.points)} pt${r.points > 1 ? 's' : ''}` : r.timeout ? 'temps dépassé' : r.stderr ? r.stderr.slice(0, 60) : `obtenu : ${(r.stdout || '').trim().slice(0, 40) || '(rien)'}`}</span>
        </div>
      ))}
    </div>
  )
}

// Commentaires types : un clic pour insérer, « + » pour enregistrer le commentaire en cours
export function useComments() {
  const [list, setList] = useState([])
  const reload = () => api.listComments().then(setList)
  useEffect(() => { reload() }, [])
  return { list, reload }
}

// Champ de commentaire : les commentaires types n'apparaissent que pendant la saisie (champ actif)
export function FeedbackField({ comments, value, onChange, minHeight = 70, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="stack-sm" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}>
      <textarea className="textarea" style={{ minHeight }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {focused ? <CommentChips comments={comments} value={value} onInsert={onChange} /> : <span className="hint">Cliquez dans le champ pour voir vos commentaires types.</span>}
    </div>
  )
}

export function CommentChips({ comments, value, onInsert }) {
  return (
    // onMouseDown : garde le champ actif pendant le clic sur un commentaire
    <div className="comment-chips" onMouseDown={(e) => e.preventDefault()}>
      {comments.list.map((c) => (
        <span key={c.id} className="comment-chip">
          <button type="button" onClick={() => onInsert(value ? `${value.trim()} ${c.text}` : c.text)} title="Insérer ce commentaire">{c.text}</button>
          {!c.suggested && (
            <button type="button" className="chip-x" aria-label="Retirer ce commentaire type" onClick={async () => { await api.deleteComment(c.id); comments.reload() }}><X size={11} /></button>
          )}
        </span>
      ))}
      {value?.trim() && !comments.list.some((c) => c.text === value.trim()) && (
        <button type="button" className="comment-chip save" onClick={async () => { await api.saveComment(value); comments.reload() }}>
          <Plus size={12} /> Enregistrer comme commentaire type
        </button>
      )}
    </div>
  )
}
