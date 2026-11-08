import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Hash, Lock, GraduationCap, Eye, EyeOff, Loader2, FlaskConical } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'
import { Modal, Notice, ICON } from '../components/ui.jsx'
import { DEMO_ACCOUNTS } from '../api/seed.js'
import { DEMO_TOOLS, TEST_MODE } from '../config.js'
import * as api from '../api/index.js'
import { ROLE_HOME } from '../lib/format.js'

// Mode test : entrer dans l'espace enseignant sans mot de passe (TEST_MODE.openTeacher, jamais en ligne)
function TeacherTestAccess() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.testAccounts().then(setTeachers).catch((e) => setError(e.message)) }, [])
  if (error) return <div className="test-access"><Notice kind="danger">{error}</Notice></div>
  if (!teachers?.length) return null
  return (
    <div className="test-access">
      <div className="test-access-head"><FlaskConical size={16} strokeWidth={1.7} /> Mode test : espace enseignant sans mot de passe</div>
      <div className="test-access-list">
        {teachers.map((t) => (
          <button key={t.matricule} type="button" className="btn btn-secondary btn-sm" onClick={async () => {
            try {
              const u = await api.testLogin(t.matricule)
              setUser(u)
              navigate('/enseignant', { replace: true })
            } catch (e) { setError(e.message) }
          }}>
            {t.name} <span className="mono small muted">{t.matricule}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { user, login, sessionMessage, clearSessionMessage } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

  if (user) return <Navigate to={user.mustChangePassword ? '/premiere-connexion' : ROLE_HOME[user.role]} replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!identifier.trim() || !password) {
      setError('Saisissez votre identifiant et votre mot de passe.')
      return
    }
    setBusy(true)
    try {
      const u = await login(identifier, password)
      const from = location.state?.from
      navigate(u.mustChangePassword ? '/premiere-connexion' : from && from.startsWith(ROLE_HOME[u.role].split('/').slice(0, 2).join('/')) ? from : ROLE_HOME[u.role], { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-photo" aria-hidden="true">
        <div className="logo-box"><Logo height={38} /></div>
        <div className="caption">
          <strong>École Supérieure Africaine des TIC</strong>
          <span>Plateforme d'évaluations - Abidjan, Côte d'Ivoire</span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h1>Connexion</h1>
          <div className="auth-divider"><GraduationCap size={26} strokeWidth={1.5} /></div>
          <p className="auth-lead">Votre espace dédié aux évaluations, aux devoirs et au suivi de vos performances académiques</p>

          {sessionMessage && (
            <div style={{ width: '100%', marginBottom: 16, textAlign: 'left' }}>
              <Notice>{sessionMessage}</Notice>
            </div>
          )}

          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="auth-input">
              <Hash {...ICON} />
              <input
                placeholder="Identifiant"
                aria-label="Identifiant (matricule ou email)"
                autoComplete="username"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); clearSessionMessage() }}
                autoFocus
              />
            </div>
            <div className="auth-input">
              <Lock {...ICON} />
              <input
                type={show ? 'text' : 'password'}
                placeholder="Mot de passe"
                aria-label="Mot de passe"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="icon-btn eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {show ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
              </button>
            </div>
            {error && <div className="error-text" role="alert" style={{ textAlign: 'left' }}>{error}</div>}
            <button className="btn btn-primary btn-lg auth-submit" disabled={busy}>
              {busy && <Loader2 {...ICON} className="spin" />} Connecter
            </button>
          </form>

          <p className="auth-forgot">
            Mot de passe oublié, demander un<br />
            <button type="button" onClick={() => setForgot(true)}>nouveau mot de passe</button>
          </p>

          {TEST_MODE.openTeacher && <TeacherTestAccess />}

          {DEMO_TOOLS && (
            <details className="demo-box">
              <summary>Comptes de démonstration</summary>
              {DEMO_ACCOUNTS.map((a) => (
                <div className="demo-row" key={a.login}>
                  <span style={{ flex: 1 }}>{a.label} : <span className="mono">{a.login}</span> / <span className="mono">{a.password}</span></span>
                  <button type="button" onClick={() => { setIdentifier(a.login); setPassword(a.password) }}>Remplir</button>
                </div>
              ))}
            </details>
          )}
        </div>
      </div>

      {forgot && (
        <Modal title="Nouveau mot de passe" onClose={() => setForgot(false)} footer={<button className="btn btn-primary" onClick={() => setForgot(false)}>J'ai compris</button>}>
          <div className="stack">
            <p>Pour des raisons de sécurité, les mots de passe sont réinitialisés par l'école.</p>
            <p>Présentez-vous à l'administration avec votre carte d'étudiant, ou adressez-vous au surveillant si vous êtes en salle d'examen. Un mot de passe provisoire vous sera remis ; vous devrez le changer à la connexion suivante.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
