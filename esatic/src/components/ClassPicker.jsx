// Choix d'une ou plusieurs classes (création d'épreuve) : cases à cocher rangées de la L1 au M2,
// avec « toutes » pour cocher un niveau entier d'un coup.
import { LEVELS } from '../api/seed.js'

export default function ClassPicker({ classes, value = [], onChange, disabled = false }) {
  const levels = [...LEVELS, ...new Set(classes.map((c) => c.level || 'Autres').filter((l) => !LEVELS.includes(l)))]
  const chosen = classes.filter((c) => value.includes(c.id))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className="class-picker">
      <div className="class-picker-chosen">
        {chosen.length === 0
          ? <span className="small muted">Aucune classe choisie : cochez une ou plusieurs classes.</span>
          : <span className="small"><b>{chosen.length} classe{chosen.length > 1 ? 's' : ''} :</b> {chosen.map((c) => c.name).join(', ')}</span>}
      </div>
      <div className="assign-levels">
        {levels.map((l) => {
          const list = classes.filter((c) => (c.level || 'Autres') === l)
          if (!list.length) return null
          const all = list.every((c) => value.includes(c.id))
          return (
            <div key={l} className="assign-level">
              <button
                type="button" className="assign-level-head" disabled={disabled}
                onClick={() => onChange(all ? value.filter((id) => !list.some((c) => c.id === id)) : [...new Set([...value, ...list.map((c) => c.id)])])}
              >
                {l} <span className="muted">{all ? 'aucune' : 'toutes'}</span>
              </button>
              {list.map((c) => (
                <label key={c.id} className="checkbox small">
                  <input type="checkbox" checked={value.includes(c.id)} disabled={disabled} onChange={() => toggle(c.id)} aria-label={c.name} />
                  {c.name}
                </label>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
