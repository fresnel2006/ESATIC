import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, ArrowDownRight, Search, Bell, ChevronsLeft, ChevronsRight,
  UserRound, KeyRound, Moon, Sun, LogOut, Ellipsis, X, ChevronDown, Lock, Repeat, TriangleAlert,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { NAV } from './nav.js'
import { prefetchPages } from '../pages/prefetch.js'
import Logo from './Logo.jsx'
import { Avatar, ICON, Loader } from './ui.jsx'
import { ROLE_HOME, ROLE_LABELS, fmtAgo } from '../lib/format.js'
import * as api from '../api/index.js'

function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('esatic-theme') || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('esatic-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

// Pages hors du menu : titre affiché dans la barre du haut
const EXTRA_TITLES = [
  ['/compte/profil', 'Profil'],
  ['/compte/mot-de-passe', 'Mot de passe'],
  ['/etudiant/epreuve/', 'Épreuve'],
]

function currentTitle(items, pathname) {
  const match = items
    .filter((i) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? EXTRA_TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? ''
}

function SearchBox() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false))

  // Ctrl+K : aller à la recherche
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) { setOpen(false); inputRef.current.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) return
    const id = setTimeout(() => api.search(q).then(setResults).catch(() => setResults([])), 200)
    return () => clearTimeout(id)
  }, [q])

  return (
    <div className="search" ref={ref}>
      <Search {...ICON} />
      <input
        ref={inputRef}
        type="search"
        placeholder="Recherche ..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        aria-label="Recherche (Ctrl+K)"
      />
      {!q && <kbd className="search-kbd">Ctrl K</kbd>}
      {open && q.trim().length >= 2 && (
        <div className="dropdown search-results">
          {results.length === 0 && <div className="dropdown-empty">Aucun résultat pour « {q} »</div>}
          {results.map((r, i) => (
            <button
              key={i}
              className="dropdown-item"
              onClick={() => { setOpen(false); setQ(''); navigate(r.link) }}
            >
              <span className="tag">{r.type}</span>
              <span className="grow">
                <span className="d-title">{r.label}</span>
                {r.sub && <span className="d-sub">{r.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)
  const navigate = useNavigate()
  useClickOutside(ref, () => setOpen(false))

  useEffect(() => {
    // Toutes les minutes, et seulement quand l'onglet est à l'écran (chaque vérification coûte des lectures Firebase)
    const load = () => { if (!document.hidden) api.listNotifications().then(setItems).catch(() => {}) }
    load()
    const id = setInterval(load, 60000)
    document.addEventListener('visibilitychange', load)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])

  const unread = items.filter((n) => !n.read).length
  return (
    <div className="menu-anchor" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications, ${unread} non lues`} onClick={() => setOpen((o) => !o)}>
        <Bell {...ICON} />
        {unread > 0 && <span className="dot-count">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown notif-panel">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={async () => { await api.markNotificationsRead(); setItems(await api.listNotifications()) }}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 && <div className="dropdown-empty">Aucune notification</div>}
          {items.map((n) => (
            <button key={n.id} className={`dropdown-item notif ${n.read ? '' : 'unread'}`} onClick={() => { setOpen(false); if (n.link) navigate(n.link) }}>
              <span className="grow">
                <span className="d-title">{n.title}</span>
                <span className="d-sub">{n.body}</span>
              </span>
              <span className="d-time">{fmtAgo(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountMenu({ user, theme, toggleTheme, compact }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { logout, switchRole } = useAuth()
  useClickOutside(ref, () => setOpen(false))
  const go = (p) => { setOpen(false); navigate(p) }
  const others = (user.roles || []).filter((r) => r !== user.role)
  return (
    <div className="menu-anchor" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu du compte" aria-expanded={open}>
        {/* Le nom figure déjà en bas de la barre latérale : ici, l'avatar seul */}
        <Avatar name={user.fullName} size={34} />
        {!compact && <span className="account-text"><strong>{user.firstName}</strong></span>}
        <ChevronDown size={15} strokeWidth={1.8} className="account-chevron" />
      </button>
      {open && (
        <div className="dropdown account-menu">
          <div className="dropdown-head column">
            <strong>{user.fullName}</strong>
            <span className="d-sub">{ROLE_LABELS[user.role]} - {user.matricule}</span>
          </div>
          {others.map((r) => (
            <button key={r} className="dropdown-item" onClick={async () => { setOpen(false); const u = await switchRole(r); navigate(ROLE_HOME[u.role]) }}>
              <Repeat {...ICON} /> Passer à l'espace {ROLE_LABELS[r].toLowerCase()}
            </button>
          ))}
          <button className="dropdown-item" onClick={() => go('/compte/profil')}><UserRound {...ICON} /> Profil</button>
          <button className="dropdown-item" onClick={() => go('/compte/mot-de-passe')}><KeyRound {...ICON} /> Mot de passe</button>
          <button className="dropdown-item" onClick={toggleTheme}>
            {theme === 'light' ? <Moon {...ICON} /> : <Sun {...ICON} />} Thème {theme === 'light' ? 'sombre' : 'clair'}
          </button>
          <button className="dropdown-item danger" onClick={async () => { await logout(); navigate('/connexion') }}>
            <LogOut {...ICON} /> Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}

// Entrées conditionnelles du menu (gate) : l'évaluation des enseignants n'est cliquable chez l'étudiant
// qu'après validation par la direction pédagogique. Vérifié à l'ouverture, à chaque page et au retour sur l'onglet.
function useGates(role, pathname) {
  const [gates, setGates] = useState({})
  useEffect(() => {
    if (role !== 'student') return
    const check = () => { if (!document.hidden) api.evalAvailable().then((r) => setGates({ evaluation: !!r.open })).catch(() => {}) }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [role, pathname])
  return gates
}

// Surveillant : toutes les 10 s, les nouvelles sorties d'examen (sessions ouvertes) s'affichent à l'écran avec un son,
// quelle que soit la page ouverte. Les sorties déjà connues à l'ouverture de la page ne sont pas rejouées.
const EXIT_TYPES = ['exit_counted', 'fullscreen_exit', 'tab_hidden', 'window_left', 'navigation_away', 'auto_submitted_exits']
const EXIT_TEXT = { fullscreen_exit: 'a quitté le plein écran', tab_hidden: 'a changé d\'onglet', window_left: 'a changé de fenêtre', navigation_away: 'a tenté de quitter la page', exit_counted: 'a quitté l\'épreuve', auto_submitted_exits: 'est sorti(e) une fois de trop : copie envoyée' }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.value = 880; g.gain.value = 0.08
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25)
  } catch { /* son indisponible */ }
}
function useExitAlerts(role) {
  const navigate = useNavigate()
  const [live, setLive] = useState([])
  useEffect(() => {
    if (role !== 'proctor') return
    const seen = new Set()
    let first = true
    let alive = true
    const check = () => {
      if (document.hidden) return
      api.listAlerts().then((list) => {
        if (!alive) return
        const fresh = list.filter((e) => e.sessionOpen && EXIT_TYPES.includes(e.type) && !seen.has(`${e.attemptId}|${e.at}|${e.type}`))
        for (const e of list) seen.add(`${e.attemptId}|${e.at}|${e.type}`)
        if (first) { first = false; return }
        // Une alerte par étudiant (plusieurs événements d'une même sortie arrivent ensemble)
        const byStudent = new Map()
        for (const e of fresh) if (!byStudent.has(e.attemptId) || e.type === 'exit_counted' || e.type === 'auto_submitted_exits') byStudent.set(e.attemptId, e)
        if (byStudent.size) {
          beep()
          setLive((cur) => [...[...byStudent.values()].map((e) => ({ ...e, key: `${e.attemptId}|${e.at}` })), ...cur].slice(0, 4))
        }
      }).catch(() => {})
    }
    check()
    const id = setInterval(check, 10000)
    document.addEventListener('visibilitychange', check)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [role])
  const close = (key) => setLive((cur) => cur.filter((x) => x.key !== key))
  if (!live.length) return null
  return (
    <div className="exit-alerts" role="alert" aria-live="assertive">
      {live.map((e) => (
        <div key={e.key} className={`exit-alert ${e.type === 'auto_submitted_exits' ? 'grave' : ''}`}>
          <TriangleAlert size={20} />
          <div className="exit-alert-text">
            <strong>{e.student} {EXIT_TEXT[e.type] || 'a quitté l\'épreuve'}</strong>
            <span className="small">{e.title}{e.detail?.n ? ` · sortie ${e.detail.n}` : ''} · {fmtAgo(e.at)}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { close(e.key); navigate(`/surveillant/sessions/${e.sessionId}`) }}>Voir</button>
          <button className="icon-btn" aria-label="Fermer" onClick={() => close(e.key)}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('esatic-sidebar') === '1')
  const [moreOpen, setMoreOpen] = useState(false)
  const gates = useGates(user.role, location.pathname)
  const exitAlerts = useExitAlerts(user.role)
  // Pages de l'espace préparées en arrière-plan
  useEffect(() => { prefetchPages(user.role) }, [user.role])
  const locked = (it) => it.gate && !gates[it.gate]
  const items = NAV[user.role] || []
  const title = currentTitle(items, location.pathname)
  const mobileItems = items.filter((i) => i.mobile).slice(0, items.length > 5 ? 4 : 5)
  const moreItems = items.filter((i) => !mobileItems.includes(i))

  useEffect(() => {
    localStorage.setItem('esatic-sidebar', collapsed ? '1' : '0')
  }, [collapsed])

  // Ferme le panneau "Plus" quand on change de page
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMoreOpen(false)
  }

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Navigation principale">
        <div className="sidebar-logo">
          <Logo height={40} withMark />
        </div>
        <div className="nav-section">Menu</div>
        <nav className="sidebar-nav">
          {items.map((it) => locked(it) ? (
            <span key={it.to} className="nav-item locked" aria-disabled="true" title={it.lockedHint}>
              <it.icon size={20} strokeWidth={1.6} />
              <span className="nav-label">{it.label}</span>
              <Lock size={13} strokeWidth={1.8} className="nav-lock" />
            </span>
          ) : (
            <NavLink key={it.to} to={it.to} end={it.end} className="nav-item" title={collapsed ? it.label : undefined}>
              <it.icon size={20} strokeWidth={1.6} />
              <span className="nav-label">{it.label}</span>
              <ArrowUpRight size={13} strokeWidth={1.8} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}>
          {collapsed ? <ChevronsRight size={18} strokeWidth={1.6} /> : <ChevronsLeft size={18} strokeWidth={1.6} />}
          <span className="nav-label">Replier le menu</span>
        </button>
        <button className="sidebar-profile" onClick={() => navigate('/compte/profil')} title="Profil">
          <Avatar name={user.fullName} size={40} light />
          <span className="profile-text">
            <strong>{user.firstName} {user.lastName}</strong>
            <span>{ROLE_LABELS[user.role]}</span>
          </span>
          <ArrowDownRight size={14} strokeWidth={1.8} className="nav-arrow" />
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-mobile-logo"><Logo height={30} /></div>
          {title && <div className="page-tab">{title}</div>}
          <div className="spacer" />
          <SearchBox />
          <Notifications />
          <AccountMenu user={user} theme={theme} toggleTheme={toggleTheme} compact />
        </header>
        <main className="content" id="contenu">
          <div key={location.pathname} className="page-enter"><Suspense fallback={<Loader variant="table" />}><Outlet /></Suspense></div>
        </main>
      </div>

      {exitAlerts}
      <nav className="bottomnav" aria-label="Navigation">
        {mobileItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className="bn-item">
            <it.icon size={21} strokeWidth={1.6} />
            <span>{it.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        {moreItems.length > 0 && (
          <button className={`bn-item ${moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((o) => !o)}>
            <Ellipsis size={21} strokeWidth={1.6} />
            <span>Plus</span>
          </button>
        )}
      </nav>
      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>Plus</strong>
              <div className="spacer" />
              <button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Fermer"><X {...ICON} /></button>
            </div>
            {moreItems.map((it) => locked(it) ? (
              <span key={it.to} className="sheet-item locked" aria-disabled="true" title={it.lockedHint}>
                <it.icon {...ICON} /> {it.label} <Lock size={14} strokeWidth={1.8} className="nav-lock" />
              </span>
            ) : (
              <NavLink key={it.to} to={it.to} className="sheet-item">
                <it.icon {...ICON} /> {it.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
