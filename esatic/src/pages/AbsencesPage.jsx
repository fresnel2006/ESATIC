// Direction pédagogique, éducateurs, administration : heures d'absence par classe et par étudiant,
// vérification des billets de justification envoyés par les étudiants
import { useSearchParams } from 'react-router-dom'
import * as api from '../api/index.js'
import { PageHead, useAsync } from '../components/ui.jsx'
import { AbsencesBrowser } from '../components/AbsenceWidgets.jsx'
import { JustificationQueue } from '../components/JustificationWidgets.jsx'

export default function AbsencesPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') || 'classes'
  const pending = useAsync(() => api.listJustifications('en_attente'), [tab])
  const n = pending.data?.pendingCount ?? 0
  const go = (onglet) => setParams(onglet === 'classes' ? {} : { onglet })
  return (
    <div>
      <PageHead title="Absences" subtitle="Heures d'absence de chaque étudiant, calculées à partir des appels faits par les enseignants" />
      <div className="eval-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button role="tab" aria-selected={tab === 'classes'} className={tab === 'classes' ? 'on' : ''} onClick={() => go('classes')}>Absences par classe</button>
        <button role="tab" aria-selected={tab === 'justificatifs'} className={tab === 'justificatifs' ? 'on' : ''} onClick={() => go('justificatifs')}>
          Justificatifs à vérifier {n > 0 && <span className="tab-count">{n}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'traites'} className={tab === 'traites' ? 'on' : ''} onClick={() => go('traites')}>Justificatifs traités</button>
      </div>
      {tab === 'classes' && <AbsencesBrowser />}
      {tab === 'justificatifs' && <JustificationQueue status="en_attente" />}
      {tab === 'traites' && (
        <div className="stack">
          <div className="row-wrap">
            <button className={`btn btn-sm ${params.get('etat') !== 'refusee' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setParams({ onglet: 'traites' })}>Acceptés</button>
            <button className={`btn btn-sm ${params.get('etat') === 'refusee' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setParams({ onglet: 'traites', etat: 'refusee' })}>Refusés</button>
          </div>
          <JustificationQueue key={params.get('etat') || 'acceptee'} status={params.get('etat') === 'refusee' ? 'refusee' : 'acceptee'} />
        </div>
      )}
    </div>
  )
}
