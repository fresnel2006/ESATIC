import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { Avatar, Notice, PageHead, ICON } from '../../components/ui.jsx'
import { ROLE_LABELS, fmtDateTime } from '../../lib/format.js'

// Profil en lecture seule : ces informations sont fournies et tenues à jour par l'école.
export default function Profile() {
  const { user } = useAuth()

  const rows = [
    ['Matricule', <span className="mono" key="m">{user.matricule}</span>],
    ['Nom', user.lastName],
    ['Prénom', user.firstName],
    ['Email institutionnel', user.email || '-'],
    user.role === 'student' && ['Classe', user.classe || '-'],
    ['Rôle', ROLE_LABELS[user.role]],
    ['Dernière connexion', fmtDateTime(user.lastLoginAt)],
  ].filter(Boolean)

  return (
    <>
      <PageHead title="Profil" subtitle="Informations fournies par l'école" />
      <div className="card profile-card" style={{ maxWidth: 680 }}>
        <div className="card-body stack">
          <div className="row">
            <Avatar name={user.fullName} size={56} />
            <div>
              <h2>{user.fullName}</h2>
              <p className="muted small">{ROLE_LABELS[user.role]}{user.classe ? ` - ${user.classe}` : ''}</p>
            </div>
          </div>
          <dl className="info-list">
            {rows.map(([k, v]) => (
              <div className="info-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <Notice>
            <strong>Ces informations ne sont pas modifiables ici.</strong> Elles sont enregistrées par l'administration de l'école.
            En cas d'erreur, adressez-vous à la scolarité.
          </Notice>
          <div>
            <Link to="/compte/mot-de-passe" className="btn btn-secondary"><KeyRound {...ICON} /> Changer mon mot de passe</Link>
          </div>
        </div>
      </div>
    </>
  )
}
