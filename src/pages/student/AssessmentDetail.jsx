import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, ListChecks, Maximize, ClipboardX, ShieldCheck, Loader2, MonitorSmartphone, FileCode2, TriangleAlert } from 'lucide-react'
import * as api from '../../api/index.js'
import { ErrorBox, Loader, Notice, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { ExamCodeForm, useNow } from '../../components/student.jsx'
import { fmtDateTime, fmtNote, TOOLS } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import { TEST_MODE } from '../../config.js'
import { prepareEngine } from '../../lib/engines.js'
import EngineStatus from '../../components/EngineStatus.jsx'
import { useExecution } from '../../lib/useExecution.js'

// Langages de l'épreuve : ceux qu'on peut lancer, et ceux qu'on écrit seulement (corrigés par l'enseignant)
function languageRule(languages, execution) {
  const name = (l) => TOOLS[l]?.label ?? l
  const list = languages.map(name).join(', ')
  const noRun = execution.known ? languages.filter((l) => !execution.canRun(l)) : []
  if (!noRun.length) return `Langage : ${list}. L'éditeur et le terminal sont prêts, rien à installer.`
  const words = noRun.map(name).join(', ')
  if (noRun.length === languages.length) return `Langage : ${list}. Vous écrivez votre code dans l'éditeur ; son exécution n'est pas disponible sur la plateforme, l'enseignant le corrigera.`
  return `Langage : ${list}. L'éditeur et le terminal sont prêts. Pour ${words}, l'exécution n'est pas disponible : écrivez votre code, l'enseignant le corrigera.`
}

export default function AssessmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { data: a, loading, error } = useAsync(() => api.studentAssessment(id), [id])
  const t = useNow(60000)
  const execution = useExecution()
  // Précharge la page de composition et l'éditeur de code pendant que l'étudiant lit les consignes
  useEffect(() => { import('./TakeAttempt.jsx') }, [])
  // Moteurs d'exécution des langages de l'épreuve (PHP : quelques Mo) téléchargés dès maintenant,
  // pour que le premier « Lancer » soit immédiat et que la salle ne télécharge pas tout au même instant
  const langs = (a?.languages || []).join(',')
  useEffect(() => {
    if (!langs || a?.status === 'annule') return
    for (const l of langs.split(',')) prepareEngine(l)
  }, [langs, a?.status])

  if (loading && !a) return <Loader />
  if (error) return <ErrorBox error={error} />

  const closed = a.status === 'annule' || new Date(a.endAt).getTime() < t
  const notOpenYet = a.kind === 'devoir' && new Date(a.startAt).getTime() > t
  const canStart = !closed && !notOpenYet && (a.attemptInProgress || a.attemptsUsed < a.maxAttempts)

  async function start() {
    setBusy(true)
    try {
      const attemptId = await api.startAttempt(a.id)
      navigate(`/etudiant/composer/${attemptId}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const rules = [
    [Clock, a.kind === 'examen' ? `Durée : ${a.durationMin} minutes, chronomètre visible pendant toute l'épreuve.` : `Date limite : ${fmtDateTime(a.endAt)}.`],
    [ListChecks, `${a.questionCount} question${a.questionCount > 1 ? 's' : ''}, ${a.maxPoints} points au total.`],
    a.languages?.length > 0 && [FileCode2, languageRule(a.languages, execution)],
    a.security.fullscreen && [Maximize, "L'épreuve se fait en plein écran. Une sortie du plein écran est enregistrée."],
    a.security.exitWarnings && [TriangleAlert, 'Si vous quittez l\'épreuve (plein écran ou changement de fenêtre), un avertissement s\'affiche. À la deuxième sortie, votre copie est envoyée automatiquement.'],
    a.security.blockPaste && [ClipboardX, "Le copier-coller depuis l'extérieur est bloqué. Dans l'éditeur, vous pouvez copier-coller votre propre code."],
    [ShieldCheck, 'Vos réponses sont enregistrées automatiquement. En cas de coupure, reconnectez-vous et reprenez où vous en étiez.'],
    [MonitorSmartphone, 'Les questions de code demandent un ordinateur. Sur téléphone, seuls les QCM et questions ouvertes sont accessibles.'],
  ].filter(Boolean)

  return (
    <div className="stack" style={{ maxWidth: 1080 }}>
      <Link to={a.kind === 'examen' ? '/etudiant/examens' : '/etudiant/devoirs'} className="row small"><ArrowLeft {...ICON} /> Retour</Link>
      <div className="card">
        <div className="card-body stack">
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="tag">{a.kind === 'examen' ? 'Examen surveillé' : 'Devoir'}</span>
              <h1 style={{ fontSize: '1.3rem', marginTop: 8 }}>{a.title}</h1>
              <p className="muted">{a.matiere} - {a.teacher}</p>
            </div>
            {a.status === 'annule' ? <StatusBadge status="annule" /> : <StatusBadge status={a.studentStatus} />}
          </div>
          {a.description && <p style={{ color: 'var(--text-2)' }}>{a.description}</p>}
          <div className="info-tiles">
            <div><span>{a.kind === 'examen' ? 'Début' : 'Ouverture'}</span><strong>{fmtDateTime(a.startAt)}</strong></div>
            <div><span>{a.kind === 'examen' ? 'Fin du créneau' : 'Date limite'}</span><strong>{fmtDateTime(a.endAt)}</strong></div>
            {a.kind === 'examen' && <div><span>Durée</span><strong>{a.durationMin} min</strong></div>}
            <div><span>Barème</span><strong>{a.maxPoints} points</strong></div>
            <div><span>Tentatives</span><strong>{a.attemptsUsed} / {a.maxAttempts}</strong></div>
          </div>
          {a.note20 !== null && (
            <Notice kind="success">Note publiée : <strong>{fmtNote(a.note20)}/20</strong> ({fmtNote(a.score)} / {a.maxPoints} points). <Link to="/etudiant/resultats">Voir le détail</Link></Notice>
          )}
        </div>
      </div>

      {a.status !== 'annule' && (
        <div className="card">
          <div className="card-header"><h2>Avant de commencer</h2></div>
          <div className="card-body rules-grid">
            {rules.map(([Icon, text], i) => (
              <div className="rule" key={i}>
                <span className="rule-icon"><Icon size={17} strokeWidth={1.6} /></span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          {TEST_MODE.runCodeInBrowser && a.languages?.length > 0 && (
            <div className="card-body" style={{ paddingTop: 0 }}><EngineStatus languages={a.languages} showReady /></div>
          )}
        </div>
      )}

      {a.status === 'annule' && <Notice>Cette épreuve a été annulée par l'enseignant.</Notice>}

      {a.kind === 'devoir' && a.status !== 'annule' && (
        <div className="row-wrap">
          {canStart ? (
            <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
              {busy && <Loader2 {...ICON} className="spin" />}
              {a.attemptInProgress ? 'Reprendre ma copie' : a.attemptsUsed ? 'Nouvelle tentative' : 'Commencer le devoir'}
            </button>
          ) : (
            <Notice>{notOpenYet ? `Ce devoir ouvre le ${fmtDateTime(a.startAt)}.` : closed ? 'La date limite est passée.' : 'Vous avez utilisé toutes vos tentatives.'}</Notice>
          )}
        </div>
      )}

      {a.kind === 'examen' && a.status !== 'annule' && TEST_MODE.examsWithoutCode && (
        <div className="card"><div className="card-body stack-sm">
          <Notice>Mode test : l'examen s'ouvre sans code d'accès, à toute heure et autant de fois que nécessaire. La durée de {a.durationMin} min compte à partir de l'entrée. À désactiver dans <span className="mono">src/config.js</span>.</Notice>
          <div>
            <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
              {busy && <Loader2 {...ICON} className="spin" />}
              {a.attemptInProgress ? 'Reprendre ma copie' : a.attemptsUsed ? 'Recommencer l\'examen' : 'Commencer l\'examen'}
            </button>
          </div>
        </div></div>
      )}

      {a.kind === 'examen' && a.status !== 'annule' && !closed && !TEST_MODE.examsWithoutCode && (
        a.attemptInProgress ? (
          <div><button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>Reprendre ma copie</button></div>
        ) : a.attemptsUsed ? (
          <Notice kind="success">Votre copie a été rendue.</Notice>
        ) : (
          <div className="card"><div className="card-body stack-sm">
            {a.sessionStatus === 'ouverte'
              ? <p>La session est ouverte. Saisissez le code affiché par le surveillant.</p>
              : <p className="muted">La session n'est pas encore ouverte. Le surveillant vous donnera le code le jour de l'examen.</p>}
            <ExamCodeForm compact />
          </div></div>
        )
      )}
    </div>
  )
}
