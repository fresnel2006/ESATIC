// Énoncé de question : le texte entre accents graves est affiché comme du code en ligne.
// `selectable={false}` pendant la composition : le sujet ne peut pas être sélectionné.
export default function Statement({ text = '', selectable = true }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <div className={`q-statement ${selectable ? '' : 'no-select'}`}>
      {parts.map((p, i) => (p.startsWith('`') && p.endsWith('`') && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>))}
    </div>
  )
}
