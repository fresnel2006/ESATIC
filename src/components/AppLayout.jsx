import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, ArrowDownRight, Search, Bell, ChevronsLeft, ChevronsRight,
  UserRound, KeyRound, Moon, Sun, LogOut, Ellipsis, X, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { NAV } from './nav.js'
import Logo from './Logo.jsx'
import { Avatar, ICON } from './ui.jsx'
import { ROLE_LABELS, fmtAgo } from '../lib/format.js'
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
  ['/etudiant/bulletins/', 'Bulletin'],
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
  const { logout } = useAuth()
  useClickOutside(ref, () => setOpen(false))
  const go = (p) => { setOpen(false); navigate(p) }
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

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('esatic-sidebar') === '1')
  const [moreOpen, setMoreOpen] = useState(false)
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
          {items.map((it) => (
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
          <div key={location.pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>

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
            {moreItems.map((it) => (
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
