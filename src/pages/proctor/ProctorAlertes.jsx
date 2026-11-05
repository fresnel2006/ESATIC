import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, PageHead, Pills, ResponsiveTable } from '../../components/ui.jsx'
import { EVENT_LABELS, fmtDateTime } from '../../lib/format.js'

export default function ProctorAlertes() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('live')

  useEffect(() => {
    let alive = true
    // Toutes les 10 s quand l'onglet est à l'écran
    const load = () => { if (!document.hidden) api.listAlerts().then((d) => alive && setData(d)).catch((e) => alive && setError(e)) }
    load()
    const t = setInterval(load, 10000)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [])

  const rows = (data || []).filter((e) => tab === 'all' || e.sessionOpen).map((e, i) => ({ ...e, key: `${e.attemptId}-${i}` }))

  return (
    <div>
      <PageHead title="Alertes" subtitle="Comportements signalés pendant les examens, du plus récent au plus ancien" />
      <div style={{ marginBottom: 16 }}>
        <Pills value={tab} onChange={setTab} items={[{ value: 'live', label: 'Sessions ouvertes' }, { value: 'all', label: 'Toutes' }]} />
      </div>
      <ErrorBox error={error} />
      {!data ? <Loader /> : (
        <div className="card">
          <ResponsiveTable
            rowKey="key"
            rows={rows}
            empty={<Empty icon={BellRing} title="Aucune alerte">Tout est calme.</Empty>}
            columns={[
              { key: 'at', label: 'Heure', render: (e) => fmtDateTime(e.at) },
              { key: 'student', label: 'Étudiant', primary: true, render: (e) => <span>{e.student} <span className="muted small">{e.matricule}</span></span> },
              { key: 'type', label: 'Événement', render: (e) => EVENT_LABELS[e.type] || e.type },
              { key: 'title', label: 'Examen', render: (e) => <Link to={`/surveillant/sessions/${e.sessionId}`}>{e.title}</Link> },
            ]}
          />
        </div>
      )}
    </div>
  )
}
