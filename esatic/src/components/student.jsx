// Éléments partagés de l'espace étudiant
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import * as api from '../api/index.js'
import { StatusBadge, ICON } from './ui.jsx'
import DocIcon from './DocIcon.jsx'
import { fmtRelativeDay, TOOLS } from '../lib/format.js'
import { useToast } from '../context/ToastContext.jsx'

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function deadlineText(a) {
  if (a.status === 'annule') return 'Épreuve annulée'
  if (a.kind === 'examen') {
    return `${fmtRelativeDay(a.startAt)}${a.durationMin ? ` - ${a.durationMin} min` : ''}`
  }
  const end = new Date(a.endAt).getTime()
  if (end < Date.now()) return `Clôturé ${fmtRelativeDay(a.endAt).toLowerCase()}`
  return `${fmtRelativeDay(a.endAt)} - date limite`
}

// Carte d'épreuve, reprise de la maquette "Mes devoirs"
export function TaskCard({ a }) {
  const navigate = useNavigate()
  const now = useNow(60000)
  const open = a.kind === 'devoir' && a.status !== 'annule' && new Date(a.endAt).getTime() > now
  const sub = open ? `${fmtRelativeDay(a.endAt).replace(' à ', ' à rendre à ')}` : deadlineText(a)
  // Moins de 24 h avant l'échéance et pas encore rendu : on le signale en bleu (jamais d'orange)
  const soon = open && new Date(a.endAt).getTime() - now < 24 * 3600 * 1000 && ['a_faire', 'en_cours'].includes(a.studentStatus)
  const go = () => navigate(`/etudiant/epreuve/${a.id}`)
  return (
    <div className={`task-card ${a.status === 'annule' ? 'is-off' : ''}`} onClick={go} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go()}>
      <DocIcon variant={a.status === 'annule' ? 'off' : a.kind} />
      <div className="task-main">
        <div className="task-title">{a.title}</div>
        <div className="task-sub">
          {sub}
          {soon && <span className="soon-chip">Échéance proche</span>}
        </div>
        <div className="task-meta">
          <span>{a.matiere}</span>
          {a.languages?.length > 0 && <span className="lang-pills">{a.languages.map((l) => <span key={l} className="tag">{TOOLS[l]?.label ?? l}</span>)}</span>}
          {a.kind === 'devoir' && a.status !== 'annule' && <span>{a.attemptsUsed}/{a.maxAttempts} tentative{a.maxAttempts > 1 ? 's' : ''}</span>}
          {a.note20 !== null && a.note20 !== undefined && <span><strong style={{ color: 'var(--text)' }}>{String(a.note20).replace('.', ',')}/20</strong></span>}
        </div>
      </div>
      <div className="task-side">
        {a.status === 'annule' ? <StatusBadge status="annule" /> : <StatusBadge status={a.studentStatus} />}
        <button className="btn btn-primary btn-sm task-btn" onClick={(e) => { e.stopPropagation(); go() }}>Voir les détails</button>
      </div>
    </div>
  )
}

export function ExamCodeForm({ compact }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const toast = useToast()

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (code.trim().length < 4) {
      setError('Saisissez le code donné par le surveillant.')
      return
    }
    setBusy(true)
    try {
      const { assessmentId } = await api.joinWithCode(code)
      const attemptId = await api.startAttempt(assessmentId, code.trim())
      toast.info('Code accepté. Bonne composition.')
      navigate(`/etudiant/composer/${attemptId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack-sm">
      {!compact && <label htmlFor="exam-code" className="label">Entrer un code d'examen</label>}
      <div className="code-form">
        <div className="input-icon" style={{ flex: 1 }}>
          <KeyRound {...ICON} />
          <input
            id="exam-code"
            className="input"
            placeholder="Code donné par le surveillant"
            value={code}
            maxLength={8}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy && <Loader2 {...ICON} className="spin" />} Entrer
        </button>
      </div>
      {error && <div className="error-text" role="alert">{error}</div>}
    </form>
  )
}
