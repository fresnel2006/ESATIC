// Illustration "documents superposés" de la maquette Devoirs.
// variant : 'devoir' (deux feuilles), 'examen' (feuille + horloge), 'off' (grisé, épreuve annulée)
export default function DocIcon({ variant = 'devoir', size = 52 }) {
  const off = variant === 'off'
  const stroke = off ? 'var(--neutral)' : 'var(--primary)'
  const back = off ? 'var(--neutral-soft)' : 'var(--doc-back)'
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true" className="doc-icon">
      {/* feuille arrière */}
      <path d="M19 4h15l9 9v25a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill={back} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M34 4v6a3 3 0 0 0 3 3h6" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      {/* feuille avant */}
      <path d="M10 12h14l8 8v25a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" fill="var(--surface)" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M24 12v5a3 3 0 0 0 3 3h5" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      {variant === 'examen' ? (
        <g stroke={stroke} strokeWidth="1.6" strokeLinecap="round">
          <circle cx="19.5" cy="33" r="7" fill={back} />
          <path d="M19.5 29.5V33l2.5 1.8" />
        </g>
      ) : (
        <g stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
          <path d="M12.5 27h13" />
          <path d="M12.5 32h13" />
          <path d="M12.5 37h8" />
        </g>
      )}
    </svg>
  )
}
