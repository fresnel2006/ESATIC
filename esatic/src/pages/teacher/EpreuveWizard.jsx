import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Library, Plus, Save, Send, ListChecks, AlignLeft, Code2, Database, LayoutTemplate, Workflow, FolderPlus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import * as api from '../../api/index.js'
import { useToast } from '../../context/ToastContext.jsx'
import QuestionEditor, { newQuestion, tempId } from '../../components/QuestionEditor.jsx'
import Statement from '../../components/Statement.jsx'
import { Confirm, Empty, ErrorBox, Loader, Modal, Notice, PageHead, StatusBadge, ICON } from '../../components/ui.jsx'
import { fmtDateTime, fromLocalInput, toLocalInput, QUESTION_TYPES, LANGUAGES, LANG_ENV, TOOLS } from '../../lib/format.js'

const STEPS = ['Informations', 'Dates et durée', 'Questions', 'Sécurité', 'Aperçu et publication']
const TYPE_BUTTONS = [
  ['qcm', ListChecks], ['ouverte', AlignLeft], ['code', Code2], ['sql', Database], ['html', LayoutTemplate], ['diagram', Workflow],
]

// Identifiant d'un nouvel exercice
const newSectionId = () => `ex-${Math.random().toString(36).slice(2, 8)}`

function emptyAssessment() {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(8, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  end.setHours(18, 0, 0, 0)
  return {
    id: null, title: '', description: '', kind: 'devoir', matiereId: '', classeId: '',
    startAt: start.toISOString(), endAt: end.toISOString(), durationMin: 60, maxAttempts: 1,
    languages: [],
    security: { fullscreen: false, blockPaste: true, sebRequired: false, sebKeys: '', shuffleQuestions: false, exitWarnings: null },
    questions: [], status: 'brouillon',
  }
}

function Toggle({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <div>
        <div className="t">{title}</div>
        <div className="d">{desc}</div>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} aria-label={title} />
        <span />
      </label>
    </div>
  )
}

function BankPicker({ matiereId, allowed, onPick, onClose }) {
  const [items, setItems] = useState(null)
  const [selected, setSelected] = useState([])
  const [filter, setFilter] = useState('mine')
  useEffect(() => { api.listBank().then(setItems) }, [])
  const list = (items || []).filter((b) => filter === 'all' || !matiereId || b.matiereId === Number(matiereId))
  return (
    <Modal
      wide
      title="Banque de questions"
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!selected.length} onClick={() => onPick(items.filter((b) => selected.includes(b.id)))}>Ajouter {selected.length || ''} question{selected.length > 1 ? 's' : ''}</button>
      </>}
    >
      <div className="stack">
        <div className="pills">
          <button className={`pill ${filter === 'mine' ? 'active' : ''}`} onClick={() => setFilter('mine')}>Cette matière</button>
          <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Toutes</button>
        </div>
        {!items ? <Loader /> : list.length === 0 ? <Empty icon={Library} title="Aucune question dans la banque" /> : (
          <div className="stack-sm">
            {list.map((b) => (
              <label key={b.id} className={`choice ${selected.includes(b.id) ? 'selected' : ''}`} style={allowed(b) ? undefined : { opacity: 0.55, cursor: 'not-allowed' }}>
                <input type="checkbox" disabled={!allowed(b)} checked={selected.includes(b.id)} onChange={() => setSelected((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]))} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block' }}>{b.statement}</span>
                  <span className="small muted">{QUESTION_TYPES[b.type]}{b.type === 'code' ? ` - ${LANGUAGES[b.data.language]}` : ''} - {b.points} pts - {b.matiere}</span>
                  {!allowed(b) && <span className="small" style={{ display: 'block', color: 'var(--danger)' }}>Outil non prévu pour cette matière</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function EpreuveWizard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [a, setA] = useState(id ? null : emptyAssessment())
  const [teaching, setTeaching] = useState(null)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bank, setBank] = useState(null) // { sectionId } : exercice où ajouter les questions de la banque
  const [removing, setRemoving] = useState(null) // exercice à supprimer (confirmation)

  useEffect(() => {
    import('../../components/CodeEditor.jsx') // préchargement de l'éditeur de code
    api.myTeaching().then(setTeaching).catch(setLoadError)
    if (id) api.getAssessment(id).then(setA).catch(setLoadError)
  }, [id])

  if (loadError) return <ErrorBox error={loadError} />
  if (!a || !teaching) return <Loader />

  const set = (patch) => setA((x) => ({ ...x, ...patch }))
  const setSec = (patch) => setA((x) => ({ ...x, security: { ...x.security, ...patch } }))
  // Toutes les matières ; celles que l'enseignant a dans cette classe (puis ailleurs) en premier
  const rank = (m) => (teaching.rows.some((r) => r.classeId === Number(a.classeId) && r.matiereId === m.id) ? 0 : teaching.rows.some((r) => r.matiereId === m.id) ? 1 : 2)
  const matieresForClass = [...teaching.matieres].sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name))
  const levels = [...new Set(teaching.classes.map((c) => c.level || 'Autres'))]
  const total = a.questions.reduce((s, q) => s + Number(q.points || 0), 0)
  const locked = a.status === 'publie' && a.submitted > 0
  // Outils informatiques prévus par l'administration pour la matière choisie
  const matiere = teaching.matieres.find((m) => m.id === Number(a.matiereId))
  const tools = matiere?.tools || []
  const matiereLangs = tools.filter((t) => TOOLS[t]?.code)
  // Langage(s) choisi(s) pour cette épreuve : l'éditeur et le terminal de l'étudiant s'y adaptent
  const codeLangs = (a.languages || []).filter((l) => matiereLangs.includes(l))
  const typeAllowed = (t) => (t === 'code' ? codeLangs.length > 0 : t === 'sql' || t === 'html' ? tools.includes(t) : true)
  const bankAllowed = (b) => {
    const tool = api.questionTool(b)
    if (b.type === 'code') return codeLangs.includes(tool)
    return !tool || tools.includes(tool)
  }
  const toggleLang = (l) => set({ languages: codeLangs.includes(l) ? codeLangs.filter((x) => x !== l) : [...codeLangs, l] })
  const isPublished = a.status === 'publie'

  function stepError(s) {
    if (s === 0) {
      if (!a.title.trim()) return 'Le titre est obligatoire.'
      if (!a.classeId || !a.matiereId) return 'Choisissez la classe et la matière.'
    }
    if (s === 2) {
      const k = sections.findIndex((x) => !x.title.trim())
      if (k >= 0) return `Donnez un titre à l'exercice ${k + 1}.`
    }
    if (s === 1) {
      if (!a.startAt || !a.endAt) return 'Indiquez les dates de début et de fin.'
      if (new Date(a.endAt) <= new Date(a.startAt)) return 'La date de fin doit être après la date de début.'
      if (a.kind === 'examen' && !(a.durationMin > 0)) return 'Indiquez la durée de l\'examen.'
    }
    return ''
  }

  function go(n) {
    if (n > step) {
      for (let s = step; s < n; s++) {
        const e = stepError(s)
        if (e) { setError(e); setStep(s); return }
      }
    }
    setError('')
    setStep(n)
  }

  // Depuis l'aperçu (lecture seule) : retour à l'étape Questions, sur le champ à remplir
  function goToQuestion(qid) {
    setError('')
    setStep(2)
    setTimeout(() => {
      const el = document.getElementById(`q-statement-${qid}`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    }, 200)
  }
  // Erreur du serveur « Question N : ... » : la question concernée (numérotée dans l'ordre de l'épreuve)
  const errorQuestion = (() => {
    const m = /^Question (\d+)/.exec(error || '')
    return m && step === STEPS.length - 1 ? a.questions[Number(m[1]) - 1] : null
  })()

  async function persist(publish) {
    setBusy(true)
    setError('')
    try {
      const saved = await api.saveAssessment(a, publish)
      toast.success(publish ? 'Épreuve publiée. Les étudiants de la classe sont prévenus.' : 'Brouillon enregistré.')
      if (publish) navigate('/enseignant/epreuves')
      else { setA(saved); if (!id) navigate(`/enseignant/epreuves/${saved.id}`, { replace: true }) }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Exercices : { id, title, intro } ; chaque question porte le sectionId de son exercice.
  // Sans exercice, les questions forment une liste simple. Les questions restent rangées exercice par exercice.
  const sections = a.sections || []
  const regroup = (qs, secs = sections) => (secs.length ? secs.flatMap((s) => qs.filter((q) => q.sectionId === s.id)) : qs)
  const addSection = () => {
    const s = { id: newSectionId(), title: '', intro: '' }
    // Premier exercice : les questions déjà écrites y sont rangées
    if (!sections.length) set({ sections: [s], questions: a.questions.map((q) => ({ ...q, sectionId: s.id })) })
    else set({ sections: [...sections, s] })
  }
  const updateSection = (sid, patch) => set({ sections: sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) })
  const moveSection = (k, d) => {
    const ss = [...sections]
    ;[ss[k], ss[k + d]] = [ss[k + d], ss[k]]
    set({ sections: ss, questions: regroup(a.questions, ss) })
  }
  const removeSection = (sid) => {
    const ss = sections.filter((s) => s.id !== sid)
    set({ sections: ss, questions: a.questions.filter((q) => q.sectionId !== sid).map((q) => (ss.length ? q : { ...q, sectionId: undefined })) })
  }
  const addQuestion = (type, sectionId) => {
    const q = { ...newQuestion(type, codeLangs[0]), ...(sectionId ? { sectionId } : {}) }
    set({ questions: regroup([...a.questions, q]) })
  }
  const updateQ = (i, q) => set({ questions: a.questions.map((x, j) => (j === i ? q : x)) })
  // Monter ou descendre une question à l'intérieur de son exercice
  const moveQ = (i, d) => {
    const same = a.questions.map((q, j) => [q, j]).filter(([q]) => (q.sectionId ?? null) === (a.questions[i].sectionId ?? null)).map(([, j]) => j)
    const k = same.indexOf(i)
    const j = same[k + d]
    if (j === undefined) return
    const qs = [...a.questions]
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
    set({ questions: qs })
  }

  return (
    <div>
      <PageHead
        title={id ? a.title || 'Épreuve' : 'Nouvelle épreuve'}
        subtitle={id ? <><StatusBadge status={a.status} /> {a.classe && `- ${a.classe}`}</> : 'Assistant de création en 5 étapes'}
        actions={!isPublished && <button className="btn btn-secondary" onClick={() => persist(false)} disabled={busy}><Save {...ICON} /> Enregistrer le brouillon</button>}
      />

      <div className="wizard-steps" role="tablist">
        {STEPS.map((s, i) => (
          <button key={s} className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => go(i)} role="tab" aria-selected={i === step}>
            <span className="n">{i < step ? <Check size={14} /> : i + 1}</span>
            <span>{s}</span>
          </button>
        ))}
      </div>

      {locked && <div style={{ marginBottom: 16 }}><Notice>Des étudiants ont déjà rendu leur copie : les questions ne peuvent plus être modifiées. Dupliquez l'épreuve pour en faire une nouvelle version.</Notice></div>}

      <div className="card"><div className="card-body stack">
        {step === 0 && (
          <div className="form-grid cols-2">
            <div className="field span-2">
              <label htmlFor="w-title">Titre</label>
              <input id="w-title" className="input" value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder="Par exemple : TP noté - Pointeurs" />
            </div>
            <div className="field span-2">
              <label htmlFor="w-desc">Consignes générales (facultatif)</label>
              <textarea id="w-desc" className="textarea" style={{ minHeight: 80 }} value={a.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="w-classe">Classe</label>
              <select id="w-classe" className="select" value={a.classeId} onChange={(e) => set({ classeId: Number(e.target.value), matiereId: '' })} disabled={isPublished}>
                <option value="">Choisir une classe</option>
                {levels.map((l) => (
                  <optgroup key={l} label={l}>
                    {teaching.classes.filter((c) => (c.level || 'Autres') === l).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="w-mat">Matière</label>
              <select id="w-mat" className="select" value={a.matiereId} disabled={isPublished} onChange={(e) => {
                // Si la matière n'a qu'un langage, il est choisi d'office
                const m = teaching.matieres.find((x) => x.id === Number(e.target.value))
                const langs = (m?.tools || []).filter((t) => TOOLS[t]?.code)
                set({ matiereId: Number(e.target.value), languages: langs.length === 1 ? langs : (a.languages || []).filter((l) => langs.includes(l)) })
              }}>
                <option value="">Choisir une matière</option>
                {matieresForClass.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {matiere && (
                <span className="hint">
                  {tools.length ? `Outils informatiques : ${tools.map((t) => TOOLS[t].label).join(', ')}` : 'Pas d\'outil informatique : QCM et questions ouvertes'}
                </span>
              )}
            </div>
            <div className="field span-2">
              <span className="label">Type d'épreuve</span>
              <div className="form-grid cols-2">
                {[
                  ['devoir', 'Devoir', 'À rendre avant une date limite, tentatives configurables, sans surveillance stricte.'],
                  ['examen', 'Examen surveillé', 'Créneau fixe, chronomètre, code d\'accès donné par le surveillant, règles de sécurité.'],
                ].map(([k, t, d]) => (
                  <label key={k} className={`choice ${a.kind === k ? 'selected' : ''}`} style={{ alignItems: 'flex-start' }}>
                    <input type="radio" name="kind" checked={a.kind === k} disabled={isPublished} onChange={() => set({ kind: k, security: { ...a.security, fullscreen: k === 'examen', exitWarnings: k === 'examen' ? 1 : null } })} />
                    <span><strong>{t}</strong><span className="small muted" style={{ display: 'block' }}>{d}</span></span>
                  </label>
                ))}
              </div>
            </div>
            {matiereLangs.length > 0 && (
              <div className="field span-2">
                <span className="label">Langage de programmation de l'épreuve</span>
                <span className="hint">L'éditeur, le nom du fichier et le terminal de l'étudiant s'adaptent au langage choisi. Plusieurs langages possibles.</span>
                <div className="lang-picker" role="group" aria-label="Langages de l'épreuve">
                  {matiereLangs.map((l) => (
                    <label key={l} className={`choice lang-choice ${codeLangs.includes(l) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={codeLangs.includes(l)} disabled={locked} onChange={() => toggleLang(l)} />
                      <span>
                        <strong>{TOOLS[l].label}</strong>
                        <span className="mono small muted" style={{ display: 'block' }}>{LANG_ENV[l].file}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="form-grid cols-2">
            <div className="field">
              <label htmlFor="w-start">{a.kind === 'examen' ? 'Début du créneau' : 'Ouverture'}</label>
              <input id="w-start" type="datetime-local" className="input" value={toLocalInput(a.startAt)} onChange={(e) => set({ startAt: fromLocalInput(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="w-end">{a.kind === 'examen' ? 'Fin du créneau' : 'Date limite de rendu'}</label>
              <input id="w-end" type="datetime-local" className="input" value={toLocalInput(a.endAt)} onChange={(e) => set({ endAt: fromLocalInput(e.target.value) })} />
            </div>
            {a.kind === 'examen' ? (
              <div className="field">
                <label htmlFor="w-dur">Durée de composition (minutes)</label>
                <input id="w-dur" type="number" min="5" max="600" className="input" value={a.durationMin || ''} onChange={(e) => set({ durationMin: Number(e.target.value) })} />
                <span className="hint">Le chronomètre démarre quand l'étudiant entre le code. Il ne dépasse jamais la fin du créneau.</span>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="w-att">Nombre de tentatives autorisées</label>
                <input id="w-att" type="number" min="1" max="10" className="input" value={a.maxAttempts} onChange={(e) => set({ maxAttempts: Number(e.target.value) })} />
                <span className="hint">La meilleure note est retenue.</span>
              </div>
            )}
          </div>
        )}

        {step === 2 && (() => {
          const addButtons = (sectionId) => (
            <div className="row-wrap add-q-row">
              <span className="label" style={{ marginRight: 4 }}>{sectionId ? 'Ajouter dans cet exercice :' : 'Ajouter :'}</span>
              {TYPE_BUTTONS.filter(([t]) => typeAllowed(t)).map(([t, Icon]) => (
                <button key={t} className="btn btn-outline btn-sm" disabled={locked} onClick={() => addQuestion(t, sectionId)}>
                  <Icon size={15} strokeWidth={1.6} /> {t === 'code' ? `Code (${codeLangs.map((l) => TOOLS[l].label).join(', ')})` : QUESTION_TYPES[t]}
                </button>
              ))}
              <button className="btn btn-secondary btn-sm" disabled={locked} onClick={() => setBank({ sectionId })}><Library size={15} strokeWidth={1.6} /> Depuis la banque</button>
            </div>
          )
          const editors = (items) => items.map(({ q, i }, k) => (
            <QuestionEditor
              key={q.id}
              q={q}
              index={k}
              total={items.length}
              languages={codeLangs}
              onChange={(nq) => updateQ(i, nq)}
              onRemove={() => set({ questions: a.questions.filter((_, j) => j !== i) })}
              onMove={(d) => moveQ(i, d)}
              onDuplicate={() => set({ questions: [...a.questions.slice(0, i + 1), { ...JSON.parse(JSON.stringify(q)), id: tempId() }, ...a.questions.slice(i + 1)] })}
              onSaveToBank={async () => {
                try {
                  await api.saveBankQuestion({ type: q.type, statement: q.statement, points: q.points, data: q.data, matiereId: Number(a.matiereId) || null, tags: [] })
                  toast.success('Question ajoutée à la banque.')
                } catch (e) { toast.error(e.message) }
              }}
            />
          ))
          const indexed = a.questions.map((q, i) => ({ q, i }))
          return (
            <>
              <div className="row-wrap">
                <div>
                  <span className="label">Organisation du sujet</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    {sections.length
                      ? `${sections.length} exercice${sections.length > 1 ? 's' : ''}, ${a.questions.length} question${a.questions.length > 1 ? 's' : ''} - ${total} points`
                      : `${a.questions.length} question${a.questions.length > 1 ? 's' : ''} - ${total} points. Regroupez-les en exercices pour un sujet plus clair.`}
                  </span>
                </div>
                <div className="spacer" />
                <button className="btn btn-primary btn-sm" disabled={locked} onClick={addSection}><FolderPlus size={15} strokeWidth={1.7} /> Ajouter un exercice</button>
              </div>
              <p className="small muted">
                {tools.length
                  ? <>Outils prévus pour {matiere?.name} : {tools.map((t) => TOOLS[t].label).join(', ')}.</>
                  : <>La matière {matiere?.name} n'utilise pas d'outil informatique : QCM et questions ouvertes uniquement.</>}
                {' '}Ces outils sont réglés par l'administration.
                {codeLangs.length > 0 && <> Langage de l'épreuve : <strong>{codeLangs.map((l) => TOOLS[l].label).join(', ')}</strong>.</>}
              </p>
              {matiereLangs.length > 0 && codeLangs.length === 0 && (
                <Notice>Pour ajouter une question de code, choisissez d'abord le langage de l'épreuve à l'étape <button className="link-btn" onClick={() => go(0)}>Informations</button>.</Notice>
              )}

              <fieldset disabled={locked} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
                {!sections.length && (
                  <>
                    {addButtons(null)}
                    {a.questions.length === 0 && <Empty icon={Plus} title="Aucune question pour l'instant">Ajoutez une question avec les boutons ci-dessus, ou commencez par un exercice.</Empty>}
                    {editors(indexed)}
                  </>
                )}

                {sections.map((s, k) => {
                  const items = indexed.filter(({ q }) => q.sectionId === s.id)
                  const pts = items.reduce((sum, { q }) => sum + Number(q.points || 0), 0)
                  return (
                    <section className="ex-block" key={s.id}>
                      <div className="ex-block-head">
                        <span className="ex-badge">Exercice {k + 1}</span>
                        <input
                          className="input ex-title-input"
                          value={s.title}
                          onChange={(e) => updateSection(s.id, { title: e.target.value })}
                          placeholder="Titre de l'exercice, par exemple : Jointures"
                          aria-label={`Titre de l'exercice ${k + 1}`}
                        />
                        <span className="small muted nowrap">{items.length} question{items.length > 1 ? 's' : ''} - {pts} pts</span>
                        <button className="icon-btn" disabled={k === 0} onClick={() => moveSection(k, -1)} aria-label="Monter l'exercice"><ArrowUp {...ICON} /></button>
                        <button className="icon-btn" disabled={k === sections.length - 1} onClick={() => moveSection(k, 1)} aria-label="Descendre l'exercice"><ArrowDown {...ICON} /></button>
                        <button className="icon-btn" onClick={() => (items.length ? setRemoving(s) : removeSection(s.id))} aria-label="Supprimer l'exercice"><Trash2 {...ICON} /></button>
                      </div>
                      <div className="ex-block-body stack">
                        <div className="field">
                          <label htmlFor={`ex-intro-${s.id}`}>Consigne commune (facultatif)</label>
                          <textarea
                            id={`ex-intro-${s.id}`}
                            className="textarea"
                            style={{ minHeight: 64 }}
                            value={s.intro}
                            onChange={(e) => updateSection(s.id, { intro: e.target.value })}
                            placeholder="Contexte affiché au-dessus de chaque question de l'exercice : base de données utilisée, données d'entrée..."
                          />
                        </div>
                        {items.length === 0 && <div className="ex-empty">Aucune question dans cet exercice.</div>}
                        {editors(items)}
                        {addButtons(s.id)}
                      </div>
                    </section>
                  )
                })}
              </fieldset>
            </>
          )
        })()}

        {step === 3 && (
          <div>
            <Toggle title="Plein écran obligatoire" desc="Une sortie du plein écran est enregistrée et un message calme invite l'étudiant à y revenir. Personne n'est exclu automatiquement." checked={a.security.fullscreen} onChange={(v) => setSec({ fullscreen: v })} />
            <Toggle
              title="Envoyer la copie après un avertissement"
              desc="À la 1re sortie de l'épreuve (plein écran quitté ou changement de fenêtre), un avertissement s'affiche. À la 2e sortie, la copie est envoyée automatiquement avec les réponses déjà saisies. Désactivé : les sorties sont seulement signalées."
              checked={!!a.security.exitWarnings}
              onChange={(v) => setSec({ exitWarnings: v ? 1 : null })}
            />
            <Toggle title="Bloquer le copier-coller externe" desc="Copier, couper, coller, glisser-déposer et clic droit sont bloqués. Dans les zones de réponse, l'étudiant peut recoller ce qu'il a lui-même copié." checked={a.security.blockPaste} onChange={(v) => setSec({ blockPaste: v })} />
            <Toggle title="Mélanger l'ordre des questions" desc="Chaque étudiant reçoit les questions dans un ordre différent." checked={a.security.shuffleQuestions} onChange={(v) => setSec({ shuffleQuestions: v })} />
            <Toggle title="Exiger Safe Exam Browser" desc="La clé du navigateur est vérifiée par le serveur. Réservé aux postes de la salle équipés de SEB." checked={a.security.sebRequired} onChange={(v) => setSec({ sebRequired: v })} disabled={a.kind !== 'examen'} />
            {a.security.sebRequired && (
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor="w-seb">Clés Browser Exam Key autorisées (une par ligne)</label>
                <textarea id="w-seb" className="textarea mono" value={a.security.sebKeys} onChange={(e) => setSec({ sebKeys: e.target.value })} />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Notice>Tous les événements (sorties du plein écran, changements d'onglet, collages bloqués, gros blocs de code apparus d'un coup) sont horodatés dans le journal de chaque copie. Le surveillant et l'enseignant décident.</Notice>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <div className="form-grid cols-3">
              <div><div className="label">Titre</div><div>{a.title || '-'}</div></div>
              <div><div className="label">Type</div><div>{a.kind === 'examen' ? 'Examen surveillé' : 'Devoir'}</div></div>
              <div><div className="label">Classe / matière</div><div>{teaching.classes.find((c) => c.id === Number(a.classeId))?.name || '-'} - {teaching.matieres.find((m) => m.id === Number(a.matiereId))?.name || '-'}</div></div>
              <div><div className="label">{a.kind === 'examen' ? 'Créneau' : 'Période'}</div><div>{fmtDateTime(a.startAt)} - {fmtDateTime(a.endAt)}</div></div>
              <div><div className="label">{a.kind === 'examen' ? 'Durée' : 'Tentatives'}</div><div>{a.kind === 'examen' ? `${a.durationMin} min` : a.maxAttempts}</div></div>
              <div><div className="label">Questions</div><div>{a.questions.length} - {total} points</div></div>
              <div><div className="label">Langage</div><div>{codeLangs.length ? codeLangs.map((l) => TOOLS[l].label).join(', ') : '-'}</div></div>
              <div className="span-2"><div className="label">Sécurité</div><div>{[a.security.fullscreen && 'Plein écran', a.security.exitWarnings && 'Copie envoyée à la 2e sortie', a.security.blockPaste && 'Copier-coller externe bloqué', a.security.shuffleQuestions && 'Ordre mélangé', a.security.sebRequired && 'Safe Exam Browser'].filter(Boolean).join(', ') || 'Aucune règle'}</div></div>
            </div>
            <div className="stack-sm">
              <span className="label">Aperçu des questions (vue étudiant)</span>
              {a.questions.map((q, i) => {
                const k = sections.findIndex((s) => s.id === q.sectionId)
                const first = k >= 0 && a.questions[i - 1]?.sectionId !== q.sectionId
                const n = k >= 0 ? a.questions.slice(0, i + 1).filter((x) => x.sectionId === q.sectionId).length : i + 1
                return (
                <Fragment key={q.id}>
                {first && (
                  <div className="ex-preview">
                    <span className="ex-badge">Exercice {k + 1}</span>
                    <strong>{sections[k].title || 'Sans titre'}</strong>
                    {sections[k].intro && <Statement text={sections[k].intro} />}
                  </div>
                )}
                <div className="q-card">
                  <div className="q-card-head"><span className="q-num">Question {n}</span><span className="tag">{QUESTION_TYPES[q.type]}</span><div className="spacer" /><span className="small">{q.points} pts</span></div>
                  <div className="q-card-body">
                    {q.statement ? <Statement text={q.statement} /> : (
                      <div className="row-wrap">
                        <span className="muted">Énoncé vide : il s'écrit à l'étape Questions (cet aperçu ne se modifie pas).</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => goToQuestion(q.id)}>Écrire l'énoncé</button>
                      </div>
                    )}
                    {q.type === 'qcm' && <ul style={{ margin: 0 }}>{q.data.choices.map((c) => <li key={c.id}>{c.text || <span className="muted">Choix vide</span>}{q.data.correct.includes(c.id) && <span className="badge badge-success badge-plain" style={{ marginLeft: 8 }}>Bonne réponse</span>}</li>)}</ul>}
                    {q.type === 'code' && <span className="small muted">{LANGUAGES[q.data.language]} - {q.data.tests.length} test(s) dont {q.data.tests.filter((t) => t.hidden).length} caché(s)</span>}
                  </div>
                </div>
                </Fragment>
                )
              })}
            </div>
            {a.kind === 'examen' && <Notice>Après publication, un code d'accès est généré. Le surveillant ouvre la session et donne le code aux étudiants le jour de l'examen.</Notice>}
          </div>
        )}

        {error && (
          <Notice kind="danger">
            <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
              <span>{error}</span>
              {errorQuestion && <button className="btn btn-secondary btn-sm" onClick={() => goToQuestion(errorQuestion.id)}>Corriger cette question</button>}
            </div>
          </Notice>
        )}
      </div></div>

      <div className="wizard-foot">
        <button className="btn btn-secondary" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={16} /> Précédent</button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => go(step + 1)}>Suivant <ChevronRight size={16} /></button>
        ) : (
          <div className="row-wrap">
            {!isPublished && <button className="btn btn-secondary" disabled={busy} onClick={() => persist(false)}><Save {...ICON} /> Garder en brouillon</button>}
            <button className="btn btn-primary" disabled={busy} onClick={() => persist(true)}><Send {...ICON} /> {isPublished ? 'Enregistrer les modifications' : 'Publier'}</button>
          </div>
        )}
      </div>

      {removing && (
        <Confirm
          danger
          title="Supprimer l'exercice"
          message={`L'exercice « ${removing.title || 'sans titre'} » et ses ${a.questions.filter((q) => q.sectionId === removing.id).length} question(s) seront supprimés.`}
          confirmLabel="Supprimer"
          onClose={() => setRemoving(null)}
          onConfirm={() => { removeSection(removing.id); setRemoving(null) }}
        />
      )}

      {bank && (
        <BankPicker
          matiereId={a.matiereId}
          allowed={bankAllowed}
          onClose={() => setBank(null)}
          onPick={(items) => {
            const sectionId = bank.sectionId || undefined
            set({ questions: regroup([...a.questions, ...items.map((b) => ({ id: tempId(), type: b.type, statement: b.statement, points: b.points, data: JSON.parse(JSON.stringify(b.data)), ...(sectionId ? { sectionId } : {}) }))]) })
            setBank(null)
            toast.success(`${items.length} question(s) ajoutée(s).`)
          }}
        />
      )}
    </div>
  )
}
