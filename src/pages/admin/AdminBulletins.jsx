import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileBadge, Send, Eye, Plus, Trash2, Download, History, Save } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import BulletinView from '../../components/BulletinView.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, Stat, StatusBadge, Tabs, useAsync, ICON } from '../../components/ui.jsx'
import { fmtDateTime, fmtNote } from '../../lib/format.js'
import { downloadBulletinPdf } from '../../lib/bulletinPdf.js'

function Preview({ row, onClose, onChanged }) {
  const toast = useToast()
  const b = row.bulletin
  const [full, setFull] = useState(null)
  const [appr, setAppr] = useState(row.preview.appreciationGenerale)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (b) api.getBulletin(b.id).then(setFull)
  }, [b])

  return (
    <Modal wide title={`Bulletin - ${row.student.lastName} ${row.student.firstName}`} onClose={onClose} footer={<>
      {full && <button className="btn btn-secondary" onClick={() => downloadBulletinPdf(full)}><Download {...ICON} /> PDF</button>}
      <button className="btn btn-primary" onClick={onClose}>Fermer</button>
    </>}>
      <div className="stack">
        {!b && <Notice>Aperçu : ce bulletin n'est pas encore publié, l'étudiant ne le voit pas.</Notice>}
        {b?.changed && <Notice kind="danger">Les notes ont changé depuis la publication. Republiez pour mettre ce bulletin à jour (une nouvelle version sera créée).</Notice>}
        <BulletinView data={full && !b?.changed ? full.data : row.preview} code={b?.code ?? 'attribué à la publication'} version={b?.version ?? 1} />

        {b && (
          <div className="card"><div className="card-body stack-sm">
            <span className="label">Modifier l'appréciation générale (crée une nouvelle version)</span>
            <textarea className="textarea" style={{ minHeight: 70 }} value={appr} onChange={(e) => setAppr(e.target.value)} />
            <input className="input" placeholder="Motif de la modification (obligatoire)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div>
              <button className="btn btn-secondary" disabled={busy} onClick={async () => {
                setBusy(true)
                try { setFull(await api.setBulletinAppreciation(b.id, appr, reason)); setReason(''); toast.success('Nouvelle version enregistrée.'); onChanged() } catch (e) { toast.error(e.message) } finally { setBusy(false) }
              }}><Save {...ICON} /> Enregistrer la modification</button>
            </div>
          </div></div>
        )}

        {full?.history?.length > 0 && (
          <div className="card"><div className="card-header"><h2><History size={16} /> Historique des versions</h2></div><div className="card-body event-list">
            <div className="event-item"><time>v{full.version}</time><span>Version actuelle - {fmtDateTime(full.updatedAt)}</span></div>
            {[...full.history].reverse().map((h) => (
              <div className="event-item" key={h.version}>
                <time>v{h.version}</time>
                <span>{fmtDateTime(h.updatedAt)} - moyenne {fmtNote(h.data.general)}/20, {h.data.mention}{h.replacedBecause ? ` - remplacée : ${h.replacedBecause}` : ''}</span>
              </div>
            ))}
          </div></div>
        )}
      </div>
    </Modal>
  )
}

function CalculTab({ periodeId, classeId }) {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.bulletinPreview(periodeId, classeId), [periodeId, classeId])
  const [open, setOpen] = useState(null)
  const [publish, setPublish] = useState(false)
  const [reason, setReason] = useState('')

  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader />
  const published = data.rows.filter((r) => r.bulletin).length
  const changed = data.rows.filter((r) => r.bulletin?.changed).length
  const toPublish = data.rows.length - published

  return (
    <div className="stack">
      <div className="grid-cards">
        <Stat icon={FileBadge} value={`${published}/${data.rows.length}`} label="Bulletins publiés" tone="green" />
        <Stat icon={FileBadge} value={changed} label="À republier (notes modifiées)" tone={changed ? 'red' : 'gray'} />
        <Stat icon={FileBadge} value={data.classStats ? fmtNote(data.classStats.average) : '-'} label="Moyenne de la classe /20" />
        <Stat icon={FileBadge} value={data.classStats ? `${fmtNote(data.classStats.min)} - ${fmtNote(data.classStats.max)}` : '-'} label="Moyenne min - max" tone="gray" />
      </div>
      <div className="row-wrap">
        <p className="small muted" style={{ flex: 1, minWidth: 260 }}>
          Notes prises en compte : épreuves de la classe dont les notes sont publiées et qui se terminent dans la période, plus les notes saisies. Moyenne générale pondérée par les coefficients des matières (Structure). Rang {data.showRank ? 'affiché' : 'masqué'} (Paramètres).
        </p>
        <button className="btn btn-primary" disabled={!toPublish && !changed} onClick={() => setPublish(true)}>
          <Send {...ICON} /> {published ? 'Publier les mises à jour' : 'Publier les bulletins'}
        </button>
      </div>
      <div className="card">
        <ResponsiveTable
          rowKey="key"
          rows={data.rows.map((r) => ({ ...r, key: r.student.id }))}
          onRowClick={setOpen}
          empty={<Empty icon={FileBadge} title="Aucun étudiant dans cette classe" />}
          columns={[
            { key: 'name', label: 'Étudiant', primary: true, render: (r) => <span>{r.student.lastName} {r.student.firstName} <span className="muted small">{r.student.matricule}</span></span> },
            ...data.rows[0]?.lines.map((l, j) => ({ key: `m${l.matiereId}`, label: l.matiere.split(' ')[0], hideMobile: true, render: (r) => fmtNote(r.lines[j].avg) })) ?? [],
            { key: 'general', label: 'Moyenne', render: (r) => <strong>{fmtNote(r.general)}</strong> },
            { key: 'mention', label: 'Mention' },
            { key: 'rank', label: 'Rang', render: (r) => r.rank ?? '-' },
            { key: 'status', label: 'Bulletin', render: (r) => (r.bulletin
              ? (r.bulletin.changed ? <StatusBadge status="en_cours" label={`v${r.bulletin.version} - à republier`} /> : <StatusBadge status="rendu" label={`Publié v${r.bulletin.version}`} />)
              : <StatusBadge status="a_faire" label="Non publié" />) },
            { key: 'actions', label: '', className: 'actions', render: (r) => <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOpen(r) }}><Eye size={14} /> Aperçu</button> },
          ]}
        />
      </div>
      {open && <Preview row={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {publish && (
        <Modal title="Publier les bulletins" onClose={() => setPublish(false)} footer={<>
          <button className="btn btn-secondary" onClick={() => setPublish(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={async () => {
            try {
              const r = await api.publishBulletins(periodeId, classeId, reason)
              toast.success(`${r.created} bulletin(s) publié(s), ${r.updated} mis à jour. Les étudiants sont prévenus.`)
              setPublish(false); setReason(''); reload()
            } catch (e) { toast.error(e.message) }
          }}>Publier</button>
        </>}>
          <div className="stack">
            <p>{toPublish} nouveau(x) bulletin(s){changed ? ` et ${changed} mise(s) à jour` : ''} pour {data.classe.name}, {data.periode.name}.</p>
            <p className="small muted">Après publication, chaque étudiant voit son bulletin et peut le télécharger en PDF avec un code de vérification.</p>
            {changed > 0 && (
              <div className="field">
                <label htmlFor="pub-reason">Motif de la modification (obligatoire)</label>
                <input id="pub-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Par exemple : note d'oral ajoutée" />
                <span className="hint">L'ancienne version de chaque bulletin modifié est conservée dans l'historique.</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function NotesTab({ periodeId, classeId, structure, users }) {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.listManualGrades(periodeId, classeId), [periodeId, classeId])
  const students = users.filter((u) => u.role === 'student' && u.classeId === Number(classeId))
  const matIds = [...new Set(structure.teaching.filter((t) => t.classeId === Number(classeId)).map((t) => t.matiereId))]
  const matieres = structure.matieres.filter((m) => matIds.includes(m.id))
  const [f, setF] = useState({ studentId: '', matiereId: '', label: '', score: '' })
  const [del, setDel] = useState(null)

  return (
    <div className="stack">
      <div className="card"><div className="card-body">
        <div className="form-grid cols-3" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor="mg-s">Étudiant</label>
            <select id="mg-s" className="select" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
              <option value="">Choisir</option>{students.map((s) => <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>)}
            </select></div>
          <div className="field"><label htmlFor="mg-m">Matière</label>
            <select id="mg-m" className="select" value={f.matiereId} onChange={(e) => setF({ ...f, matiereId: e.target.value })}>
              <option value="">Choisir</option>{matieres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></div>
          <div className="field"><label htmlFor="mg-l">Intitulé</label><input id="mg-l" className="input" value={f.label} placeholder="Oral, TP papier..." onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
          <div className="field"><label htmlFor="mg-n">Note /20</label><input id="mg-n" className="input" inputMode="decimal" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></div>
          <div><button className="btn btn-primary" onClick={async () => {
            try { await api.saveManualGrade({ ...f, periodeId, classeId }); toast.success('Note enregistrée.'); setF({ ...f, label: f.label, score: '' }); reload() } catch (e) { toast.error(e.message) }
          }}><Plus {...ICON} /> Ajouter la note</button></div>
        </div>
      </div></div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="card">
          <ResponsiveTable
            rows={data}
            empty={<Empty icon={FileBadge} title="Aucune note saisie pour cette période" />}
            columns={[
              { key: 'student', label: 'Étudiant', primary: true },
              { key: 'matiere', label: 'Matière' },
              { key: 'label', label: 'Intitulé' },
              { key: 'score', label: 'Note', render: (g) => <strong>{fmtNote(g.score)}/20</strong> },
              { key: 'actions', label: '', className: 'actions', render: (g) => <button className="icon-btn" aria-label="Supprimer la note" onClick={() => setDel(g)}><Trash2 {...ICON} /></button> },
            ]}
          />
        </div>
      )}
      {del && <Confirm danger title="Supprimer la note" message={`${del.student} - ${del.label} : ${fmtNote(del.score)}/20`} confirmLabel="Supprimer" onClose={() => setDel(null)} onConfirm={async () => { await api.deleteManualGrade(del.id); reload() }} />}
    </div>
  )
}

function ModeleTab() {
  const toast = useToast()
  const { data, loading } = useAsync(() => api.getBulletinTemplate(), [])
  const [tpl, setTpl] = useState(null)
  const t = tpl ?? data
  if (loading && !data) return <Loader />
  return (
    <div className="card" style={{ maxWidth: 680 }}><div className="card-body stack">
      <div className="field"><label htmlFor="tp-t">Titre du document</label><input id="tp-t" className="input" value={t.title} onChange={(e) => setTpl({ ...t, title: e.target.value })} /></div>
      <div className="field"><label htmlFor="tp-s">Signataire</label><input id="tp-s" className="input" value={t.signatory} onChange={(e) => setTpl({ ...t, signatory: e.target.value })} /></div>
      <div className="field"><label htmlFor="tp-f">Mention en bas de page</label><input id="tp-f" className="input" value={t.footer} onChange={(e) => setTpl({ ...t, footer: e.target.value })} /></div>
      <p className="small muted">Le logo, le nom de l'école et l'année académique viennent des Paramètres ; les coefficients, de Structure &gt; Matières ; l'affichage du rang, de Paramètres &gt; Résultats.</p>
      <div><button className="btn btn-primary" onClick={async () => { await api.saveBulletinTemplate(t); toast.success('Modèle enregistré. Il s\'applique aux prochaines publications.') }}><Save {...ICON} /> Enregistrer le modèle</button></div>
    </div></div>
  )
}

export default function AdminBulletins() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') || 'calcul'
  const { data, loading, error } = useAsync(() => Promise.all([api.getStructure(), api.listUsers()]), [])
  const [structure, users] = data || [{ periodes: [], classes: [] }, []]
  const periodeId = params.get('periode') || structure.periodes.find((p) => p.active)?.id || structure.periodes[0]?.id || ''
  const classeId = params.get('classe') || structure.classes[0]?.id || ''
  const setParam = (k, v) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p) }

  return (
    <div>
      <PageHead title="Bulletins" subtitle="Calcul des moyennes, notes saisies, modèle et publication" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
        <div className="stack">
          <div className="filters" style={{ marginBottom: 0 }}>
            <select className="select" value={periodeId} onChange={(e) => setParam('periode', e.target.value)} aria-label="Période">
              {structure.periodes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select" value={classeId} onChange={(e) => setParam('classe', e.target.value)} aria-label="Classe">
              {structure.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Tabs value={tab} onChange={(v) => setParam('onglet', v)} items={[
            { value: 'calcul', label: 'Calcul et publication' },
            { value: 'notes', label: 'Notes saisies (oral, TP papier)' },
            { value: 'modele', label: 'Modèle' },
          ]} />
          {tab === 'calcul' && periodeId && classeId && <CalculTab periodeId={Number(periodeId)} classeId={Number(classeId)} />}
          {tab === 'notes' && periodeId && classeId && <NotesTab periodeId={Number(periodeId)} classeId={Number(classeId)} structure={structure} users={users} />}
          {tab === 'modele' && <ModeleTab />}
        </div>
      )}
    </div>
  )
}
