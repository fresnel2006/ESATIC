import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, KeyRound, Timer, CircleCheck, UserRound, BellRing } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { ErrorBox, Loader, Modal, ResponsiveTable, RiskBadge, Stat, StatusBadge, ICON } from '../../components/ui.jsx'
import { EVENT_LABELS, fmtAgo, fmtTime, fmtDuration } from '../../lib/format.js'

export default function ProctorSessionDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState(null)
  const [reset, setReset] = useState(null)

  useEffect(() => {
    let alive = true
    // Suivi en direct : toutes les 10 s quand l'onglet est à l'écran (chaque rafraîchissement lit les copies de la session)
    const load = () => { if (!document.hidden) api.sessionDetail(id).then((d) => alive && setData(d)).catch((e) => alive && setError(e)) }
    load()
    const t = setInterval(load, 10000)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [id])

  if (error) return <ErrorBox error={error} />
  if (!data) return <Loader variant="detail" />
  const { session: s, participants } = data
  const count = (st) => participants.filter((p) => p.status === st).length

  return (
    <div className="stack">
      <Link to={s.status === 'fermee' ? '/surveillant/historique' : '/surveillant/sessions'} className="row small"><ArrowLeft {...ICON} /> Retour</Link>
      <div className="card"><div className="card-body row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.2rem' }}>{data.title}</h1>
          <p className="muted small">{s.room || 'Salle non précisée'} - {data.durationMin} min - actualisation automatique toutes les 5 secondes</p>
        </div>
        <div className="row-wrap">
          <StatusBadge status={s.status} />
          {s.status === 'ouverte' && (
            <div>
              <div className="label">Code d'accès</div>
              <div className="row"><span className="session-code">{s.code}</span>
                <button className="icon-btn" title="Générer un nouveau code" aria-label="Générer un nouveau code" onClick={async () => { await api.regenerateCode(s.id); setData(await api.sessionDetail(id)); toast.info('Nouveau code généré. Les étudiants déjà entrés continuent normalement.') }}><RefreshCw {...ICON} /></button>
              </div>
            </div>
          )}
        </div>
      </div></div>

      <div className="grid-cards">
        <Stat icon={Timer} value={count('en_cours')} label="En cours" />
        <Stat icon={CircleCheck} value={count('rendu') + count('corrige')} label="Rendues" tone="green" />
        <Stat icon={UserRound} value={count('absent')} label="Pas encore entrés" tone="gray" />
        <Stat icon={BellRing} value={participants.reduce((n, p) => n + p.events.length, 0)} label="Signalements" tone="red" />
      </div>

      <div className="card">
        <ResponsiveTable
          rowKey="studentId"
          rows={participants}
          columns={[
            { key: 'name', label: 'Étudiant', primary: true, render: (p) => <span>{p.name} <span className="muted small">{p.matricule}</span></span> },
            { key: 'status', label: 'Statut', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'answered', label: 'Avancement', render: (p) => p.status === 'absent' ? '-' : (
              <div style={{ minWidth: 90 }}><div className="bar"><span style={{ width: `${(p.answered / p.total) * 100}%` }} /></div><span className="small muted">{p.answered}/{p.total}</span></div>
            ) },
            { key: 'time', label: 'Temps restant', render: (p) => (p.status === 'en_cours' && p.deadlineAt ? fmtDuration(new Date(p.deadlineAt).getTime() - Date.now()) : '-') },
            { key: 'lastSeenAt', label: 'Dernière activité', render: (p) => (p.lastSeenAt ? fmtAgo(p.lastSeenAt) : '-') },
            { key: 'risk', label: 'Risque', render: (p) => (p.events.length ? <button className="btn btn-ghost btn-sm" onClick={() => setEvents(p)}><RiskBadge value={p.risk} /> {p.events.length} événement(s)</button> : <RiskBadge value={0} />) },
            { key: 'actions', label: '', className: 'actions', render: (p) => (
              <button className="btn btn-ghost btn-sm" onClick={() => setReset(p)}><KeyRound size={14} /> Mot de passe</button>
            ) },
          ]}
        />
      </div>
      <p className="small muted">La plateforme signale, elle n'exclut jamais. Si un comportement vous semble anormal, allez voir l'étudiant et notez-le au procès-verbal.</p>

      {events && (
        <Modal title={`Journal - ${events.name}`} onClose={() => setEvents(null)}>
          <div className="event-list">
            {events.events.map((e, i) => (
              <div className="event-item" key={i}><time>{fmtTime(e.at)}</time><span>{EVENT_LABELS[e.type] || e.type}{e.detail?.length ? ` (${e.detail.length} caractères)` : ''}</span></div>
            ))}
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Réinitialiser le mot de passe" onClose={() => setReset(null)} footer={reset.temp
          ? <button className="btn btn-primary" onClick={() => setReset(null)}>Fermer</button>
          : <>
            <button className="btn btn-secondary" onClick={() => setReset(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={async () => { try { const r = await api.resetPassword(reset.studentId); setReset({ ...reset, temp: r.temporaryPassword }) } catch (e) { toast.error(e.message) } }}>Réinitialiser</button>
          </>}>
          {reset.temp ? (
            <div className="stack-sm">
              <p>Mot de passe provisoire de <strong>{reset.name}</strong> :</p>
              <div className="session-code" style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>{reset.temp}</div>
              <p className="small muted">Communiquez-le à l'étudiant. Il devra le changer à sa prochaine connexion. Sa copie en cours est conservée.</p>
            </div>
          ) : (
            <p>Un mot de passe provisoire sera créé pour <strong>{reset.name}</strong> ({reset.matricule}). Sa session actuelle sera fermée ; il pourra se reconnecter et reprendre sa copie.</p>
          )}
        </Modal>
      )}
    </div>
  )
}
