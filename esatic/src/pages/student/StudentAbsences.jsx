// Étudiant : ses heures d'absence et ses retards (d'après l'appel des enseignants), et l'envoi de billets de
// justification, vérifiés ensuite par les éducateurs
import { useRef, useState } from 'react'
import { CalendarX2, CheckCircle2, Clock, FileCheck2, FileUp, Loader2, Send, UserX } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, Modal, Notice, PageHead, Stat, useAsync, ICON } from '../../components/ui.jsx'
import { StatusTag, fmtCourseDay, fmtHours } from '../../components/AbsenceWidgets.jsx'
import { JustificationCard } from '../../components/JustificationWidgets.jsx'
import { fmtSize, readFileBase64 } from '../../lib/bulletinFiles.js'

const MAX = 3 * 1024 * 1024

function SendForm({ items, motifs, onClose, onSent }) {
  const toast = useToast()
  const [motif, setMotif] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const hours = items.reduce((n, it) => n + it.hours, 0)

  function pick(f) {
    if (!f) return
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) { setError('Format non accepté : photo (JPG, PNG) ou PDF.'); return }
    if (f.size > MAX) { setError(`Fichier trop lourd (${fmtSize(f.size)}) : 3 Mo au maximum.`); return }
    setError(''); setFile(f)
  }
  async function send() {
    setError('')
    if (!motif) { setError('Choisissez le motif de l\'absence.'); return }
    if (!file) { setError('Joignez la photo ou le PDF du billet de justification.'); return }
    setBusy(true)
    try {
      await api.submitJustification({ attendanceIds: items.map((it) => it.attendanceId), motif, comment, file: { name: file.name, base64: await readFileBase64(file) } })
      toast.success('Justificatif envoyé : les éducateurs vont le vérifier.')
      onSent(); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal wide title="Envoyer un justificatif" onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={send}>{busy ? <Loader2 {...ICON} className="spin" /> : <Send {...ICON} />} Envoyer pour vérification</button>
    </>}>
      <div className="stack">
        <div>
          <span className="label">Absences concernées ({fmtHours(hours)})</span>
          <ul className="justif-items">{items.map((it) => <li key={it.attendanceId}><b>{fmtCourseDay(it.date)}</b> · {it.start} - {it.end} · {it.matiere}</li>)}</ul>
        </div>
        <div className="field">
          <label htmlFor="j-motif">Motif</label>
          <select id="j-motif" className="select" value={motif} onChange={(e) => setMotif(e.target.value)}>
            <option value="">Choisir le motif...</option>
            {motifs.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="j-comment">Commentaire {motif === 'Autre' ? '' : <span className="muted small">(facultatif)</span>}</label>
          <textarea id="j-comment" className="textarea" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Précisions utiles pour l'éducateur" />
        </div>
        <div>
          <span className="label">Billet de justification</span>
          <div className={`tt-drop ${drag ? 'drag' : ''} ${file ? 'has-file' : ''}`} role="button" tabIndex={0}
            onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}>
            <FileUp size={26} strokeWidth={1.5} />
            {file ? <span><strong>{file.name}</strong> · {fmtSize(file.size)}<span className="small muted" style={{ display: 'block' }}>Cliquez pour choisir un autre fichier</span></span>
              : <span><strong>Photo ou PDF du billet</strong> (certificat médical, convocation...)<span className="small muted" style={{ display: 'block' }}>Glissez le fichier ici ou cliquez · 3 Mo au maximum</span></span>}
          </div>
          <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" capture="environment" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
        </div>
        <Notice>Les éducateurs vérifient que le billet est valable. S'il est validé, ces heures deviennent des absences justifiées ; sinon, vous êtes prévenu avec le motif du refus.</Notice>
        {error && <Notice kind="danger">{error}</Notice>}
      </div>
    </Modal>
  )
}

export default function StudentAbsences() {
  const { data, loading, error, reload } = useAsync(() => api.myAbsences(), [])
  const [selected, setSelected] = useState([])
  const [sending, setSending] = useState(false)
  const selectable = (it) => it.status === 'absent' && !it.justified && !it.pending
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div>
      <PageHead title="Mes absences" subtitle="D'après l'appel fait par vos enseignants à chaque cours" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="dashboard" /> : (
        <div className="stack">
          <div className="grid-cards">
            <Stat icon={Clock} value={fmtHours(data.totals.hours)} label={`Heures d'absence · ${data.totals.absences} cours manqué${data.totals.absences > 1 ? 's' : ''}`} tone={data.totals.hours >= 10 ? 'red' : ''} />
            <Stat icon={CheckCircle2} value={fmtHours(data.totals.justifiedHours)} label="Justifiées" tone="green" />
            <Stat icon={UserX} value={fmtHours(data.totals.unjustifiedHours)} label="Non justifiées" tone={data.totals.unjustifiedHours > 0 ? 'red' : 'gray'} />
            <Stat icon={CalendarX2} value={data.totals.retards} label={`Retard${data.totals.retards > 1 ? 's' : ''}`} tone="gray" />
          </div>
          <div className="card">
            <div className="card-header">
              <h2>Absences et retards</h2>
              {data.items.some(selectable) && (
                <button className="btn btn-primary btn-sm" disabled={!selected.length} onClick={() => setSending(true)}>
                  <FileCheck2 size={15} /> Envoyer un justificatif{selected.length ? ` (${selected.length})` : ''}
                </button>
              )}
            </div>
            {data.items.some(selectable) && <p className="small muted" style={{ padding: '0 20px' }}>Cochez les absences concernées par un même billet, puis envoyez-le.</p>}
            {!data.items.length ? <Empty icon={CheckCircle2} title="Aucune absence">Vous avez été présent à tous les cours où l'appel a été fait.</Empty> : (
              <div className="abs-list">
                {data.items.map((it) => (
                  <label key={it.attendanceId} className={`abs-item ${it.status} ${it.justified ? 'is-justified' : ''} ${selectable(it) ? 'selectable' : ''}`}>
                    <div className="abs-when">
                      <span className="row" style={{ gap: 8 }}>
                        {selectable(it) && <input type="checkbox" checked={selected.includes(it.attendanceId)} onChange={() => toggle(it.attendanceId)} aria-label={`Absence du ${fmtCourseDay(it.date)}`} />}
                        <strong>{fmtCourseDay(it.date)}</strong>
                      </span>
                      <span className="small muted">{it.start} - {it.end} · {fmtHours(it.hours)}</span>
                    </div>
                    <div className="abs-what"><span>{it.matiere}</span><span className="small muted">{it.teacher}{it.reason ? ` · Motif : ${it.reason}` : ''}</span></div>
                    {it.pending ? <span className="abs-tag pending">Justificatif en vérification</span> : <StatusTag status={it.status} justified={it.justified} />}
                  </label>
                ))}
              </div>
            )}
          </div>
          {data.requests.length > 0 && (
            <div className="stack-sm">
              <h2 className="eval-section-title">Mes justificatifs</h2>
              {data.requests.map((j) => <JustificationCard key={j.id} j={j} showStudent={false} />)}
            </div>
          )}
        </div>
      )}
      {sending && <SendForm items={data.items.filter((it) => selected.includes(it.attendanceId))} motifs={data.motifs} onClose={() => setSending(false)} onSent={() => { setSelected([]); reload() }} />}
    </div>
  )
}
