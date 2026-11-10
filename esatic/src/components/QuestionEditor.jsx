// Éditeur d'une question (assistant de création et banque de questions)
import { lazy, Suspense, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, EyeOff, Eye } from 'lucide-react'
import { ICON, Loader, Notice } from './ui.jsx'
import { isWriteOnly, LANGUAGES, QUESTION_TYPES } from '../lib/format.js'
import { isEmptyDiagram } from './DiagramEditor.jsx'
import { useExecution } from '../lib/useExecution.js'
import SqlTestDatabase from './SqlTestDatabase.jsx'

const CodeEditor = lazy(() => import('./CodeEditor.jsx'))
const DiagramEditor = lazy(() => import('./DiagramEditor.jsx'))
const WebEditor = lazy(() => import('./WebPlayground.jsx').then((m) => ({ default: m.WebEditor })))

let tmp = -1
export const tempId = () => tmp--
const rid = () => Math.random().toString(36).slice(2, 7)

export function newQuestion(type, language) {
  const q = baseQuestion(type)
  if (type === 'code' && language) {
    q.data.language = language
    q.data.starter = STARTERS[language] ?? ''
  }
  return q
}

function baseQuestion(type) {
  const base = { id: tempId(), type, statement: '', points: 1, data: {} }
  if (type === 'qcm') base.data = { multiple: false, choices: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }], correct: [] }
  if (type === 'ouverte') { base.points = 4; base.data = { answerModel: '', maxWords: 200 } }
  if (type === 'code') {
    base.points = 4
    base.data = { language: 'python', starter: '', timeLimitMs: 2000, tests: [{ id: rid(), name: 'Exemple', stdin: '', expected: '', points: 4, hidden: false }] }
  }
  if (type === 'sql') { base.points = 4; base.data = { schemaSql: '', seedSql: '', expectedQuery: '', orderMatters: false } }
  if (type === 'diagram') {
    base.points = 6
    base.data = { starterXml: '', answerModelXml: '' }
  }
  if (type === 'html') {
    base.points = 6
    base.data = { starterHtml: '', starterCss: '', starterJs: '', criteria: [{ id: rid(), label: 'Structure HTML', points: 3 }, { id: rid(), label: 'Mise en forme CSS', points: 3 }] }
  }
  return base
}

const STARTERS = {
  c: '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  python: '',
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

    }
}
`,
  javascript: "const lignes = require('fs').readFileSync(0, 'utf8').split('\\n');\n",
  php: '<?php\n$ligne = trim(fgets(STDIN));\n',
  ocaml: 'let () =\n  let ligne = read_line () in\n  print_endline ligne\n',
  algo: `Algorithme NomDeLAlgorithme
Variables
    n : Entier
Début
    Écrire("Entrez un nombre : ")
    Lire(n)

Fin
`,
}

// Partie repliable avec un éditeur de diagrammes : l'éditeur n'est chargé qu'à l'ouverture
// (sinon il se charge caché et prend le clavier pendant que l'enseignant écrit l'énoncé)
function DiagramDetails({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="diagram-details" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open && <Suspense fallback={<Loader label="Chargement de l'éditeur..." />}>{children}</Suspense>}
    </details>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// `languages` : langages autorisés pour la matière (tous si absent, par exemple dans la banque)
export default function QuestionEditor({ q, index, total, onChange, onRemove, onMove, onDuplicate, onSaveToBank, languages }) {
  const langOptions = Object.entries(LANGUAGES).filter(([k]) => !languages || languages.includes(k) || k === q.data?.language)
  const set = (patch) => onChange({ ...q, ...patch })
  const setData = (patch) => onChange({ ...q, data: { ...q.data, ...patch } })
  // Langage exécutable dans le navigateur : tests automatiques. Sinon (C++, Java, OCaml, pseudo-code) :
  // correction à la main, barème saisi directement
  const execution = useExecution()
  const autoTests = q.type === 'code' && (!execution.known || execution.canRun(q.data.language))
  const testSum = autoTests ? (q.data.tests || []).reduce((s, t) => s + Number(t.points || 0), 0) : 0
  const critSum = q.type === 'html' ? (q.data.criteria || []).reduce((s, c) => s + Number(c.points || 0), 0) : 0

  return (
    <div className="q-card">
      <div className="q-card-head">
        <span className="q-num">{index !== undefined ? `Question ${index + 1}` : 'Question'}</span>
        <span className="tag">{QUESTION_TYPES[q.type]}</span>
        <div className="spacer" />
        <label className="row small" style={{ gap: 6 }}>
          Barème
          <input
            type="number" min="0.5" step="0.5" className="input" style={{ width: 80, minHeight: 32 }}
            value={q.points}
            onChange={(e) => set({ points: e.target.value === '' ? '' : Number(e.target.value) })}
            disabled={autoTests || q.type === 'html'}
            title={autoTests ? 'Somme des points des tests' : q.type === 'html' ? 'Somme des critères' : undefined}
          />
          pts
        </label>
        {onMove && <>
          <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Monter"><ArrowUp {...ICON} /></button>
          <button className="icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Descendre"><ArrowDown {...ICON} /></button>
        </>}
        {onDuplicate && <button className="icon-btn" onClick={onDuplicate} aria-label="Dupliquer" title="Dupliquer"><Copy {...ICON} /></button>}
        {onSaveToBank && <button className="btn btn-ghost btn-sm" onClick={onSaveToBank}>Ajouter à la banque</button>}
        {onRemove && <button className="icon-btn" onClick={onRemove} aria-label="Supprimer la question" title="Supprimer"><Trash2 {...ICON} /></button>}
      </div>
      <div className="q-card-body">
        <Field label="Énoncé" hint="Entourez le code en ligne avec des accents graves, par exemple `int *p`.">
          <textarea id={`q-statement-${q.id}`} className="textarea" value={q.statement} onChange={(e) => set({ statement: e.target.value })} placeholder="Énoncé de la question" />
        </Field>

        {q.type === 'qcm' && (
          <>
            <label className="checkbox">
              <input type="checkbox" checked={!!q.data.multiple} onChange={(e) => setData({ multiple: e.target.checked, correct: e.target.checked ? q.data.correct : q.data.correct.slice(0, 1) })} />
              Plusieurs bonnes réponses possibles
            </label>
            <div className="stack-sm">
              <span className="label">Choix (cochez la ou les bonnes réponses)</span>
              {q.data.choices.map((c, i) => (
                <div className="choice-row" key={c.id}>
                  <input
                    type={q.data.multiple ? 'checkbox' : 'radio'}
                    name={`correct-${q.id}`}
                    checked={q.data.correct.includes(c.id)}
                    onChange={() => setData({ correct: q.data.multiple ? (q.data.correct.includes(c.id) ? q.data.correct.filter((x) => x !== c.id) : [...q.data.correct, c.id]) : [c.id] })}
                    aria-label={`Bonne réponse : choix ${i + 1}`}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                  />
                  <input className="input" value={c.text} placeholder={`Choix ${i + 1}`} onChange={(e) => setData({ choices: q.data.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
                  <button className="icon-btn" disabled={q.data.choices.length <= 2} onClick={() => setData({ choices: q.data.choices.filter((x) => x.id !== c.id), correct: q.data.correct.filter((x) => x !== c.id) })} aria-label="Retirer ce choix"><Trash2 {...ICON} /></button>
                </div>
              ))}
              <div><button className="btn btn-ghost btn-sm" onClick={() => setData({ choices: [...q.data.choices, { id: rid(), text: '' }] })}><Plus size={14} /> Ajouter un choix</button></div>
            </div>
          </>
        )}

        {q.type === 'ouverte' && (
          <div className="form-grid cols-2">
            <div className="span-2">
              <Field label="Corrigé / éléments attendus" hint="Visible uniquement par vous pendant la correction.">
                <textarea className="textarea" value={q.data.answerModel} onChange={(e) => setData({ answerModel: e.target.value })} />
              </Field>
            </div>
            <Field label="Nombre de mots conseillé">
              <input type="number" min="0" className="input" value={q.data.maxWords || ''} onChange={(e) => setData({ maxWords: Number(e.target.value) || null })} />
            </Field>
          </div>
        )}

        {q.type === 'code' && (
          <>
            <div className="form-grid cols-3">
              <Field label="Langage" hint={q.data.language === 'java' ? "La classe principale doit s'appeler Main." : undefined}>
                <select className="select" value={q.data.language} onChange={(e) => {
                  // Le code de départ par défaut suit le langage ; un code déjà personnalisé est conservé
                  const untouched = !q.data.starter?.trim() || q.data.starter === STARTERS[q.data.language]
                  setData({ language: e.target.value, starter: untouched ? STARTERS[e.target.value] ?? '' : q.data.starter })
                }}>
                  {langOptions.map(([k, v]) => <option key={k} value={k}>{v}{languages && !languages.includes(k) ? ' (non prévu pour la matière)' : ''}</option>)}
                </select>
              </Field>
              {autoTests && (
                <Field label="Temps maximum par test (ms)">
                  <input type="number" min="200" max="10000" step="100" className="input" value={q.data.timeLimitMs} onChange={(e) => setData({ timeLimitMs: Number(e.target.value) })} />
                </Field>
              )}
            </div>
            {!autoTests && (
              <Notice>
                {isWriteOnly(q.data.language)
                  ? 'Pseudo-code : l\'étudiant écrit son algorithme dans l\'éditeur, sans l\'exécuter. Vous le corrigez à la main ; fixez le barème en haut de la question.'
                  : `L'exécution du ${LANGUAGES[q.data.language]} n'est pas disponible sur la plateforme : l'étudiant écrit son code sans pouvoir le lancer, et vous le corrigez à la main. Fixez le barème en haut de la question.`}
              </Notice>
            )}
            <Field label="Code de départ donné à l'étudiant">
              <div className="code-area">
                <Suspense fallback={<Loader label="Chargement de l'éditeur..." />}>
                  <CodeEditor key={q.data.language} value={q.data.starter} language={q.data.language} onChange={(v) => setData({ starter: v })} height={200} />
                </Suspense>
              </div>
            </Field>
            {autoTests && <div className="stack-sm">
              <div className="row">
                <span className="label">Tests automatiques</span>
                <div className="spacer" />
                <span className={`small ${Math.abs(testSum - q.points) > 0.001 ? 'error-text' : 'muted'}`}>Total : {testSum} pts</span>
              </div>
              <span className="hint">L'entrée est envoyée sur stdin ; la sortie est comparée à la sortie attendue (espaces de fin ignorés). Les tests cachés ne sont pas montrés à l'étudiant.</span>
              {(q.data.tests || []).map((t) => {
                const upd = (patch) => {
                  const tests = q.data.tests.map((x) => (x.id === t.id ? { ...x, ...patch } : x))
                  onChange({ ...q, points: tests.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, tests } })
                }
                return (
                  <div className="test-row" key={t.id}>
                    <input className="input" value={t.name} placeholder="Nom du test" onChange={(e) => upd({ name: e.target.value })} aria-label="Nom du test" />
                    <textarea className="textarea" value={t.stdin} placeholder="Entrée (stdin)" onChange={(e) => upd({ stdin: e.target.value })} aria-label="Entrée" />
                    <textarea className="textarea" value={t.expected} placeholder="Sortie attendue" onChange={(e) => upd({ expected: e.target.value })} aria-label="Sortie attendue" />
                    <input type="number" min="0" step="0.5" className="input" value={t.points} onChange={(e) => upd({ points: Number(e.target.value) })} aria-label="Points" />
                    <button className={`btn btn-sm ${t.hidden ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => upd({ hidden: !t.hidden })} title={t.hidden ? 'Test caché' : 'Test visible par l\'étudiant'}>
                      {t.hidden ? <><EyeOff size={14} /> Caché</> : <><Eye size={14} /> Visible</>}
                    </button>
                    <button className="icon-btn" disabled={q.data.tests.length <= 1} onClick={() => {
                      const tests = q.data.tests.filter((x) => x.id !== t.id)
                      onChange({ ...q, points: tests.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, tests } })
                    }} aria-label="Supprimer le test"><Trash2 {...ICON} /></button>
                  </div>
                )
              })}
              <div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const tests = [...q.data.tests, { id: rid(), name: `Test ${q.data.tests.length + 1}`, stdin: '', expected: '', points: 1, hidden: true }]
                  onChange({ ...q, points: tests.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, tests } })
                }}><Plus size={14} /> Ajouter un test</button>
              </div>
            </div>}
          </>
        )}

        {q.type === 'sql' && (
          <div className="form-grid cols-2">
            <SqlTestDatabase
              schema={q.data.schemaSql}
              seed={q.data.seedSql}
              onChange={(schemaSql, seedSql) => setData({ schemaSql, seedSql })}
            />
            <div className="span-2">
              <Field label="Requête de référence" hint="Son résultat est comparé à celui de la requête de l'étudiant, sur une base de test neuve.">
                <textarea className="textarea mono" style={{ minHeight: 70 }} value={q.data.expectedQuery} onChange={(e) => setData({ expectedQuery: e.target.value })} />
              </Field>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={!!q.data.orderMatters} onChange={(e) => setData({ orderMatters: e.target.checked })} />
              L'ordre des lignes compte
            </label>
          </div>
        )}

        {q.type === 'diagram' && (
          <div className="stack-sm">
            <span className="hint">L'étudiant a toujours les formes Merise, Relation d'entité et UML. Les cardinalités (0,1, 1,1, 0,n, 1,n) s'écrivent sur les liens.</span>
            <DiagramDetails title={`Diagramme de départ donné à l'étudiant (facultatif)${isEmptyDiagram(q.data.starterXml) ? '' : ' : rempli'}`}>
              <span className="hint">Par exemple quelques entités déjà placées, à compléter. Laissez vide pour une page blanche.</span>
              <DiagramEditor key={`s-${q.id}`} value={q.data.starterXml} onChange={(xml) => setData({ starterXml: xml })} height={460} title="Diagramme de départ" />
            </DiagramDetails>
            <DiagramDetails title={`Corrigé type, visible seulement par les correcteurs (facultatif)${isEmptyDiagram(q.data.answerModelXml) ? '' : ' : rempli'}`}>
              <DiagramEditor key={`c-${q.id}`} value={q.data.answerModelXml} onChange={(xml) => setData({ answerModelXml: xml })} height={460} title="Corrigé type" />
            </DiagramDetails>
            <Notice>Correction à la main : l'enseignant voit le diagramme de chaque étudiant et, s'il est rempli, le corrigé type à côté.</Notice>
          </div>
        )}

        {q.type === 'html' && (
          <>
            <div className="stack-sm">
              <span className="label">Fichiers de départ donnés à l'étudiant</span>
              <span className="hint">L'étudiant retrouve ces trois fichiers et voit le rendu de sa page en direct, à côté de son code.</span>
              <Suspense fallback={<Loader />}>
                <WebEditor
                  value={{ html: q.data.starterHtml ?? '', css: q.data.starterCss ?? '', js: q.data.starterJs ?? '' }}
                  onChange={(v) => setData({ starterHtml: v.html, starterCss: v.css, starterJs: v.js })}
                  height={320}
                />
              </Suspense>
            </div>
            <div className="stack-sm">
              <div className="row"><span className="label">Grille de critères</span><div className="spacer" /><span className="small muted">Total : {critSum} pts</span></div>
              {(q.data.criteria || []).map((c) => {
                const upd = (patch) => {
                  const criteria = q.data.criteria.map((x) => (x.id === c.id ? { ...x, ...patch } : x))
                  onChange({ ...q, points: criteria.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, criteria } })
                }
                return (
                  <div className="choice-row" key={c.id}>
                    <input className="input" value={c.label} placeholder="Critère" onChange={(e) => upd({ label: e.target.value })} />
                    <input type="number" min="0" step="0.5" className="input" style={{ width: 90 }} value={c.points} onChange={(e) => upd({ points: Number(e.target.value) })} aria-label="Points" />
                    <button className="icon-btn" disabled={q.data.criteria.length <= 1} onClick={() => {
                      const criteria = q.data.criteria.filter((x) => x.id !== c.id)
                      onChange({ ...q, points: criteria.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, criteria } })
                    }} aria-label="Retirer le critère"><Trash2 {...ICON} /></button>
                  </div>
                )
              })}
              <div><button className="btn btn-ghost btn-sm" onClick={() => {
                const criteria = [...q.data.criteria, { id: rid(), label: '', points: 1 }]
                onChange({ ...q, points: criteria.reduce((s, x) => s + Number(x.points || 0), 0), data: { ...q.data, criteria } })
              }}><Plus size={14} /> Ajouter un critère</button></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
