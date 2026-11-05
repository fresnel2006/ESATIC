import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import * as api from '../../api/index.js'
import BulletinView from '../../components/BulletinView.jsx'
import { ErrorBox, Loader, useAsync, ICON } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { downloadBulletinPdf } from '../../lib/bulletinPdf.js'

export default function StudentBulletin() {
  const { id } = useParams()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { data: b, loading, error } = useAsync(() => api.getBulletin(id), [id])

  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <div className="row-wrap">
        <Link to="/etudiant/resultats?onglet=bulletins" className="row small"><ArrowLeft {...ICON} /> Retour aux bulletins</Link>
        <div className="spacer" />
        {b && (
          <button className="btn btn-primary" disabled={busy} onClick={async () => {
            setBusy(true)
            try { await downloadBulletinPdf(b) } catch { toast.error('Le PDF n\'a pas pu être créé.') } finally { setBusy(false) }
          }}>
            {busy ? <Loader2 {...ICON} className="spin" /> : <Download {...ICON} />} Télécharger en PDF
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      {loading && !b ? <Loader /> : b && <div className="card"><div className="card-body"><BulletinView data={b.data} code={b.code} version={b.version} /></div></div>}
    </div>
  )
}
