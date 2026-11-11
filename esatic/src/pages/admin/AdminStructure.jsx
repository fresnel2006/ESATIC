import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, StatusBadge, Tabs, useAsync, ICON } from '../../components/ui.jsx'
import { fmtShort, TOOLS } from '../../lib/format.js'
import { LEVELS, LEVEL_NAMES } from '../../api/seed.js'


const TABS = [
  { value: 'classes', label: 'Classes' },
  { value: 'filieres', label: 'Filières' },
  { value: 'matieres', label: 'Matières' },
  { value: 'periodes', label: 'Périodes' },
  { value: 'teaching', label: 'Affectations enseignants' },
]

const SINGULAR = { classes: 'une classe', filieres: 'une filière', matieres: 'une matière', periodes: 'une période', teaching: 'une affectation' }

export default function AdminStructure() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('onglet')) ? params.get('onglet') : 'classes'
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.getStructure(), api.listUsers()]), [])
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [formError, setFormError] = useState('')
  const [level, setLevel] = useState('') // filtre des classes par niveau

  const [s, users] = data || [{ classes: [], filieres: [], matieres: [], periodes: [], teaching: [] }, []]
  const teachers = users.filter((u) => u.role === 'teacher')
  const name = (list, id) => list.find((x) => x.id === id)?.name ?? '-'
  const studentsIn = (cid) => users.filter((u) => u.role === 'student' && u.classeId === cid).length

  const blank = {
    classes: { name: '', code: '', filiereId: s.filieres[0]?.id ?? '', level: 'L1', year: s.school?.settings?.academicYear ?? '' },
    filieres: { name: '', code: '' },
    matieres: { name: '', code: '', coefficient: 1, tools: [] },
    periodes: { name: '', start: '', end: '', active: false },
    teaching: { teacherId: teachers[0]?.id ?? '', classeId: s.classes[0]?.id ?? '', matiereId: s.matieres[0]?.id ?? '' },
  }

  const columns = {
    classes: [
      { key: 'name', label: 'Classe', primary: true },
      { key: 'code', label: 'Code', render: (c) => <span className="mono">{c.code}</span> },
      { key: 'filiere', label: 'Filière', render: (c) => name(s.filieres, c.filiereId) },
      { key: 'level', label: 'Niveau' },
      { key: 'year', label: 'Année' },
      { key: 'students', label: 'Étudiants', render: (c) => studentsIn(c.id) },
    ],
    filieres: [
      { key: 'name', label: 'Filière', primary: true },
      { key: 'code', label: 'Code', render: (f) => <span className="mono">{f.code}</span> },
      { key: 'classes', label: 'Classes', render: (f) => s.classes.filter((c) => c.filiereId === f.id).length },
    ],
    matieres: [
      { key: 'name', label: 'Matière', primary: true },
      { key: 'code', label: 'Code', render: (m) => <span className="mono">{m.code}</span> },
      { key: 'coefficient', label: 'Coefficient' },
      { key: 'tools', label: 'Outils informatiques', render: (m) => (m.tools?.length
        ? <span className="row-wrap" style={{ gap: 4 }}>{m.tools.map((t) => <span key={t} className="tag">{TOOLS[t]?.label ?? t}</span>)}</span>
        : <span className="muted small">Aucun (QCM et questions ouvertes)</span>) },
    ],
    periodes: [
      { key: 'name', label: 'Période', primary: true },
      { key: 'start', label: 'Début', render: (p) => fmtShort(p.start) },
      { key: 'end', label: 'Fin', render: (p) => fmtShort(p.end) },
      { key: 'active', label: 'État', render: (p) => (p.active ? <StatusBadge status="en_cours" label="En cours" /> : <StatusBadge status="a_faire" label="Inactive" />) },
    ],
    teaching: [
      { key: 'teacher', label: 'Enseignant', primary: true, render: (t) => teachers.find((u) => u.id === t.teacherId)?.fullName ?? '-' },
      { key: 'classe', label: 'Classe', render: (t) => name(s.classes, t.classeId) },
      { key: 'matiere', label: 'Matière', render: (t) => name(s.matieres, t.matiereId) },
    ],
  }

  async function save() {
    setFormError('')
    try {
      await api.saveStructureItem(tab, edit)
      toast.success('Enregistré.')
      setEdit(null)
      reload()
    } catch (e) { setFormError(e.message) }
  }

  const set = (p) => setEdit((x) => ({ ...x, ...p }))
  const input = (key, label, type = 'text') => (
    <div className="field">
      <label htmlFor={`s-${key}`}>{label}</label>
      <input id={`s-${key}`} type={type} className="input" value={edit[key] ?? ''} onChange={(e) => set({ [key]: type === 'number' ? Number(e.target.value) : e.target.value })} />
    </div>
  )
  const select = (key, label, list, labelOf = (x) => x.name) => (
    <div className="field">
      <label htmlFor={`s-${key}`}>{label}</label>
      <select id={`s-${key}`} className="select" value={edit[key] ?? ''} onChange={(e) => set({ [key]: Number(e.target.value) })}>
        {list.map((x) => <option key={x.id} value={x.id}>{labelOf(x)}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <PageHead title="Structure" subtitle="Classes, filières, matières, périodes et affectations" actions={
        <button className="btn btn-primary" onClick={() => { setFormError(''); setEdit(blank[tab]) }}><Plus {...ICON} /> Ajouter {SINGULAR[tab]}</button>
      } />
      <div style={{ marginBottom: 16 }}><Tabs items={TABS} value={tab} onChange={(v) => setParams({ onglet: v })} /></div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : (
        <div className="card">
          {tab === 'classes' && (
            <div className="card-header">
              <div className="pills" role="group" aria-label="Filtrer par niveau">
                {['', ...LEVELS].map((l) => (
                  <button key={l || 'all'} className={`pill ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
                    {LEVEL_NAMES[l] || l || 'Tous'} <span className="muted">{(l ? s.classes.filter((c) => c.level === l) : s.classes).length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ResponsiveTable
            rows={tab === 'classes' && level ? s.classes.filter((c) => c.level === level) : s[tab]}
            empty={<Empty title="Aucun élément" />}
            columns={[...columns[tab], {
              key: 'actions', label: '', className: 'actions', render: (x) => (
                <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  {tab !== 'teaching' && <button className="icon-btn" aria-label="Modifier" onClick={() => { setFormError(''); setEdit({ ...x }) }}><Pencil {...ICON} /></button>}
                  <button className="icon-btn" aria-label="Supprimer" onClick={() => setDel(x)}><Trash2 {...ICON} /></button>
                </div>
              ),
            }]}
          />
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Modifier' : `Ajouter ${SINGULAR[tab]}`} onClose={() => setEdit(null)} footer={<>
          <button className="btn btn-secondary" onClick={() => setEdit(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={save}>Enregistrer</button>
        </>}>
          <div className="form-grid cols-2">
            {tab === 'classes' && <>
              <div className="span-2">{input('name', 'Nom de la classe')}</div>
              {input('code', 'Code (utilisé pour l\'import)')}
              {select('filiereId', 'Filière', s.filieres)}
              <div className="field">
                <label htmlFor="s-level">Niveau</label>
                <select id="s-level" className="select" value={edit.level ?? 'L1'} onChange={(e) => set({ level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_NAMES[l] || l}</option>)}
                </select>
              </div>
              {input('year', 'Année académique')}
            </>}
            {tab === 'filieres' && <><div className="span-2">{input('name', 'Nom de la filière')}</div>{input('code', 'Code')}</>}
            {tab === 'matieres' && <>
              <div className="span-2">{input('name', 'Nom de la matière')}</div>
              {input('code', 'Code')}
              {input('coefficient', 'Coefficient', 'number')}
              <div className="span-2 stack-sm">
                <span className="label">Outils informatiques utilisés dans cette matière</span>
                <span className="hint">Les enseignants ne pourront proposer que ces outils dans leurs épreuves. Sans outil, la matière se limite aux QCM et questions ouvertes.</span>
                <div className="tools-grid">
                  {Object.entries(TOOLS).map(([k, t]) => {
                    const on = (edit.tools || []).includes(k)
                    return (
                      <label key={k} className={`choice tool-choice ${on ? 'selected' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => set({ tools: on ? edit.tools.filter((x) => x !== k) : [...(edit.tools || []), k] })} />
                        <span>
                          <strong>{t.label}</strong>
                          <span className="small muted" style={{ display: 'block' }}>{t.code ? 'Questions de code' : k === 'sql' ? 'Requêtes sur base de test' : 'Mise en page avec aperçu'}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </>}
            {tab === 'periodes' && <>
              <div className="span-2">{input('name', 'Nom (par exemple Semestre 1)')}</div>
              {input('start', 'Début', 'date')}
              {input('end', 'Fin', 'date')}
              <label className="checkbox"><input type="checkbox" checked={!!edit.active} onChange={(e) => set({ active: e.target.checked })} /> Période en cours</label>
            </>}
            {tab === 'teaching' && <>
              <div className="span-2">{select('teacherId', 'Enseignant', teachers, (t) => t.fullName)}</div>
              {select('classeId', 'Classe', s.classes)}
              {select('matiereId', 'Matière', s.matieres)}
            </>}
            {formError && <div className="span-2"><Notice kind="danger">{formError}</Notice></div>}
          </div>
        </Modal>
      )}
      {del && (
        <Confirm danger title="Supprimer" message="Cette suppression est définitive." confirmLabel="Supprimer" onClose={() => setDel(null)}
          onConfirm={async () => { try { await api.deleteStructureItem(tab, del.id); toast.success('Supprimé.'); reload() } catch (e) { toast.error(e.message) } }} />
      )}
    </div>
  )
}
