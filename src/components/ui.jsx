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

// Chargement : squelette animé (le libellé reste lisible par les lecteurs d'écran)
export function Loader({ label = 'Chargement...', lines = 4 }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="sk-line sk-title" />
      {Array.from({ length: lines }, (_, i) => <div key={i} className="sk-line" style={{ width: `${92 - i * 11}%` }} />)}
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

export function Confirm({ title, message, confirmLabel = 'Confirmer', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
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
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
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
