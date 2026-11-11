// Dépôt des bulletins par l'établissement (direction pédagogique, éducateurs et administration).
// Les bulletins sont faits hors de la plateforme ; ici on dépose le fichier de chaque étudiant
// (PDF), et l'étudiant le retrouve dans son espace.
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileBadge, Upload, Eye, Trash2, Files, Loader2, Download } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, Stat, StatusBadge, useAsync, ICON } from '../components/ui.jsx'
import { fmtDateTime } from '../lib/format.js'
import { BULLETIN_ACCEPT, checkBulletinFile, downloadBulletin, fmtSize, openBulletin, sendBulletin } from '../lib/bulletinFiles.js'
import { LEVELS } from '../api/seed.js'


// Fichier du dépôt groupé -> étudiant dont le matricule figure dans le nom du fichier
function matchFiles(files, rows) {
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Matricules les plus longs d'abord : ETU2401 ne doit pas capter ETU24012.pdf
  const students = rows.map((r) => r.student).sort((a, b) => b.matricule.length - a.matricule.length)
  const matched = []
  const unmatched = []
  for (const file of files) {
    const name = norm(file.name.replace(/\.[^.]+$/, ''))
    const s = students.find((x) => name.includes(norm(x.matricule)))
    const problem = checkBulletinFile(file)
    if (!s) unmatched.push({ file, reason: 'aucun matricule de la classe dans le nom du fichier' })
    else if (problem) unmatched.push({ file, reason: problem })
    else matched.push({ file, student: s })
  }
  // Deux fichiers pour le même étudiant : aucun des deux n'est envoyé
  const count = {}
  for (const m of matched) count[m.student.id] = (count[m.student.id] || 0) + 1
  return {
    matched: matched.filter((m) => count[m.student.id] === 1),
    unmatched: [...unmatched, ...matched.filter((m) => count[m.student.id] > 1).map((m) => ({ file: m.file, reason: `plusieurs fichiers pour ${m.student.matricule}` }))],
  }
}

function BulkUpload({ data, onClose, onDone }) {
  const toast = useToast()
  const [plan, setPlan] = useState(null)
  const [progress, setProgress] = useState(null)
  const [errors, setErrors] = useState([])
  const replaced = plan ? plan.matched.filter((m) => data.rows.find((r) => r.student.id === m.student.id)?.bulletin).length : 0

  async function send() {
    const failed = []
    for (let i = 0; i < plan.matched.length; i++) {
      const { file, student } = plan.matched[i]
      setProgress({ done: i, total: plan.matched.length, current: file.name })
      try { await sendBulletin(data.periode.id, student.id, file) } catch (e) { failed.push({ file, reason: e.message }) }
    }
    setProgress({ done: plan.matched.length, total: plan.matched.length })
    const ok = plan.matched.length - failed.length
    if (ok) toast.success(`${ok} bulletin${ok > 1 ? 's' : ''} déposé${ok > 1 ? 's' : ''}. Les étudiants sont prévenus.`)
    onDone()
    if (failed.length) setErrors(failed)
    else onClose()
  }

  return (
    <Modal title="Déposer plusieurs bulletins" onClose={progress && progress.done < progress.total ? () => {} : onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose} disabled={progress && progress.done < progress.total}>Fermer</button>
      {plan && !progress && <button className="btn btn-primary" disabled={!plan.matched.length} onClick={send}><Upload {...ICON} /> Déposer {plan.matched.length} bulletin{plan.matched.length > 1 ? 's' : ''}</button>}
    </>}>
      <div className="stack">
        <p className="small">
          Choisissez les bulletins de <b>{data.classe.name}</b> pour <b>{data.periode.name}</b>, tous en même temps.
          Chaque fichier doit contenir le <b>matricule</b> de l'étudiant dans son nom, par exemple <code>ETU24002.pdf</code> ou <code>Bulletin_S1_ETU24002.pdf</code>.
        </p>
        {!progress && (
          <label className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
            <Files {...ICON} /> Choisir les fichiers
            <input type="file" multiple accept={BULLETIN_ACCEPT} hidden onChange={(e) => { setPlan(matchFiles([...e.target.files], data.rows)); e.target.value = '' }} />
          </label>
        )}
        {plan && (
          <>
            <Notice kind={plan.matched.length ? 'success' : 'danger'}>
              {plan.matched.length} fichier{plan.matched.length > 1 ? 's' : ''} reconnu{plan.matched.length > 1 ? 's' : ''}
              {replaced > 0 && ` (dont ${replaced} qui remplace${replaced > 1 ? 'nt' : ''} un bulletin déjà déposé)`}.
            </Notice>
            {plan.unmatched.length > 0 && (
              <div className="small">
                <b>Fichiers ignorés :</b>
                <ul className="bulk-list">{plan.unmatched.map((u, i) => <li key={i}><span className="mono">{u.file.name}</span> : {u.reason}</li>)}</ul>
              </div>
            )}
          </>
        )}
        {progress && (
          <div className="stack-sm">
            <div className="row small">
              {progress.done < progress.total && <Loader2 size={14} className="spin" />}
              <span>{progress.done} / {progress.total} envoyé{progress.done > 1 ? 's' : ''}{progress.current && progress.done < progress.total ? ` - ${progress.current}` : ''}</span>
            </div>
            <div className="exec-progress"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          </div>
        )}
        {errors.length > 0 && (
          <Notice kind="danger">
            {errors.length} fichier{errors.length > 1 ? 's' : ''} non déposé{errors.length > 1 ? 's' : ''} :
            <ul className="bulk-list">{errors.map((u, i) => <li key={i}><span className="mono">{u.file.name}</span> : {u.reason}</li>)}</ul>
          </Notice>
        )}
      </div>
    </Modal>
  )
}

function ClassBulletins({ periodeId, classeId }) {
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(() => api.listBulletins(periodeId, classeId), [periodeId, classeId])
  const [bulk, setBulk] = useState(false)
  const [busy, setBusy] = useState(null)
  const [remove, setRemove] = useState(null)
  const input = useRef(null)
  const target = useRef(null)

  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader />
  const done = data.rows.filter((r) => r.bulletin).length

  async function upload(file) {
    const r = target.current
    if (!r || !file) return
    setBusy(r.student.id)
    try {
      await sendBulletin(periodeId, r.student.id, file)
      toast.success(`Bulletin de ${r.student.lastName} ${r.student.firstName} déposé. L'étudiant est prévenu.`)
      reload()
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }
  const pick = (r) => { target.current = r; input.current?.click() }
  const run = async (fn) => { try { await fn() } catch (e) { toast.error(e.message) } }

  return (
    <div className="stack">
      <div className="grid-cards">
        <Stat icon={FileBadge} value={`${done} / ${data.rows.length}`} label="Bulletins déposés" tone={done === data.rows.length && done ? 'green' : ''} />
        <Stat icon={FileBadge} value={data.rows.length - done} label="Restant à déposer" tone={data.rows.length - done ? 'red' : 'gray'} />
      </div>
      <div className="row-wrap">
        <p className="small muted" style={{ flex: 1, minWidth: 260 }}>
          PDF uniquement, 2 Mo au maximum par bulletin. Déposer un nouveau fichier remplace l'ancien. L'étudiant est prévenu à chaque dépôt.
        </p>
        <button className="btn btn-primary" disabled={!data.rows.length} onClick={() => setBulk(true)}><Files {...ICON} /> Déposer plusieurs bulletins</button>
      </div>
      <input ref={input} type="file" accept={BULLETIN_ACCEPT} hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = '' }} />
      <div className="card">
        <ResponsiveTable
          rowKey="key"
          rows={data.rows.map((r) => ({ ...r, key: r.student.id }))}
          empty={<Empty icon={FileBadge} title="Aucun étudiant dans cette classe" />}
          columns={[
            { key: 'name', label: 'Étudiant', primary: true, render: (r) => <span>{r.student.lastName} {r.student.firstName} <span className="muted small">{r.student.matricule}</span></span> },
            { key: 'status', label: 'Bulletin', render: (r) => (r.bulletin
              ? <StatusBadge status="rendu" label={r.bulletin.version > 1 ? `Déposé (version ${r.bulletin.version})` : 'Déposé'} />
              : <StatusBadge status="a_faire" label="Pas encore déposé" />) },
            { key: 'file', label: 'Fichier', hideMobile: true, render: (r) => (r.bulletin
              ? <span className="small">{r.bulletin.fileName} <span className="muted">({fmtSize(r.bulletin.size)}) - {fmtDateTime(r.bulletin.uploadedAt)}{r.bulletin.uploadedBy ? `, ${r.bulletin.uploadedBy}` : ''}</span></span>
              : <span className="muted small">-</span>) },
            { key: 'actions', label: '', className: 'actions', render: (r) => (
              <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                {r.bulletin && <button className="btn btn-ghost btn-sm" title="Voir" onClick={() => run(() => openBulletin(r.bulletin.id))}><Eye size={14} /> Voir</button>}
                {r.bulletin && <button className="btn btn-ghost btn-sm" title="Télécharger" aria-label="Télécharger" onClick={() => run(() => downloadBulletin(r.bulletin.id))}><Download size={14} /></button>}
                <button className="btn btn-secondary btn-sm" disabled={busy === r.student.id} onClick={() => pick(r)}>
                  {busy === r.student.id ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {r.bulletin ? 'Remplacer' : 'Déposer'}
                </button>
                {r.bulletin && <button className="btn btn-ghost btn-sm" title="Supprimer" aria-label="Supprimer" onClick={() => setRemove(r)}><Trash2 size={14} /></button>}
              </div>
            ) },
          ]}
        />
      </div>
      {bulk && <BulkUpload data={data} onClose={() => setBulk(false)} onDone={reload} />}
      {remove && (
        <Confirm
          danger
          title="Supprimer ce bulletin ?"
          message={`Le bulletin de ${remove.student.lastName} ${remove.student.firstName} (${data.periode.name}) ne sera plus visible par l'étudiant.`}
          confirmLabel="Supprimer"
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            try { await api.deleteBulletin(remove.bulletin.id); toast.success('Bulletin supprimé.'); reload() } catch (e) { toast.error(e.message) }
          }}
        />
      )}
    </div>
  )
}

export default function BulletinsDepot() {
  const [params, setParams] = useSearchParams()
  const { data, loading, error } = useAsync(() => api.bulletinOptions(), [])
  const periodes = data?.periodes || []
  const classes = data?.classes || []
  const periodeId = params.get('periode') || periodes.find((p) => p.active)?.id || periodes[0]?.id || ''
  const classeId = params.get('classe') || classes[0]?.id || ''
  const setParam = (k, v) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p) }
  const grouped = [...LEVELS, ''].map((l) => [l, classes.filter((c) => (l ? c.level === l : !LEVELS.includes(c.level)))]).filter(([, list]) => list.length)

  return (
    <div>
      <PageHead title="Bulletins" subtitle="Dépôt des bulletins de l'établissement : chaque étudiant retrouve le sien dans son espace" />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : !periodes.length ? (
        <Notice>Aucune période n'est définie. L'administration doit d'abord créer les périodes (Structure &gt; Périodes).</Notice>
      ) : (
        <div className="stack">
          <div className="filters" style={{ marginBottom: 0 }}>
            <select className="select" value={periodeId} onChange={(e) => setParam('periode', e.target.value)} aria-label="Période">
              {periodes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="select" value={classeId} onChange={(e) => setParam('classe', e.target.value)} aria-label="Classe">
              {grouped.map(([l, list]) => (
                <optgroup key={l || 'autres'} label={l || 'Autres'}>
                  {list.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.students} étudiant{c.students > 1 ? 's' : ''})</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {periodeId && classeId && <ClassBulletins periodeId={Number(periodeId)} classeId={Number(classeId)} />}
        </div>
      )}
    </div>
  )
}
