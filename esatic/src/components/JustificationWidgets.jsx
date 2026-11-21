// Billets de justification : ouverture du fichier, file des justificatifs à vérifier (éducateurs, direction
// pédagogique, administration), étiquette d'état
import { useState } from 'react'
import { CheckCircle2, Eye, FileCheck2, Loader2, XCircle } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, useAsync, ICON } from './ui.jsx'
import { fmtDateTime } from '../lib/format.js'
import { fmtSize } from '../lib/bulletinFiles.js'
import { fmtCourseDay, fmtHours } from './AbsenceWidgets.jsx'

// Ouvre le billet dans un nouvel onglet (ouvert tout de suite, sinon le navigateur le bloque)
export async function openJustification(id) {
  const tab = window.open('', '_blank')
  try {
    const f = await api.getJustificationFile(id)
    const bin = atob(f.base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }))
    if (tab) tab.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) {
    tab?.close()
    throw e
  }
}

export function JustifStatus({ status }) {
  if (status === 'acceptee') return <span className="abs-tag justified">Accepté</span>
  if (status === 'refusee') return <span className="abs-tag absent">Refusé</span>
  return <span className="abs-tag pending">En attente de vérification</span>
}

// Une demande : étudiant, absences concernées, motif, billet ; boutons de décision si en attente
export function JustificationCard({ j, onDone, showStudent = true, canReview = false }) {
  const toast = useToast()
  const [refusing, setRefusing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const open = () => openJustification(j.id).catch((e) => toast.error(e.message))

  async function decide(accept) {
    setBusy(true)
    try {
      await api.reviewJustification(j.id, accept, accept ? '' : note)
      toast.success(accept ? `Justificatif validé : ${fmtHours(j.hours)} d'absence justifiée${j.hours > 1 ? 's' : ''}.` : 'Justificatif refusé : l\'étudiant est prévenu.')
      onDone?.()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className={`card justif-card ${j.status}`}>
      <div className="justif-head">
        <div>
          {showStudent && <strong className="justif-student">{j.student} <span className="small muted">· {j.matricule} · {j.classe}</span></strong>}
          <div className="justif-motif"><FileCheck2 size={15} /> {j.motif}{j.comment ? <span className="muted"> - {j.comment}</span> : ''}</div>
          <span className="small muted">Envoyé le {fmtDateTime(j.createdAt)}</span>
        </div>
        <div className="justif-side">
          <JustifStatus status={j.status} />
          <span className="justif-hours">{fmtHours(j.hours)}</span>
        </div>
      </div>
      <ul className="justif-items">
        {j.items.map((it) => (
          <li key={it.attendanceId}>{it.missing ? <span className="muted">Cours introuvable</span> : <><b>{fmtCourseDay(it.date)}</b> · {it.start} - {it.end} · {it.matiere} <span className="muted">({it.teacher})</span></>}</li>
        ))}
      </ul>
      {j.status !== 'en_attente' && (
        <p className="small justif-review">{j.status === 'acceptee' ? 'Validé' : 'Refusé'} par {j.reviewedBy} le {fmtDateTime(j.reviewedAt)}{j.reviewNote ? ` · Motif : ${j.reviewNote}` : ''}</p>
      )}
      <div className="justif-actions">
        <button className="btn btn-secondary btn-sm" onClick={open}><Eye size={15} /> Voir le billet <span className="muted small">({fmtSize(j.size)})</span></button>
        {canReview && j.status === 'en_attente' && (refusing ? (
          <div className="justif-refuse">
            <input className="input" autoFocus maxLength={300} placeholder="Pourquoi le billet n'est pas valable (illisible, non signé, dates différentes...)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-danger btn-sm" disabled={busy || !note.trim()} onClick={() => decide(false)}>Confirmer le refus</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRefusing(false); setNote('') }}>Annuler</button>
          </div>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(true)}>{busy ? <Loader2 {...ICON} className="spin" /> : <CheckCircle2 size={15} />} Valider : absences justifiées</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRefusing(true)}><XCircle size={15} /> Refuser</button>
          </>
        ))}
      </div>
    </div>
  )
}

// File des justificatifs (en attente, acceptés, refusés)
export function JustificationQueue({ status }) {
  const { data, loading, error, reload } = useAsync(() => api.listJustifications(status), [status])
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="rows" />
  if (!data.items.length) {
    return <div className="card"><Empty icon={FileCheck2} title={status === 'en_attente' ? 'Aucun justificatif à vérifier' : 'Aucun justificatif'}>{status === 'en_attente' ? 'Les billets envoyés par les étudiants apparaîtront ici.' : ''}</Empty></div>
  }
  return (
    <div className="stack">
      {status === 'en_attente' && <p className="small muted">Ouvrez chaque billet, vérifiez qu'il est valable (lisible, signé, dates et noms correspondants), puis validez ou refusez. Validé : les heures d'absence concernées deviennent justifiées.</p>}
      {data.items.map((j) => <JustificationCard key={j.id} j={j} canReview onDone={reload} />)}
    </div>
  )
}
