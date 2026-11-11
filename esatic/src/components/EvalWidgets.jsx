// Évaluation des enseignants : saisie en étoiles, barres de moyenne, fiche de résultats d'un enseignant
import { useState } from 'react'
import { Star, MessageSquareQuote, Lock } from 'lucide-react'

export const RATING_LABELS = ['', 'Très insuffisant', 'Insuffisant', 'Moyen', 'Bien', 'Très bien']

// Note de 1 à 5 en étoiles (clavier : flèches gauche / droite)
export function StarRating({ value = 0, onChange, label }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="star-rating" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sur 5 : ${RATING_LABELS[n]}`}
          className={`star ${n <= shown ? 'on' : ''}`}
          onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)) }
          }}
        >
          <Star size={24} strokeWidth={1.6} />
        </button>
      ))}
      <span className="star-label">{shown ? RATING_LABELS[shown] : 'Choisissez une note'}</span>
    </div>
  )
}

// Couleur d'une moyenne sur 5
export const tone = (v) => (v === null || v === undefined ? 'none' : v >= 4 ? 'good' : v >= 3 ? 'mid' : 'low')
export const fmt5 = (v) => (v === null || v === undefined ? '-' : v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

export function ScoreBar({ label, value }) {
  return (
    <div className="score-bar">
      <span className="score-bar-label">{label}</span>
      <span className="score-bar-track"><span className={`score-bar-fill ${tone(value)}`} style={{ width: `${value ? (value / 5) * 100 : 0}%` }} /></span>
      <strong className="score-bar-value">{fmt5(value)}</strong>
    </div>
  )
}

// Moyenne générale en grand (sur 5), avec étoiles
export function ScoreBadge({ value, size = 'md' }) {
  return (
    <span className={`score-badge ${tone(value)} ${size}`}>
      <Star size={size === 'lg' ? 18 : 14} strokeWidth={0} fill="currentColor" />
      {fmt5(value)}<small>/5</small>
    </span>
  )
}

export const EVAL_TYPE_LABELS = { partie: 'Titre de partie', note: 'Note (1 à 5 étoiles)', qcm: 'QCM (un choix)', texte: 'Question ouverte' }

// Répartition des réponses à un QCM (pourcentages)
export function QcmResult({ item }) {
  const total = item.total || 0
  return (
    <div className="eval-qcm-result">
      <span className="eval-q-label">{item.label}</span>
      {item.options.map((o) => {
        const pct = total ? Math.round((o.count / total) * 100) : 0
        return (
          <div className="score-bar" key={o.label}>
            <span className="score-bar-label">{o.label}</span>
            <span className="score-bar-track"><span className="score-bar-fill qcm" style={{ width: `${pct}%` }} /></span>
            <strong className="score-bar-value">{pct} %</strong>
          </div>
        )
      })}
      <span className="hint">{total} réponse{total > 1 ? 's' : ''}</span>
    </div>
  )
}

// Résultats question par question, partie par partie : notes, QCM, réponses ouvertes
export function EvalItemsView({ items }) {
  return (
    <div className="stack">
      {items.map((q) => {
        if (q.type === 'partie') return <h3 key={q.key} className="eval-part-title">{q.label}</h3>
        if (q.type === 'note') return <ScoreBar key={q.key} label={q.label} value={q.average} />
        if (q.type === 'qcm') return <QcmResult key={q.key} item={q} />
        return (
          <div key={q.key} className="stack-sm">
            <span className="eval-q-label">{q.label} <span className="small muted">({q.answers.length} réponse{q.answers.length > 1 ? 's' : ''})</span></span>
            {q.answers.length
              ? <div className="eval-comments">{q.answers.map((a, i) => <blockquote key={i} className="eval-comment"><MessageSquareQuote size={15} />{a}</blockquote>)}</div>
              : <span className="small muted">Aucune réponse écrite.</span>}
          </div>
        )
      })}
    </div>
  )
}

// Résultats d'un enseignant pour une matière : chaque partie et question, puis les commentaires
export function EvalResultCard({ row, minResponses }) {
  return (
    <div className="card eval-card">
      <div className="card-body stack">
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong className="eval-card-title">{row.teacher}</strong>
            <div className="small muted">{row.matiere}{row.classes.length ? ` · ${row.classes.join(', ')}` : ''}</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="small muted">{row.responses} réponse{row.responses > 1 ? 's' : ''}</span>
            {row.visible && <ScoreBadge value={row.overall} />}
          </div>
        </div>
        {!row.visible ? (
          <div className="eval-hidden"><Lock size={15} /> Moins de {minResponses} réponses : les résultats restent masqués pour garantir l'anonymat des étudiants.</div>
        ) : (
          <>
            <EvalItemsView items={row.items || row.criteria} />
            {row.comments.length > 0 && (
              <div className="stack-sm">
                <span className="label">Commentaires libres ({row.comments.length})</span>
                <div className="eval-comments">
                  {row.comments.map((c, i) => <blockquote key={i} className="eval-comment"><MessageSquareQuote size={15} />{c}</blockquote>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
