// Direction pédagogique (et administration) : dépôt des emplois du temps en PDF, pour une ou plusieurs classes
// et, au besoin, pour des enseignants nommément. Les étudiants et enseignants concernés sont prévenus.
import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Eye, FileUp, Pencil, Plus, Search, Trash2, TriangleAlert, Loader2 } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, useAsync, ICON } from '../components/ui.jsx'
import ClassPicker from '../components/ClassPicker.jsx'
import { TimetableBadge, TimetableViewer, validity } from '../components/TimetableWidgets.jsx'
import { fmtSize } from '../lib/bulletinFiles.js'
import { TIMETABLE_ACCEPT, checkTimetableFile, timetablePayload } from '../lib/timetableFiles.js'
import { fmtDateTime } from '../lib/format.js'

function TeacherPicker({ teachers, value, onChange }) {
  const [q, setQ] = useState('')
  const list = teachers.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="tt-teachers">
      <input className="input" placeholder="Rechercher un enseignant..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un enseignant" />
      <div className="tt-teachers-list">
        {list.map((t) => (
          <label key={t.id} className="checkbox small">
            <input type="checkbox" checked={value.includes(t.id)} onChange={() => toggle(t.id)} /> {t.name}
          </label>
        ))}
        {!list.length && <span className="small muted">Aucun enseignant trouvé.</span>}
      </div>
    </div>
  )
}

function TimetableForm({ item, options, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    title: item?.title ?? '', note: item?.note ?? '',
    validFrom: item?.validFrom ?? '', validTo: item?.validTo ?? '',
    classeIds: item?.classeIds ?? [], teacherIds: item?.teacherIds ?? [],
  }))
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [showTeachers, setShowTeachers] = useState(!!item?.teacherIds?.length)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const set = (p) => setF((x) => ({ ...x, ...p }))

  function pick(fl) {
    if (!fl) return
    const problem = checkTimetableFile(fl)
    if (problem) { setError(problem); return }
    setError(''); setFile(fl)
    if (!f.title) set({ title: fl.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() })
  }
  async function save() {
    setError('')
    if (!item && !file) { setError('Choisissez le fichier PDF de l\'emploi du temps.'); return }
    setBusy(true)
    try {
      await api.saveTimetable({ id: item?.id, ...f, validFrom: f.validFrom || null, validTo: f.validTo || null, file: file ? await timetablePayload(file) : null })
      onSaved(!item); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal wide title={item ? 'Modifier l\'emploi du temps' : 'Déposer un emploi du temps'} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <Loader2 {...ICON} className="spin" /> : <FileUp {...ICON} />} {item ? 'Enregistrer' : 'Déposer et prévenir'}</button>
    </>}>
      <div className="form-grid cols-2">
        <div className="span-2">
          <div
            className={`tt-drop ${drag ? 'drag' : ''} ${file ? 'has-file' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
            role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          >
            <FileUp size={28} strokeWidth={1.5} />
            {file ? <span><strong>{file.name}</strong> · {fmtSize(file.size)}<span className="small muted" style={{ display: 'block' }}>Cliquez pour choisir un autre fichier</span></span>
              : item ? <span><strong>{item.fileName}</strong> · {fmtSize(item.size)}<span className="small muted" style={{ display: 'block' }}>Glissez un nouveau PDF ici pour le remplacer (facultatif)</span></span>
                : <span><strong>Glissez le PDF ici</strong> ou cliquez pour le choisir<span className="small muted" style={{ display: 'block' }}>PDF uniquement, 3 Mo au maximum</span></span>}
          </div>
          <input ref={input} type="file" accept={TIMETABLE_ACCEPT} hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }} />
        </div>
        <div className="field span-2"><label htmlFor="tt-title">Titre</label><input id="tt-title" className="input" maxLength={120} value={f.title} placeholder="Ex. : Semaine du 17 au 22 novembre - Semestre 1" onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="field"><label htmlFor="tt-from">Valable à partir du <span className="muted small">(facultatif)</span></label><input id="tt-from" type="date" className="input" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></div>
        <div className="field"><label htmlFor="tt-to">Jusqu'au <span className="muted small">(facultatif)</span></label><input id="tt-to" type="date" className="input" value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} /></div>
        <div className="field span-2"><label htmlFor="tt-note">Message pour les étudiants <span className="muted small">(facultatif)</span></label><input id="tt-note" className="input" maxLength={300} value={f.note} placeholder="Ex. : Les cours du samedi ont lieu en salle B12." onChange={(e) => set({ note: e.target.value })} /></div>
        <div className="field span-2">
          <label>Classes concernées</label>
          <ClassPicker classes={options.classes} value={f.classeIds} onChange={(ids) => set({ classeIds: ids })} />
        </div>
        <div className="field span-2">
          <label className="checkbox"><input type="checkbox" checked={showTeachers} onChange={(e) => { setShowTeachers(e.target.checked); if (!e.target.checked) set({ teacherIds: [] }) }} /> Emploi du temps personnel d'un ou plusieurs enseignants</label>
          {showTeachers && <TeacherPicker teachers={options.teachers} value={f.teacherIds} onChange={(ids) => set({ teacherIds: ids })} />}
          <span className="hint">Les enseignants des classes cochées le voient déjà ; cochez des enseignants seulement pour un emploi du temps qui leur est propre.</span>
        </div>
        {error && <div className="span-2"><Notice kind="danger">{error}</Notice></div>}
      </div>
    </Modal>
  )
}

export default function TimetablesManage() {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.listTimetables(), [])
  const [form, setForm] = useState(null) // 'new' | emploi du temps
  const [view, setView] = useState(null)
  const [classeId, setClasseId] = useState('')
  const [q, setQ] = useState('')

  const items = useMemo(() => (data?.items || [])
    .filter((t) => !classeId || t.classeIds.includes(Number(classeId)))
    .filter((t) => !q.trim() || `${t.title} ${t.classes.join(' ')} ${t.teachers.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())), [data, classeId, q])
  const missing = useMemo(() => (data ? data.classes.filter((c) => c.students > 0 && !data.items.some((t) => t.current && t.classeIds.includes(c.id))) : []), [data])

  async function remove(t) {
    if (!window.confirm(`Supprimer « ${t.title} » ? Les étudiants ne le verront plus.`)) return
    try { await api.deleteTimetable(t.id); toast.success('Emploi du temps supprimé.'); reload() } catch (e) { toast.error(e.message) }
  }

  return (
    <div>
      <PageHead title="Emplois du temps" subtitle="Déposez les emplois du temps en PDF : les étudiants et les enseignants concernés les retrouvent dans leur espace" actions={
        <button className="btn btn-primary" disabled={!data} onClick={() => setForm('new')}><Plus {...ICON} /> Déposer un emploi du temps</button>
      } />
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="table" /> : (
        <div className="stack">
          {missing.length > 0 && data.items.length > 0 && (
            <div className="tt-missing"><TriangleAlert size={16} /> <span><b>{missing.length} classe{missing.length > 1 ? 's' : ''} sans emploi du temps en cours :</b> {missing.map((c) => c.name).join(', ')}</span></div>
          )}
          <div className="card">
            <div className="card-header tt-filters">
              <div className="search-inline"><Search size={16} /><input className="input" placeholder="Rechercher (titre, classe, enseignant)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" /></div>
              <select className="select" style={{ width: 'auto' }} value={classeId} onChange={(e) => setClasseId(e.target.value)} aria-label="Classe">
                <option value="">Toutes les classes</option>
                {[...data.classes].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <ResponsiveTable
              rowKey="id"
              rows={items}
              onRowClick={setView}
              empty={<Empty icon={CalendarDays} title={data.items.length ? 'Aucun emploi du temps ne correspond' : 'Aucun emploi du temps déposé'}>{data.items.length ? 'Changez la recherche ou la classe.' : 'Déposez le premier emploi du temps : un PDF pour une ou plusieurs classes.'}</Empty>}
              columns={[
                { key: 'title', label: 'Emploi du temps', primary: true, render: (t) => <span><strong style={{ fontWeight: 600 }}>{t.title}</strong> <TimetableBadge t={t} /><span className="small muted" style={{ display: 'block' }}>{validity(t)}</span></span> },
                { key: 'targets', label: 'Concerne', render: (t) => <span className="small">{[t.classes.join(', '), t.teachers.length ? `Enseignant(s) : ${t.teachers.join(', ')}` : ''].filter(Boolean).join(' · ')}</span> },
                { key: 'file', label: 'Fichier', hideMobile: true, render: (t) => <span className="small muted">{fmtSize(t.size)}{t.version > 1 ? ` · v${t.version}` : ''}</span> },
                { key: 'at', label: 'Déposé', hideMobile: true, render: (t) => <span className="small">{fmtDateTime(t.uploadedAt)}<span className="muted" style={{ display: 'block' }}>{t.uploadedBy}</span></span> },
                { key: 'actions', label: '', className: 'actions', render: (t) => (
                  <span className="row" style={{ gap: 2, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" aria-label="Voir" title="Voir" onClick={() => setView(t)}><Eye size={16} /></button>
                    <button className="icon-btn" aria-label="Modifier" title="Modifier ou remplacer le PDF" onClick={() => setForm(t)}><Pencil size={16} /></button>
                    <button className="icon-btn" aria-label="Supprimer" title="Supprimer" onClick={() => remove(t)}><Trash2 size={16} /></button>
                  </span>
                ) },
              ]}
            />
          </div>
        </div>
      )}
      {view && (
        <Modal wide title="Aperçu" onClose={() => setView(null)} footer={<button className="btn btn-primary" onClick={() => setView(null)}>Fermer</button>}>
          <TimetableViewer key={`${view.id}:${view.version}`} item={view} />
        </Modal>
      )}
      {form && data && <TimetableForm item={form === 'new' ? null : form} options={data} onClose={() => setForm(null)} onSaved={(isNew) => { toast.success(isNew ? 'Emploi du temps déposé : les étudiants et enseignants concernés sont prévenus.' : 'Emploi du temps enregistré.'); reload() }} />}
    </div>
  )
}
