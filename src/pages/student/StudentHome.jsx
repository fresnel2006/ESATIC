import { Link, useNavigate } from 'react-router-dom'
import { FileBadge, Megaphone, CalendarClock, Files, ChartColumn, GraduationCap } from 'lucide-react'
import * as api from '../../api/index.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Empty, ErrorBox, Loader, StatusBadge, useAsync } from '../../components/ui.jsx'
import { ExamCodeForm, useNow, deadlineText } from '../../components/student.jsx'
import { fmtCountdown, fmtLongDay, fmtAgo, fmtNote } from '../../lib/format.js'

function NowCard({ a }) {
  const now = useNow(30000)
  const navigate = useNavigate()
  if (!a) {
    return (
      <div className="card now-card">
        <GraduationCap className="watermark" size={170} strokeWidth={1} />
        <div className="label">À faire maintenant</div>
        <h2>Rien à rendre pour le moment</h2>
        <div className="meta">Les prochains devoirs et examens apparaîtront ici.</div>
      </div>
    )
  }
  const target = a.kind === 'examen' ? a.startAt : a.endAt
  const ms = new Date(target).getTime() - now
  const examLive = a.kind === 'examen' && a.sessionStatus === 'ouverte'
  let countLabel
  if (a.kind === 'examen') countLabel = examLive ? 'Session ouverte' : ms > 0 ? `Commence dans ${fmtCountdown(ms)}` : 'En attente du surveillant'
  else countLabel = `Il reste ${fmtCountdown(ms)}`
  return (
    <div className="card now-card">
      <GraduationCap className="watermark" size={170} strokeWidth={1} />
      <div className="label">À faire maintenant - {a.kind === 'examen' ? 'Examen' : 'Devoir'}</div>
      <h2>{a.title}</h2>
      <div className="meta">{a.matiere} - {deadlineText(a)}</div>
      <div className="row" style={{ marginTop: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="count">{countLabel}</div>
        <button className="btn" onClick={() => navigate(`/etudiant/epreuve/${a.id}`)}>
          {a.studentStatus === 'en_cours' ? 'Reprendre' : a.kind === 'examen' ? 'Voir l\'examen' : 'Commencer'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, link, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>{title}</h2>
        {link && <Link className="card-link" to={link}>Tout voir</Link>}
      </div>
      <div style={{ paddingTop: 10 }}>{children}</div>
    </div>
  )
}

export default function StudentHome() {
  const { user } = useAuth()
  const { data, loading, error } = useAsync(() => api.studentHome(), [])

  return (
    <div className="stack">
      <div className="hello">
        <h1>Bonjour {user.firstName}</h1>
        <p>{fmtLongDay()}{data?.classe ? ` - ${data.classe}` : ''}</p>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : data && (
        <div className="home-grid">
          <div className="home-col">
            <NowCard a={data.next} />
            <div className="card"><div className="card-body"><ExamCodeForm /></div></div>
            <Section title="Devoirs à rendre" link="/etudiant/devoirs">
              {data.devoirs.length === 0 ? <Empty icon={Files} title="Aucun devoir en cours" /> : (
                <div className="list-rows">
                  {data.devoirs.map((a) => (
                    <Link key={a.id} to={`/etudiant/epreuve/${a.id}`} className="list-row">
                      <div className="grow">
                        <div className="t">{a.title}</div>
                        <div className="s">{a.matiere} - {deadlineText(a)}</div>
                      </div>
                      <StatusBadge status={a.studentStatus} />
                    </Link>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Examens à venir" link="/etudiant/examens">
              {data.examens.length === 0 ? <Empty icon={CalendarClock} title="Aucun examen programmé" /> : (
                <div className="list-rows">
                  {data.examens.map((a) => (
                    <Link key={a.id} to={`/etudiant/epreuve/${a.id}`} className="list-row">
                      <div className="grow">
                        <div className="t">{a.title}</div>
                        <div className="s">{deadlineText(a)}{a.room ? ` - ${a.room}` : ''}</div>
                      </div>
                      {a.sessionStatus === 'ouverte' ? <StatusBadge status="en_cours" label="Session ouverte" /> : <StatusBadge status={a.studentStatus} />}
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>
          <div className="home-col">
            <Section title="Derniers résultats" link="/etudiant/resultats">
              {data.results.length === 0 ? <Empty icon={ChartColumn} title="Aucune note publiée" /> : (
                <div className="list-rows">
                  {data.results.map((r) => (
                    <Link key={r.attemptId} to={`/etudiant/resultats/${r.attemptId}`} className="list-row">
                      <div className="grow">
                        <div className="t">{r.title}</div>
                        <div className="s">{r.matiere}</div>
                      </div>
                      <span className="note-big">{fmtNote(r.note20)}<small>/20</small></span>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
            {data.bulletin && (
              <div className="card"><div className="card-body row">
                <FileBadge size={28} strokeWidth={1.4} color="var(--primary)" />
                <div className="grow"><strong>Bulletin disponible</strong><div className="small muted">{data.bulletin.periode}</div></div>
                <Link className="btn btn-primary btn-sm" to="/etudiant/resultats?onglet=bulletins">Consulter</Link>
              </div></div>
            )}
            <Section title="Annonces de l'école" link="/etudiant/annonces">
              {data.announcements.length === 0 ? <Empty icon={Megaphone} title="Aucune annonce" /> : (
                <div className="list-rows">
                  {data.announcements.map((n) => (
                    <Link key={n.id} to="/etudiant/annonces" className="list-row">
                      <div className="grow">
                        <div className="t">{n.title}</div>
                        <div className="s">{n.author} - {fmtAgo(n.createdAt)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}
