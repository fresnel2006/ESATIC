// Emplois du temps (consultation). Étudiant : ceux de sa classe. Enseignant : les siens et ceux de ses classes,
// et ceux de n'importe quelle classe (onglet « Par classe »). L'emploi du temps en cours s'ouvre directement.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import * as api from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Empty, ErrorBox, Loader, PageHead, useAsync } from '../components/ui.jsx'
import { TimetableList, TimetableViewer } from '../components/TimetableWidgets.jsx'

function Browser({ items, empty, showTargets }) {
  const [selectedId, setSelectedId] = useState(null)
  if (!items.length) return <div className="card">{empty}</div>
  const selected = items.find((t) => t.id === selectedId) || items[0]
  return (
    <div className={`tt-layout ${items.length > 1 ? '' : 'single'}`}>
      {items.length > 1 && (
        <aside className="tt-side">
          <span className="label">{items.length} emplois du temps</span>
          <TimetableList items={items} selectedId={selected.id} onSelect={(t) => setSelectedId(t.id)} showTargets={showTargets} />
        </aside>
      )}
      <TimetableViewer key={`${selected.id}:${selected.version}`} item={selected} />
    </div>
  )
}

export default function MyTimetables() {
  const { user } = useAuth()
  const { data, loading, error } = useAsync(() => api.myTimetables(), [])
  const [params, setParams] = useSearchParams()
  const teacher = user.role === 'teacher'
  const tab = teacher && params.get('vue') === 'classes' ? 'classes' : 'mine'
  const classeId = Number(params.get('classe')) || null

  const none = (text) => <Empty icon={CalendarDays} title="Aucun emploi du temps pour le moment">{text}</Empty>

  return (
    <div>
      <PageHead title="Emplois du temps" subtitle={teacher ? 'Vos emplois du temps et ceux des classes' : data?.classe ? `Classe ${data.classe}` : 'Emplois du temps de votre classe'} />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : !teacher ? (
        <Browser items={data.items} showTargets={false} empty={none('La direction pédagogique déposera l\'emploi du temps de votre classe ici. Vous serez prévenu par une notification.')} />
      ) : (
        <div className="stack">
          <div className="eval-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setParams({})}>Mes emplois du temps</button>
            <button role="tab" aria-selected={tab === 'classes'} className={tab === 'classes' ? 'on' : ''} onClick={() => setParams({ vue: 'classes' })}>Par classe</button>
          </div>
          {tab === 'mine' ? (
            <Browser key="mine" items={data.items} empty={none('Les emplois du temps de vos classes, et le vôtre s\'il y en a un, apparaîtront ici dès que la direction pédagogique les aura déposés.')} />
          ) : (
            <>
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="tt-classe">Classe</label>
                <select id="tt-classe" className="select" value={classeId ?? ''} onChange={(e) => setParams(e.target.value ? { vue: 'classes', classe: e.target.value } : { vue: 'classes' })}>
                  <option value="">Choisir une classe...</option>
                  {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}{data.myClasses.includes(c.id) ? ' (une de vos classes)' : ''}</option>)}
                </select>
              </div>
              {classeId
                ? <Browser key={classeId} items={data.byClass.filter((t) => t.classeIds.includes(classeId))} empty={none('Aucun emploi du temps déposé pour cette classe.')} />
                : <div className="card">{none(data.classes.length ? 'Choisissez une classe pour voir son emploi du temps.' : 'Aucun emploi du temps n\'a encore été déposé.')}</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
