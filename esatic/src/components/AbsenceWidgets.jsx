// Heures d'absence : choix de la classe, total par étudiant, fiche d'un étudiant (avec justification).
// Utilisé par la direction pédagogique, les éducateurs, l'administration, et l'enseignant pour ses classes.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarX2, CheckCircle2, ChevronRight, Clock, Download, Undo2, UserX, Users } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { Avatar, Empty, ErrorBox, Loader, ResponsiveTable, Stat, useAsync } from './ui.jsx'
import { LEVELS, LEVEL_NAMES } from '../api/constants.js'
import { downloadCsv } from '../lib/format.js'
import AttendanceSheet from './AttendanceSheet.jsx'
import ClassPicker from './ClassPicker.jsx'
import { Modal } from './ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { JustificationCard } from './JustificationWidgets.jsx'

// 3.5 -> « 3 h 30 » ; 2 -> « 2 h »
export function fmtHours(h) {
  const total = Math.round((h || 0) * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`
}
export const fmtCourseDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const hoursTone = (h) => (h >= 10 ? 'high' : h >= 4 ? 'mid' : h > 0 ? 'low' : 'none')

export function HoursBadge({ hours }) {
  return <span className={`abs-hours ${hoursTone(hours)}`}>{fmtHours(hours)}</span>
}

export function StatusTag({ status, justified }) {
  if (status === 'retard') return <span className="abs-tag retard">Retard</span>
  return justified ? <span className="abs-tag justified">Absence justifiée</span> : <span className="abs-tag absent">Absence</span>
}

// Fiche d'un étudiant : totaux et liste de ses absences et retards ; justification par l'équipe pédagogique
function StudentDetail({ studentId, onBack }) {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.studentAbsences(studentId), [studentId])
  const [editing, setEditing] = useState(null) // attendanceId en cours de justification
  const [reason, setReason] = useState('')
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="detail" />
  const t = data.totals

  async function justify(item, value) {
    try {
      await api.justifyAbsence(item.attendanceId, studentId, value, value ? reason : '')
      toast.success(value ? 'Absence justifiée.' : 'Justification retirée.')
      setEditing(null); setReason(''); reload()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <section className="teacher-detail" aria-label={`Absences de ${data.student.fullName}`}>
      <div className="td-bar">
        <button className="btn btn-secondary btn-sm" onClick={onBack}><ArrowLeft size={15} /> Retour à {data.classe}</button>
        <span className="small muted td-path">Absences <ChevronRight size={13} /> {data.classe} <ChevronRight size={13} /> <b>{data.student.fullName}</b></span>
      </div>
      <div className="card td-head">
        <Avatar name={data.student.fullName} size={64} />
        <div className="td-id">
          <h2>{data.student.fullName}</h2>
          <div className="td-tags"><span className="tag">{data.student.matricule}</span><span className="tag">{data.classe}</span></div>
        </div>
        <div className="td-score"><HoursBadge hours={t.hours} /><span className="small muted">d'absence au total</span></div>
      </div>
      <div className="grid-cards">
        <Stat icon={Clock} value={fmtHours(t.hours)} label={`Heures d'absence · ${t.absences} cours manqué${t.absences > 1 ? 's' : ''}`} tone={t.hours >= 10 ? 'red' : ''} />
        <Stat icon={CheckCircle2} value={fmtHours(t.justifiedHours)} label="Justifiées" tone="green" />
        <Stat icon={UserX} value={fmtHours(t.unjustifiedHours)} label="Non justifiées" tone={t.unjustifiedHours > 0 ? 'red' : 'gray'} />
        <Stat icon={CalendarX2} value={t.retards} label={`Retard${t.retards > 1 ? 's' : ''}`} tone="gray" />
      </div>
      <div className="card">
        <div className="card-header"><h2>Absences et retards</h2><span className="small muted">{data.items.length} au total</span></div>
        {!data.items.length ? <Empty icon={CheckCircle2} title="Aucune absence">Cet étudiant a été présent à tous les cours où l'appel a été fait.</Empty> : (
          <div className="abs-list">
            {data.items.map((it) => (
              <div key={it.attendanceId} className={`abs-item ${it.status} ${it.justified ? 'is-justified' : ''}`}>
                <div className="abs-when">
                  <strong>{fmtCourseDay(it.date)}</strong>
                  <span className="small muted">{it.start} - {it.end} · {fmtHours(it.hours)}</span>
                </div>
                <div className="abs-what">
                  <span>{it.matiere}</span>
                  <span className="small muted">{it.teacher}{it.reason ? ` · Motif : ${it.reason}` : ''}</span>
                </div>
                {it.pending ? <span className="abs-tag pending">Justificatif en vérification</span> : <StatusTag status={it.status} justified={it.justified} />}
                {data.canJustify && it.status === 'absent' && !it.pending && (
                  editing === it.attendanceId ? (
                    <div className="abs-justify">
                      <input className="input" autoFocus placeholder="Motif (certificat médical, convocation...)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
                      <button className="btn btn-primary btn-sm" onClick={() => justify(it, true)}>Valider</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setReason('') }}>Annuler</button>
                    </div>
                  ) : it.justified
                    ? <button className="btn btn-ghost btn-sm" onClick={() => justify(it, false)}><Undo2 size={14} /> Retirer la justification</button>
                    : <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(it.attendanceId); setReason('') }}><CheckCircle2 size={14} /> Justifier</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {data.requests?.length > 0 && (
        <div className="stack-sm">
          <h2 className="eval-section-title">Justificatifs envoyés par l'étudiant</h2>
          {data.requests.map((j) => <JustificationCard key={j.id} j={j} showStudent={false} canReview={data.canJustify} onDone={reload} />)}
        </div>
      )}
    </section>
  )
}

// Une classe : appels faits, heures d'absence de chaque étudiant
function ClassAbsences({ classeId, onOpen }) {
  const { data, loading, error } = useAsync(() => api.absenceSummary(classeId), [classeId])
  const [sort, setSort] = useState('hours')
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="dashboard" />
  const rows = [...data.rows].sort((a, b) => (sort === 'name' ? a.student.lastName.localeCompare(b.student.lastName) : b[sort] - a[sort] || a.student.lastName.localeCompare(b.student.lastName)))
  const withAbs = data.rows.filter((r) => r.hours > 0).length
  const exportCsv = () => downloadCsv(`absences-${data.classe.name.replace(/\s+/g, '-')}.csv`, rows.map((r) => ({
    Matricule: r.student.matricule, Nom: r.student.lastName, Prénom: r.student.firstName,
    'Heures d\'absence': String(r.hours).replace('.', ','), 'Dont justifiées': String(r.justifiedHours).replace('.', ','),
    'Non justifiées': String(r.unjustifiedHours).replace('.', ','), 'Cours manqués': r.absences, Retards: r.retards,
  })))
  return (
    <div className="stack">
      <div className="grid-cards">
        <Stat icon={Users} value={data.sessions} label={`Appel${data.sessions > 1 ? 's' : ''} fait${data.sessions > 1 ? 's' : ''} · ${fmtHours(data.courseHours)} de cours`} />
        <Stat icon={Clock} value={fmtHours(data.totalHours)} label="Heures d'absence (toute la classe)" tone={data.totalHours > 0 ? 'red' : 'gray'} />
        <Stat icon={UserX} value={`${withAbs} / ${data.rows.length}`} label="Étudiants avec au moins une absence" tone="gray" />
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Étudiants de {data.classe.name}</h2>
          <div className="row-wrap">
            <select className="select" style={{ width: 'auto', minHeight: 34 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
              <option value="hours">Trier par heures d'absence</option>
              <option value="unjustifiedHours">Trier par heures non justifiées</option>
              <option value="retards">Trier par retards</option>
              <option value="name">Trier par nom</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!rows.length}><Download size={14} /> Exporter (Excel)</button>
          </div>
        </div>
        <ResponsiveTable
          rowKey="key"
          rows={rows.map((r) => ({ ...r, key: r.student.id }))}
          onRowClick={(r) => onOpen(r.student.id)}
          empty={<Empty icon={Users} title="Aucun étudiant dans cette classe" />}
          columns={[
            { key: 'student', label: 'Étudiant', primary: true, render: (r) => <span className="row" style={{ gap: 10 }}><Avatar name={r.student.fullName} size={32} /><span><strong style={{ fontWeight: 600 }}>{r.student.fullName}</strong><span className="small muted" style={{ display: 'block' }}>{r.student.matricule}</span></span></span> },
            { key: 'hours', label: 'Heures d\'absence', render: (r) => <HoursBadge hours={r.hours} /> },
            { key: 'just', label: 'Justifiées', hideMobile: true, render: (r) => <span className="small">{fmtHours(r.justifiedHours)}</span> },
            { key: 'unjust', label: 'Non justifiées', render: (r) => <span className={`small ${r.unjustifiedHours > 0 ? 'abs-red' : 'muted'}`}>{fmtHours(r.unjustifiedHours)}</span> },
            { key: 'retards', label: 'Retards', hideMobile: true, render: (r) => r.retards },
            { key: 'actions', label: '', className: 'actions', render: (r) => <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onOpen(r.student.id) }}>Détail <ChevronRight size={14} /></button> },
          ]}
        />
      </div>
      {data.sessions === 0 && <p className="small muted">Aucun appel n'a encore été fait dans cette classe : les heures d'absence apparaîtront dès le premier appel d'un enseignant.</p>}
    </div>
  )
}

// Éducateur : choix des classes qu'il suit (elles apparaissent en premier)
function MyClassesForm({ classes, onClose, onSaved }) {
  const toast = useToast()
  const [ids, setIds] = useState(classes.filter((c) => c.mine).map((c) => c.id))
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try { await api.setSupervisedClasses(ids); toast.success('Vos classes sont enregistrées.'); onSaved(); onClose() } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal wide title="Les classes que je suis" onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>Enregistrer</button>
    </>}>
      <p className="small muted" style={{ marginTop: 0 }}>Cochez les classes dont vous êtes l'éducateur : elles apparaissent en premier, et les justificatifs de leurs étudiants vous sont signalés. Vous gardez l'accès à toutes les classes.</p>
      <ClassPicker classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level }))} value={ids} onChange={setIds} />
    </Modal>
  )
}

// Choix de la classe (par niveau), puis la classe ou la fiche d'un étudiant (dans l'adresse : ?classe=&etudiant=)
export function AbsencesBrowser() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => api.absenceOverview(), [])
  const [choosing, setChoosing] = useState(false)
  const [params, setParams] = useSearchParams()
  const setP = (p, push = false) => setParams((cur) => { const n = new URLSearchParams(cur); for (const [k, v] of Object.entries(p)) (v == null ? n.delete(k) : n.set(k, v)); return n }, { replace: !push })
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="list" />
  if (!data.length) return <div className="card"><Empty icon={Users} title="Aucune classe">Aucune classe ne vous est affectée pour le moment.</Empty></div>
  const mine = data.filter((c) => c.mine)
  const classeId = Number(params.get('classe')) || (mine[0] || data.find((c) => c.sessions > 0) || data.find((c) => c.students > 0) || data[0]).id
  const studentId = Number(params.get('etudiant')) || null
  const view = params.get('vue')
  const groups = [...LEVELS, ...new Set(data.map((c) => c.level).filter((l) => !LEVELS.includes(l)))]
    .map((l) => ({ level: l, list: data.filter((c) => c.level === l) })).filter((g) => g.list.length)

  if (studentId) return <StudentDetail key={studentId} studentId={studentId} onBack={() => setP({ etudiant: null }, true)} />
  return (
    <div className="stack">
      <div className="abs-picker">
        <label htmlFor="abs-classe" className="label">Classe</label>
        <select id="abs-classe" className="select" value={classeId} onChange={(e) => setP({ classe: e.target.value, etudiant: null })}>
          {mine.length > 0 && (
            <optgroup label="Mes classes">
              {mine.map((c) => <option key={`m${c.id}`} value={c.id}>{c.name} · {c.students} étudiant{c.students > 1 ? 's' : ''} · {c.sessions} appel{c.sessions > 1 ? 's' : ''}</option>)}
            </optgroup>
          )}
          {groups.map((g) => (
            <optgroup key={g.level} label={LEVEL_NAMES[g.level] || g.level}>
              {g.list.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.students} étudiant{c.students > 1 ? 's' : ''} · {c.sessions} appel{c.sessions > 1 ? 's' : ''}</option>)}
            </optgroup>
          ))}
        </select>
        {user?.role === 'educator' && <button className="btn btn-secondary btn-sm" onClick={() => setChoosing(true)}>Mes classes{mine.length ? ` (${mine.length})` : ''}</button>}
      </div>
      {choosing && <MyClassesForm classes={data} onClose={() => setChoosing(false)} onSaved={reload} />}
      <div className="eval-tabs" role="tablist">
        <button role="tab" aria-selected={view !== 'cahier'} className={view !== 'cahier' ? 'on' : ''} onClick={() => setP({ vue: null })}>Heures d'absence</button>
        <button role="tab" aria-selected={view === 'cahier'} className={view === 'cahier' ? 'on' : ''} onClick={() => setP({ vue: 'cahier' })}>Cahier d'appels (semaine)</button>
      </div>
      {view === 'cahier'
        ? <AttendanceSheet key={classeId} classeId={classeId} />
        : <ClassAbsences key={classeId} classeId={classeId} onOpen={(id) => setP({ classe: classeId, etudiant: id }, true)} />}
    </div>
  )
}
