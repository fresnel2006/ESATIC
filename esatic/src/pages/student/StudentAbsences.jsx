// Étudiant : ses heures d'absence et ses retards, d'après les appels des enseignants
import { CalendarX2, CheckCircle2, Clock, UserX } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, Notice, PageHead, Stat, useAsync } from '../../components/ui.jsx'
import { StatusTag, fmtCourseDay, fmtHours } from '../../components/AbsenceWidgets.jsx'

export default function StudentAbsences() {
  const { data, loading, error } = useAsync(() => api.myAbsences(), [])
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
          {data.totals.unjustifiedHours > 0 && <Notice>Pour justifier une absence, présentez votre justificatif (certificat médical, convocation...) aux éducateurs ou à la direction pédagogique.</Notice>}
          <div className="card">
            <div className="card-header"><h2>Absences et retards</h2></div>
            {!data.items.length ? <Empty icon={CheckCircle2} title="Aucune absence">Vous avez été présent à tous les cours où l'appel a été fait.</Empty> : (
              <div className="abs-list">
                {data.items.map((it) => (
                  <div key={it.attendanceId} className={`abs-item ${it.status} ${it.justified ? 'is-justified' : ''}`}>
                    <div className="abs-when"><strong>{fmtCourseDay(it.date)}</strong><span className="small muted">{it.start} - {it.end} · {fmtHours(it.hours)}</span></div>
                    <div className="abs-what"><span>{it.matiere}</span><span className="small muted">{it.teacher}{it.reason ? ` · Motif : ${it.reason}` : ''}</span></div>
                    <StatusTag status={it.status} justified={it.justified} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
