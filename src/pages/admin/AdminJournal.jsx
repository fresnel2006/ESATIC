import { useState } from 'react'
import { ScrollText, Download } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, PageHead, ResponsiveTable, useAsync, ICON } from '../../components/ui.jsx'
import { ACTION_LABELS, ROLE_LABELS, downloadCsv, fmtDateTime } from '../../lib/format.js'

export default function AdminJournal() {
  const { data, loading, error } = useAsync(() => api.listAudit(), [])
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [day, setDay] = useState('')
  const rows = (data || []).filter((a) =>
    (!action || a.action === action) &&
    (!day || a.at.slice(0, 10) === day) &&
    (!q || `${a.user?.fullName ?? ''} ${a.target} ${a.detail}`.toLowerCase().includes(q.toLowerCase())),
  )
  const actions = [...new Set((data || []).map((a) => a.action))]

  return (
    <div>
      <PageHead title="Journal d'activité" subtitle="Toutes les actions importantes, horodatées" actions={
        <button className="btn btn-secondary" disabled={!rows.length} onClick={() => downloadCsv('journal-activite.csv', rows.map((a) => ({ Date: fmtDateTime(a.at), Utilisateur: a.user?.fullName ?? '', Rôle: ROLE_LABELS[a.user?.role] ?? '', Action: ACTION_LABELS[a.action] || a.action, Cible: a.target, Détail: a.detail })))}><Download {...ICON} /> Exporter (CSV)</button>
      } />
      <div className="filters">
        <input className="input" placeholder="Utilisateur, cible ou détail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">Toutes les actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
        <input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Jour" />
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows.slice(0, 300)}
            empty={<Empty icon={ScrollText} title="Aucune activité" />}
            columns={[
              { key: 'at', label: 'Date', render: (a) => <span className="nowrap">{fmtDateTime(a.at)}</span> },
              { key: 'action', label: 'Action', primary: true, render: (a) => ACTION_LABELS[a.action] || a.action },
              { key: 'user', label: 'Utilisateur', render: (a) => (a.user ? `${a.user.fullName} (${ROLE_LABELS[a.user.role]})` : 'Système') },
              { key: 'target', label: 'Cible' },
              { key: 'detail', label: 'Détail', render: (a) => a.detail || '-' },
            ]}
          />
        </div>
      )}
    </div>
  )
}
