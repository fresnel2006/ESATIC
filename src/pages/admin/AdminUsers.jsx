import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Upload, Pencil, KeyRound, UserX, UserCheck, Download, FileSpreadsheet } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Avatar, Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { ROLE_LABELS, downloadCsv, fmtDateTime, parseCsv } from '../../lib/format.js'

function UserForm({ user, classes, onClose, onSaved }) {
  const [f, setF] = useState(user || { matricule: '', firstName: '', lastName: '', email: '', role: 'student', classeId: classes[0]?.id ?? '' })
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const set = (p) => setF((x) => ({ ...x, ...p }))

  async function save() {
    setError('')
    try {
      const r = await api.saveUser(f)
      if (r.temporaryPassword) setCreated(r)
      else { onSaved(); onClose() }
    } catch (e) { setError(e.message) }
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
    <Modal title={user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" onClick={save}>{user ? 'Enregistrer' : 'Créer le compte'}</button>
    </>}>
      <div className="form-grid cols-2">
        <div className="field"><label htmlFor="u-mat">Matricule</label><input id="u-mat" className="input" value={f.matricule} onChange={(e) => set({ matricule: e.target.value })} /></div>
        <div className="field">
          <label htmlFor="u-role">Rôle</label>
          <select id="u-role" className="select" value={f.role} onChange={(e) => set({ role: e.target.value })}>
            {['student', 'teacher', 'proctor', 'educator', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
        {error && <div className="span-2"><Notice kind="danger">{error}</Notice></div>}
      </div>
    </Modal>
  )
}

function ImportModal({ classes, onClose, onDone }) {
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
      setError('Dans Excel, utilisez « Enregistrer sous » puis « CSV (séparateur : point-virgule) », et importez ce fichier. L\'import .xlsx direct sera fait par le serveur.')
      return
    }
    const parsed = parseCsv(await file.text())
    const missing = ['matricule', 'nom', 'prenom', 'classe'].filter((c) => !parsed.length || !(c in parsed[0]))
    if (missing.length) { setRows(null); setError(`Colonnes manquantes : ${missing.join(', ')}.`); return }
    setRows(parsed)
  }

  // Envoi par paquets de 100 : une classe entière ou toute l'école, sans dépasser les limites du serveur.
  // Si un paquet échoue, les comptes déjà créés restent affichés avec leurs mots de passe provisoires.
  async function run() {
    setBusy(true)
    setError('')
    const total = { created: [], errors: [] }
    const numbered = rows.map((r, i) => ({ ...r, line: i + 2 }))
    try {
      for (let i = 0; i < numbered.length; i += 100) {
        setProgress(`${i} / ${numbered.length}`)
        const r = await api.importStudents(numbered.slice(i, i + 100))
        total.created.push(...r.created)
        total.errors.push(...r.errors)
      }
    } catch (e) {
      setError(`Import interrompu à la ligne ${total.created.length + total.errors.length + 2} : ${e.message} Les comptes déjà créés sont listés ci-dessous ; relancez l'import avec les lignes restantes.`)
    } finally {
      setResult(total)
      setProgress('')
      setBusy(false)
      onDone()
    }
  }

  return (
    <Modal wide title="Importer des étudiants" onClose={onClose} footer={result
      ? <>
        {result.created.length > 0 && <button className="btn btn-secondary" onClick={() => downloadCsv('identifiants-provisoires.csv', result.created.map((c) => ({ Matricule: c.matricule, Nom: c.nom, Prénom: c.prenom, 'Email institutionnel': c.email, Classe: c.classe, 'Mot de passe provisoire': c.motDePasseProvisoire })))}><Download {...ICON} /> Télécharger les identifiants</button>}
        <button className="btn btn-primary" onClick={onClose}>Terminé</button>
      </>
      : <>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!rows?.length || busy} onClick={run}>{busy ? `Import en cours... ${progress}` : `Importer ${rows?.length || ''} ligne${rows?.length > 1 ? 's' : ''}`}</button>
      </>}>
      {result ? (
        <div className="stack">
          {error && <Notice kind="danger">{error}</Notice>}
          <Notice kind="success">{result.created.length} compte(s) créé(s). Téléchargez la liste des mots de passe provisoires maintenant : elle ne sera plus affichée.</Notice>
          {result.errors.length > 0 && (
            <Notice kind="danger">
              {result.errors.length} ligne(s) ignorée(s) :
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.errors.map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}</ul>
            </Notice>
          )}
        </div>
      ) : (
        <div className="stack">
          <p className="small">Fichier CSV avec les colonnes <span className="kbd">matricule</span> <span className="kbd">nom</span> <span className="kbd">prenom</span> <span className="kbd">classe</span> et <span className="kbd">email</span> (email institutionnel ; s'il est vide, il est attribué automatiquement : prenom.nom@esatic.ci). La classe est le code (par exemple {classes[0]?.code}) ou le nom exact.</p>
          <div className="row-wrap">
            <label className="btn btn-secondary">
              <FileSpreadsheet {...ICON} /> Choisir un fichier
              <input type="file" accept=".csv,.txt,.xlsx,.xls" hidden onChange={(e) => onFile(e.target.files[0])} />
            </label>
            <span className="small muted">{fileName || 'Aucun fichier choisi'}</span>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => downloadCsv('modele-import-etudiants.csv', [{ matricule: 'ETU25001', nom: 'Kouamé', prenom: 'Ange', email: 'ange.kouame@esatic.ci', classe: classes[0]?.code ?? '' }])}><Download size={14} /> Modèle CSV</button>
          </div>
          {error && <Notice kind="danger">{error}</Notice>}
          {rows && (
            <>
              <p className="small muted">Aperçu : {rows.length} ligne(s)</p>
              <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="table">
                  <thead><tr><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Classe</th><th>Email</th></tr></thead>
                  <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td>{r.matricule}</td><td>{r.nom}</td><td>{r.prenom}</td><td>{r.classe}</td><td>{r.email}</td></tr>)}</tbody>
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
  const [importing, setImporting] = useState(!!params.get('import'))
  const [reset, setReset] = useState(null)

  useEffect(() => {
    if (params.get('nouveau') || params.get('import')) setParams({}, { replace: true })
  }, [params, setParams])

  const [users, structure] = data || [[], { classes: [] }]
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
          <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload {...ICON} /> Importer (CSV)</button>
          <button className="btn btn-primary" onClick={() => setEdit('new')}><UserPlus {...ICON} /> Nouvel utilisateur</button>
        </>}
      />
      <div className="filters">
        <input className="input" placeholder="Nom, matricule ou email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {['student', 'teacher', 'proctor', 'educator', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="select" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
          <option value="">Toutes les classes</option>
          {structure.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="small muted" style={{ alignSelf: 'center' }}>{rows.length} compte(s)</span>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : (
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
              { key: 'classe', label: 'Classe', render: (u) => (u.classe ? <span className="nowrap">{structure.classes.find((c) => c.id === u.classeId)?.code ?? u.classe}</span> : '-') },
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
      {edit && <UserForm user={edit === 'new' ? null : edit} classes={structure.classes} onClose={() => setEdit(null)} onSaved={() => { toast.success('Utilisateur enregistré.'); reload() }} />}
      {importing && <ImportModal classes={structure.classes} onClose={() => setImporting(false)} onDone={reload} />}
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
