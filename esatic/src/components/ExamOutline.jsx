import { useState } from 'react'
import { ChevronDown, CircleCheck, Circle, ListTree } from 'lucide-react'
import { QUESTION_TYPES } from '../lib/format.js'

// Plan du sujet : exercices et questions, comme une arborescence.
// Sans exercice, les questions forment une seule liste.

// Exercice et numéro de chaque question (numérotation recommencée dans chaque exercice)
export function outlineOf(sections = [], questions = []) {
  if (!sections.length) {
    return {
      groups: [{ section: null, number: 0, items: questions.map((q, i) => ({ q, index: i, number: i + 1 })) }],
      label: (i) => ({ title: `Question ${i + 1}`, section: null }),
    }
  }
  const groups = sections.map((s, k) => ({ section: s, number: k + 1, items: [] }))
  const where = []
  questions.forEach((q, i) => {
    const g = groups.find((x) => x.section.id === q.sectionId) ?? groups[0]
    g.items.push({ q, index: i, number: g.items.length + 1 })
    where[i] = { group: g, number: g.items.length }
  })
  return {
    groups: groups.filter((g) => g.items.length),
    label: (i) => (where[i] ? { title: `Question ${where[i].number}`, section: where[i].group } : { title: `Question ${i + 1}`, section: null }),
  }
}

// Début de l'énoncé, pour reconnaître la question d'un coup d'oeil
function excerpt(text = '') {
  const plain = text.replace(/`+/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 58 ? plain.slice(0, 56).trimEnd() + '...' : plain
}

export default function ExamOutline({ sections, questions, answered, current, onSelect, totalPoints, footer, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const { groups } = outlineOf(sections, questions)
  const done = questions.filter((q) => answered(q)).length

  return (
    <nav className="outline card" aria-label="Plan du sujet">
      <button type="button" className="outline-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ListTree size={17} strokeWidth={1.6} />
        <span className="outline-title">Plan du sujet</span>
        <span className="outline-count">{done}/{questions.length}</span>
        <ChevronDown size={16} strokeWidth={1.8} className={`outline-chevron ${open ? 'open' : ''}`} />
      </button>
      <div className="outline-progress" aria-hidden="true"><span style={{ width: `${questions.length ? (done / questions.length) * 100 : 0}%` }} /></div>

      {open && (
        <div className="outline-body">
          {groups.map((g) => {
            const gDone = g.items.filter(({ q }) => answered(q)).length
            const gPoints = g.items.reduce((s, { q }) => s + Number(q.points || 0), 0)
            const active = g.items.some(({ index }) => index === current)
            return (
              <div className={`outline-group ${active ? 'active' : ''}`} key={g.section?.id ?? 'all'}>
                {g.section && (
                  <div className="outline-ex">
                    <span className="outline-ex-n">Exercice {g.number}</span>
                    <span className="outline-ex-title">{g.section.title}</span>
                    <span className="outline-ex-meta">{gDone}/{g.items.length} - {gPoints} pt{gPoints > 1 ? 's' : ''}</span>
                  </div>
                )}
                <ul className={`outline-list ${g.section ? 'tree' : ''}`}>
                  {g.items.map(({ q, index, number }) => {
                    const ok = answered(q)
                    const isCurrent = index === current
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          className={`outline-item ${isCurrent ? 'current' : ''} ${ok ? 'done' : ''}`}
                          onClick={() => onSelect(index)}
                          aria-current={isCurrent ? 'step' : undefined}
                          aria-label={`${g.section ? `Exercice ${g.number}, ` : ''}question ${number}${ok ? ', répondue' : ''}`}
                        >
                          <span className="outline-state">{ok ? <CircleCheck size={16} strokeWidth={1.8} /> : <Circle size={16} strokeWidth={1.6} />}</span>
                          <span className="outline-text">
                            <span className="outline-q">
                              Question {number}
                              <span className="outline-type">{QUESTION_TYPES[q.type]}</span>
                            </span>
                            {q.statement && <span className="outline-excerpt">{excerpt(q.statement)}</span>}
                          </span>
                          <span className="outline-pts">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          <div className="outline-foot">
            <span>Total : {totalPoints} points</span>
            {footer}
          </div>
        </div>
      )}
    </nav>
  )
}
