import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import * as api from '../../api/index.js'
import { Empty, ErrorBox, Loader, Pills, useAsync } from '../../components/ui.jsx'
import { TaskCard, ExamCodeForm, useNow } from '../../components/student.jsx'

export default function StudentExamens() {
  const [tab, setTab] = useState('a_venir')
  const { data, loading, error } = useAsync(() => api.studentAssessments(), [])
  const exams = (data || []).filter((a) => a.kind === 'examen')
  const t = useNow(60000)
  const groups = {
    a_venir: exams.filter((a) => a.status === 'publie' && new Date(a.endAt).getTime() > t).sort((x, y) => (x.startAt > y.startAt ? 1 : -1)),
    annules: exams.filter((a) => a.status === 'annule'),
    passes: exams.filter((a) => a.status === 'publie' && new Date(a.endAt).getTime() <= t).sort((x, y) => (y.startAt > x.startAt ? 1 : -1)),
  }
  const list = groups[tab]

  return (
    <div className="stack">
      <h1 style={{ fontSize: '1.15rem' }}>Mes examens</h1>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-body"><ExamCodeForm /></div>
      </div>
      <Pills
        value={tab}
        onChange={setTab}
        items={[
          { value: 'a_venir', label: 'À venir' },
          { value: 'annules', label: 'Annulés' },
          { value: 'passes', label: 'Passés' },
        ]}
      />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="rows" /> : (
        <div className="stack-sm" style={{ gap: 12 }}>
          {list.length === 0 ? <div className="card"><Empty icon={CalendarClock} title="Aucun examen dans cette liste" /></div> : list.map((a) => <TaskCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
