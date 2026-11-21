// Enseignant : faire l'appel d'un cours (présent, absent, retard), ses appels, et les absences de ses classes
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCheck, ClipboardList, Loader2, Save, Users } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Avatar, Empty, ErrorBox, Loader, Notice, PageHead, ResponsiveTable, useAsync, ICON } from '../../components/ui.jsx'
import { AbsencesBrowser, fmtCourseDay, fmtHours } from '../../components/AbsenceWidgets.jsx'
import { LEVEL_NAMES } from '../../api/seed.js'

const STATUSES = [['present', 'Présent'], ['absent', 'Absent'], ['retard', 'Retard']]
const hm = (s) => s.replace(':', ' h ')
// Créneau proposé selon l'heure : 1 le matin, 2 en fin de matinée, 3 l'après-midi (comme le cahier d'appels)
function currentSlot() {
  const m = new Date().getHours() * 60 + new Date().getMinutes()
  return m < 10 * 60 + 10 ? 1 : m < 13 * 60 + 30 ? 2 : 3
}
const weekday = (d) => new Date(`${d}T12:00:00Z`).getUTCDay()
const DAY = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const longDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function RollCall({ options, preset, onSaved }) {
  const toast = useToast()
  const first = options.classes[0]
  const [f, setF] = useState(() => preset || { classeId: first?.id ?? '', matiereId: first?.matieres[0]?.id ?? '', date: options.today, slot: currentSlot() })
  const [roster, setRoster] = useState(null)
  const [records, setRecords] = useState({})
  const [existing, setExisting] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const classe = options.classes.find((c) => c.id === Number(f.classeId))
  const set = (p) => setF((x) => ({ ...x, ...p }))

  // Liste de la classe et appel déjà fait sur ce créneau
  useEffect(() => {
    if (!f.classeId) return
    let alive = true
    api.getAttendance(f.classeId, f.date, f.slot).then((r) => {
      if (!alive) return
      setRoster(r.roster)
      setExisting(r.attendance)
      setRecords(r.attendance ? r.attendance.records : Object.fromEntries(r.roster.map((s) => [s.id, 'present'])))
      if (r.attendance) setF((x) => ({ ...x, matiereId: r.attendance.matiereId }))
    }).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [f.classeId, f.date, f.slot])

  const counts = useMemo(() => {
    const v = Object.values(records)
    return { present: v.filter((x) => x === 'present').length, absent: v.filter((x) => x === 'absent').length, retard: v.filter((x) => x === 'retard').length }
  }, [records])

  async function save() {
    setError(''); setBusy(true)
    try {
      const r = await api.saveAttendance({ classeId: Number(f.classeId), matiereId: Number(f.matiereId), date: f.date, slot: Number(f.slot), records })
      toast.success(`Appel enregistré : ${r.counts.absent} absent${r.counts.absent > 1 ? 's' : ''}, ${r.counts.retard} retard${r.counts.retard > 1 ? 's' : ''}.`)
      setExisting({ ...r, mine: true })
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  // L'appel se fait en classe, le jour du cours : un autre jour, on ne peut que corriger un appel déjà fait
  const notToday = f.date !== options.today
  const locked = (existing && !existing.mine) || (notToday && !existing)
  const days = options.week.includes(f.date) ? options.week : [...options.week, f.date].sort()
  const chooseDay = (d) => set({ date: d, slot: weekday(d) === 6 && Number(f.slot) === 3 ? 1 : f.slot })
  return (
    <div className="stack">
      <div className="card">
        <div className="card-body form-grid att-form">
          <div className="field">
            <label htmlFor="att-c">Classe</label>
            <select id="att-c" className="select" value={f.classeId} onChange={(e) => { const c = options.classes.find((x) => x.id === Number(e.target.value)); set({ classeId: Number(e.target.value), matiereId: c?.matieres[0]?.id ?? '' }) }}>
              {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({LEVEL_NAMES[c.level] || c.level})</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="att-m">Matière</label>
            <select id="att-m" className="select" value={f.matiereId} onChange={(e) => set({ matiereId: Number(e.target.value) })}>
              {(classe?.matieres || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="att-s">Créneau</label>
            <select id="att-s" className="select" value={f.slot} onChange={(e) => set({ slot: Number(e.target.value) })}>
              {Object.entries(options.slots).filter(([k]) => !(weekday(f.date) === 6 && k === '3')).map(([k, [a, b]]) => <option key={k} value={k}>{k} : {hm(a)} - {hm(b)}{k === '3' ? ' (soir)' : ' (matin)'}</option>)}
            </select>
          </div>
        </div>
        <div className="att-days" role="radiogroup" aria-label="Jour du cours">
          <span className="label">Jour du cours</span>
          <div className="att-days-row">
            {days.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={f.date === d} disabled={d > options.today}
                className={`att-day ${f.date === d ? 'on' : ''} ${d === options.today ? 'today' : ''}`} onClick={() => chooseDay(d)}>
                <b>{DAY[weekday(d)]}</b><span>{ddmm(d)}</span>{d === options.today && <em>Aujourd'hui</em>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="att-when"><b>{longDay(f.date)}</b> · créneau {f.slot} ({hm(options.slots[f.slot][0])} - {hm(options.slots[f.slot][1])}, {Number(f.slot) === 3 ? 'soir' : 'matin'})</div>
      {weekday(f.date) === 0 && <Notice kind="danger">Pas de cours le dimanche : choisissez un autre jour.</Notice>}
      {notToday && !existing && weekday(f.date) !== 0 && roster && <Notice>L'appel se fait en classe, le jour du cours. Aucun appel n'a été fait pour ce créneau ce jour-là ; vous pouvez seulement corriger un appel déjà fait (voir « Mes appels »).</Notice>}
      {existing && (locked
        ? <Notice kind="danger">L'appel de ce créneau a déjà été fait par {existing.teacher} ({existing.matiere}). Choisissez un autre créneau.</Notice>
        : <Notice>Vous avez déjà fait l'appel de ce cours ({existing.matiere}). Vous pouvez le corriger puis l'enregistrer à nouveau.</Notice>)}
      <ErrorBox error={error ? { message: error } : null} />

      {!roster ? <Loader variant="list" /> : !roster.length ? (
        <div className="card"><Empty icon={Users} title="Aucun étudiant dans cette classe" /></div>
      ) : (
        <div className="card att-card">
          <div className="card-header att-head">
            <div className="att-counts">
              <span className="att-count present"><b>{counts.present}</b> présent{counts.present > 1 ? 's' : ''}</span>
              <span className="att-count absent"><b>{counts.absent}</b> absent{counts.absent > 1 ? 's' : ''}</span>
              <span className="att-count retard"><b>{counts.retard}</b> retard{counts.retard > 1 ? 's' : ''}</span>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={!!locked} onClick={() => setRecords(Object.fromEntries(roster.map((s) => [s.id, 'present'])))}><CheckCheck size={15} /> Tous présents</button>
          </div>
          <div className="att-list">
            {roster.map((s, i) => (
              <div key={s.id} className={`att-row ${records[s.id] || 'present'}`}>
                <span className="att-num">{i + 1}</span>
                <Avatar name={s.name} size={36} />
                <span className="att-name"><strong>{s.name}</strong><span className="small muted">{s.matricule}</span></span>
                <div className="att-seg" role="radiogroup" aria-label={`Présence de ${s.name}`}>
                  {STATUSES.map(([k, label]) => (
                    <button key={k} type="button" role="radio" aria-checked={(records[s.id] || 'present') === k} disabled={locked}
                      className={`att-btn ${k} ${(records[s.id] || 'present') === k ? 'on' : ''}`}
                      onClick={() => setRecords((r) => ({ ...r, [s.id]: k }))}>{label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="att-foot">
            <span className="small muted">{classe?.name} · {fmtCourseDay(f.date)} · créneau {f.slot} ({hm(options.slots[f.slot][0])} - {hm(options.slots[f.slot][1])})</span>
            <button className="btn btn-primary" disabled={busy || locked || !f.matiereId || weekday(f.date) === 0} onClick={save}>{busy ? <Loader2 {...ICON} className="spin" /> : <Save {...ICON} />} {existing?.mine ? 'Enregistrer la correction' : 'Enregistrer l\'appel'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function History({ sessions, onOpen }) {
  return (
    <div className="card">
      <ResponsiveTable
        rowKey="id"
        rows={sessions}
        onRowClick={onOpen}
        empty={<Empty icon={ClipboardList} title="Aucun appel pour le moment">Vos appels apparaîtront ici.</Empty>}
        columns={[
          { key: 'date', label: 'Cours', primary: true, render: (a) => <span><strong style={{ fontWeight: 600 }}>{fmtCourseDay(a.date)}</strong><span className="small muted" style={{ display: 'block' }}>Créneau {a.slot} · {a.start} - {a.end} · {fmtHours(a.hours)}</span></span> },
          { key: 'classe', label: 'Classe', render: (a) => a.classe },
          { key: 'matiere', label: 'Matière', hideMobile: true, render: (a) => a.matiere },
          { key: 'absent', label: 'Absents', render: (a) => <span className={a.counts.absent ? 'abs-red' : 'muted'}>{a.counts.absent}</span> },
          { key: 'retard', label: 'Retards', hideMobile: true, render: (a) => a.counts.retard },
        ]}
      />
    </div>
  )
}

export default function TeacherAttendance() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') || 'appel'
  const { data: options, loading, error } = useAsync(() => api.attendanceOptions(), [])
  const history = useAsync(() => api.myAttendanceSessions(), [])
  const [preset, setPreset] = useState(null)
  const go = (onglet) => setParams(onglet === 'appel' ? {} : { onglet })

  return (
    <div>
      <PageHead title="Faire l'appel" subtitle="Présents, absents et retards de chaque cours : les heures d'absence de chaque étudiant se calculent automatiquement" />
      <div className="eval-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button role="tab" aria-selected={tab === 'appel'} className={tab === 'appel' ? 'on' : ''} onClick={() => go('appel')}>Faire l'appel</button>
        <button role="tab" aria-selected={tab === 'historique'} className={tab === 'historique' ? 'on' : ''} onClick={() => go('historique')}>Mes appels{history.data ? ` (${history.data.length})` : ''}</button>
        <button role="tab" aria-selected={tab === 'absences'} className={tab === 'absences' ? 'on' : ''} onClick={() => go('absences')}>Absences de mes classes</button>
      </div>
      <ErrorBox error={error} />
      {tab === 'appel' && (loading && !options ? <Loader variant="form" /> : !options.classes.length
        ? <div className="card"><Empty icon={Users} title="Aucune classe affectée">L'administration vous affecte vos classes et matières (fiche de l'enseignant). Vous pourrez ensuite faire l'appel.</Empty></div>
        : <RollCall key={preset ? `${preset.classeId}-${preset.date}-${preset.slot}` : 'nouveau'} options={options} preset={preset} onSaved={history.reload} />)}
      {tab === 'historique' && (history.loading && !history.data ? <Loader variant="list" />
        : <History sessions={history.data || []} onOpen={(a) => { setPreset({ classeId: a.classeId, matiereId: a.matiereId, date: a.date, slot: a.slot || 1 }); go('appel') }} />)}
      {tab === 'absences' && <AbsencesBrowser />}
    </div>
  )
}
