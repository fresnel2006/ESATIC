import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Zap, Loader2 } from 'lucide-react'
import { TestResults, FeedbackField, useComments } from '../../components/grading.jsx'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { AnswerView } from '../../components/AnswerView.jsx'
import { DiagramView, isEmptyDiagram } from '../../components/DiagramEditor.jsx'
import Statement from '../../components/Statement.jsx'
import { ErrorBox, Loader, RiskBadge, StatusBadge, ICON } from '../../components/ui.jsx'
import { EVENT_LABELS, QUESTION_TYPES, fmtDateTime, fmtTime, fmtNote } from '../../lib/format.js'

function Corrige({ q }) {
  if (q.type === 'qcm') return <div className="small">Bonne(s) réponse(s) : <strong>{q.data.choices.filter((c) => q.data.correct.includes(c.id)).map((c) => c.text).join(', ')}</strong></div>
  if (q.type === 'ouverte') return <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{q.data.answerModel || <span className="muted">Pas de corrigé saisi.</span>}</div>
  if (q.type === 'code') return (
    <div className="stack-sm small">
      {(q.data.tests || []).length ? q.data.tests.map((t) => <div key={t.id} className="mono">{t.name} : {t.stdin.replace(/\n/g, ' / ')} → {t.expected}</div>) : <span className="muted">Pas d'exemple. Correction à la main.</span>}
    </div>
  )
  if (q.type === 'sql') return <pre className="code-block">{q.data.expectedQuery}</pre>
  if (q.type === 'diagram') return isEmptyDiagram(q.data.answerModelXml) ? <span className="small muted">Pas de corrigé type.</span> : <DiagramView value={q.data.answerModelXml} height={380} />
  if (q.type === 'html') return <div className="small">Grille : {q.data.criteria.map((c) => `${c.label} (${c.points})`).join(', ')}</div>
  return null
}

export default function CorrectionDetail() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [grades, setGrades] = useState({})
  const [override, setOverride] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const comments = useComments()

  const loadCopy = useCallback(() => api.getCopy(attemptId).then((d) => {
    setData(d)
    const g = {}
    for (const q of d.assessment.questions) {
      const an = d.attempt.answers[q.id] || {}
      g[q.id] = { score: an.manualScore ?? an.autoScore ?? '', feedback: an.feedback || '', criteria: an.criteria || {} }
    }
    setGrades(g)
    setOverride(d.attempt.finalOverride ?? '')
  }).catch(setError), [attemptId])

  useEffect(() => { loadCopy() }, [loadCopy])

  // Ctrl+Entrée : enregistrer et passer à la copie suivante
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); document.getElementById('save-next')?.click() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!data || data.attempt.id !== Number(attemptId)) return <Loader />

  const { attempt: t, assessment: a, student, risk, siblings } = data
  const pos = siblings.indexOf(t.id)
  const computed = a.questions.reduce((s, q) => s + (Number(grades[q.id]?.score) || 0), 0)
  const setG = (qid, patch) => setGrades((g) => ({ ...g, [qid]: { ...g[qid], ...patch } }))
  const suspicious = t.events.filter((e) => api.EVENT_WEIGHTS[e.type])

  async function save(next) {
    setBusy(true)
    try {
      await api.gradeCopy(t.id, grades, override)
      toast.success('Correction enregistrée.')
      if (next && pos < siblings.length - 1) navigate(`/enseignant/corrections/${siblings[pos + 1]}`)
      else setData(await api.getCopy(t.id))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }
  const hasAuto = a.questions.some((q) => q.type === 'qcm')

  async function runTests() {
    setTesting(true)
    try {
      const r = await api.autoGradeCopy(t.id)
      await loadCopy()
      toast.success(`QCM corrigés (${r.graded}). Les autres questions se corrigent à la main ; enregistrez la copie ensuite.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="stack">
      <div className="row-wrap">
        <Link to={`/enseignant/corrections?epreuve=${a.id}`} className="row small"><ArrowLeft {...ICON} /> Retour aux copies</Link>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" disabled={pos <= 0} onClick={() => navigate(`/enseignant/corrections/${siblings[pos - 1]}`)}><ChevronLeft size={15} /> Copie précédente</button>
        <span className="small muted">{pos + 1} / {siblings.length}</span>
        <button className="btn btn-ghost btn-sm" disabled={pos >= siblings.length - 1} onClick={() => navigate(`/enseignant/corrections/${siblings[pos + 1]}`)}>Copie suivante <ChevronRight size={15} /></button>
      </div>

      <div className="card"><div className="card-body row-wrap" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: '1.2rem' }}>{student.lastName} {student.firstName}</h1>
          <p className="muted small">{student.matricule} - {a.title} - rendue le {fmtDateTime(t.submittedAt)}</p>
        </div>
        <div className="row-wrap">
          <StatusBadge status={t.status} />
          <span className="small muted">Risque</span> <RiskBadge value={risk} />
          {hasAuto && (
            <button className="btn btn-primary btn-sm" disabled={testing} onClick={runTests} title="Les QCM sont notés automatiquement ; le code, le SQL, les questions ouvertes et les diagrammes se corrigent à la main">
              {testing ? <Loader2 size={14} className="spin" /> : <Zap size={14} />} {testing ? 'Correction...' : 'Corriger les QCM'}
            </button>
          )}
        </div>
      </div></div>

      {suspicious.length > 0 && (
        <div className="card">
          <div className="card-header"><h2>Journal de la copie</h2><span className="small muted">{suspicious.length} événement(s) signalé(s)</span></div>
          <div className="card-body event-list">
            {suspicious.map((e, i) => (
              <div className="event-item" key={i}><time>{fmtTime(e.at)}</time><span>{EVENT_LABELS[e.type] || e.type}{e.detail?.length ? ` (${e.detail.length} caractères)` : ''}</span></div>
            ))}
            <p className="small muted" style={{ marginTop: 8 }}>Ces signalements sont des indices, pas des preuves. La décision vous appartient.</p>
          </div>
        </div>
      )}

      {a.questions.map((q, i) => {
        const an = t.answers[q.id] || {}
        const g = grades[q.id] || {}
        return (
          <div className="q-card" key={q.id}>
            <div className="q-card-head">
              <span className="q-num">Question {i + 1}</span>
              <span className="tag">{QUESTION_TYPES[q.type]}</span>
              <div className="spacer" />
              {an.autoScore !== null && an.autoScore !== undefined && <span className="small muted">Auto : {fmtNote(an.autoScore)}</span>}
              <label className="row small" style={{ gap: 6 }}>
                Note
                <input type="number" min="0" max={q.points} step="0.25" className="input score-input" value={g.score} onChange={(e) => setG(q.id, { score: e.target.value })} aria-label={`Note question ${i + 1}`} />
                / {q.points}
              </label>
            </div>
            <div className="q-card-body">
              <Statement text={q.statement} />
              <div className="grading">
                <div className="stack-sm">
                  <span className="label">Copie de l'étudiant</span>
                  <AnswerView question={q} value={an.value} showCorrect />
                  <TestResults results={an.testResults} />
                </div>
                <div className="stack-sm">
                  <span className="label">Corrigé</span>
                  <Corrige q={q} />
                  {q.type === 'html' && (
                    <div className="stack-sm">
                      {q.data.criteria.map((c) => (
                        <label key={c.id} className="row small" style={{ justifyContent: 'space-between' }}>
                          {c.label}
                          <span className="row" style={{ gap: 6 }}>
                            <input type="number" min="0" max={c.points} step="0.5" className="input score-input" value={g.criteria?.[c.id] ?? ''} onChange={(e) => {
                              const criteria = { ...(g.criteria || {}), [c.id]: e.target.value }
                              setG(q.id, { criteria, score: Object.values(criteria).reduce((s, v) => s + (Number(v) || 0), 0) })
                            }} /> / {c.points}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="field">
                    <label>Commentaire pour l'étudiant</label>
                    <FeedbackField comments={comments} value={g.feedback} onChange={(text) => setG(q.id, { feedback: text })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="card"><div className="card-body row-wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row-wrap">
          <span>Total calculé : <strong>{fmtNote(Math.round(computed * 100) / 100)} / {t.maxScore}</strong></span>
          <label className="row small" style={{ gap: 6 }}>
            Note finale décidée
            <input type="number" min="0" max={t.maxScore} step="0.25" className="input score-input" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="auto" />
          </label>
        </div>
        <div className="row-wrap">
          <button className="btn btn-secondary" disabled={busy} onClick={() => save(false)}><Save {...ICON} /> Enregistrer</button>
          <button id="save-next" className="btn btn-primary" disabled={busy || pos >= siblings.length - 1} onClick={() => save(true)} title="Raccourci : Ctrl + Entrée">Enregistrer et suivante <span className="kbd-hint">Ctrl+Entrée</span></button>
        </div>
      </div></div>
    </div>
  )
}
