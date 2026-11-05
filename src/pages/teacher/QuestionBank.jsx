import { useState } from 'react'
import { Plus, Library, Pencil, Trash2 } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import QuestionEditor, { newQuestion } from '../../components/QuestionEditor.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, PageHead, ResponsiveTable, useAsync, ICON } from '../../components/ui.jsx'
import { QUESTION_TYPES, LANGUAGES } from '../../lib/format.js'

export default function QuestionBank() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.listBank(), api.myTeaching()]), [])
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [type, setType] = useState('')
  const [matiere, setMatiere] = useState('')
  const [q, setQ] = useState('')

  const [bank, teaching] = data || [[], { matieres: [] }]
  const rows = bank.filter((b) => (!type || b.type === type) && (!matiere || b.matiereId === Number(matiere)) && (!q || b.statement.toLowerCase().includes(q.toLowerCase())))

  async function save() {
    try {
      await api.saveBankQuestion(edit)
      toast.success('Question enregistrée dans la banque.')
      setEdit(null)
      reload()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <PageHead
        title="Banque de questions"
        subtitle="Questions réutilisables dans vos épreuves"
        actions={
          <select className="select" style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && setEdit({ ...newQuestion(e.target.value), id: null, matiereId: teaching.matieres[0]?.id ?? null, tags: [] })}>
            <option value="">Nouvelle question...</option>
            {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        }
      />
      <div className="filters">
        <input className="input" placeholder="Rechercher dans les énoncés" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select" value={matiere} onChange={(e) => setMatiere(e.target.value)}>
          <option value="">Toutes les matières</option>
          {teaching.matieres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows}
            empty={<Empty icon={Library} title="Aucune question">Ajoutez des questions ici, ou depuis l'assistant avec « Ajouter à la banque ».</Empty>}
            columns={[
              { key: 'statement', label: 'Énoncé', primary: true, render: (b) => <span style={{ display: 'block', maxWidth: 520 }}>{b.statement}</span> },
              { key: 'type', label: 'Type', render: (b) => QUESTION_TYPES[b.type] + (b.type === 'code' ? ` - ${LANGUAGES[b.data.language]}` : '') },
              { key: 'matiere', label: 'Matière' },
              { key: 'points', label: 'Points' },
              { key: 'actions', label: '', className: 'actions', render: (b) => (
                <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  <button className="icon-btn" aria-label="Modifier" onClick={() => setEdit(JSON.parse(JSON.stringify(b)))}><Pencil {...ICON} /></button>
                  <button className="icon-btn" aria-label="Supprimer" onClick={() => setDel(b)}><Trash2 {...ICON} /></button>
                </div>
              ) },
            ]}
          />
        </div>
      )}
      {edit && (
        <Modal wide title={edit.id ? 'Modifier la question' : 'Nouvelle question'} onClose={() => setEdit(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setEdit(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={save}><Plus {...ICON} /> Enregistrer</button>
        </>}>
          <div className="stack">
            <div className="field">
              <label htmlFor="b-mat">Matière</label>
              <select id="b-mat" className="select" value={edit.matiereId ?? ''} onChange={(e) => setEdit({ ...edit, matiereId: Number(e.target.value) || null })}>
                <option value="">Aucune</option>
                {teaching.matieres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <QuestionEditor q={edit} onChange={(nq) => setEdit({ ...edit, ...nq })} />
          </div>
        </Modal>
      )}
      {del && <Confirm danger title="Supprimer la question" message="Cette question sera retirée de votre banque. Les épreuves qui l'utilisent déjà ne sont pas modifiées." confirmLabel="Supprimer" onClose={() => setDel(null)} onConfirm={async () => { await api.deleteBankQuestion(del.id); reload() }} />}
    </div>
  )
}
