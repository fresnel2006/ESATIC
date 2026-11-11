import { Link } from 'react-router-dom'
import { UserPlus, Upload, GraduationCap, Presentation, ShieldCheck, School, FileStack, MonitorPlay, ClipboardCheck, UserX } from 'lucide-react'
import * as api from '../../api/index.js'
import { ErrorBox, Loader, PageHead, Stat, useAsync, ICON } from '../../components/ui.jsx'
import { fmtAgo, ACTION_LABELS } from '../../lib/format.js'

export default function AdminDashboard() {
  const { data, loading, error } = useAsync(() => api.adminStats(), [])
  return (
    <div>
      <PageHead
        title="Tableau de bord"
        subtitle="Vue d'ensemble de l'école"
        actions={<>
          <Link to="/admin/utilisateurs?import=1" className="btn btn-secondary"><Upload {...ICON} /> Importer des étudiants</Link>
          <Link to="/admin/utilisateurs?nouveau=1" className="btn btn-primary"><UserPlus {...ICON} /> Nouvel utilisateur</Link>
        </>}
      />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="dashboard" /> : data && (
        <div className="stack">
          <div className="grid-cards">
            <Stat icon={GraduationCap} value={data.students} label="Étudiants" />
            <Stat icon={Presentation} value={data.teachers} label="Enseignants" />
            <Stat icon={ShieldCheck} value={data.proctors} label="Surveillants" />
            <Stat icon={School} value={data.classes} label="Classes" />
            <Stat icon={FileStack} value={data.assessments} label="Épreuves publiées" tone="green" />
            <Stat icon={MonitorPlay} value={data.openSessions} label="Sessions d'examen ouvertes" tone="green" />
            <Stat icon={ClipboardCheck} value={data.toGrade} label="Copies en attente de correction" tone="gray" />
            <Stat icon={UserX} value={data.neverLogged} label="Étudiants jamais connectés" tone="gray" />
          </div>
          <div className="card">
            <div className="card-header"><h2>Activité récente</h2><Link className="card-link" to="/admin/journal">Journal complet</Link></div>
            <div className="list-rows" style={{ paddingTop: 10 }}>
              {data.recentAudit.map((a) => (
                <div className="list-row" key={a.id}>
                  <div className="grow">
                    <div className="t">{ACTION_LABELS[a.action] || a.action} - {a.target}</div>
                    <div className="s">{a.user?.fullName ?? 'Système'}{a.detail ? ` - ${a.detail}` : ''}</div>
                  </div>
                  <span className="small muted nowrap">{fmtAgo(a.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
