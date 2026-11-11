import { useState } from 'react'
import { FileStack } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, Modal, PageHead, Pills, ResponsiveTable, RiskBadge, StatusBadge, useAsync } from '../../components/ui.jsx'
import { fmtDateTime, fmtNote } from '../../lib/format.js'

function Results({ a, onClose }) {
  const { data, loading, error } = useAsync(() => api.assessmentResults(a.id), [a.id])
  return (
    <Modal wide title={a.title} onClose={onClose}>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : data && (
        <div className="stack">
          <p className="small muted">{a.classe} - {a.teacher} - {data.assessment.resultsPublished ? 'notes publiées' : 'notes non publiées'}{data.stats ? ` - moyenne ${fmtNote(data.stats.average)}/20` : ''}</p>
          <ResponsiveTable
            rowKey="studentId"
            rows={data.rows}
            columns={[
              { key: 'student', label: 'Étudiant', primary: true },
              { key: 'status', label: 'Statut', render: (x) => <StatusBadge status={x.status} /> },
              { key: 'risk', label: 'Risque', render: (x) => <RiskBadge value={x.risk} /> },
              { key: 'note20', label: 'Note /20', render: (x) => fmtNote(x.note20) },
            ]}
          />
        </div>
      )}
    </Modal>
  )
}

export default function AdminEpreuves() {
  const [tab, setTab] = useState('tous')
  const [open, setOpen] = useState(null)
  const { data, loading, error } = useAsync(() => api.listAssessments(), [])
  const rows = (data || []).filter((a) => tab === 'tous' || a.kind === tab || a.status === tab)
  return (
    <div>
      <PageHead title="Épreuves" subtitle="Tous les devoirs et examens de l'école" />
      <div style={{ marginBottom: 16 }}>
        <Pills value={tab} onChange={setTab} items={[{ value: 'tous', label: 'Toutes' }, { value: 'devoir', label: 'Devoirs' }, { value: 'examen', label: 'Examens' }, { value: 'brouillon', label: 'Brouillons' }, { value: 'annule', label: 'Annulées' }]} />
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows}
            onRowClick={setOpen}
            empty={<Empty icon={FileStack} title="Aucune épreuve" />}
            columns={[
              { key: 'title', label: 'Épreuve', primary: true },
              { key: 'kind', label: 'Type', render: (a) => (a.kind === 'examen' ? 'Examen' : 'Devoir') },
              { key: 'teacher', label: 'Enseignant' },
              { key: 'classe', label: 'Classe' },
              { key: 'matiere', label: 'Matière' },
              { key: 'endAt', label: 'Échéance', render: (a) => fmtDateTime(a.kind === 'examen' ? a.startAt : a.endAt) },
              { key: 'submitted', label: 'Copies', render: (a) => `${a.submitted}/${a.classSize}` },
              { key: 'status', label: 'Statut', render: (a) => <StatusBadge status={a.status} /> },
            ]}
          />
        </div>
      )}
      {open && <Results a={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
