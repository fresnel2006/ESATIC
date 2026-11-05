import { Link } from 'react-router-dom'
import { Plus, ClipboardCheck, FolderKanban, FilePen, CircleCheck } from 'lucide-react'
import * as api from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Empty, ErrorBox, Loader, Stat, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { fmtLongDay, fmtRelativeDay } from '../../lib/format.js'
import { useNow } from '../../components/student.jsx'

export default function TeacherHome() {
  const { user } = useAuth()
  const { data, loading, error } = useAsync(() => api.listAssessments(), [])
  const list = data || []
  const toGrade = list.reduce((n, a) => n + a.toGrade, 0)
  const t = useNow(60000)
  const live = list.filter((a) => a.status === 'publie' && new Date(a.endAt).getTime() > t).sort((x, y) => (x.endAt > y.endAt ? 1 : -1))
  const drafts = list.filter((a) => a.status === 'brouillon')

  return (
    <div className="stack">
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <div className="hello">
          <h1>Bonjour {user.firstName}</h1>
          <p>{fmtLongDay()}</p>
        </div>
        <Link to="/enseignant/epreuves/nouvelle" className="btn btn-primary"><Plus {...ICON} /> Nouvelle épreuve</Link>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <>
          <div className="grid-cards">
            <Stat icon={FolderKanban} value={live.length} label="Épreuves en cours" />
            <Stat icon={ClipboardCheck} value={toGrade} label="Copies à corriger" tone="gray" />
            <Stat icon={FilePen} value={drafts.length} label="Brouillons" tone="gray" />
            <Stat icon={CircleCheck} value={list.filter((a) => a.resultsPublished).length} label="Notes publiées" tone="green" />
          </div>
          <div className="home-grid">
            <div className="card">
              <div className="card-header"><h2>Épreuves en cours</h2><Link className="card-link" to="/enseignant/epreuves">Tout voir</Link></div>
              <div style={{ paddingTop: 10 }}>
                {live.length === 0 ? <Empty icon={FolderKanban} title="Aucune épreuve en cours" /> : (
                  <div className="list-rows">
                    {live.map((a) => (
                      <Link key={a.id} to={`/enseignant/epreuves/${a.id}`} className="list-row">
                        <div className="grow">
                          <div className="t">{a.title}</div>
                          <div className="s">{a.classe} - {a.kind === 'examen' ? `examen ${fmtRelativeDay(a.startAt).toLowerCase()}` : `à rendre ${fmtRelativeDay(a.endAt).toLowerCase()}`}</div>
                        </div>
                        <span className="small muted nowrap">{a.submitted}/{a.classSize} rendus</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2>À corriger</h2><Link className="card-link" to="/enseignant/corrections">Corrections</Link></div>
              <div style={{ paddingTop: 10 }}>
                {list.filter((a) => a.toGrade).length === 0 ? <Empty icon={ClipboardCheck} title="Aucune copie en attente" /> : (
                  <div className="list-rows">
                    {list.filter((a) => a.toGrade).map((a) => (
                      <Link key={a.id} to={`/enseignant/corrections?epreuve=${a.id}`} className="list-row">
                        <div className="grow"><div className="t">{a.title}</div><div className="s">{a.classe}</div></div>
                        <StatusBadge status="rendu" label={`${a.toGrade} à corriger`} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
