import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Copy, Pencil, Ban, Trash2, FolderKanban, ClipboardCheck } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Confirm, Empty, ErrorBox, Loader, PageHead, Pills, ResponsiveTable, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'

export default function TeacherEpreuves() {
  const [tab, setTab] = useState('tous')
  const [confirm, setConfirm] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.listAssessments(), [])
  const list = (data || []).filter((a) => tab === 'tous' || (tab === 'devoir' && a.kind === 'devoir') || (tab === 'examen' && a.kind === 'examen') || (tab === 'brouillon' && a.status === 'brouillon'))

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); reload() } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <PageHead
        title="Mes épreuves"
        subtitle="Devoirs et examens que vous avez créés"
        actions={<Link to="/enseignant/epreuves/nouvelle" className="btn btn-primary"><Plus {...ICON} /> Nouvelle épreuve</Link>}
      />
      <div style={{ marginBottom: 16 }}>
        <Pills value={tab} onChange={setTab} items={[
          { value: 'tous', label: 'Toutes' }, { value: 'devoir', label: 'Devoirs' },
          { value: 'examen', label: 'Examens' }, { value: 'brouillon', label: 'Brouillons' },
        ]} />
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : (
        <div className="card">
          <ResponsiveTable
            rows={list}
            empty={<Empty icon={FolderKanban} title="Aucune épreuve">Créez votre première épreuve avec l'assistant.</Empty>}
            columns={[
              { key: 'title', label: 'Épreuve', primary: true, render: (a) => <Link to={`/enseignant/epreuves/${a.id}`}>{a.title}</Link> },
              { key: 'kind', label: 'Type', render: (a) => (a.kind === 'examen' ? 'Examen' : 'Devoir') },
              { key: 'classe', label: 'Classe' },
              { key: 'endAt', label: 'Échéance', render: (a) => fmtDateTime(a.kind === 'examen' ? a.startAt : a.endAt) },
              { key: 'submitted', label: 'Rendus', render: (a) => `${a.submitted}/${a.classSize}` },
              { key: 'status', label: 'Statut', render: (a) => <StatusBadge status={a.status} /> },
              {
                key: 'actions', label: '', className: 'actions', render: (a) => (
                  <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                    <button className="icon-btn" title="Modifier" aria-label="Modifier" onClick={() => navigate(`/enseignant/epreuves/${a.id}`)}><Pencil {...ICON} /></button>
                    <button className="icon-btn" title="Dupliquer" aria-label="Dupliquer" onClick={() => act(async () => { const id = await api.duplicateAssessment(a.id); navigate(`/enseignant/epreuves/${id}`) }, 'Épreuve dupliquée en brouillon.')}><Copy {...ICON} /></button>
                    {a.submitted > 0 && <button className="icon-btn" title="Corriger" aria-label="Corriger" onClick={() => navigate(`/enseignant/corrections?epreuve=${a.id}`)}><ClipboardCheck {...ICON} /></button>}
                    {a.status === 'publie' && <button className="icon-btn" title="Annuler l'épreuve" aria-label="Annuler l'épreuve" onClick={() => setConfirm({ a, type: 'annule' })}><Ban {...ICON} /></button>}
                    {a.status === 'brouillon' && <button className="icon-btn" title="Supprimer" aria-label="Supprimer" onClick={() => setConfirm({ a, type: 'delete' })}><Trash2 {...ICON} /></button>}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      {confirm && (
        <Confirm
          danger
          title={confirm.type === 'delete' ? 'Supprimer le brouillon' : 'Annuler l\'épreuve'}
          message={confirm.type === 'delete' ? `Le brouillon « ${confirm.a.title} » sera supprimé définitivement.` : `« ${confirm.a.title} » sera annulée. Les étudiants seront prévenus et ne pourront plus composer. Les copies déjà rendues sont conservées.`}
          confirmLabel={confirm.type === 'delete' ? 'Supprimer' : 'Annuler l\'épreuve'}
          onClose={() => setConfirm(null)}
          onConfirm={() => act(() => (confirm.type === 'delete' ? api.deleteAssessment(confirm.a.id) : api.setAssessmentStatus(confirm.a.id, 'annule')), confirm.type === 'delete' ? 'Brouillon supprimé.' : 'Épreuve annulée.')}
        />
      )}
    </div>
  )
}
