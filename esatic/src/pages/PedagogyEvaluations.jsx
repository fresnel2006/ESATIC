// Direction pédagogique : évaluation des enseignants par les étudiants (seul rôle qui voit ce tableau de bord).
// Campagnes (ouverture, dates, clôture) et tableau de bord : participation, moyennes de l'école par critère,
// répartition des notes, participation par classe, classement des enseignants et fiche détaillée de chacun.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Plus, Users, Percent, Star, MessageSquare, Lock, LockOpen, Pencil, Trash2, Send, ShieldCheck, ArrowUp, ArrowDown, X } from 'lucide-react'
import * as api from '../api/index.js'
import { useToast } from '../context/ToastContext.jsx'
import { Empty, ErrorBox, Loader, Modal, Notice, PageHead, ResponsiveTable, Stat, StatusBadge, useAsync, ICON } from '../components/ui.jsx'
import { EVAL_TYPE_LABELS, EvalResultCard, QcmResult, ScoreBadge, ScoreBar, fmt5 } from '../components/EvalWidgets.jsx'
import { fmtDateTime, fromLocalInput, toLocalInput } from '../lib/format.js'
import { LEVELS, LEVEL_NAMES } from '../api/seed.js'

// Modèle proposé par défaut : la direction pédagogique modifie, retire ou ajoute parties et questions
const note = (label) => ({ type: 'note', label })
const DEFAULT_QUESTIONS = [
  { type: 'partie', label: 'Partie 1 - Qualité de l\'enseignement' },
  note('Clarté des explications'),
  note('Maîtrise de la matière'),
  note('Organisation et préparation des cours'),
  note('Disponibilité et écoute'),
  note('Ponctualité et assiduité'),
  note('Équité des évaluations'),
  { type: 'partie', label: 'Partie 2 - Le cours' },
  { type: 'qcm', label: 'Le rythme du cours était :', options: ['Trop lent', 'Adapté', 'Trop rapide'] },
  { type: 'qcm', label: 'Les supports de cours (polycopiés, diapositives, exercices) vous ont-ils aidé ?', options: ['Oui, beaucoup', 'Un peu', 'Pas vraiment', 'Pas de support'] },
  { type: 'qcm', label: 'Recommanderiez-vous ce cours à d\'autres étudiants ?', options: ['Oui', 'Plutôt oui', 'Plutôt non', 'Non'] },
  { type: 'partie', label: 'Partie 3 - Questions ouvertes' },
  { type: 'texte', label: 'Qu\'avez-vous le plus apprécié dans ce cours ?' },
  { type: 'texte', label: 'Que faudrait-il améliorer ?' },
]
const MAX_QUESTIONS = 30
const MAX_OPTIONS = 8

// Un élément de l'évaluation dans l'éditeur : type, énoncé et, pour un QCM, les réponses proposées
function QuestionRow({ q, num, locked, canRemove, onChange, onRemove, onMove }) {
  const setOpt = (i, v) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? v : o)) })
  return (
    <div className={`eval-q-edit ${q.type === 'partie' ? 'partie' : ''}`}>
      <div className="eval-q-row">
        {q.type === 'partie' ? <span className="eval-part-tag">Partie</span> : <span className="eval-num">{num}</span>}
        <select className="select eval-q-type" value={q.type} disabled={locked} aria-label="Type"
          onChange={(e) => onChange({ ...q, type: e.target.value, options: e.target.value === 'qcm' ? (q.options?.length ? q.options : ['', '']) : undefined })}>
          {Object.entries(EVAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" value={q.label} maxLength={200} disabled={locked} aria-label={q.type === 'partie' ? 'Titre de la partie' : `Question ${num}`}
          placeholder={q.type === 'partie' ? 'Ex. : Partie 2 - Le cours' : 'Énoncé de la question'} onChange={(e) => onChange({ ...q, label: e.target.value })} />
        {!locked && <>
          <button type="button" className="icon-btn" aria-label="Monter" onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
          <button type="button" className="icon-btn" aria-label="Descendre" onClick={() => onMove(1)}><ArrowDown size={15} /></button>
          <button type="button" className="icon-btn" disabled={!canRemove} aria-label="Retirer" onClick={onRemove}><Trash2 size={15} /></button>
        </>}
      </div>
      {q.type === 'qcm' && (
        <div className="eval-q-options">
          {q.options.map((o, i) => (
            <div className="eval-q-option" key={i}>
              <span className="eval-q-radio" />
              <input className="input" value={o} maxLength={120} disabled={locked} placeholder={`Réponse ${i + 1}`} aria-label={`Réponse ${i + 1}`} onChange={(e) => setOpt(i, e.target.value)} />
              {!locked && <button type="button" className="icon-btn" disabled={q.options.length <= 2} aria-label={`Retirer la réponse ${i + 1}`}
                onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })}><X size={14} /></button>}
            </div>
          ))}
          {!locked && q.options.length < MAX_OPTIONS && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...q, options: [...q.options, ''] })}><Plus size={14} /> Ajouter une réponse</button>
          )}
        </div>
      )}
    </div>
  )
}

function CampaignForm({ campaign, periodes, onClose, onSaved }) {
  const start = new Date()
  const end = new Date(start.getTime() + 14 * 24 * 3600 * 1000); end.setHours(23, 59, 0, 0)
  const active = periodes.find((p) => p.active) || periodes[0]
  const [f, setF] = useState(campaign
    ? { ...campaign, startAt: toLocalInput(campaign.startAt), endAt: toLocalInput(campaign.endAt) }
    : { title: `Évaluation des enseignants${active ? ` - ${active.name}` : ''}`, periodeId: active?.id ?? '', startAt: toLocalInput(start.toISOString()), endAt: toLocalInput(end.toISOString()) })
  const [questions, setQuestions] = useState(() => (campaign?.questions?.length
    ? campaign.questions.map((q) => ({ type: q.type || 'note', label: q.label, options: q.options ? [...q.options] : undefined }))
    : DEFAULT_QUESTIONS.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined }))))
  const locked = !!campaign && campaign.responses > 0 // des étudiants ont répondu : questions figées
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const setQ = (i, v) => setQuestions((qs) => qs.map((q, j) => (j === i ? v : q)))
  const move = (i, d) => setQuestions((qs) => {
    const j = i + d
    if (j < 0 || j >= qs.length) return qs
    const out = [...qs]; [out[i], out[j]] = [out[j], out[i]]
    return out
  })
  const counted = questions.filter((q) => q.type !== 'partie').length
  const numbers = Object.fromEntries(questions.map((q, i) => [i, q]).filter(([, q]) => q.type !== 'partie').map(([i], n) => [i, n + 1]))
  const add = (type) => setQuestions((qs) => [...qs, { type, label: '', options: type === 'qcm' ? ['', ''] : undefined }])
  async function save() {
    setError(''); setBusy(true)
    try {
      const r = await api.saveEvalCampaign({ id: campaign?.id, title: f.title, periodeId: f.periodeId || null, startAt: fromLocalInput(f.startAt), endAt: fromLocalInput(f.endAt), questions })
      onSaved(r?.id); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal wide title={campaign ? 'Modifier l\'évaluation' : 'Nouvelle évaluation des enseignants'} onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{campaign ? 'Enregistrer' : 'Enregistrer le brouillon'}</button>
    </>}>
      <div className="form-grid cols-2">
        <div className="field span-2"><label htmlFor="ev-t">Titre</label><input id="ev-t" className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="field span-2">
          <label htmlFor="ev-p">Période</label>
          <select id="ev-p" className="select" value={f.periodeId ?? ''} onChange={(e) => set({ periodeId: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">Aucune</option>
            {periodes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="ev-s">Ouverture</label><input id="ev-s" type="datetime-local" className="input" value={f.startAt} onChange={(e) => set({ startAt: e.target.value })} /></div>
        <div className="field"><label htmlFor="ev-e">Clôture</label><input id="ev-e" type="datetime-local" className="input" value={f.endAt} onChange={(e) => set({ endAt: e.target.value })} /></div>
        <div className="field span-2">
          <label>Questionnaire <span className="muted small">({counted} question{counted > 1 ? 's' : ''} : notes en étoiles, QCM et questions ouvertes, rangées par parties)</span></label>
          {locked && <Notice>Des étudiants ont déjà répondu : le questionnaire ne peut plus être modifié.</Notice>}
          <div className="stack-sm">
            {questions.map((q, i) => (
              <QuestionRow key={i} q={q} num={numbers[i]} locked={locked} canRemove={counted > 1 || q.type === 'partie'}
                onChange={(v) => setQ(i, v)} onMove={(d) => move(i, d)} onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} />
            ))}
          </div>
          {!locked && counted < MAX_QUESTIONS && (
            <div className="row-wrap">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('partie')}><Plus size={14} /> Partie</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('note')}><Plus size={14} /> Note en étoiles</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('qcm')}><Plus size={14} /> QCM</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => add('texte')}><Plus size={14} /> Question ouverte</button>
            </div>
          )}
          <span className="hint">Les notes et les QCM sont obligatoires pour l'étudiant, les questions ouvertes facultatives.</span>
        </div>
        {!campaign && <div className="span-2"><Notice>L'évaluation est enregistrée en brouillon : les étudiants voient la section mais ne peuvent pas cliquer dessus tant que vous ne l'avez pas validée avec « Valider et ouvrir aux étudiants ». Chaque étudiant évaluera alors les enseignants affectés à sa classe, une fois par enseignant et par matière, de façon anonyme.</Notice></div>}
        {error && <div className="span-2"><Notice kind="danger">{error}</Notice></div>}
      </div>
    </Modal>
  )
}

const pctTone = (pct) => (pct >= 50 ? 'good' : pct >= 20 ? 'mid' : 'low')

// Enseignants (et matières) avec leur moyenne, triables, et fiche détaillée au clic
function TeachersTable({ rows: list, minResponses, title, showClasses }) {
  const [detail, setDetail] = useState(null)
  const [sort, setSort] = useState('overall')
  const rows = [...list].sort((a, b) => (sort === 'overall' ? (b.overall ?? -1) - (a.overall ?? -1) : sort === 'responses' ? b.responses - a.responses : a.teacher.localeCompare(b.teacher)))
  return (
    <div className="card">
      <div className="card-header">
        <h2>{title}</h2>
        <select className="select" style={{ width: 'auto', minHeight: 34 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
          <option value="overall">Trier par moyenne</option>
          <option value="responses">Trier par nombre de réponses</option>
          <option value="name">Trier par nom</option>
        </select>
      </div>
      <ResponsiveTable
        rowKey="key"
        rows={rows.map((r) => ({ ...r, key: `${r.teacherId}-${r.matiereId}` }))}
        onRowClick={(r) => r.responses > 0 && setDetail(r)}
        empty={<Empty icon={ClipboardCheck} title="Aucun enseignant">L'administration affecte les enseignants aux classes (fiche de l'enseignant).</Empty>}
        columns={[
          { key: 'teacher', label: 'Enseignant', primary: true, render: (r) => <span><strong style={{ fontWeight: 600 }}>{r.teacher}</strong><span className="small muted" style={{ display: 'block' }}>{r.matiere}</span></span> },
          ...(showClasses ? [{ key: 'classes', label: 'Classes', hideMobile: true, render: (r) => <span className="small">{r.classes.join(', ')}</span> }] : []),
          { key: 'responses', label: 'Réponses' },
          { key: 'overall', label: 'Moyenne', render: (r) => (r.visible ? <ScoreBadge value={r.overall} />
            : r.responses === 0 ? <span className="small muted">Pas encore évalué</span>
              : <span className="small muted"><Lock size={13} /> moins de {minResponses}</span>) },
          { key: 'actions', label: '', className: 'actions', render: (r) => r.responses > 0 && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDetail(r) }}>Détail</button> },
        ]}
      />
      {detail && (
        <Modal wide title={`${detail.teacher} - ${detail.matiere}${showClasses ? '' : ` (${detail.classes.join(', ')})`}`} onClose={() => setDetail(null)} footer={<button className="btn btn-primary" onClick={() => setDetail(null)}>Fermer</button>}>
          <EvalResultCard row={detail} minResponses={minResponses} />
        </Modal>
      )}
    </div>
  )
}

// Une classe : participation, moyennes de la classe et évaluation de chacun de ses enseignants (réponses de la
// classe seulement)
function ClassView({ campaignId, classeId }) {
  const { data, loading, error } = useAsync(() => api.evalResults(campaignId, classeId), [campaignId, classeId])
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader />
  const k = data.classe
  return (
    <div className="stack">
      <div className="grid-cards">
        <Stat icon={Users} value={`${k.responses} / ${k.expected}`} label={`Évaluations reçues / attendues · ${k.students} étudiant(s)`} />
        <Stat icon={Percent} value={`${String(k.participation).replace('.', ',')} %`} label="Participation de la classe" tone={k.participation >= 50 ? 'green' : k.participation >= 20 ? '' : 'red'} />
        <Stat icon={Star} value={k.overall === null ? '-' : `${fmt5(k.overall)} / 5`} label="Moyenne de la classe" tone="green" />
        <Stat icon={ClipboardCheck} value={`${k.evaluated} / ${k.teachers}`} label="Enseignants évalués" tone="gray" />
      </div>
      <TeachersTable rows={data.rows} minResponses={data.minResponses} title={`Enseignants de ${k.classe}`} />
      {!k.visible ? (
        <div className="eval-hidden"><Lock size={15} /> Moins de {data.minResponses} réponses dans cette classe : les moyennes de la classe restent masquées pour garantir l'anonymat.</div>
      ) : (
        <div className="eval-dash-grid">
          <div className="card">
            <div className="card-header"><h2>Moyenne de la classe par question</h2></div>
            <div className="card-body"><div className="score-bars">{k.criteria.map((c) => <ScoreBar key={c.key} label={c.label} value={c.average} />)}</div></div>
          </div>
          {k.qcm.length > 0 && (
            <div className="card">
              <div className="card-header"><h2>Réponses aux QCM de la classe</h2></div>
              <div className="card-body stack">{k.qcm.map((q) => <QcmResult key={q.key} item={q} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Tableau de bord : par classe (vue principale) ou toute l'école
function Dashboard({ campaignId }) {
  const { data, loading, error } = useAsync(() => api.evalResults(campaignId), [campaignId])
  const [params, setParams] = useSearchParams()
  const view = params.get('vue') === 'ecole' ? 'ecole' : 'classe'
  const setP = (p) => setParams((cur) => { const n = new URLSearchParams(cur); for (const [a, b] of Object.entries(p)) (b == null ? n.delete(a) : n.set(a, b)); return n }, { replace: true })
  if (error) return <ErrorBox error={error} />
  if (loading && !data) return <Loader />
  const d = data.dashboard
  const classes = [...d.byClass].sort((a, b) => a.classe.localeCompare(b.classe, 'fr', { numeric: true }))
  // Toutes les classes, rangées par niveau (L1 ... M2, prépas)
  const levels = [...LEVELS, ...new Set(classes.map((c) => c.level || 'Autres').filter((l) => !LEVELS.includes(l)))]
    .map((l) => ({ level: l, list: classes.filter((c) => (c.level || 'Autres') === l) })).filter((g) => g.list.length)
  const classeId = Number(params.get('classe')) || (classes.find((c) => c.responses > 0) || classes.find((c) => c.expected > 0) || classes[0])?.classeId
  const maxDist = Math.max(1, ...d.distribution.map((x) => x.count))

  const tabs = (
    <div className="eval-tabs" role="tablist">
      <button role="tab" aria-selected={view === 'classe'} className={view === 'classe' ? 'on' : ''} onClick={() => setP({ vue: null })}>Par classe</button>
      <button role="tab" aria-selected={view === 'ecole'} className={view === 'ecole' ? 'on' : ''} onClick={() => setP({ vue: 'ecole' })}>Toute l'école</button>
    </div>
  )

  if (view === 'classe') return (
    <div className="stack">
      {tabs}
      {!classes.length ? (
        <div className="card"><Empty icon={Users} title="Aucune classe">L'administration crée les classes (Structure).</Empty></div>
      ) : (
        <>
          <div className="eval-levels">
            {levels.map((g) => (
              <div key={g.level} className="eval-level">
                <span className="eval-level-title">{LEVEL_NAMES[g.level] || g.level}<span className="muted"> · {g.list.length} classe{g.list.length > 1 ? 's' : ''}</span></span>
                <div className="eval-class-picker">
                  {g.list.map((x) => {
                    const pct = x.expected ? Math.round((x.responses / x.expected) * 100) : 0
                    return (
                      <button key={x.classeId} className={`eval-class ${x.classeId === classeId ? 'active' : ''} ${x.expected ? '' : 'no-data'}`} onClick={() => setP({ classe: x.classeId })}>
                        <strong>{x.classe}</strong>
                        <span className="small muted">{!x.teachers ? 'Aucun enseignant affecté' : !x.students ? `${x.teachers} enseignant${x.teachers > 1 ? 's' : ''} · aucun étudiant` : `${x.teachers} enseignant${x.teachers > 1 ? 's' : ''} · ${x.responses} / ${x.expected}`}</span>
                        <span className="eval-rate"><span className="score-bar-track"><span className={`score-bar-fill ${pctTone(pct)}`} style={{ width: `${pct}%` }} /></span><b>{x.expected ? `${pct} %` : '-'}</b></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {classeId && <ClassView key={classeId} campaignId={campaignId} classeId={classeId} />}
        </>
      )}
    </div>
  )

  return (
    <div className="stack">
      {tabs}
      <div className="grid-cards">
        <Stat icon={Users} value={`${d.responses} / ${d.expected}`} label="Évaluations reçues / attendues" />
        <Stat icon={Percent} value={`${String(d.participation).replace('.', ',')} %`} label="Taux de participation" tone={d.participation >= 50 ? 'green' : d.participation >= 20 ? '' : 'red'} />
        <Stat icon={Star} value={d.overall === null ? '-' : `${fmt5(d.overall)} / 5`} label="Moyenne générale de l'école" tone="green" />
        <Stat icon={MessageSquare} value={d.comments} label={`Commentaires · ${d.teachersEvaluated} enseignant(s) évalué(s)`} tone="gray" />
      </div>

      <div className="eval-dash-grid">
        <div className="card">
          <div className="card-header"><h2>Moyenne de l'école par question</h2></div>
          <div className="card-body">
            {d.responses === 0 ? <p className="small muted">Aucune réponse pour le moment.</p> : <div className="score-bars">{d.criteria.map((c) => <ScoreBar key={c.key} label={c.label} value={c.average} />)}</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Répartition des notes</h2></div>
          <div className="card-body">
            <div className="eval-dist">
              {[...d.distribution].reverse().map((x) => (
                <div className="eval-dist-row" key={x.note}>
                  <span className="eval-dist-label">{'★'.repeat(x.note)}</span>
                  <span className="score-bar-track"><span className={`score-bar-fill ${x.note >= 4 ? 'good' : x.note === 3 ? 'mid' : 'low'}`} style={{ width: `${(x.count / maxDist) * 100}%` }} /></span>
                  <strong className="score-bar-value">{x.count}</strong>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Toutes les notes données, toutes questions confondues.</p>
          </div>
        </div>
      </div>

      {d.qcm.length > 0 && d.responses > 0 && (
        <div className="card">
          <div className="card-header"><h2>Réponses aux QCM (toute l'école)</h2></div>
          <div className="card-body eval-qcm-grid">{d.qcm.map((q) => <QcmResult key={q.key} item={q} />)}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Participation par classe</h2><span className="small muted">{d.byClass.length} classe(s) concernée(s)</span></div>
        <ResponsiveTable
          rowKey="classeId"
          rows={classes}
          onRowClick={(x) => setP({ vue: null, classe: x.classeId })}
          empty={<Empty icon={Users} title="Aucune classe avec des enseignants affectés">L'administration affecte les enseignants à leurs classes (fiche de l'enseignant).</Empty>}
          columns={[
            { key: 'classe', label: 'Classe', primary: true, render: (x) => <strong style={{ fontWeight: 600 }}>{x.classe}</strong> },
            { key: 'students', label: 'Étudiants' },
            { key: 'teachers', label: 'Enseignants' },
            { key: 'resp', label: 'Évaluations', render: (x) => `${x.responses} / ${x.expected}` },
            { key: 'rate', label: 'Participation', render: (x) => {
              const pct = x.expected ? Math.round((x.responses / x.expected) * 100) : 0
              return <span className="eval-rate"><span className="score-bar-track"><span className={`score-bar-fill ${pct >= 50 ? 'good' : pct >= 20 ? 'mid' : 'low'}`} style={{ width: `${pct}%` }} /></span><b>{pct} %</b></span>
            } },
          ]}
        />
      </div>

      <TeachersTable rows={data.rows} minResponses={data.minResponses} title="Enseignants (toutes classes confondues)" showClasses />
    </div>
  )
}

export default function PedagogyEvaluations() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => Promise.all([api.listEvalCampaigns(), api.getStructure()]), [])
  const [form, setForm] = useState(null) // 'new' | campagne
  const [campaigns, structure] = data || [[], { periodes: [] }]
  const selected = campaigns.find((c) => c.id === Number(params.get('campagne'))) || campaigns[0]
  useEffect(() => { if (selected && !params.get('campagne')) setParams({ campagne: selected.id }, { replace: true }) }, [selected, params, setParams])

  async function setStatus(c, status) {
    try {
      await api.setEvalCampaignStatus(c.id, status)
      toast.success(status === 'fermee' ? 'Évaluation clôturée : les enseignants peuvent voir leurs résultats.'
        : c.status === 'brouillon' ? 'Évaluation validée : les étudiants peuvent maintenant évaluer leurs enseignants.' : 'Évaluation rouverte.')
      reload()
    } catch (e) { toast.error(e.message) }
  }
  const badge = (c) => (c.status === 'brouillon' ? ['a_faire', 'Brouillon - non validée']
    : c.open ? ['en_cours', 'En cours'] : c.status === 'fermee' ? ['rendu', 'Clôturée'] : ['a_faire', 'Validée, hors des dates'])

  return (
    <div>
      <PageHead title="Évaluation des enseignants" subtitle="Les étudiants évaluent anonymement les enseignants de leur classe" actions={
        <button className="btn btn-primary" onClick={() => setForm('new')}><Plus {...ICON} /> Nouvelle évaluation</button>
      } />
      <ErrorBox error={error} />
      {loading && !data ? <Loader /> : !campaigns.length ? (
        <div className="card"><Empty icon={ClipboardCheck} title="Aucune évaluation pour le moment">Ouvrez une évaluation : les étudiants pourront évaluer les enseignants de leur classe, de façon anonyme.</Empty></div>
      ) : (
        <div className="stack">
          <div className="eval-campaigns">
            {campaigns.map((c) => (
              <button key={c.id} className={`eval-campaign ${selected?.id === c.id ? 'active' : ''}`} onClick={() => setParams({ campagne: c.id })}>
                <span className="eval-campaign-title">{c.title}</span>
                <span className="small muted">{fmtDateTime(c.startAt)} → {fmtDateTime(c.endAt)}</span>
                <span className="row" style={{ gap: 8, marginTop: 4 }}>
                  <StatusBadge status={badge(c)[0]} label={badge(c)[1]} />
                  <span className="small">{c.responses} / {c.expected} réponses</span>
                </span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setForm(selected)}><Pencil size={14} /> Modifier</button>
              {selected.status === 'brouillon' && <button className="btn btn-ghost btn-sm" onClick={async () => {
                if (!window.confirm(`Supprimer le brouillon « ${selected.title} » ?`)) return
                try { await api.deleteEvalCampaign(selected.id); toast.success('Brouillon supprimé.'); setParams({}); reload() } catch (e) { toast.error(e.message) }
              }}><Trash2 size={14} /> Supprimer</button>}
              {selected.status === 'brouillon' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(selected, 'ouverte')}><Send size={14} /> Valider et ouvrir aux étudiants</button>}
              {selected.status === 'ouverte' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(selected, 'fermee')}><Lock size={14} /> Clôturer</button>}
              {selected.status === 'fermee' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus(selected, 'ouverte')}><LockOpen size={14} /> Rouvrir</button>}
            </div>
          )}
          {selected && <div className="eval-anon"><ShieldCheck size={16} /> Réponses anonymes : le nom de l'étudiant n'est jamais enregistré avec sa réponse. Personne, ni la direction ni l'enseignant, ne peut savoir qui a voté ; seuls des moyennes et des commentaires s'affichent, à partir de 3 réponses.</div>}
          {selected?.status === 'brouillon' ? (
            <div className="card">
              <div className="card-header"><h2>Questions de l'évaluation</h2><span className="small muted">Brouillon : les étudiants voient la section, sans pouvoir cliquer</span></div>
              <div className="card-body">
                <div className="eval-q-list">{selected.questions.map((q) => q.type === 'partie'
                  ? <h3 key={q.key} className="eval-part-title">{q.label}</h3>
                  : (
                    <div key={q.key} className="eval-q-preview">
                      <span>{q.label}</span>
                      <span className="tag">{EVAL_TYPE_LABELS[q.type]}</span>
                      {q.type === 'qcm' && <span className="small muted" style={{ flexBasis: '100%' }}>{q.options.join(' · ')}</span>}
                    </div>
                  ))}</div>
              </div>
            </div>
          ) : selected && <Dashboard key={selected.id} campaignId={selected.id} />}
        </div>
      )}
      {form && <CampaignForm campaign={form === 'new' ? null : form} periodes={structure.periodes || []} onClose={() => setForm(null)} onSaved={(id) => { toast.success(form === 'new' ? 'Brouillon enregistré : validez-le pour l\'ouvrir aux étudiants.' : 'Évaluation enregistrée.'); if (id) setParams({ campagne: id }); reload() }} />}
    </div>
  )
}
