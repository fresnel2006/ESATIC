// Affichage en lecture seule d'une réponse d'étudiant (résultats, correction)
import { Check, X } from 'lucide-react'
import { LANGUAGES } from '../lib/format.js'
import { WebEditor, webValue } from './WebPlayground.jsx'

export function AnswerView({ question: q, value, showCorrect = false }) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return <div className="muted small">Pas de réponse.</div>
  }
  if (q.type === 'qcm') {
    const correct = q.data.correct || []
    return (
      <div className="stack-sm">
        {q.data.choices.map((c) => {
          const chosen = value.includes(c.id)
          const good = correct.includes(c.id)
          return (
            <div key={c.id} className={`choice ${chosen ? 'selected' : ''}`} style={{ cursor: 'default' }}>
              <input type={q.data.multiple ? 'checkbox' : 'radio'} checked={chosen} readOnly tabIndex={-1} />
              <span style={{ flex: 1 }}>{c.text}</span>
              {showCorrect && good && <span className="badge badge-success badge-plain"><Check size={13} /> Bonne réponse</span>}
              {showCorrect && chosen && !good && <span className="badge badge-danger badge-plain"><X size={13} /> Incorrect</span>}
            </div>
          )
        })}
      </div>
    )
  }
  if (q.type === 'ouverte') return <div className="card"><div className="card-body" style={{ whiteSpace: 'pre-wrap' }}>{value}</div></div>
  if (q.type === 'code' || q.type === 'sql') {
    return (
      <div className="stack-sm">
        {q.type === 'code' && <span className="small muted">Langage : {LANGUAGES[q.data.language]}</span>}
        <pre className="code-block">{value}</pre>
      </div>
    )
  }
  if (q.type === 'html') {
    // Code de l'étudiant à gauche, rendu en direct à droite (le correcteur peut cliquer dans la page)
    return <WebEditor value={webValue(value)} readOnly height={400} />
  }
  return null
}
