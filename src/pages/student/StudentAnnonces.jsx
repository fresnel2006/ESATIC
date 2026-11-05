import { Megaphone } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, useAsync } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function StudentAnnonces() {
  const { data, loading, error } = useAsync(() => api.listAnnouncements(), [])
  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.15rem' }}>Annonces</h1>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : data.length === 0 ? <div className="card"><Empty icon={Megaphone} title="Aucune annonce" /></div> : (
        data.map((n) => (
          <article className="card" key={n.id}>
            <div className="card-body stack-sm">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <h2 style={{ flex: 1 }}>{n.title}</h2>
                <span className="tag">{n.classe}</span>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>{n.body}</p>
              <p className="small muted">{n.author} - {fmtDateTime(n.createdAt)}</p>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
