import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Upload, Pencil, KeyRound, UserX, UserCheck, Download, FileSpreadsheet } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Avatar, Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { ROLE_LABELS, downloadCsv, fmtDateTime, parseCsv } from '../../lib/format.js'
import TeacherAssignments from '../../components/TeacherAssignments.jsx'

function UserForm({ user, structure, onClose, onSaved }) {
  const { classes } = structure
  const [f, setF] = useState(user || { matricule: '', firstName: '', lastName: '', email: '', role: 'student', classeId: classes[0]?.id ?? '' })
  // Enseignant : classes et matières attribuées
  const [assign, setAssign] = useState(() => (structure.teaching || []).filter((t) => user && t.teacherId === user.id).map((t) => ({ classeId: t.classeId, matiereId: t.matiereId })))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const wasTeacher = user?.role === 'teacher'

  async function save() {
    setError('')
    setBusy(true)
    try {
      const r = await api.saveUser(f)
      const id = r.user?.id ?? user?.id
      // Affectations enregistrées après le compte (un enseignant qui change de rôle les perd)
      if (f.role === 'teacher') await api.setTeacherAssignments(id, assign)
      else if (wasTeacher) await api.setTeacherAssignments(id, [])
      if (r.temporaryPassword) setCreated(r)
      else { onSaved(); onClose() }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (created) {
    return (
      <Modal title="Compte créé" onClose={() => { onSaved(); onClose() }} footer={<button className="btn btn-primary" onClick={() => { onSaved(); onClose() }}>Terminé</button>}>
        <div className="stack-sm">
          <p><strong>{created.user.fullName}</strong> - {created.user.matricule}</p>
          <p className="small muted">Mot de passe provisoire à remettre en main propre :</p>
          <div className="session-code" style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>{created.temporaryPassword}</div>
          <p className="small muted">Il devra être changé à la première connexion. Il ne sera plus affiché ensuite.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal wide={f.role === 'teacher'} title={user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{user ? 'Enregistrer' : 'Créer le compte'}</button>
    </>}>
      <div className="form-grid cols-2">
        <div className="field"><label htmlFor="u-mat">Matricule</label><input id="u-mat" className="input" value={f.matricule} onChange={(e) => set({ matricule: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="u-role">Rôle</label>
          <select id="u-role" className="select" value={f.role} onChange={(e) => set({ role: e.target.value })}>
            {['student', 'teacher', 'proctor', 'educator', 'pedagogy', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="u-ln">Nom</label><input id="u-ln" className="input" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} /></div>
        <div className="field"><label htmlFor="u-fn">Prénom</label><input id="u-fn" className="input" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="u-em">Email institutionnel</label>
          <input id="u-em" type="email" className="input" value={f.email} placeholder={`${(f.firstName || 'prenom').toLowerCase()}.${(f.lastName || 'nom').toLowerCase()}@esatic.ci`} onChange={(e) => set({ email: e.target.value })} />
          <span className="hint">Laissé vide, il est attribué automatiquement (prenom.nom@esatic.ci).</span>
        </div>
        {f.role === 'student' && (
          <div className="field">
            <label htmlFor="u-cl">Classe</label>
            <select id="u-cl" className="select" value={f.classeId ?? ''} onChange={(e) => set({ classeId: Number(e.target.value) })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {f.role === 'teacher' && (
          <div className="field span-2">
            <label>Classes et matières attribuées</label>
            <span className="hint">L'enseignant les retrouve dans « Mes classes ». Il peut aussi créer des épreuves pour les autres classes de l'école.</span>
            <TeacherAssignments classes={classes} matieres={structure.matieres || []} value={assign} onChange={setAssign} />
          </div>
        )}
        {error && <div className="span-2"><Notice kind="danger">{error}</Notice></div>}
      </div>
    </Modal>
  )
}

// Import par fichier CSV : étudiants ou enseignants (chacun son modèle de fichier et ses vérifications)
const IMPORTS = {
  students: {
    title: 'Importer des étudiants',
    required: ['matricule', 'nom', 'prenom', 'classe'],
    columns: [['matricule', 'Matricule'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['classe', 'Classe'], ['email', 'Email']],
    send: (rows) => api.importStudents(rows),
    model: (classes) => [{ matricule: 'ETU25001', nom: 'Kouamé', prenom: 'Ange', email: 'ange.kouame@esatic.ci', classe: classes[0]?.code ?? '' }],
    modelName: 'modele-import-etudiants.csv',
    resultName: 'identifiants-provisoires-etudiants.csv',
    result: (c) => ({ Matricule: c.matricule, Nom: c.nom, Prénom: c.prenom, 'Email institutionnel': c.email, Classe: c.classe, 'Mot de passe provisoire': c.motDePasseProvisoire }),
  },
  teachers: {
    title: 'Importer des enseignants',
    required: ['matricule', 'nom', 'prenom'],
    columns: [['matricule', 'Matricule'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['email', 'Email'], ['matiere', 'Matière'], ['classes', 'Classes']],
    send: (rows) => api.importTeachers(rows),
    model: (classes, matieres) => {
      const m1 = matieres[0]?.code ?? ''
      const m2 = matieres[1]?.code ?? m1
      const c = (i) => classes[i]?.name ?? ''
      return [
        { matricule: 'ENS025', nom: 'Koffi', prenom: 'Serge', email: 'serge.koffi@esatic.ci', matiere: m1, classes: [c(0), c(1)].filter(Boolean).join(', ') },
        { matricule: 'ENS025', nom: 'Koffi', prenom: 'Serge', email: 'serge.koffi@esatic.ci', matiere: m2, classes: c(5) || c(2) },
        { matricule: 'ENS026', nom: 'Bamba', prenom: 'Mariam', email: '', matiere: '', classes: '' },
      ]
    },
    modelName: 'modele-import-enseignants.csv',
    resultName: 'identifiants-provisoires-enseignants.csv',
    result: (c) => ({ Matricule: c.matricule, Nom: c.nom, Prénom: c.prenom, 'Email institutionnel': c.email, 'Mot de passe provisoire': c.motDePasseProvisoire, 'Classes attribuées': c.affectations }),
  },
}

function ImportModal({ kind, classes, matieres, onClose, onDone }) {
  const cfg = IMPORTS[kind]
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  async function onFile(file) {
    setError('')
    setResult(null)
    if (!file) return
    setFileName(file.name)
    if (/\.xlsx?$/i.test(file.name)) {
      setRows(null)
      setError('Dans Excel, utilisez « Enregistrer sous » puis « CSV (séparateur : point-virgule) », et importez ce fichier.')
      return
    }
    const parsed = parseCsv(await file.text())
    const missing = cfg.required.filter((c) => !parsed.length || !(c in parsed[0]))
    if (missing.length) { setRows(null); setError(`Colonnes manquantes : ${missing.join(', ')}.`); return }
    setRows(parsed)
  }

  // Envoi par paquets de 100 : une classe entière ou toute l'école, sans dépasser les limites du serveur.
  // Si un paquet échoue, les comptes déjà créés restent affichés avec leurs mots de passe provisoires.
  // Enseignants : les lignes d'un même matricule restent dans le même paquet.
  async function run() {
    setBusy(true)
    setError('')
    const total = { created: [], updated: [], errors: [] }
    const numbered = rows.map((r, i) => ({ ...r, line: i + 2 }))
    const packets = []
    for (const r of numbered) {
      const last = packets[packets.length - 1]
      const sameTeacher = kind === 'teachers' && last && last.some((x) => String(x.matricule).trim().toUpperCase() === String(r.matricule).trim().toUpperCase())
      if (last && (last.length < 100 || sameTeacher)) last.push(r)
      else packets.push([r])
    }
    let done = 0
    try {
      for (const packet of packets) {
        setProgress(`${done} / ${numbered.length}`)
        const r = await cfg.send(packet)
        total.created.push(...r.created)
        total.updated.push(...(r.updated || []))
        total.errors.push(...r.errors)
        done += packet.length
      }
    } catch (e) {
      setError(`Import interrompu à la ligne ${done + 2} : ${e.message} Les comptes déjà créés sont listés ci-dessous ; relancez l'import avec les lignes restantes.`)
    } finally {
      setResult(total)
      setProgress('')
      setBusy(false)
      onDone()
    }
  }

  return (
    <Modal wide title={cfg.title} onClose={onClose} footer={result
      ? <>
        {result.created.length > 0 && <button className="btn btn-secondary" onClick={() => downloadCsv(cfg.resultName, result.created.map(cfg.result))}><Download {...ICON} /> Télécharger les identifiants</button>}
        <button className="btn btn-primary" onClick={onClose}>Terminé</button>
      </>
      : <>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!rows?.length || busy} onClick={run}>{busy ? `Import en cours... ${progress}` : `Importer ${rows?.length || ''} ligne${rows?.length > 1 ? 's' : ''}`}</button>
      </>}>
      {result ? (
        <div className="stack">
          {error && <Notice kind="danger">{error}</Notice>}
          <Notice kind="success">
            {result.created.length} compte(s) créé(s){kind === 'teachers' && result.updated.length ? `, ${result.updated.length} enseignant(s) déjà inscrit(s) complété(s)` : ''}.
            {result.created.length > 0 && ' Téléchargez la liste des mots de passe provisoires maintenant : elle ne sera plus affichée.'}
          </Notice>
          {result.updated.length > 0 && (
            <div className="small">
              <b>Classes ajoutées à des enseignants déjà inscrits :</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.updated.map((u) => <li key={u.line}>{u.nom} {u.prenom} ({u.matricule}) : {u.affectations}</li>)}</ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <Notice kind="danger">
              {result.errors.length} ligne(s) ignorée(s) :
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.errors.map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}</ul>
            </Notice>
          )}
        </div>
      ) : (
        <div className="stack">
          {kind === 'students' ? (
            <p className="small">Fichier CSV avec les colonnes <span className="kbd">matricule</span> <span className="kbd">nom</span> <span className="kbd">prenom</span> <span className="kbd">classe</span> et <span className="kbd">email</span> (email institutionnel ; s'il est vide, il est attribué automatiquement : prenom.nom@esatic.ci). La classe est le code (par exemple {classes[0]?.code}) ou le nom exact.</p>
          ) : (
            <p className="small">
              Fichier CSV avec les colonnes <span className="kbd">matricule</span> <span className="kbd">nom</span> <span className="kbd">prenom</span> <span className="kbd">email</span>, et si vous le souhaitez <span className="kbd">matiere</span> et <span className="kbd">classes</span> pour attribuer ses classes en même temps.
              La matière est le code (par exemple {matieres[0]?.code}) ou le nom exact ; <span className="kbd">classes</span> contient une ou plusieurs classes séparées par des virgules (par exemple « SRIT 2 A, M1 SIGL »).
              Pour plusieurs matières, mettez une ligne par matière avec le même matricule. Un enseignant déjà inscrit garde son compte : seules ses nouvelles classes sont ajoutées.
            </p>
          )}
          <div className="row-wrap">
            <label className="btn btn-secondary">
              <FileSpreadsheet {...ICON} /> Choisir un fichier
              <input type="file" accept=".csv,.txt,.xlsx,.xls" hidden onChange={(e) => onFile(e.target.files[0])} />
            </label>
            <span className="small muted">{fileName || 'Aucun fichier choisi'}</span>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv(cfg.modelName, cfg.model(classes, matieres))}><Download size={14} /> Modèle CSV</button>
          </div>
          {error && <Notice kind="danger">{error}</Notice>}
          {rows && (
            <>
              <p className="small muted">Aperçu : {rows.length} ligne(s)</p>
              <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)' }}>
                <table className="table">
                  <thead><tr>{cfg.columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}>{cfg.columns.map(([key]) => <td key={key}>{r[key]}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function AdminUsers() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.listUsers(), api.getStructure()]), [])
  const [q, setQ] = useState(params.get('q') || '')
  const [role, setRole] = useState('')
  const [classe, setClasse] = useState('')
  const [edit, setEdit] = useState(params.get('nouveau') ? 'new' : null)
  const [importing, setImporting] = useState(params.get('import') ? 'students' : null) // 'students' | 'teachers'
  const [reset, setReset] = useState(null)

  useEffect(() => {
    if (params.get('nouveau') || params.get('import')) setParams({}, { replace: true })
  }, [params, setParams])

  const [users, structure] = data || [[], { classes: [], matieres: [], teaching: [] }]
  const rows = users
    .filter((u) => (!role || u.role === role) && (!classe || u.classeId === Number(classe)))
    .filter((u) => !q || `${u.firstName} ${u.lastName} ${u.matricule} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => x.lastName.localeCompare(y.lastName))

  return (
    <div>
      <PageHead
        title="Utilisateurs"
        subtitle="Aucun compte ne se crée librement : tout passe par l'administration"
        actions={<>
          <button className="btn btn-secondary" onClick={() => setImporting('students')}><Upload {...ICON} /> Importer des étudiants (CSV)</button>
          <button className="btn btn-secondary" onClick={() => setImporting('teachers')}><Upload {...ICON} /> Importer des enseignants (CSV)</button>
          <button className="btn btn-primary" onClick={() => setEdit('new')}><UserPlus {...ICON} /> Nouvel utilisateur</button>
        </>}
      />
      <div className="filters">
        <input className="input" placeholder="Nom, matricule ou email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {['student', 'teacher', 'proctor', 'educator', 'pedagogy', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="select" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
          <option value="">Toutes les classes</option>
          {structure.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {data && <span className="small muted" style={{ alignSelf: 'center' }}>{rows.length} compte(s)</span>}
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader variant="list" /> : (
        <div className="card">
          <ResponsiveTable
            rows={rows}
            empty={<Empty title="Aucun utilisateur ne correspond" />}
            columns={[
              { key: 'name', label: 'Utilisateur', primary: true, render: (u) => (
                <span className="user-cell">
                  <Avatar name={`${u.firstName} ${u.lastName}`} size={32} />
                  <span><strong>{u.lastName} {u.firstName}</strong><span className="small muted">{u.email}</span></span>
                </span>
              ) },
              { key: 'matricule', label: 'Matricule', render: (u) => <span className="mono nowrap">{u.matricule}</span> },
              { key: 'role', label: 'Rôle', render: (u) => ROLE_LABELS[u.role] },
              { key: 'classe', label: 'Classe', render: (u) => {
                if (u.role === 'teacher') {
                  const names = [...new Set((structure.teaching || []).filter((t) => t.teacherId === u.id).map((t) => structure.classes.find((c) => c.id === t.classeId)?.name).filter(Boolean))]
                  if (!names.length) return <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>Attribuer des classes</button>
                  return <span className="small" title={names.join(', ')}>{names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3}` : ''}</span>
                }
                return u.classe ? <span className="nowrap">{structure.classes.find((c) => c.id === u.classeId)?.code ?? u.classe}</span> : '-'
              } },
              { key: 'lastLoginAt', label: 'Dernière connexion', render: (u) => (u.lastLoginAt ? <span className="nowrap">{fmtDateTime(u.lastLoginAt)}</span> : <span className="muted">Jamais</span>) },
              { key: 'active', label: 'État', render: (u) => (u.active ? (u.mustChangePassword ? <StatusBadge status="en_cours" label="Mot de passe provisoire" /> : <StatusBadge status="rendu" label="Actif" />) : <StatusBadge status="annule" label="Désactivé" />) },
              { key: 'actions', label: '', className: 'actions', render: (u) => (
                <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                  <button className="icon-btn" title="Modifier" aria-label="Modifier" onClick={() => setEdit(u)}><Pencil {...ICON} /></button>
                  <button className="icon-btn" title="Réinitialiser le mot de passe" aria-label="Réinitialiser le mot de passe" onClick={() => setReset({ u })}><KeyRound {...ICON} /></button>
                  {u.id !== me.id && (
                    <button className="icon-btn" title={u.active ? 'Désactiver' : 'Réactiver'} aria-label={u.active ? 'Désactiver' : 'Réactiver'} onClick={async () => { await api.setUserActive(u.id, !u.active); toast.success(u.active ? 'Compte désactivé.' : 'Compte réactivé.'); reload() }}>
                      {u.active ? <UserX {...ICON} /> : <UserCheck {...ICON} />}
                    </button>
                  )}
                </div>
              ) },
            ]}
          />
        </div>
      )}
      {edit && <UserForm user={edit === 'new' ? null : edit} structure={structure} onClose={() => setEdit(null)} onSaved={() => { toast.success('Utilisateur enregistré.'); reload() }} />}
      {importing && <ImportModal key={importing} kind={importing} classes={structure.classes} matieres={structure.matieres || []} onClose={() => setImporting(null)} onDone={reload} />}
      {reset && (
        <Modal title="Réinitialiser le mot de passe" onClose={() => setReset(null)} footer={reset.temp
          ? <button className="btn btn-primary" onClick={() => setReset(null)}>Fermer</button>
          : <>
            <button className="btn btn-secondary" onClick={() => setReset(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={async () => { const r = await api.resetPassword(reset.u.id); setReset({ ...reset, temp: r.temporaryPassword }); reload() }}>Réinitialiser</button>
          </>}>
          {reset.temp ? (
            <div className="stack-sm">
              <p>Mot de passe provisoire de <strong>{reset.u.firstName} {reset.u.lastName}</strong> :</p>
              <div className="session-code" style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>{reset.temp}</div>
              <p className="small muted">À remettre en main propre. Il devra être changé à la prochaine connexion.</p>
            </div>
          ) : <p>Un mot de passe provisoire sera créé pour <strong>{reset.u.firstName} {reset.u.lastName}</strong> ({reset.u.matricule}). Ses sessions ouvertes seront fermées.</p>}
        </Modal>
      )}
    </div>
  )
}
