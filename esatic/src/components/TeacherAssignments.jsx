// Classes et matières attribuées à un enseignant (Administration > Utilisateurs) :
// on choisit une matière, on coche une ou plusieurs classes (rangées de la L1 au M2), puis « Attribuer ».
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { LEVELS, LEVEL_NAMES } from '../api/seed.js'


export default function TeacherAssignments({ classes, matieres, value, onChange }) {
  const [matiereId, setMatiereId] = useState(matieres[0]?.id ?? '')
  const [checked, setChecked] = useState([])
  const levels = [...LEVELS, ...new Set(classes.map((c) => c.level).filter((l) => !LEVELS.includes(l)))]
  const has = (cid, mid) => value.some((v) => v.classeId === cid && v.matiereId === mid)
  const className = (id) => classes.find((c) => c.id === id)?.name ?? '?'
  const matiereName = (id) => matieres.find((m) => m.id === id)?.name ?? '?'

  function add() {
    const mid = Number(matiereId)
    const extra = checked.filter((cid) => !has(cid, mid)).map((cid) => ({ classeId: cid, matiereId: mid }))
    onChange([...value, ...extra])
    setChecked([])
  }
  const toggle = (cid) => setChecked((x) => (x.includes(cid) ? x.filter((y) => y !== cid) : [...x, cid]))
  const sorted = [...value].sort((a, b) => {
    const ca = classes.find((c) => c.id === a.classeId); const cb = classes.find((c) => c.id === b.classeId)
    return levels.indexOf(ca?.level) - levels.indexOf(cb?.level) || className(a.classeId).localeCompare(className(b.classeId)) || matiereName(a.matiereId).localeCompare(matiereName(b.matiereId))
  })

  return (
    <div className="assign">
      <div className="assign-current">
        {sorted.length === 0
          ? <span className="small muted">Aucune classe attribuée pour l'instant.</span>
          : sorted.map((v) => (
            <span key={`${v.classeId}-${v.matiereId}`} className="assign-chip">
              <b>{className(v.classeId)}</b> · {matiereName(v.matiereId)}
              <button type="button" aria-label={`Retirer ${className(v.classeId)}, ${matiereName(v.matiereId)}`} onClick={() => onChange(value.filter((x) => x !== v))}><X size={13} /></button>
            </span>
          ))}
      </div>

      <div className="assign-add">
        <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="as-mat">Matière</label>
            <select id="as-mat" className="select" value={matiereId} onChange={(e) => setMatiereId(Number(e.target.value))}>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-secondary" disabled={!checked.length || !matiereId} onClick={add}>
            <Plus size={15} /> Attribuer {checked.length ? `à ${checked.length} classe${checked.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
        <div className="assign-levels">
          {levels.map((l) => {
            const list = classes.filter((c) => c.level === l)
            if (!list.length) return null
            const all = list.every((c) => checked.includes(c.id))
            return (
              <div key={l} className="assign-level">
                <button type="button" className="assign-level-head" onClick={() => setChecked((x) => (all ? x.filter((id) => !list.some((c) => c.id === id)) : [...new Set([...x, ...list.map((c) => c.id)])]))}>
                  {LEVEL_NAMES[l] || l} <span className="muted">{all ? 'aucune' : 'toutes'}</span>
                </button>
                {list.map((c) => (
                  <label key={c.id} className={`checkbox small ${has(c.id, Number(matiereId)) ? 'muted' : ''}`}>
                    <input type="checkbox" checked={checked.includes(c.id)} disabled={has(c.id, Number(matiereId))} onChange={() => toggle(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
