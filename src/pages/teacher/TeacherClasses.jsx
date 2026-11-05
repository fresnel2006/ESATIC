import { useState } from 'react'
import { Users, Megaphone } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, Modal, PageHead, ResponsiveTable, useAsync, ICON } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function TeacherClasses() {
  const toast = useToast()
  const { data, loading, error } = useAsync(() => api.teacherClasses(), [])
  const [selected, setSelected] = useState(null)
  const [annonce, setAnnonce] = useState(null)
  const classes = data || []
  const current = classes.find((c) => c.id === selected) || classes[0]

  return (
    <div>
      <PageHead title="Mes classes" subtitle="Classes et matières qui vous sont attribuées" actions={current && (
        <button className="btn btn-secondary" onClick={() => setAnnonce({ title: '', body: '', classeId: current.id })}><Megaphone {...ICON} /> Annonce à la classe</button>
      )} />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : classes.length === 0 ? <div className="card"><Empty icon={Users} title="Aucune classe attribuée">L'administration vous attribue vos classes et matières.</Empty></div> : (
        <div className="stack">
          <div className="pills">
            {classes.map((c) => (
              <button key={c.id} className={`pill ${current?.id === c.id ? 'active' : ''}`} onClick={() => setSelected(c.id)}>{c.name}</button>
            ))}
          </div>
          <div className="card"><div className="card-body">
            <div className="row-wrap">
              <strong>{current.name}</strong>
              <span className="muted small">{current.filiere}</span>
              <div className="spacer" />
              {current.matieres.map((m) => <span key={m} className="tag">{m}</span>)}
            </div>
          </div></div>
          <div className="card">
            <ResponsiveTable
              rows={current.students}
              empty={<Empty icon={Users} title="Aucun étudiant dans cette classe" />}
              columns={[
                { key: 'name', label: 'Étudiant', primary: true, render: (s) => `${s.lastName} ${s.firstName}` },
                { key: 'matricule', label: 'Matricule' },
                { key: 'email', label: 'Email' },
                { key: 'lastLoginAt', label: 'Dernière connexion', render: (s) => (s.lastLoginAt ? fmtDateTime(s.lastLoginAt) : 'Jamais connecté') },
              ]}
            />
          </div>
        </div>
      )}
      {annonce && (
        <Modal title={`Annonce - ${classes.find((c) => c.id === annonce.classeId)?.name}`} onClose={() => setAnnonce(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setAnnonce(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={async () => { try { await api.createAnnouncement(annonce); toast.success('Annonce publiée.'); setAnnonce(null) } catch (e) { toast.error(e.message) } }}>Publier</button>
        </>}>
          <div className="stack">
            <div className="field"><label htmlFor="an-t">Titre</label><input id="an-t" className="input" value={annonce.title} onChange={(e) => setAnnonce({ ...annonce, title: e.target.value })} /></div>
            <div className="field"><label htmlFor="an-b">Message</label><textarea id="an-b" className="textarea" value={annonce.body} onChange={(e) => setAnnonce({ ...annonce, body: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
