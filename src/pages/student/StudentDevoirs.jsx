import { useState } from 'react'
import { Files } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, Pills, useAsync } from '../../components/ui.jsx'
import { TaskCard, useNow } from '../../components/student.jsx'

export default function StudentDevoirs() {
  const [tab, setTab] = useState('en_cours')
  const { data, loading, error } = useAsync(() => api.studentAssessments(), [])
  const devoirs = (data || []).filter((a) => a.kind === 'devoir')
  const t = useNow(60000)
  const groups = {
    en_cours: devoirs.filter((a) => a.status === 'publie' && new Date(a.endAt).getTime() > t).sort((x, y) => (x.endAt > y.endAt ? 1 : -1)),
    annules: devoirs.filter((a) => a.status === 'annule'),
    finis: devoirs.filter((a) => a.status === 'publie' && new Date(a.endAt).getTime() <= t).sort((x, y) => (y.endAt > x.endAt ? 1 : -1)),
  }
  const list = groups[tab]
  const emptyText = { en_cours: 'Aucun devoir en cours', annules: 'Aucun devoir annulé', finis: 'Aucun devoir terminé' }

  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.15rem' }}>Mes devoirs</h1>
      <Pills
        value={tab}
        onChange={setTab}
        items={[
          { value: 'en_cours', label: 'En cours' },
          { value: 'annules', label: 'Annulés' },
          { value: 'finis', label: 'Finis' },
        ]}
      />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="stack-sm" style={{ gap: 12 }}>
          {list.length === 0 ? <div className="card"><Empty icon={Files} title={emptyText[tab]} /></div> : list.map((a) => <TaskCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
