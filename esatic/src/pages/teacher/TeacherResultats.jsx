import { useSearchParams, Link } from 'react-router-dom'
import { ChartColumn, Download } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, PageHead, ResponsiveTable, RiskBadge, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { downloadCsv, fmtNote } from '../../lib/format.js'

export default function TeacherResultats() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const list = useAsync(() => api.listAssessments(), [])
  const published = (list.data || []).filter((a) => a.status !== 'brouillon')
  const selected = params.get('epreuve') || published[0]?.id || ''
  const res = useAsync(() => (selected ? api.assessmentResults(selected) : Promise.resolve(null)), [selected])
  const r = res.data

  return (
    <div>
      <PageHead
        title="Résultats"
        subtitle="Notes par épreuve et par classe"
        actions={r && <>
          <button className="btn btn-secondary" onClick={() => downloadCsv(`notes-${r.assessment.title}.csv`, r.rows.map((x) => ({ Matricule: x.matricule, 'Nom et prénom': x.student, Classe: x.classe, Statut: x.status, Points: x.score ?? '', 'Note sur 20': x.note20 ?? '' })))}><Download {...ICON} /> Exporter (CSV)</button>
          {r.rows.some((x) => x.status === 'corrige') && (
            <button className="btn btn-primary" onClick={async () => { try { await api.publishResults(r.assessment.id, !r.assessment.resultsPublished); toast.success(r.assessment.resultsPublished ? 'Notes retirées.' : 'Notes publiées.'); res.reload() } catch (e) { toast.error(e.message) } }}>
              {r.assessment.resultsPublished ? 'Retirer la publication' : 'Publier les notes'}
            </button>
          )}
        </>}
      />
      <div className="filters">
        <select className="select" value={selected} onChange={(e) => setParams({ epreuve: e.target.value })} aria-label="Épreuve">
          {published.map((a) => <option key={a.id} value={a.id}>{a.title} - {a.classe}</option>)}
        </select>
      </div>
      <ErrorBox error={list.error || res.error} />
      {(list.loading || res.loading) && !r ? <Loader variant="dashboard" /> : !r ? <div className="card"><Empty icon={ChartColumn} title="Aucune épreuve publiée" /></div> : (
        <div className="stack">
          <div className="grid-cards">
            <div className="card stat"><div className="v">{r.stats ? fmtNote(r.stats.average) : '-'}</div><div className="k">Moyenne /20</div></div>
            <div className="card stat"><div className="v">{r.stats ? `${fmtNote(r.stats.min)} - ${fmtNote(r.stats.max)}` : '-'}</div><div className="k">Note min - max</div></div>
            <div className="card stat"><div className="v">{r.stats ? `${r.stats.passRate} %` : '-'}</div><div className="k">Notes supérieures ou égales à 10</div></div>
            <div className="card stat"><div className="v">{r.rows.filter((x) => x.status !== 'absent').length}/{r.rows.length}</div><div className="k">Copies rendues</div></div>
          </div>
          <p className="small muted">{r.assessment.resultsPublished ? 'Notes publiées : les étudiants les voient.' : 'Notes non publiées : les étudiants ne voient rien pour l\'instant.'}</p>
          <div className="card">
            <ResponsiveTable
              rowKey="studentId"
              rows={r.rows}
              columns={[
                { key: 'student', label: 'Étudiant', primary: true, render: (x) => <span>{x.student} <span className="muted small">{x.matricule}</span></span> },
                ...(new Set(r.rows.map((x) => x.classe)).size > 1 ? [{ key: 'classe', label: 'Classe', render: (x) => <span className="nowrap">{x.classe}</span> }] : []),
                { key: 'status', label: 'Statut', render: (x) => <StatusBadge status={x.status} /> },
                { key: 'risk', label: 'Risque', render: (x) => <RiskBadge value={x.risk} /> },
                { key: 'score', label: 'Points', render: (x) => (x.score === null ? '-' : `${fmtNote(x.score)} / ${r.assessment.maxPoints}`) },
                { key: 'note20', label: 'Note /20', render: (x) => <strong>{fmtNote(x.note20)}</strong> },
                { key: 'actions', label: '', className: 'actions', render: (x) => x.attemptId && x.status !== 'en_cours' ? <Link className="btn btn-ghost btn-sm" to={`/enseignant/corrections/${x.attemptId}`}>Voir la copie</Link> : null },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}
