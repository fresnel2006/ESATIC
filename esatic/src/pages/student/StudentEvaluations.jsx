// Étudiant : évaluer les enseignants de sa classe (campagne ouverte par la direction pédagogique). Réponses anonymes.
import { useState } from 'react'
import { ClipboardCheck, CheckCircle2, ShieldCheck, Send, Loader2, Lock } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Avatar, Empty, ErrorBox, Loader, Modal, Notice, useAsync, ICON } from '../../components/ui.jsx'
import { StarRating } from '../../components/EvalWidgets.jsx'
import { fmtDateTime } from '../../lib/format.js'

function EvalForm({ campaign, target, criteria, onClose, onDone }) {
  const toast = useToast()
  const [scores, setScores] = useState({})
  const [answers, setAnswers] = useState({})
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const missing = criteria.filter((q) => (q.type === 'note' && !scores[q.key]) || (q.type === 'qcm' && answers[q.key] === undefined))
  const numbers = Object.fromEntries(criteria.filter((q) => q.type !== 'partie').map((q, i) => [q.key, i + 1]))

  async function send() {
    setError('')
    if (missing.length) { setError(`Répondez à toutes les questions notées et aux QCM (il en manque ${missing.length}). Les questions ouvertes sont facultatives.`); return }
    setBusy(true)
    try {
      await api.submitEvaluation(campaign.id, target.teacherId, target.matiereId, scores, comment, answers)
      toast.success(`Merci ! Votre évaluation de ${target.teacher} est enregistrée.`)
      onDone()
      onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal wide title={`Évaluer ${target.teacher}`} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? <Loader2 {...ICON} className="spin" /> : <Send {...ICON} />} Envoyer mon évaluation</button>
    </>}>
      <div className="stack">
        <div className="eval-target">
          <Avatar name={target.teacher} size={44} />
          <div><strong>{target.teacher}</strong><div className="small muted">{target.matiere}</div></div>
        </div>
        <div className="eval-criteria">
          {criteria.map((q) => {
            if (q.type === 'partie') return <h3 key={q.key} className="eval-part-title">{q.label}</h3>
            const head = <span className="eval-criterion-label"><span className="eval-num">{numbers[q.key]}</span>{q.label}</span>
            if (q.type === 'qcm') return (
              <div className="eval-criterion column" key={q.key}>
                {head}
                <div className="eval-choices" role="radiogroup" aria-label={q.label}>
                  {q.options.map((o, i) => (
                    <button key={o} type="button" role="radio" aria-checked={answers[q.key] === i}
                      className={`eval-choice ${answers[q.key] === i ? 'on' : ''}`}
                      onClick={() => setAnswers((a) => ({ ...a, [q.key]: i }))}>{o}</button>
                  ))}
                </div>
              </div>
            )
            if (q.type === 'texte') return (
              <div className="eval-criterion column" key={q.key}>
                {head}
                <textarea className="textarea" rows={3} maxLength={1000} aria-label={q.label} placeholder="Votre réponse (facultatif)"
                  value={answers[q.key] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
              </div>
            )
            return (
              <div className="eval-criterion" key={q.key}>
                {head}
                <StarRating label={q.label} value={scores[q.key] || 0} onChange={(n) => setScores((s) => ({ ...s, [q.key]: n }))} />
              </div>
            )
          })}
        </div>
        <div className="field">
          <label htmlFor="eval-comment">Commentaire (facultatif)</label>
          <textarea id="eval-comment" className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Points forts, suggestions pour améliorer le cours... Restez courtois : ce commentaire sera lu par l'enseignant." />
          <span className="hint">{comment.length} / 1000 caractères</span>
        </div>
        <div className="eval-anon"><ShieldCheck size={16} /> Évaluation anonyme : votre nom n'est jamais enregistré avec vos réponses. Ni l'enseignant ni la direction pédagogique ne peuvent savoir qui a voté ; ils ne voient que des moyennes et des commentaires, à partir de 3 réponses. Une seule évaluation par enseignant et par matière, non modifiable.</div>
        {error && <Notice kind="danger">{error}</Notice>}
      </div>
    </Modal>
  )
}

export default function StudentEvaluations() {
  const { data, loading, error, reload } = useAsync(() => api.studentEvaluations(), [])
  const [target, setTarget] = useState(null)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Évaluation des enseignants</h1>
          <p className="muted">Donnez votre avis sur les enseignants qui vous ont encadrés : il est anonyme et aide à améliorer les cours.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="cards" /> : !data.campaigns.length ? (
        <div className="card"><Empty icon={Lock} title="L'évaluation n'est pas encore ouverte">La direction pédagogique vous préviendra par une notification à l'ouverture de la prochaine évaluation.</Empty></div>
      ) : data.campaigns.map((c) => {
        const done = c.teachers.filter((t) => t.done).length
        return (
          <div className="stack-sm" key={c.id}>
            <div className="card eval-campaign-head">
              <div className="card-body row" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong className="eval-card-title">{c.title}</strong>
                  <div className="small muted">{c.periode ? `${c.periode} · ` : ''}Ouverte jusqu'au {fmtDateTime(c.endAt)}</div>
                </div>
                <div className="eval-progress">
                  <span className="small"><b>{done}</b> / {c.teachers.length} enseignant{c.teachers.length > 1 ? 's' : ''} évalué{done > 1 ? 's' : ''}</span>
                  <span className="exec-progress"><span style={{ width: `${c.teachers.length ? (done / c.teachers.length) * 100 : 0}%` }} /></span>
                </div>
              </div>
            </div>
            {!c.teachers.length ? (
              <div className="card"><Empty icon={ClipboardCheck} title="Aucun enseignant à évaluer">Aucun enseignant n'est encore affecté à votre classe.</Empty></div>
            ) : (
              <div className="eval-grid">
                {c.teachers.map((t) => (
                  <div key={`${t.teacherId}-${t.matiereId}`} className={`card eval-teacher ${t.done ? 'done' : ''}`}>
                    <Avatar name={t.teacher} size={46} />
                    <div className="eval-teacher-text">
                      <strong>{t.teacher}</strong>
                      <span className="small muted">{t.matiere}</span>
                    </div>
                    {t.done
                      ? <span className="eval-done"><CheckCircle2 size={16} /> Évalué</span>
                      : <button className="btn btn-primary btn-sm" onClick={() => setTarget({ ...t, campaign: c })}>Évaluer</button>}
                  </div>
                ))}
              </div>
            )}
            {done === c.teachers.length && c.teachers.length > 0 && <Notice kind="success">Merci ! Vous avez évalué tous vos enseignants pour cette campagne.</Notice>}
          </div>
        )
      })}
      {target && <EvalForm campaign={target.campaign} target={target} criteria={target.campaign.questions} onClose={() => setTarget(null)} onDone={reload} />}
    </div>
  )
}
