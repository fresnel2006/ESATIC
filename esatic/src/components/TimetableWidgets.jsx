// Emplois du temps : lecteur PDF intégré et liste des emplois du temps (étudiants, enseignants, direction)
import { useEffect, useState } from 'react'
import { CalendarDays, Download, ExternalLink, FileText, Loader2, UserRound } from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'
import { fmtDate, fmtDateTime } from '../lib/format.js'
import { fmtSize } from '../lib/bulletinFiles.js'
import { downloadTimetable, openTimetable, timetableBlob } from '../lib/timetableFiles.js'

// « du 17 nov. au 22 nov. 2026 », « à partir du ... », « jusqu'au ... »
export function validity(t) {
  if (t.validFrom && t.validTo) return `Du ${fmtDate(t.validFrom)} au ${fmtDate(t.validTo)}`
  if (t.validFrom) return `À partir du ${fmtDate(t.validFrom)}`
  if (t.validTo) return `Jusqu'au ${fmtDate(t.validTo)}`
  return 'Sans date de validité'
}

export function TimetableBadge({ t }) {
  if (!t.validFrom && !t.validTo) return null
  const today = new Date().toISOString().slice(0, 10)
  if (t.current) return <span className="tt-badge current">En cours</span>
  if (t.validFrom && t.validFrom > today) return <span className="tt-badge next">À venir</span>
  return <span className="tt-badge past">Passé</span>
}

// Lecteur : le PDF s'affiche dans la page ; sur téléphone, boutons pour l'ouvrir (les navigateurs mobiles
// n'affichent pas les PDF intégrés). À afficher avec key={`${id}:${version}`} pour repartir de zéro.
export function TimetableViewer({ item }) {
  const toast = useToast()
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    let made = null
    timetableBlob(item)
      .then(({ blob }) => { if (alive) { made = URL.createObjectURL(blob); setUrl(made) } })
      .catch((e) => alive && setError(e.message))
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [item])

  const run = (fn) => fn(item).catch((e) => toast.error(e.message))
  return (
    <div className="card tt-viewer">
      <div className="tt-viewer-head">
        <div className="tt-viewer-title">
          <span className="tt-icon"><CalendarDays size={20} strokeWidth={1.7} /></span>
          <div>
            <strong>{item.title}</strong> <TimetableBadge t={item} />
            <div className="small muted">{validity(item)}{item.classes?.length ? ` · ${item.classes.join(', ')}` : ''}{item.teachers?.length ? ` · ${item.teachers.join(', ')}` : ''}</div>
          </div>
        </div>
        <div className="row-wrap">
          <button className="btn btn-secondary btn-sm" onClick={() => run(openTimetable)}><ExternalLink size={15} /> Plein écran</button>
          <button className="btn btn-primary btn-sm" onClick={() => run(downloadTimetable)}><Download size={15} /> Télécharger</button>
        </div>
      </div>
      {item.note && <div className="tt-note">{item.note}</div>}
      <div className="tt-frame">
        {error ? <div className="tt-frame-msg danger">{error}</div>
          : !url ? <div className="tt-frame-msg"><Loader2 size={22} className="spin" /> Chargement de l'emploi du temps...</div>
            : <iframe title={item.title} src={`${url}#view=FitH&toolbar=1`} />}
        <div className="tt-mobile">
          <FileText size={34} strokeWidth={1.4} />
          <span>{item.fileName} · {fmtSize(item.size)}</span>
          <button className="btn btn-primary" onClick={() => run(openTimetable)}><ExternalLink size={16} /> Ouvrir l'emploi du temps</button>
        </div>
      </div>
      <div className="tt-viewer-foot small muted">Déposé le {fmtDateTime(item.uploadedAt)}{item.uploadedBy ? ` par ${item.uploadedBy}` : ''}{item.version > 1 ? ` · version ${item.version}` : ''}</div>
    </div>
  )
}

// Liste à cliquer (l'emploi du temps choisi s'affiche dans le lecteur)
export function TimetableList({ items, selectedId, onSelect, showTargets = true }) {
  return (
    <div className="tt-list">
      {items.map((t) => (
        <button key={t.id} className={`tt-item ${t.id === selectedId ? 'active' : ''}`} onClick={() => onSelect(t)}>
          <span className="tt-item-icon">{t.personal ? <UserRound size={17} /> : <CalendarDays size={17} />}</span>
          <span className="tt-item-text">
            <span className="tt-item-title">{t.title} <TimetableBadge t={t} /></span>
            <span className="small muted">{validity(t)}</span>
            {showTargets && (t.classes?.length > 0 || t.personal) && <span className="small muted">{t.personal ? 'Emploi du temps personnel' : t.classes.join(', ')}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
