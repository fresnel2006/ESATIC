// Correction par question : la même question dans toutes les copies, à la suite.
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { AnswerView } from '../../components/AnswerView.jsx'
import { DiagramView, isEmptyDiagram } from '../../components/DiagramEditor.jsx'
import Statement from '../../components/Statement.jsx'
import { TestResults, FeedbackField, useComments } from '../../components/grading.jsx'
import { Empty, ErrorBox, Loader, Notice, StatusBadge, ICON } from '../../components/ui.jsx'
import { QUESTION_TYPES, fmtNote } from '../../lib/format.js'

function Corrige({ q }) {
  if (q.type === 'qcm') return <span>{q.data.choices.filter((c) => q.data.correct.includes(c.id)).map((c) => c.text).join(', ')}</span>
  if (q.type === 'ouverte') return <span style={{ whiteSpace: 'pre-wrap' }}>{q.data.answerModel || 'Pas de corrigé saisi.'}</span>
  if (q.type === 'sql') return <pre className="code-block">{q.data.expectedQuery}</pre>
  if (q.type === 'code') return <span>{(q.data.tests || []).map((t) => `${t.stdin.replace(/\n/g, ' / ')} → ${t.expected}`).join(' ; ') || 'Correction à la main'}</span>
  if (q.type === 'diagram') return isEmptyDiagram(q.data.answerModelXml) ? <span className="small muted">Pas de corrigé type.</span> : <DiagramView value={q.data.answerModelXml} height={380} />
  if (q.type === 'html') return <span>{q.data.criteria.map((c) => `${c.label} (${c.points})`).join(', ')}</span>
  return null
}

export default function CorrectionByQuestion() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const comments = useComments()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [grades, setGrades] = useState({})
  const [busy, setBusy] = useState(false)
  const qid = params.get('question')

  useEffect(() => {
    api.copiesForQuestion(id, qid).then((d) => {
      setData(d)
      setGrades(Object.fromEntries(d.copies.map((c) => [c.attemptId, { score: c.manualScore ?? c.autoScore ?? '', feedback: c.feedback, criteria: c.criteria }])))
    }).catch(setError)
  }, [id, qid])

  if (error) return <ErrorBox error={error} />
  if (!data) return <Loader variant="detail" />
  const { assessment: a, question: q, copies } = data
  const idx = a.questions.findIndex((x) => x.id === q.id)
  const goto = (i) => setParams({ question: a.questions[i].id })
  const setG = (attemptId, patch) => setGrades((g) => ({ ...g, [attemptId]: { ...g[attemptId], ...patch } }))
  const filled = copies.filter((c) => grades[c.attemptId]?.score !== '' && grades[c.attemptId]?.score !== null).length

  async function saveAll(next) {
    setBusy(true)
    try {
      const r = await api.gradeQuestion(a.id, q.id, grades)
      toast.success(`Question ${idx + 1} enregistrée pour ${copies.length} copie(s)${r.completed ? ` - ${r.completed} copie(s) désormais complète(s)` : ''}.`)
      if (next && idx < a.questions.length - 1) goto(idx + 1)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="row-wrap">
        <Link to={`/enseignant/corrections?epreuve=${a.id}`} className="row small"><ArrowLeft {...ICON} /> Retour aux copies</Link>
        <div className="spacer" />
        <span className="small muted">{a.title}</span>
      </div>

      <div className="q-switch" role="tablist" aria-label="Questions">
        {a.questions.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={x.id === q.id} className={`q-dot ${x.id === q.id ? 'current' : ''}`} onClick={() => goto(i)} title={QUESTION_TYPES[x.type]}>
            Q{i + 1}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="row"><h2>Question {idx + 1}</h2><span className="tag">{QUESTION_TYPES[q.type]}</span></div>
          <span className="small muted">{q.points} pts - {filled}/{copies.length} notée(s)</span>
        </div>
        <div className="card-body stack-sm">
          <Statement text={q.statement} />
          <div className="small"><span className="label">Corrigé : </span><Corrige q={q} /></div>
          {['code', 'sql', 'qcm'].includes(q.type) && <Notice>Question corrigeable automatiquement : lancez « Corriger automatiquement » depuis la liste des copies, puis ajustez ici si besoin.</Notice>}
        </div>
      </div>

      {copies.length === 0 ? <div className="card"><Empty title="Aucune copie rendue" /></div> : copies.map((c) => {
        const g = grades[c.attemptId] || {}
        return (
          <div className="q-card" key={c.attemptId}>
            <div className="q-card-head">
              <strong>{c.student}</strong>
              <span className="muted small">{c.matricule}</span>
              <StatusBadge status={c.status} />
              <div className="spacer" />
              {c.autoScore !== null && <span className="small muted">Auto : {fmtNote(c.autoScore)}</span>}
              <label className="row small" style={{ gap: 6 }}>
                Note
                <input type="number" min="0" max={q.points} step="0.25" className="input score-input" value={g.score} onChange={(e) => setG(c.attemptId, { score: e.target.value })} aria-label={`Note de ${c.student}`} />
                / {q.points}
              </label>
              {[0, q.points / 2, q.points].map((v) => (
                <button key={v} className="btn btn-ghost btn-sm" onClick={() => setG(c.attemptId, { score: v })} title={`Mettre ${fmtNote(v)}`}>{fmtNote(v)}</button>
              ))}
            </div>
            <div className="q-card-body">
              <div className="grading">
                <div className="stack-sm">
                  <AnswerView question={q} value={c.value} showCorrect />
                  <TestResults results={c.testResults} />
                </div>
                <div className="stack-sm">
                  {q.type === 'html' && q.data.criteria.map((cr) => (
                    <label key={cr.id} className="row small" style={{ justifyContent: 'space-between' }}>
                      {cr.label}
                      <span className="row" style={{ gap: 6 }}>
                        <input type="number" min="0" max={cr.points} step="0.5" className="input score-input" value={g.criteria?.[cr.id] ?? ''} onChange={(e) => {
                          const criteria = { ...(g.criteria || {}), [cr.id]: e.target.value }
                          setG(c.attemptId, { criteria, score: Object.values(criteria).reduce((s, v) => s + (Number(v) || 0), 0) })
                        }} /> / {cr.points}
                      </span>
                    </label>
                  ))}
                  <FeedbackField comments={comments} minHeight={64} placeholder="Commentaire pour l'étudiant" value={g.feedback} onChange={(text) => setG(c.attemptId, { feedback: text })} />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="card grading-bar"><div className="card-body row-wrap" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" disabled={idx === 0} onClick={() => goto(idx - 1)}><ChevronLeft size={16} /> Question précédente</button>
        <div className="row-wrap">
          <button className="btn btn-secondary" disabled={busy} onClick={() => saveAll(false)}><Save {...ICON} /> Enregistrer</button>
          <button className="btn btn-primary" disabled={busy || idx >= a.questions.length - 1} onClick={() => saveAll(true)}>Enregistrer et question suivante <ChevronRight size={16} /></button>
        </div>
      </div></div>
    </div>
  )
}
