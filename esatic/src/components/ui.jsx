// Petits composants d'interface réutilisés partout
import { useEffect, useState } from 'react'
import { Inbox, Loader2, X, Info, AlertCircle, CheckCircle2 } from 'lucide-react'

export const ICON = { size: 18, strokeWidth: 1.6 }

const STATUS = {
  a_faire: ['À faire', 'neutral'],
  a_venir: ['À venir', 'neutral'],
  en_cours: ['En cours', 'info'],
  rendu: ['Rendu', 'success'],
  corrige: ['Corrigé', 'success'],
  non_rendu: ['Non rendu', 'neutral'],
  absent: ['Absent', 'neutral'],
  brouillon: ['Brouillon', 'neutral'],
  publie: ['Publié', 'info'],
  annule: ['Annulé', 'neutral'],
  planifiee: ['Planifiée', 'neutral'],
  ouverte: ['Ouverte', 'success'],
  fermee: ['Fermée', 'neutral'],
}

export function StatusBadge({ status, label }) {
  const [text, tone] = STATUS[status] || [status, 'neutral']
  return <span className={`badge badge-${tone}`}>{label || text}</span>
}

export function RiskBadge({ value }) {
  const tone = value >= 50 ? 'danger' : value >= 20 ? 'info' : 'neutral'
  return <span className={`badge badge-${tone} badge-plain`} title="Score de risque calculé à partir des événements">{value}</span>
}

// ---------------------------------------------------------------------------
// Chargement : squelettes qui reprennent la forme de la page (tableau, cartes, tableau de bord, fiche, PDF).
// Les informations prennent ensuite exactement leur place, sans saut. Le libellé reste lisible par les
// lecteurs d'écran.
// ---------------------------------------------------------------------------
const Sk = ({ w, h, className = '', style }) => <span className={`sk ${className}`} style={{ width: w, height: h, ...style }} />
const range = (n) => Array.from({ length: n }, (_, i) => i)
// Largeurs variées mais stables (pas de hasard : rien ne bouge d'un rendu à l'autre)
const W = ['72%', '54%', '86%', '63%', '45%', '78%', '58%', '68%']

function SkStats({ n = 4 }) {
  return (
    <div className="grid-cards">
      {range(n).map((i) => (
        <div key={i} className="card stat sk-card">
          <Sk className="sk-icon" />
          <div className="sk-col"><Sk w="46%" h={22} /><Sk w={`${60 + (i % 3) * 10}%`} h={11} /></div>
        </div>
      ))}
    </div>
  )
}

function SkTable({ rows = 7, cols = 4, toolbar = true }) {
  return (
    <div className="card sk-card">
      {toolbar && <div className="sk-toolbar"><Sk w="38%" h={36} /><span className="spacer" /><Sk w={150} h={36} /></div>}
      <div className="sk-thead">{range(cols).map((c) => <Sk key={c} w={c === 0 ? '30%' : `${12 + c * 3}%`} h={10} />)}</div>
      {range(rows).map((r) => (
        <div key={r} className="sk-row">
          <div className="sk-cell" style={{ width: '30%' }}><Sk w={W[r % 8]} h={13} /><Sk w="40%" h={10} /></div>
          {range(cols - 1).map((c) => <div key={c} className="sk-cell" style={{ width: `${12 + (c + 1) * 3}%` }}><Sk w={c === cols - 2 ? 64 : W[(r + c + 3) % 8]} h={c === cols - 2 ? 26 : 12} /></div>)}
        </div>
      ))}
    </div>
  )
}

function SkCards({ n = 6 }) {
  return (
    <div className="sk-cards">
      {range(n).map((i) => (
        <div key={i} className="card sk-card sk-tile">
          <div className="sk-tile-head"><Sk className="sk-avatar" /><div className="sk-col"><Sk w={W[i % 8]} h={14} /><Sk w="45%" h={10} /></div></div>
          <Sk w="92%" h={10} /><Sk w={W[(i + 2) % 8]} h={10} />
          <div className="sk-tile-foot"><Sk w={84} h={22} /><Sk w={96} h={32} /></div>
        </div>
      ))}
    </div>
  )
}

function SkBlock({ lines = 5, title = true }) {
  return (
    <div className="card sk-card sk-pad">
      {title && <Sk w="34%" h={18} style={{ marginBottom: 6 }} />}
      {range(lines).map((i) => <Sk key={i} w={W[i % 8]} h={11} />)}
    </div>
  )
}

// Lignes larges (devoirs, examens) : icône, titre et informations, badge, bouton
function SkRows({ n = 4 }) {
  return (
    <div className="sk-rows">
      {range(n).map((i) => (
        <div key={i} className="card sk-card sk-rowcard">
          <Sk className="sk-icon" />
          <div className="sk-col"><Sk w={W[i % 8]} h={15} style={{ maxWidth: 420 }} /><Sk w="28%" h={11} /><Sk w="20%" h={10} /></div>
          <Sk w={70} h={22} /><Sk w={120} h={32} />
        </div>
      ))}
    </div>
  )
}

// Petite carte de liste (titre + lignes), comme les blocs de l'accueil
function SkListCard({ rows = 3 }) {
  return (
    <div className="card sk-card">
      <div className="sk-toolbar"><Sk w="38%" h={15} /><span className="spacer" /><Sk w={60} h={11} /></div>
      {range(rows).map((i) => (
        <div key={i} className="sk-row"><div className="sk-col"><Sk w={W[(i + 1) % 8]} h={13} /><Sk w="46%" h={10} /></div><Sk w={56} h={20} /></div>
      ))}
    </div>
  )
}

const VARIANTS = {
  table: () => <SkTable />,
  cards: () => <SkCards />,
  list: () => <SkTable rows={7} cols={4} toolbar={false} />,
  rows: () => <SkRows />,
  // Accueil étudiant : bandeau « à faire maintenant », code d'examen, devoirs ; à droite résultats et annonces
  home: () => (
    <div className="sk-home">
      <div className="sk-col sk-gap">
        <div className="sk-hero-band"><Sk w="22%" h={10} className="sk-light" /><Sk w="55%" h={20} className="sk-light" /><Sk w="38%" h={11} className="sk-light" /><div className="sk-tile-foot"><Sk w="35%" h={28} className="sk-light" /><Sk w={130} h={36} className="sk-light" /></div></div>
        <div className="card sk-card sk-pad"><Sk w="20%" h={11} /><div className="sk-tile-head"><Sk h={40} style={{ flex: 1, minWidth: 0 }} /><Sk w={80} h={40} /></div></div>
        <SkListCard rows={4} />
      </div>
      <div className="sk-col sk-gap"><SkListCard rows={2} /><SkListCard rows={3} /></div>
    </div>
  ),
  // Évaluation des enseignants : campagnes, onglets, puis les classes par niveau
  campaigns: () => (
    <>
      <div className="sk-campaigns">{range(2).map((i) => <div key={i} className="card sk-card sk-pad"><Sk w="80%" h={15} /><Sk w="60%" h={10} /><div className="sk-tile-head"><Sk w={74} h={20} /><Sk w={90} h={11} /></div></div>)}</div>
      <Sk w="100%" h={46} />
      <VARIANTS.classes />
    </>
  ),
  classes: () => (
    <>
      <Sk w={240} h={44} />
      {range(2).map((g) => (
        <div key={g} className="sk-col sk-gap-sm">
          <Sk w={150} h={14} />
          <div className="sk-class-grid">{range(5).map((i) => <div key={i} className="card sk-card sk-pad sk-class"><Sk w="45%" h={14} /><Sk w="75%" h={10} /><Sk w="90%" h={6} /></div>)}</div>
        </div>
      ))}
    </>
  ),
  dashboard: () => (
    <>
      <SkStats />
      <div className="sk-two"><SkBlock lines={6} /><SkBlock lines={6} /></div>
      <SkTable rows={4} toolbar={false} />
    </>
  ),
  detail: () => (
    <>
      <div className="card sk-card sk-pad sk-hero"><Sk className="sk-avatar lg" /><div className="sk-col"><Sk w="40%" h={20} /><Sk w="62%" h={11} /></div><Sk w={110} h={34} /></div>
      <SkBlock lines={4} />
      <SkBlock lines={6} />
    </>
  ),
  form: () => (
    <div className="card sk-card sk-pad sk-form">
      {range(6).map((i) => <div key={i} className="sk-col"><Sk w={`${18 + (i % 3) * 6}%`} h={10} /><Sk w="100%" h={38} /></div>)}
      <Sk w={140} h={38} style={{ alignSelf: 'flex-end' }} />
    </div>
  ),
  pdf: () => (
    <div className="card sk-card">
      <div className="sk-toolbar"><Sk className="sk-icon" /><div className="sk-col" style={{ flex: 1 }}><Sk w="30%" h={14} /><Sk w="45%" h={10} /></div><Sk w={110} h={32} /><Sk w={120} h={32} /></div>
      <div className="sk-pdf"><div className="sk-page">{range(9).map((i) => <Sk key={i} w={i === 0 ? '50%' : W[i % 8]} h={i === 0 ? 20 : 12} />)}</div></div>
    </div>
  ),
  block: ({ label }) => <div className="sk-editor"><Sk w="100%" h="100%" className="sk-fill" /><span className="sk-editor-label"><Loader2 size={16} className="spin" /> {label}</span></div>,
}

export function Loader({ label = 'Chargement...', variant = 'table' }) {
  const Shape = VARIANTS[variant] || VARIANTS.table
  return (
    <div className={`skeleton skv-${variant}`} role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <Shape label={label} />
    </div>
  )
}

// Écran d'ouverture (vérification de la session, ouverture d'une copie) : logo et barre de progression
export function Splash({ label = 'Chargement...' }) {
  return (
    <div className="splash" role="status" aria-label={label}>
      <img src="/img/logo-esatic.svg" alt="ESATIC" className="splash-logo" />
      <span className="splash-bar"><span /></span>
      <span className="splash-label">{label}</span>
    </div>
  )
}

// Petit indicateur de chargement en ligne (boutons, zones réduites)
export function Spinner({ label }) {
  return <span className="loader"><Loader2 {...ICON} className="spin" /> {label}</span>
}

export function Empty({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={26} strokeWidth={1.5} /></span>
      {title && <strong>{title}</strong>}
      {children && <div className="small">{children}</div>}
    </div>
  )
}

export function Notice({ kind = 'info', children }) {
  const Icon = kind === 'danger' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info
  return (
    <div className={`notice ${kind === 'info' ? '' : kind}`}>
      <Icon {...ICON} />
      <div>{children}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">
              <X {...ICON} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// Confirmation d'une action. Si l'action échoue, le message d'erreur s'affiche dans la fenêtre
// (sinon le clic semble ne rien faire).
export function Confirm({ title, message, confirmLabel = 'Confirmer', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                await onConfirm()
                onClose()
              } catch (e) {
                setError(e?.message || String(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 {...ICON} className="spin" />} {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {error && <div style={{ marginTop: 12 }}><Notice kind="danger">{error}</Notice></div>}
    </Modal>
  )
}

export function Pills({ items, value, onChange }) {
  return (
    <div className="pills" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} className={`pill ${value === it.value ? 'active' : ''}`} onClick={() => onChange(it.value)}>
          {it.label}
          {it.count !== undefined && <span className="count">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} className={`tab ${value === it.value ? 'active' : ''}`} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  )
}

export function Avatar({ name = '', size = 36, light }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
  return (
    <span className={`avatar ${light ? 'light' : ''}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  )
}

// Tableau sur PC, liste de cartes sur mobile
export function ResponsiveTable({ columns, rows, rowKey = 'id', empty, onRowClick }) {
  if (!rows.length) return empty || <Empty title="Aucun élément" />
  return (
    <>
      <div className="table-wrap responsive">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.className}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-list">
        {rows.map((r) => {
          const main = columns.find((c) => c.primary) || columns[0]
          const actions = columns.find((c) => c.key === 'actions')
          return (
            <div key={r[rowKey]} className="card item" onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{main.render ? main.render(r) : r[main.key]}</div>
              {columns.filter((c) => c !== main && c !== actions && !c.hideMobile).map((c) => (
                <div className="item-row" key={c.key}>
                  <span className="k">{c.label}</span>
                  <span>{c.render ? c.render(r) : r[c.key]}</span>
                </div>
              ))}
              {actions && <div className="item-actions">{actions.render(r)}</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indicateur de rechargement
    setState((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <Notice kind="danger">{error.message || String(error)}</Notice>
}

export function Stat({ icon: Icon, value, label, tone = '' }) {
  return (
    <div className="card stat">
      {Icon && <span className={`stat-icon ${tone}`}><Icon size={20} strokeWidth={1.6} /></span>}
      <div>
        <div className="v">{value}</div>
        <div className="k">{label}</div>
      </div>
    </div>
  )
}
