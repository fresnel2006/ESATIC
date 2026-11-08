import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Maximize, Check, CloudUpload, CloudOff, Loader2, Play, ChevronLeft, ChevronRight, Globe, ListChecks,
  Monitor, Send, CircleCheck, FileCode2, TriangleAlert, Info,
} from 'lucide-react'
import * as api from '../../api/index.js'
import Logo from '../../components/Logo.jsx'
import CodeEditor from '../../components/CodeEditor.jsx'
import Statement from '../../components/Statement.jsx'
import Terminal from '../../components/RunConsole.jsx'
import { prepareEngine } from '../../lib/engines.js'
import { useExecution } from '../../lib/useExecution.js'
import { EngineLine } from '../../components/EngineStatus.jsx'
import { TEST_MODE } from '../../config.js'
import { Loader, Modal, Notice, ErrorBox, ICON } from '../../components/ui.jsx'
import { WebEditor, WebPreview, webValue } from '../../components/WebPlayground.jsx'
import ExamOutline, { outlineOf } from '../../components/ExamOutline.jsx'
import { useExamGuard } from '../../lib/useExamGuard.js'
import { fmtDuration, fmtRelativeDay, fmtTime, isWriteOnly, DIAGRAM_NOTATIONS, LANGUAGES, LANG_ENV, QUESTION_TYPES } from '../../lib/format.js'

const DiagramEditor = lazy(() => import('../../components/DiagramEditor.jsx'))

const DESKTOP_ONLY = ['code', 'sql', 'html', 'diagram']

function isAnswered(v) {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v).some((x) => String(x || '').trim())
  return String(v).trim().length > 0
}


function useIsDesktop() {
  const q = '(min-width: 900px) and (pointer: fine)'
  const [ok, setOk] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const h = () => setOk(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return ok
}

// Le premier lancement charge le moteur (Python surtout) : on le signale
const warmed = new Set()

// Historique du terminal d'une question (10 derniers lancements)
function useTerminal(language) {
  const [history, setHistory] = useState([])
  const [running, setRunning] = useState(false)
  const [first, setFirst] = useState(false)
  useEffect(() => {
    if (TEST_MODE.runCodeInBrowser) prepareEngine(language).then(() => warmed.add(language))
  }, [language])
  // mode 'run' : exécuter le programme avec l'entrée saisie ; 'tests' : vérifier les exemples
  async function launch(payload, mode = 'run') {
    setFirst(!warmed.has(language))
    setRunning(mode)
    const result = await api.runCode({ language, ...payload })
    warmed.add(language)
    setHistory((h) => [...h.slice(-9), { command: LANG_ENV[language]?.run ?? language, result, language, mode }])
    setRunning(false)
  }
  return { history, running, first, launch, clear: () => setHistory([]) }
}

function FileTab({ language }) {
  return (
    <span className="file-tab">
      <FileCode2 size={14} strokeWidth={1.6} /> {LANG_ENV[language]?.file}
      <span className="file-lang">{LANGUAGES[language] ?? 'SQL'}</span>
    </span>
  )
}

function CodeQuestion({ q, value, onChange, onBigInsert }) {
  const [stdin, setStdin] = useState(q.data.tests?.[0]?.stdin ?? '')
  const code = value ?? q.data.starter ?? ''
  const term = useTerminal(q.data.language)
  // Langage sans exécution (C++, Java, OCaml, pseudo-code) :
  // l'étudiant écrit son code normalement, sans bouton Lancer, ni entrée, ni exemples, ni terminal
  const execution = useExecution()
  const runnable = execution.canRun(q.data.language)
  const limitMs = q.data.timeLimitMs || 2000
  // Lancer : le programme seul, avec l'entrée saisie. Tester : les exemples de l'énoncé, sans exécution libre.
  const run = () => term.launch({ code, stdin, tests: [], timeLimitMs: limitMs }, 'run')
  const test = () => term.launch({ code, stdin: '', tests: q.data.tests || [], timeLimitMs: limitMs, runCustom: false }, 'tests')
  return (
    <div className="stack-sm">
      <div className="code-area">
        <div className="code-toolbar">
          <FileTab language={q.data.language} />
          <span className="small muted">Le copier-coller fonctionne à l'intérieur de vos réponses.</span>
          <div className="spacer" />
          {runnable && (q.data.tests || []).length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={test} disabled={!!term.running}><ListChecks size={14} /> Tester les exemples</button>
          )}
          {runnable && <button className="btn btn-primary btn-sm" onClick={run} disabled={!!term.running}><Play size={14} /> Lancer</button>}
        </div>
        {runnable && <EngineLine lang={q.data.language} />}
        {execution.known && !runnable && (
          <div className="engine-line no-run">
            <Info size={14} />
            <span>
              {isWriteOnly(q.data.language)
                ? 'Le pseudo-code ne s\'exécute pas : écrivez votre algorithme dans l\'éditeur. Il est enregistré automatiquement et sera corrigé par l\'enseignant.'
                : `L'exécution du ${LANGUAGES[q.data.language]} n'est pas disponible sur la plateforme. Écrivez votre programme normalement : il est enregistré automatiquement et sera corrigé par l'enseignant.`}
            </span>
          </div>
        )}
        <CodeEditor value={code} language={q.data.language} onChange={onChange} onBigInsert={onBigInsert} height={380} />
      </div>
      {/* Entrée, exemples et terminal : seulement pour les langages qu'on peut exécuter */}
      {runnable && (
        <div className="form-grid cols-2">
          <div className="field">
            <label>Entrée du programme (ce que l'utilisateur tape, une ligne par lecture)</label>
            <textarea className="textarea mono answer-zone" style={{ minHeight: 70 }} value={stdin} onChange={(e) => setStdin(e.target.value)} />
          </div>
          <div className="field">
            <label>Exemples</label>
            <div className="small" style={{ color: 'var(--text-2)' }}>
              {(q.data.tests || []).map((t) => (
                <div key={t.id} className="mono no-select" style={{ marginBottom: 6 }}>
                  Entrée : {t.stdin.replace(/\n/g, ' / ')} &nbsp;Sortie attendue : {t.expected}
                </div>
              ))}
              {q.data.hiddenTestCount > 0 && <div className="muted">+ {q.data.hiddenTestCount} test(s) caché(s) utilisés pour la note.</div>}
            </div>
          </div>
        </div>
      )}
      {runnable && <Terminal language={q.data.language} history={term.history} running={term.running} first={term.first} onClear={term.clear} />}
      {runnable && q.data.language === 'php' && <PhpPageRender history={term.history} />}
    </div>
  )
}

// PHP qui produit du HTML (echo "<h1>...", tableau construit dans une boucle...) : la sortie du dernier
// lancement est aussi montrée comme une vraie page, dans un cadre isolé, comme l'aperçu des questions web
const LOOKS_LIKE_HTML = /<\s*(!doctype|html|head|body|div|p|h[1-6]|table|tr|td|th|ul|ol|li|span|a|img|form|input|button|br|hr|b|i|strong|em|section|article|header|footer|nav|style|label|select|textarea)\b/i

function PhpPageRender({ history }) {
  const last = history[history.length - 1]?.result
  const html = last?.stdout || ''
  if (!LOOKS_LIKE_HTML.test(html)) return null
  return (
    <div className="stack-sm php-render">
      <div className="row small muted">
        <Globe size={15} strokeWidth={1.6} /> Rendu de la page produite par main.php (dernier lancement)
      </div>
      <WebPreview value={{ html, css: '', js: '' }} height={320} title="Rendu de la page PHP" address="localhost/main.php" showConsole={false} />
      <span className="hint">Les liens et les envois de formulaires ne rappellent pas le programme PHP dans cet aperçu.</span>
    </div>
  )
}

function SqlQuestion({ q, value, onChange, onBigInsert }) {
  const term = useTerminal('sql')
  return (
    <div className="stack-sm">
      <details>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 500 }}>Schéma de la base de test</summary>
        <pre className="code-block no-select" style={{ marginTop: 8 }}>{q.data.schemaSql}</pre>
      </details>
      <div className="code-area">
        <div className="code-toolbar">
          <FileTab language="sql" />
          <div className="spacer" />
          <button className="btn btn-primary btn-sm" disabled={term.running} onClick={() => term.launch({ code: value ?? '', schemaSql: q.data.schemaSql, seedSql: q.data.seedSql })}>
            <Play size={14} /> Exécuter
          </button>
        </div>
        <EngineLine lang="sql" />
        <CodeEditor value={value ?? ''} language="sql" onChange={onChange} onBigInsert={onBigInsert} height={220} />
      </div>
      <Terminal language="sql" history={term.history} running={term.running} first={term.first} onClear={term.clear} />
    </div>
  )
}

function HtmlQuestion({ q, value, onChange, onBigInsert }) {
  return <WebEditor value={webValue(value, q.data)} onChange={onChange} onBigInsert={onBigInsert} />
}

function QuestionBody({ q, value, onChange, onBigInsert, desktop }) {
  if (DESKTOP_ONLY.includes(q.type) && !desktop) {
    return (
      <div className="desktop-only-msg">
        <Monitor {...ICON} style={{ flexShrink: 0 }} />
        <div>
          <strong>Cette question nécessite un ordinateur.</strong>
          <div className="small">Les questions de code, SQL et web (HTML, CSS, JavaScript) se font sur un PC, par exemple en salle informatique. Vos autres réponses sont bien enregistrées.</div>
        </div>
      </div>
    )
  }
  if (q.type === 'qcm') {
    const sel = value || []
    const toggle = (id) => onChange(q.data.multiple ? (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]) : [id])
    return (
      <div className="stack-sm" role={q.data.multiple ? 'group' : 'radiogroup'}>
        {q.data.multiple && <span className="small muted">Plusieurs réponses possibles.</span>}
        {q.data.choices.map((c) => (
          <label key={c.id} className={`choice no-select ${sel.includes(c.id) ? 'selected' : ''}`}>
            <input type={q.data.multiple ? 'checkbox' : 'radio'} name={`q${q.id}`} checked={sel.includes(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.text}</span>
          </label>
        ))}
      </div>
    )
  }
  if (q.type === 'ouverte') {
    const words = (value || '').trim().split(/\s+/).filter(Boolean).length
    return (
      <div className="field">
        <textarea className="textarea answer-zone" style={{ minHeight: 200 }} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Votre réponse" aria-label="Votre réponse" spellCheck={false} />
        <span className="hint">{words} mot{words > 1 ? 's' : ''}{q.data.maxWords ? ` - ${q.data.maxWords} maximum conseillés` : ''}</span>
      </div>
    )
  }
  if (q.type === 'code') return <CodeQuestion q={q} value={value} onChange={onChange} onBigInsert={onBigInsert} />
  if (q.type === 'sql') return <SqlQuestion q={q} value={value} onChange={onChange} onBigInsert={onBigInsert} />
  if (q.type === 'html') return <HtmlQuestion q={q} value={value} onChange={onChange} onBigInsert={onBigInsert} />
  if (q.type === 'diagram') {
    return (
      <div className="stack-sm">
        <div className="engine-line no-run diagram-help">
          <Info size={14} />
          <span>
            Glissez les formes depuis le panneau de gauche ({DIAGRAM_NOTATIONS[q.data.notation] || 'UML et Merise'}). Reliez deux formes en tirant une flèche depuis le bord de l'une vers l'autre.
            Double-cliquez sur un lien pour écrire sa cardinalité (0,1, 1,1, 0,n, 1,n), ou sur une forme pour changer son texte. Votre diagramme est enregistré automatiquement.
          </span>
        </div>
        <Suspense fallback={<Loader label="Ouverture de l'éditeur de diagrammes..." />}>
          <DiagramEditor key={q.id} value={value || q.data.starterXml || ''} notation={q.data.notation} onChange={onChange} height={600} />
        </Suspense>
      </div>
    )
  }
  return null
}

export default function TakeAttempt() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const draftKey = `esatic-draft-${attemptId}`

  const [att, setAtt] = useState(null)
  const [error, setError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [save, setSave] = useState({ state: 'idle', at: null })
  const [started, setStarted] = useState(false)
  const [fsLost, setFsLost] = useState(false)
  const [calm, setCalm] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [finished, setFinished] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const dirty = useRef(new Set())
  const answersRef = useRef({})
  const eventQueue = useRef([])
  const submitting = useRef(false)
  const warned5 = useRef(false)

  // ---------- Chargement et reprise ----------
  useEffect(() => {
    let alive = true
    api.getAttempt(attemptId).then((data) => {
      if (!alive) return
      let initial = { ...data.answers }
      // Brouillon local plus récent (coupure réseau ou fermeture du navigateur)
      try {
        const local = JSON.parse(localStorage.getItem(draftKey) || 'null')
        if (local && data.status === 'en_cours') {
          for (const [k, v] of Object.entries(local)) {
            if (JSON.stringify(v) !== JSON.stringify(initial[k])) {
              initial[k] = v
              dirty.current.add(k)
            }
          }
        }
      } catch { /* brouillon illisible : ignoré */ }
      answersRef.current = initial
      setAnswers(initial)
      setAtt(data)
      if (data.status !== 'en_cours') setFinished({ already: true })
      else if (Date.now() - new Date(data.startedAt).getTime() > 15000) eventQueue.current.push({ type: 'resumed', at: new Date().toISOString() })
    }).catch((e) => alive && setError(e))
    return () => { alive = false }
  }, [attemptId, draftKey])

  const security = att?.assessment.security
  const needFs = !!security?.fullscreen && document.fullscreenEnabled
  const ready = !!att && !finished && (started || !needFs)

  // ---------- Journal d'événements ----------
  const logEvent = useCallback((type, detail) => {
    eventQueue.current.push({ type, detail, at: new Date().toISOString() })
  }, [])

  const flushEvents = useCallback(async () => {
    if (!eventQueue.current.length) return
    const batch = eventQueue.current.splice(0)
    try {
      await api.logEvents(attemptId, batch)
    } catch {
      eventQueue.current.unshift(...batch)
    }
  }, [attemptId])

  useEffect(() => {
    const id = setInterval(flushEvents, 5000)
    return () => clearInterval(id)
  }, [flushEvents])

  const calmTimer = useRef(null)
  const showCalm = useCallback((msg) => {
    setCalm(msg)
    clearTimeout(calmTimer.current)
    calmTimer.current = setTimeout(() => setCalm(''), 4500)
  }, [])

  // ---------- Sorties de l'épreuve : avertissement, puis envoi automatique ----------
  // exitWarnings = nombre d'avertissements avant l'envoi (1 : avertissement à la 1re sortie, envoi à la 2e).
  const exitWarnings = security?.exitWarnings ?? null
  const exits = useRef(0)
  const lastExitAt = useRef(0)
  const [warning, setWarning] = useState(null)
  useEffect(() => {
    if (att) exits.current = att.exitCount || 0
  }, [att])

  const submitRef = useRef(null)
  const registerExit = useCallback(() => {
    if (!exitWarnings) return
    // Changer de fenêtre fait souvent aussi quitter le plein écran : une seule sortie
    if (Date.now() - lastExitAt.current < 2500) return
    lastExitAt.current = Date.now()
    exits.current += 1
    if (exits.current <= exitWarnings) {
      eventQueue.current.push({ type: 'exit_counted', at: new Date().toISOString(), detail: { n: exits.current } })
      flushEvents()
      setWarning({ n: exits.current, left: exitWarnings - exits.current })
    } else {
      submitRef.current?.('exits')
    }
  }, [exitWarnings, flushEvents])

  useExamGuard({
    active: ready,
    blockPaste: !!security?.blockPaste,
    requireFullscreen: needFs,
    onEvent: (type, detail) => {
      logEvent(type, detail)
      if (['fullscreen_exit', 'tab_hidden', 'navigation_away', 'window_left'].includes(type)) registerExit()
    },
    onCalm: showCalm,
    onFullscreenLost: () => setFsLost(true),
  })

  // ---------- Sauvegarde automatique ----------
  const flushAnswers = useCallback(async () => {
    if (!dirty.current.size) return true
    const keys = [...dirty.current]
    const changes = Object.fromEntries(keys.map((k) => [k, answersRef.current[k]]))
    setSave({ state: 'saving', at: null })
    try {
      const r = await api.saveAnswers(attemptId, changes)
      // Ne retire que ce qui n'a pas changé entre-temps
      for (const k of keys) if (JSON.stringify(answersRef.current[k]) === JSON.stringify(changes[k])) dirty.current.delete(k)
      setSave({ state: 'saved', at: r.savedAt })
      if (!dirty.current.size) localStorage.removeItem(draftKey)
      return true
    } catch (e) {
      if (e.code === 'closed' || e.code === 'time_over') {
        setFinished({ closed: e.message })
        return false
      }
      setSave({ state: 'offline', at: null })
      return false
    }
  }, [attemptId, draftKey])

  useEffect(() => {
    if (!att || finished) return
    const s = Math.min(30, Math.max(20, att.autosaveSeconds || 25))
    const id = setInterval(flushAnswers, s * 1000)
    return () => clearInterval(id)
  }, [att, finished, flushAnswers])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') { flushAnswers(); flushEvents() }
    }
    const onUnload = (e) => {
      if (dirty.current.size && !submitting.current) { e.preventDefault(); e.returnValue = '' }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [flushAnswers, flushEvents])

  function setAnswer(qid, value) {
    const k = String(qid)
    answersRef.current = { ...answersRef.current, [k]: value }
    setAnswers(answersRef.current)
    dirty.current.add(k)
    setSave((s) => (s.state === 'saving' ? s : { state: 'pending', at: s.at }))
    try { localStorage.setItem(draftKey, JSON.stringify(answersRef.current)) } catch { /* stockage plein */ }
  }

  // ---------- Rendu de la copie ----------
  const submit = useCallback(async (auto = false) => {
    if (submitting.current) return
    submitting.current = true
    try {
      await flushEvents()
      const pending = Object.fromEntries([...dirty.current].map((k) => [k, answersRef.current[k]]))
      await api.submitAttempt(attemptId, pending, auto === 'exits' ? 'exits' : null)
      dirty.current.clear()
      localStorage.removeItem(draftKey)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      setWarning(null)
      setFinished({ auto })
    } catch (e) {
      submitting.current = false
      if (e.code === 'closed' || e.code === 'time_over') setFinished({ closed: e.message })
      else showCalm('La copie n\'a pas pu être envoyée. Vérifiez la connexion, vos réponses restent enregistrées sur ce poste.')
    }
  }, [attemptId, draftKey, flushEvents, showCalm])
  useEffect(() => {
    submitRef.current = submit
  }, [submit])

  // ---------- Chronomètre ----------
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = att?.deadlineAt ? new Date(att.deadlineAt).getTime() - now : null
  useEffect(() => {
    if (!ready || remaining === null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rendu automatique à la fin du temps
    if (remaining <= 0) submit(true)
    else if (remaining < 5 * 60 * 1000 && !warned5.current && att.assessment.kind === 'examen') {
      warned5.current = true
      showCalm('Il reste 5 minutes. Pensez à relire vos réponses.')
    }
  }, [remaining, ready, submit, showCalm, att])

  const questions = useMemo(() => att?.assessment.questions ?? [], [att])
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen()
    } catch { /* refusé par le navigateur */ }
    setStarted(true)
    setFsLost(false)
  }

  if (error) return <div className="content"><ErrorBox error={error} /><p style={{ marginTop: 12 }}><Link to="/etudiant">Retour à l'accueil</Link></p></div>
  if (!att) return <Loader label="Ouverture de la copie..." />

  if (finished) {
    return (
      <div className="exam" style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 480, width: '100%' }}>
          <div className="card-body stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <CircleCheck size={44} strokeWidth={1.4} color="var(--success)" />
            <h1 style={{ fontSize: '1.3rem' }}>{finished.already ? 'Copie déjà rendue' : finished.closed ? 'Épreuve terminée' : 'Copie rendue'}</h1>
            <p className="muted">
              {finished.closed || (finished.auto === 'exits'
                ? 'Vous avez quitté l\'épreuve après l\'avertissement : votre copie a été envoyée automatiquement avec toutes les réponses déjà saisies. Le surveillant et l\'enseignant en sont informés.'
                : finished.auto
                  ? 'Le temps est écoulé : votre copie a été rendue automatiquement avec toutes vos réponses enregistrées.'
                  : 'Vos réponses ont bien été envoyées. La note sera visible après publication par l\'enseignant.')}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/etudiant', { replace: true })}>Retour à l'accueil</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const place = outlineOf(att.assessment.sections, questions).label(index)
  const low = remaining !== null && remaining < 5 * 60 * 1000

  return (
    <div className="exam">
      <header className="exam-bar">
        <Logo height={28} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="title">{att.assessment.title}</div>
          <div className="sub">{att.assessment.matiere} - {answeredCount}/{questions.length} répondue{answeredCount > 1 ? 's' : ''}</div>
        </div>
        <span className="save-state" aria-live="polite">
          {save.state === 'saving' && <><Loader2 size={14} className="spin" /> Enregistrement...</>}
          {save.state === 'saved' && <><Check size={14} /> Enregistré à {fmtTime(save.at)}</>}
          {save.state === 'pending' && <><CloudUpload size={14} /> Modifications à enregistrer</>}
          {save.state === 'offline' && <><CloudOff size={14} /> Hors connexion, réponses gardées sur ce poste</>}
        </span>
        {remaining !== null && (remaining < 24 * 3600 * 1000
          ? <span className={`timer ${low ? 'low' : ''}`} aria-label="Temps restant">{fmtDuration(remaining)}</span>
          : <span className="save-state">À rendre {fmtRelativeDay(att.deadlineAt).toLowerCase()}</span>)}
        <button className="btn btn-primary" onClick={async () => { await flushAnswers(); setConfirm(true) }}><Send size={16} /> Rendre</button>
      </header>

      <div className="exam-body">
        <aside className="q-nav">
          <ExamOutline
            sections={att.assessment.sections}
            questions={questions}
            answered={(qq) => isAnswered(answers[qq.id])}
            current={index}
            onSelect={setIndex}
            totalPoints={att.assessment.maxPoints}
            defaultOpen={desktop}
            footer={att.assessment.maxAttempts > 1 && <span>Tentative {att.number} sur {att.assessment.maxAttempts}</span>}
          />
        </aside>

        {q && (
          <section className="card" key={q.id}>
            <div className="card-header">
              <div className="q-heading">
                {place.section && <span className="q-heading-ex">Exercice {place.section.number} - {place.section.section.title}</span>}
                <div className="row">
                  <h2>{place.title}</h2>
                  <span className="tag">{QUESTION_TYPES[q.type]}</span>
                </div>
              </div>
              <span className="small muted">{q.points} point{q.points > 1 ? 's' : ''}</span>
            </div>
            <div className="card-body stack">
              {place.section?.section.intro && (
                <div className="ex-intro">
                  <span className="ex-intro-label">Consigne de l'exercice {place.section.number}</span>
                  <Statement text={place.section.section.intro} selectable={false} />
                </div>
              )}
              <Statement text={q.statement} selectable={false} />
              <QuestionBody
                q={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
                onBigInsert={(n) => logEvent('big_insert', { length: n, questionId: q.id })}
                desktop={desktop}
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={16} /> Précédente</button>
                {index < questions.length - 1
                  ? <button className="btn btn-outline" onClick={() => setIndex(index + 1)}>Suivante <ChevronRight size={16} /></button>
                  : <button className="btn btn-primary" onClick={async () => { await flushAnswers(); setConfirm(true) }}>Terminer</button>}
              </div>
            </div>
          </section>
        )}
      </div>

      {calm && <div className="calm-toast" role="status">{calm}</div>}

      {needFs && !started && (
        <div className="calm-overlay">
          <div className="calm-box">
            <Maximize size={36} strokeWidth={1.4} />
            <h2>Prêt à commencer</h2>
            <p>L'épreuve se déroule en plein écran. Vos réponses sont enregistrées automatiquement.{remaining !== null && ` Temps restant : ${fmtDuration(remaining)}.`}</p>
            <button className="btn btn-primary btn-lg" onClick={enterFullscreen}>Passer en plein écran et commencer</button>
          </div>
        </div>
      )}

      {warning && (
        <div className="calm-overlay">
          <div className="calm-box warning-box" role="alertdialog" aria-labelledby="warn-title">
            <TriangleAlert size={38} strokeWidth={1.5} />
            <h2 id="warn-title">Avertissement</h2>
            <p>
              Vous avez quitté l'épreuve (sortie du plein écran ou changement de fenêtre). Cette sortie est enregistrée.
            </p>
            <p className="warning-rule">
              {warning.left > 0
                ? `Encore ${warning.left} avertissement${warning.left > 1 ? 's' : ''} possible${warning.left > 1 ? 's' : ''}, ensuite la copie sera envoyée automatiquement.`
                : 'Si vous quittez encore une fois l\'épreuve, votre copie sera envoyée automatiquement avec les réponses déjà saisies.'}
            </p>
            <button className="btn btn-primary btn-lg" onClick={async () => { setWarning(null); if (needFs && !document.fullscreenElement) await enterFullscreen() }}>
              J'ai compris, revenir à l'épreuve
            </button>
          </div>
        </div>
      )}

      {needFs && started && fsLost && !warning && (
        <div className="calm-overlay">
          <div className="calm-box">
            <Maximize size={36} strokeWidth={1.4} />
            <h2>Retournez en plein écran</h2>
            <p>Votre copie est intacte et le temps continue. Revenez en plein écran pour poursuivre.</p>
            <button className="btn btn-primary btn-lg" onClick={enterFullscreen}>Revenir en plein écran</button>
          </div>
        </div>
      )}

      {confirm && (
        <Modal
          title="Rendre la copie"
          onClose={() => setConfirm(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Continuer à composer</button>
            <button className="btn btn-primary" onClick={() => { setConfirm(false); submit(false) }}>Rendre ma copie</button>
          </>}
        >
          <div className="stack-sm">
            <p>Vous avez répondu à <strong>{answeredCount}</strong> question{answeredCount > 1 ? 's' : ''} sur {questions.length}.</p>
            {answeredCount < questions.length && <Notice>Certaines questions sont sans réponse. Vous pouvez y revenir avant de rendre.</Notice>}
            <p className="muted small">Une fois rendue, la copie ne peut plus être modifiée.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
