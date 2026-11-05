import { useSearchParams, useNavigate } from 'react-router-dom'
import { ChartColumn, FileBadge } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, ResponsiveTable, Tabs, useAsync } from '../../components/ui.jsx'
import { fmtShort, fmtNote } from '../../lib/format.js'

export default function StudentResultats() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') === 'bulletins' ? 'bulletins' : 'notes'
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(() => api.studentResults(), [])

  const byMatiere = {}
  for (const r of data || []) (byMatiere[r.matiere] ||= []).push(r.note20)

  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.15rem' }}>Mes résultats</h1>
      <Tabs
        value={tab}
        onChange={(v) => setParams(v === 'notes' ? {} : { onglet: v })}
        items={[{ value: 'notes', label: 'Notes' }, { value: 'bulletins', label: 'Bulletins' }]}
      />
      <ErrorBox error={error} />
      {tab === 'notes' && (loading && !data ? <Loader /> : (
        <>
          {Object.keys(byMatiere).length > 0 && (
            <div className="grid-cards">
              {Object.entries(byMatiere).map(([m, notes]) => (
                <div className="card stat" key={m}>
                  <div className="k">{m}</div>
                  <div className="v">{fmtNote(Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10)}<span className="muted small">/20</span></div>
                  <div className="k">{notes.length} note{notes.length > 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <ResponsiveTable
              rowKey="attemptId"
              rows={data || []}
              onRowClick={(r) => navigate(`/etudiant/resultats/${r.attemptId}`)}
              empty={<Empty icon={ChartColumn} title="Aucune note publiée">Les notes apparaissent ici dès que l'enseignant les publie.</Empty>}
              columns={[
                { key: 'title', label: 'Épreuve', primary: true },
                { key: 'matiere', label: 'Matière' },
                { key: 'kind', label: 'Type', render: (r) => (r.kind === 'examen' ? 'Examen' : 'Devoir') },
                { key: 'gradedAt', label: 'Publiée le', render: (r) => fmtShort(r.gradedAt) },
                { key: 'score', label: 'Points', render: (r) => `${fmtNote(r.score)} / ${r.maxScore}` },
                { key: 'note20', label: 'Note', render: (r) => <strong>{fmtNote(r.note20)}/20</strong> },
              ]}
            />
          </div>
        </>
      ))}
      {tab === 'bulletins' && <BulletinsTab />}
    </div>
  )
}

function BulletinsTab() {
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(() => api.studentBulletins(), [])
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader />
  return (
    <div className="card">
      <ResponsiveTable
        rows={data}
        onRowClick={(b) => navigate(`/etudiant/bulletins/${b.id}`)}
        empty={<Empty icon={FileBadge} title="Aucun bulletin publié">Votre bulletin sera visible ici lorsque l'administration l'aura publié. Vous pourrez alors le télécharger en PDF.</Empty>}
        columns={[
          { key: 'periode', label: 'Période', primary: true, render: (b) => <strong style={{ fontWeight: 600 }}>{b.periode}</strong> },
          { key: 'classe', label: 'Classe' },
          { key: 'general', label: 'Moyenne générale', render: (b) => <strong>{fmtNote(b.general)}/20</strong> },
          { key: 'mention', label: 'Mention' },
          { key: 'updatedAt', label: 'Publié le', render: (b) => `${fmtShort(b.updatedAt)}${b.version > 1 ? ` (version ${b.version})` : ''}` },
          { key: 'actions', label: '', className: 'actions', render: (b) => <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/etudiant/bulletins/${b.id}`) }}>Consulter</button> },
        ]}
      />
    </div>
  )
}
