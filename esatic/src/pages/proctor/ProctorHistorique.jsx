import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, PageHead, ResponsiveTable, StatusBadge, useAsync } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function ProctorHistorique() {
  const { data, loading, error } = useAsync(() => api.listSessions(), [])
  const rows = (data || []).filter((s) => s.status === 'fermee' || s.cancelled).sort((x, y) => (y.startAt > x.startAt ? 1 : -1))
  return (
    <div>
      <PageHead title="Historique" subtitle="Sessions terminées" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows}
            empty={<Empty icon={History} title="Aucune session terminée" />}
            columns={[
              { key: 'title', label: 'Examen', primary: true, render: (s) => <Link to={`/surveillant/sessions/${s.id}`}>{s.title}</Link> },
              { key: 'classe', label: 'Classe' },
              { key: 'room', label: 'Salle', render: (s) => s.room || '-' },
              { key: 'openedAt', label: 'Ouverte', render: (s) => fmtDateTime(s.openedAt) },
              { key: 'closedAt', label: 'Fermée', render: (s) => fmtDateTime(s.closedAt) },
              { key: 'submitted', label: 'Copies', render: (s) => `${s.submitted}/${s.classSize}` },
              { key: 'alerts', label: 'Signalements' },
              { key: 'status', label: 'Statut', render: (s) => <StatusBadge status={s.cancelled ? 'annule' : s.status} /> },
            ]}
          />
        </div>
      )}
    </div>
  )
}
