// Enseignant : résultats de l'évaluation par les étudiants, après la clôture de chaque campagne.
// Anonyme : moyennes et commentaires seulement, à partir de 3 réponses.
import { ClipboardCheck, Clock } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, Notice, PageHead, useAsync } from '../../components/ui.jsx'
import { EvalResultCard } from '../../components/EvalWidgets.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function TeacherEvaluations() {
  const { data, loading, error } = useAsync(() => api.myEvalResults(), [])
  return (
    <div>
      <PageHead title="Mes évaluations" subtitle="Ce que vos étudiants pensent de vos cours, de façon anonyme" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="detail" /> : (
        <div className="stack">
          {data.pending.map((c) => (
            <Notice key={c.id}><Clock size={15} style={{ verticalAlign: '-2px' }} /> « {c.title} » est en cours jusqu'au {fmtDateTime(c.endAt)}. Vos résultats seront disponibles à sa clôture.</Notice>
          ))}
          {!data.results.length ? (
            !data.pending.length && <div className="card"><Empty icon={ClipboardCheck} title="Aucun résultat pour le moment">Vos résultats apparaîtront ici après la clôture d'une évaluation par la direction pédagogique.</Empty></div>
          ) : data.results.map((r) => (
            <div className="stack-sm" key={r.campaign.id}>
              <h2 className="eval-section-title">{r.campaign.title}<span className="small muted">{r.campaign.periode ? ` · ${r.campaign.periode}` : ''} · clôturée le {fmtDateTime(r.campaign.closedAt)}</span></h2>
              {!r.rows.length
                ? <div className="card"><div className="card-body small muted">Aucune réponse vous concernant dans cette évaluation.</div></div>
                : r.rows.map((row) => <EvalResultCard key={`${row.teacherId}-${row.matiereId}`} row={row} minResponses={data.minResponses} />)}
            </div>
          ))}
          <p className="small muted">Les réponses sont anonymes : vous ne voyez jamais qui a répondu. Les résultats ne s'affichent qu'à partir de {data.minResponses} réponses pour une matière.</p>
        </div>
      )}
    </div>
  )
}
