import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MonitorPlay, Play, Square, Users, BellRing, CalendarClock, Timer, MapPin, Copy, Check } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, PageHead, StatusBadge, useAsync } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export function SessionCard({ s, onOpen, onClose }) {
  const [copied, setCopied] = useState(false)
  const done = s.classSize ? Math.round(((s.inProgress + s.submitted) / s.classSize) * 100) : 0
  return (
    <div className={`card session-card ${s.status}`}>
      <div className="card-body stack-sm">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link to={`/surveillant/sessions/${s.id}`} className="session-title">{s.title}</Link>
            <div className="small muted">{s.classe} - {s.matiere}</div>
          </div>
          <StatusBadge status={s.cancelled ? 'annule' : s.status} />
        </div>
        <div className="session-meta">
          <span><CalendarClock size={14} /> {fmtDateTime(s.startAt)}</span>
          <span><Timer size={14} /> {s.durationMin} min</span>
          {s.room && <span><MapPin size={14} /> {s.room}</span>}
        </div>
        {s.status === 'ouverte' && (
          <>
            <div className="code-box">
              <div>
                <div className="code-box-label">Code d'accès</div>
                <div className="session-code">{s.code}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                try { await navigator.clipboard.writeText(s.code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* presse-papiers indisponible */ }
              }}>{copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}</button>
            </div>
            <div>
              <div className="session-progress-label small">
                <span><Users size={14} /> {s.inProgress} en cours, {s.submitted} rendu(s) sur {s.classSize}</span>
                <span className={s.alerts ? 'alert-count' : 'muted'}><BellRing size={14} /> {s.alerts}</span>
              </div>
              <div className="bar"><span style={{ width: `${done}%` }} /></div>
            </div>
          </>
        )}
        <div className="row-wrap" style={{ marginTop: 6 }}>
          {s.status !== 'ouverte' && !s.cancelled && s.status !== 'fermee' && <button className="btn btn-primary btn-sm" onClick={() => onOpen(s)}><Play size={14} /> Ouvrir la session</button>}
          {s.status === 'ouverte' && <>
            <Link className="btn btn-primary btn-sm" to={`/surveillant/sessions/${s.id}`}>Suivre en direct</Link>
            <button className="btn btn-secondary btn-sm" onClick={() => onClose(s)}><Square size={14} /> Fermer la session</button>
          </>}
          {s.status === 'fermee' && <Link className="btn btn-ghost btn-sm" to={`/surveillant/sessions/${s.id}`}>Voir le détail</Link>}
        </div>
      </div>
    </div>
  )
}

export default function ProctorSessions() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.listSessions(), [])
  const [opening, setOpening] = useState(null)
  const [closing, setClosing] = useState(null)
  const list = (data || []).filter((s) => s.status !== 'fermee' && !s.cancelled).sort((x, y) => (x.status === 'ouverte' ? -1 : y.status === 'ouverte' ? 1 : x.startAt > y.startAt ? 1 : -1))

  return (
    <div>
      <PageHead title="Sessions d'examen" subtitle="Ouvrez la session, donnez le code aux étudiants, suivez la composition" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : list.length === 0 ? <div className="card"><Empty icon={MonitorPlay} title="Aucune session prévue" /></div> : (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {list.map((s) => <SessionCard key={s.id} s={s} onOpen={(x) => setOpening({ ...x, room: x.room || '' })} onClose={setClosing} />)}
        </div>
      )}
      {opening && (
        <Modal title="Ouvrir la session" onClose={() => setOpening(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setOpening(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={async () => { try { await api.setSessionState(opening.id, 'ouverte', opening.room); toast.success('Session ouverte. Donnez le code aux étudiants.'); setOpening(null); reload() } catch (e) { toast.error(e.message) } }}>Ouvrir</button>
        </>}>
          <div className="stack">
            <p><strong>{opening.title}</strong><br /><span className="muted small">{opening.classe}</span></p>
            <div className="field">
              <label htmlFor="room">Salle</label>
              <input id="room" className="input" value={opening.room} onChange={(e) => setOpening({ ...opening, room: e.target.value })} placeholder="Salle informatique 1" />
            </div>
            <p className="small muted">Dès l'ouverture, les étudiants de la classe peuvent entrer le code et commencer. Le chronomètre de chacun démarre à son entrée.</p>
          </div>
        </Modal>
      )}
      {closing && (
        <Confirm
          title="Fermer la session"
          message={`Les copies encore en cours (${closing.inProgress}) seront rendues automatiquement avec les réponses déjà enregistrées.`}
          confirmLabel="Fermer la session"
          danger
          onClose={() => setClosing(null)}
          onConfirm={async () => { await api.setSessionState(closing.id, 'fermee'); toast.success('Session fermée.'); reload() }}
        />
      )}
    </div>
  )
}
