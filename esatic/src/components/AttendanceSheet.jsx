// Cahier d'appels d'une classe pour une semaine, au format de la feuille papier de l'ESATIC :
// N°, NOM, PRÉNOMS, STATUT, puis lundi au samedi (MATIN 1 et 2, SOIR 3). Absent : son numéro d'ordre dans la
// case ; présent : un point ; retard : « R ». En bas : matière et enseignant de chaque créneau, visa.
import { Fragment, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Stamp, Undo2 } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { ErrorBox, Loader, useAsync } from './ui.jsx'
import { LEVEL_NAMES } from '../api/seed.js'
import { fmtDateTime } from '../lib/format.js'

const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const short = (d) => { const [y, m, j] = d.split('-'); return `${j}/${m}/${y}` }
const hm = (s) => s.replace(':', ' h ')
const ORD = (n) => (n === 1 ? '1ère' : `${n}ème`)
// « LICENCE, 3ème année », « MASTER, 1ère année », « CLASSE PRÉPARATOIRE, 2ème année »
function gradeLabel(level) {
  const m = /^([LM])(\d)$/.exec(level || '')
  if (m) return `${m[1] === 'L' ? 'LICENCE' : 'MASTER'}, ${ORD(Number(m[2]))} année`
  const p = /^Prépa (\d)$/.exec(level || '')
  if (p) return `CLASSE PRÉPARATOIRE, ${ORD(Number(p[1]))} année`
  return LEVEL_NAMES[level] || level || ''
}
// Groupe : la lettre de la classe (SRIT 2 A -> A)
const groupOf = (name) => { const m = /\s([A-Z])$/.exec(name || ''); return m ? m[1] : '' }

export default function AttendanceSheet({ classeId }) {
  const toast = useToast()
  const [week, setWeek] = useState('')
  const { data, loading, error, reload } = useAsync(() => api.attendanceWeek(classeId, week), [classeId, week])
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader variant="table" />
  const cols = data.days.flatMap((d) => d.slots.map((s) => ({ ...s, date: d.date })))

  async function visa(value) {
    try { await api.visaAttendanceWeek(classeId, data.monday, value); toast.success(value ? 'Feuille de la semaine visée.' : 'Visa retiré.'); reload() } catch (e) { toast.error(e.message) }
  }

  function cell(s, st) {
    const v = s.records?.[st.id]
    if (!s.done) return ''
    if (v === 'absent') return <span className={`sheet-abs ${s.justified.includes(String(st.id)) ? 'just' : ''}`} title={s.justified.includes(String(st.id)) ? 'Absence justifiée' : 'Absent'}>{st.n}</span>
    if (v === 'retard') return <span className="sheet-ret" title="Retard">R</span>
    return ''
  }

  return (
    <div className="stack">
      <div className="sheet-tools no-print">
        <div className="row-wrap">
          <button className="btn btn-secondary btn-sm" onClick={() => setWeek(data.previous)}><ChevronLeft size={15} /> Semaine précédente</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeek(data.next)}>Semaine suivante <ChevronRight size={15} /></button>
          {week && <button className="btn btn-ghost btn-sm" onClick={() => setWeek('')}>Cette semaine</button>}
        </div>
        <div className="row-wrap">
          {data.canVisa && (data.visa
            ? <button className="btn btn-ghost btn-sm" onClick={() => visa(false)}><Undo2 size={14} /> Retirer le visa</button>
            : <button className="btn btn-primary btn-sm" onClick={() => visa(true)}><Stamp size={15} /> Viser la feuille</button>)}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={15} /> Imprimer ou enregistrer en PDF</button>
        </div>
      </div>

      <div className="card sheet print-area">
        <div className="sheet-head">
          <img src="/img/logo-esatic.svg" alt="ESATIC" className="sheet-logo" />
          <div className="sheet-title"><strong>CAHIER D'APPELS</strong></div>
          <div className="sheet-code">
            <span>Code : EN/PR1/08</span>
            <span>Version : 03</span>
            <span>Crée-le : 29/01/2021</span>
            <span>Modifié le : 12/05/2022</span>
            <span>Page : 1 / 1</span>
          </div>
        </div>
        <div className="sheet-sub">
          <span className="sheet-week">Semaine du <b>{short(data.monday)}</b> au <b>{short(data.saturday)}</b></span>
          <div className="sheet-meta">
            <span><b>Grade et Niveau :</b> {gradeLabel(data.classe.level)}</span>
            <span><b>Filière :</b> {data.classe.filiere}</span>
            <span><b>Groupe :</b> {groupOf(data.classe.name) || '..........'} <span className="muted no-print-hide">({data.classe.name})</span></span>
          </div>
        </div>
        <div className="sheet-scroll">
          <table className="sheet-table">
            <thead>
              <tr>
                <th rowSpan={3} className="c-n">N°</th>
                <th rowSpan={3} className="c-nom">NOM</th>
                <th rowSpan={3} className="c-prenom">PRÉNOMS</th>
                <th rowSpan={3} className="c-sta">STA<br />TUT</th>
                {data.days.map((d, i) => <th key={d.date} colSpan={d.slots.length} className="c-day">{DAY_NAMES[i]}</th>)}
              </tr>
              <tr>
                {data.days.map((d) => (
                  <Fragment key={d.date}>
                    <th colSpan={d.slots.filter((s) => s.slot < 3).length} className="c-half">MATIN</th>
                    {d.slots.some((s) => s.slot === 3) && <th className="c-half">SOIR</th>}
                  </Fragment>
                ))}
              </tr>
              <tr>{cols.map((c) => <th key={`${c.date}-${c.slot}`} className="c-slot">{c.slot}</th>)}</tr>
            </thead>
            <tbody>
              {data.roster.map((st) => (
                <tr key={st.id}>
                  <td className="c-n">{st.n}</td>
                  <td className="c-nom">{st.lastName.toUpperCase()}</td>
                  <td className="c-prenom">{st.firstName.toUpperCase()}</td>
                  <td className="c-sta">{st.statut}</td>
                  {cols.map((c) => <td key={`${c.date}-${c.slot}`} className={`c-cell ${c.done ? 'done' : ''}`}>{cell(c, st)}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="sheet-sign">
                <td colSpan={4} className="c-label">Intitulé de la matière et émargement de l'Enseignant(e)</td>
                {cols.map((c) => <td key={`${c.date}-${c.slot}`} className="c-sign">{c.done && <span><b>{c.matiere}</b>{c.teacher}</span>}</td>)}
              </tr>
              <tr>
                <td colSpan={4} className="c-label">Visa de l'Administration</td>
                <td colSpan={cols.length} className="c-visa">{data.visa ? <span className="sheet-stamp"><Stamp size={14} /> Visé par {data.visa.by} le {fmtDateTime(data.visa.at)}</span> : <span className="muted small">Non visée</span>}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="sheet-notes">
          <p>En cas d'absence de l'étudiant(e), veuillez inscrire en regard de son nom, son numéro d'ordre dans la case correspondante. Si non, ne rien écrire en cas de présence de l'étudiant(e).</p>
          <p className="sheet-nb"><b>NB : 1 = {hm(data.slots[1][0]).replace(/^0/, '')} - {hm(data.slots[1][1])} ; 2 = {hm(data.slots[2][0])} - {hm(data.slots[2][1])} et 3 = {hm(data.slots[3][0])} - {hm(data.slots[3][1])}</b></p>
          <p><b><i>Pour Statut : N = Nouveau dans la classe ; R = Redouble la classe ; ou A = Autorisé à s'inscrire dans la classe (dans ce cas, l'étudiant est aussi inscrit dans la classe précédente comme Redoublant).</i></b></p>
          <p className="sheet-smq">SMQ/ESATIC/PR1 : Assurer la sélection et la gestion des apprenants</p>
          <p className="sheet-legend no-print">Sur la plateforme : « R » = retard ; numéro en vert = absence justifiée.</p>
        </div>
      </div>
    </div>
  )
}
