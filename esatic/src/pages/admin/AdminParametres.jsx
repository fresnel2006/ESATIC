import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Save, RotateCcw } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Confirm, ErrorBox, Loader, Notice, PageHead, ResponsiveTable, StatusBadge, useAsync, ICON } from '../../components/ui.jsx'
import { DEMO_TOOLS } from '../../config.js'
import { LANGUAGES } from '../../lib/format.js'
import { canRunLanguage } from '../../lib/useExecution.js'

function Toggle({ title, desc, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div><div className="t">{title}</div><div className="d">{desc}</div></div>
      <label className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={title} /><span /></label>
    </div>
  )
}

// Exécution du code : dans le navigateur des étudiants uniquement
function ExecutionCard() {
  const run = Object.keys(LANGUAGES).filter(canRunLanguage).map((l) => LANGUAGES[l])
  const write = Object.keys(LANGUAGES).filter((l) => !canRunLanguage(l)).map((l) => LANGUAGES[l])
  return (
    <div className="card">
      <div className="card-header"><h2>Exécution du code</h2></div>
      <div className="card-body stack-sm">
        <p className="small"><b>Exécutés dans le navigateur de l'étudiant :</b> {[...run, 'SQL', 'Web (HTML, CSS, JS)'].join(', ')}. Rien à installer, le serveur n'est pas sollicité.</p>
        <p className="small"><b>Écrits sans exécution :</b> {write.join(', ')}. L'étudiant écrit son code dans l'éditeur ; il est enregistré et l'enseignant le corrige à la main.</p>
      </div>
    </div>
  )
}

function ToolsCard() {
  const { data, error } = useAsync(() => api.toolsOverview(), [])
  return (
    <div className="card">
      <div className="card-header">
        <h2>Outils de programmation</h2>
        <Link className="card-link" to="/admin/structure?onglet=matieres">Régler par matière</Link>
      </div>
      <div className="card-body stack">
        <Notice>Rien n'est à installer, ni sur les PC des étudiants ni sur le serveur : tout se passe dans le navigateur.</Notice>
        <ErrorBox error={error} />
        {!data ? <Loader /> : (
          <ResponsiveTable
            rowKey="key"
            rows={data}
            columns={[
              { key: 'label', label: 'Outil', primary: true, render: (t) => <strong style={{ fontWeight: 600 }}>{t.label}</strong> },
              { key: 'matieres', label: 'Matières', render: (t) => (t.matieres.length ? t.matieres.join(', ') : <span className="muted">Aucune</span>) },
              { key: 'assessmentCount', label: 'Épreuves', render: (t) => t.assessmentCount },
              { key: 'now', label: 'Exécution aujourd\'hui', render: (t) => (t.runsInBrowser
                ? <StatusBadge status="rendu" label={t.key === 'html' ? 'Aperçu intégré' : 'Exécuté dans le navigateur'} />
                : <StatusBadge status="a_faire" label="Écrit, corrigé par l'enseignant" />) },
              { key: 'server', label: 'Fonctionnement', render: (t) => <span className="small">{t.server}</span> },
            ]}
          />
        )}
      </div>
    </div>
  )
}

export default function AdminParametres() {
  const toast = useToast()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [school, setSchool] = useState(null)
  const [error, setError] = useState(null)
  const [resetDemo, setResetDemo] = useState(false)

  useEffect(() => { api.getStructure().then((s) => setSchool(s.school)).catch(setError) }, [])
  if (error) return <ErrorBox error={error} />
  if (!school) return <Loader />
  const st = school.settings
  const set = (p) => setSchool({ ...school, settings: { ...st, ...p } })

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHead title="Paramètres" subtitle="Réglages de l'école et règles de sécurité par défaut" actions={
        <button className="btn btn-primary" onClick={async () => { try { setSchool(await api.saveSettings(st, school.name)); toast.success('Paramètres enregistrés.') } catch (e) { toast.error(e.message) } }}><Save {...ICON} /> Enregistrer</button>
      } />
      <div className="card"><div className="card-header"><h2>École</h2></div><div className="card-body form-grid cols-2">
        <div className="field span-2"><label htmlFor="p-name">Nom de l'établissement</label><input id="p-name" className="input" value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="p-year">Année académique</label><input id="p-year" className="input" value={st.academicYear} onChange={(e) => set({ academicYear: e.target.value })} /></div>
      </div></div>

      <div className="card"><div className="card-header"><h2>Sécurité</h2></div><div className="card-body">
        <Toggle title="Une seule session active par compte" desc="Pour les étudiants, c'est toujours le cas : se connecter sur un autre poste ferme l'ancienne session. Activez pour l'appliquer aussi au personnel." checked={!!st.singleSession} onChange={(v) => set({ singleSession: v })} />
        <Toggle title="Safe Exam Browser par défaut" desc="Proposé activé à la création des nouveaux examens." checked={!!st.sebDefault} onChange={(v) => set({ sebDefault: v })} />
        <div className="toggle-row">
          <div><div className="t">Intervalle de sauvegarde automatique</div><div className="d">Entre 20 et 30 secondes. La sauvegarde n'a lieu que si une réponse a changé.</div></div>
          <select className="select" style={{ width: 110 }} value={st.autosaveSeconds} onChange={(e) => set({ autosaveSeconds: Number(e.target.value) })} aria-label="Intervalle de sauvegarde">
            {[20, 25, 30].map((n) => <option key={n} value={n}>{n} s</option>)}
          </select>
        </div>
        <div className="toggle-row">
          <div><div className="t">Longueur minimale des mots de passe</div><div className="d">Avec des lettres et des chiffres.</div></div>
          <select className="select" style={{ width: 110 }} value={st.passwordMinLength} onChange={(e) => set({ passwordMinLength: Number(e.target.value) })} aria-label="Longueur minimale">
            {[8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div></div>

      <ExecutionCard />
      <ToolsCard />

      {DEMO_TOOLS && <div className="card"><div className="card-header"><h2>Démonstration</h2></div><div className="card-body row-wrap" style={{ justifyContent: 'space-between' }}>
        <p className="small muted" style={{ maxWidth: 520 }}>Efface toutes les données et revient aux données de démonstration d'origine.</p>
        <button className="btn btn-secondary" onClick={() => setResetDemo(true)}><RotateCcw {...ICON} /> Réinitialiser la démo</button>
      </div></div>}

      {resetDemo && <Confirm danger title="Réinitialiser la démo" message="Toutes les modifications faites dans cette démonstration seront effacées et vous serez déconnecté." confirmLabel="Réinitialiser" onClose={() => setResetDemo(false)} onConfirm={async () => { await api.resetDemo(); setUser(null); navigate('/connexion') }} />}
    </div>
  )
}
