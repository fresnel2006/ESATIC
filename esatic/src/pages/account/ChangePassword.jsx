import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import * as api from '../../api/index.js'
import Logo from '../../components/Logo.jsx'
import { Notice, PageHead, ICON } from '../../components/ui.jsx'
import { ROLE_HOME } from '../../lib/format.js'

function PasswordForm({ onDone, submitLabel }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (next !== confirm) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      const u = await api.changePassword(current, next)
      onDone(u)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="pw-current">Mot de passe actuel</label>
        <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pw-next">Nouveau mot de passe</label>
        <input id="pw-next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <span className="hint">Au moins 8 caractères, avec des lettres et des chiffres.</span>
      </div>
      <div className="field">
        <label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</label>
        <input id="pw-confirm" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <div className="error-text" role="alert">{error}</div>}
      <div>
        <button className="btn btn-primary" disabled={busy}><KeyRound {...ICON} /> {submitLabel}</button>
      </div>
    </form>
  )
}

export default function ChangePassword({ firstLogin }) {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  if (firstLogin) {
    return (
      <div className="auth" style={{ gridTemplateColumns: '1fr' }}>
        <div className="auth-panel">
          <div className="card first-login">
            <div className="first-login-logo"><Logo height={44} /></div>
            <div className="card-body first-login-body">
              <div className="first-login-head">
                <h1>Bienvenue {user.firstName}</h1>
                <p className="muted small">Première connexion</p>
              </div>
              <Notice>Le mot de passe remis par l'école est provisoire. Choisissez maintenant votre mot de passe personnel.</Notice>
              <PasswordForm
                submitLabel="Enregistrer mon mot de passe"
                onDone={(u) => {
                  setUser(u)
                  toast.success('Mot de passe enregistré.')
                  navigate(ROLE_HOME[u.role], { replace: true })
                }}
              />
              <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/connexion') }}>
                <LogOut {...ICON} /> Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHead title="Mot de passe" subtitle="Modifier votre mot de passe de connexion" />
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-body">
          <PasswordForm submitLabel="Modifier le mot de passe" onDone={(u) => { setUser(u); toast.success('Mot de passe modifié.') }} />
        </div>
      </div>
    </>
  )
}
