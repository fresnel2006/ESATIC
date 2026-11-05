// Page publique : vérifier qu'un bulletin est authentique à partir de son code (sans connexion)
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ShieldCheck, ShieldX, Search, Loader2 } from 'lucide-react'
import * as api from '../api/index.js'
import Logo from '../components/Logo.jsx'
import { useAsync, ICON } from '../components/ui.jsx'
import { fmtDateTime, fmtNote } from '../lib/format.js'

export default function VerifyBulletin() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [value, setValue] = useState(code || '')
  const { data, loading } = useAsync(() => (code ? api.verifyBulletin(code) : Promise.resolve(undefined)), [code])

  return (
    <div className="verify-page">
      <div className="card verify-card">
        <div className="card-body stack">
          <Logo height={40} />
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>Vérifier un bulletin</h1>
            <p className="muted small">Saisissez le code de vérification imprimé en bas du bulletin.</p>
          </div>
          <form className="code-form" onSubmit={(e) => { e.preventDefault(); if (value.trim()) navigate(`/verifier/${value.trim().toUpperCase()}`) }}>
            <input className="input mono" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="ESA-XXXX-XXXX" aria-label="Code de vérification" />
            <button className="btn btn-primary">{loading ? <Loader2 {...ICON} className="spin" /> : <Search {...ICON} />} Vérifier</button>
          </form>
          {code && !loading && (data ? (
            <div className="verify-result ok">
              <div className="row"><ShieldCheck size={22} /> <strong>Bulletin authentique</strong></div>
              <dl className="info-list">
                {[
                  ['Établissement', data.school], ['Étudiant', data.student], ['Matricule', data.matricule], ['Classe', data.classe],
                  ['Période', data.periode], ['Moyenne générale', `${fmtNote(data.general)}/20 - ${data.mention}`],
                  ['Version', `${data.version}, émise le ${fmtDateTime(data.updatedAt)}`],
                ].map(([k, v]) => <div className="info-row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <p className="small muted">Si les informations du document présenté diffèrent, il a été modifié ou une version plus récente existe.</p>
            </div>
          ) : (
            <div className="verify-result ko">
              <div className="row"><ShieldX size={22} /> <strong>Aucun bulletin ne correspond à ce code</strong></div>
              <p className="small">Vérifiez la saisie. Un code inconnu signifie que le document n'a pas été émis par la plateforme.</p>
            </div>
          ))}
          <Link to="/connexion" className="small">Aller à la connexion</Link>
        </div>
      </div>
    </div>
  )
}
