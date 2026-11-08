// Terminal de la composition : chaque clic sur « Lancer » ajoute une session à l'historique,
// affichée comme dans un vrai terminal (invite, commande, sorties, entrée tapée, code de sortie).
import { useEffect, useRef } from 'react'
import { SquareTerminal, Eraser } from 'lucide-react'
import { LANG_ENV } from '../lib/format.js'

const PROMPT_USER = 'etudiant@esatic'
const PROMPT_DIR = '~/examen'

function Prompt({ command, cursor }) {
  return (
    <div className="t-line">
      <span className="t-user">{PROMPT_USER}</span>:<span className="t-dir">{PROMPT_DIR}</span>$ {command}
      {cursor && <span className="t-cursor" aria-hidden="true" />}
    </div>
  )
}

// Tableau texte, comme le mode « box » de sqlite3
function textTable({ columns, rows }) {
  const cells = [columns, ...rows.map((r) => r.map((v) => (v === null ? 'NULL' : String(v))))]
  const widths = columns.map((_, j) => Math.max(...cells.map((r) => r[j].length)))
  const line = (l, m, r) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r
  const row = (r) => '│' + r.map((v, j) => ' ' + v.padEnd(widths[j]) + ' ').join('│') + '│'
  return [line('┌', '┬', '┐'), row(cells[0]), line('├', '┼', '┤'), ...cells.slice(1).map(row), line('└', '┴', '┘')].join('\n')
}

// Valeur sur plusieurs lignes, alignée sous son intitulé
function Value({ label, text, empty, err }) {
  return (
    <div className="t-field">
      <span className="t-dim">{label}</span>
      <pre className={`t-pre t-value ${err ? 't-err' : ''}`}>{text || <span className="t-dim">{empty}</span>}</pre>
    </div>
  )
}

// « Tester les exemples » : chaque exemple réussi ou non ; pour un échec, entrée, attendu et obtenu alignés
function TestsBlock({ r, limit }) {
  const results = r.results || []
  const passed = results.filter((x) => x.passed).length
  return (
    <div className="t-block">
      <Prompt command="tester-exemples" />
      {results.map((t, i) => (
        <div key={i}>
          <div className="t-line">
            {t.passed ? <span className="t-ok">[ OK  ]</span> : <span className="t-err">[ÉCHEC]</span>} {t.name}
          </div>
          {!t.passed && (
            <div className="t-diff">
              {t.timeout ? <div className="t-err">temps limite dépassé ({limit} s)</div> : (
                <>
                  <Value label="entrée" text={t.stdin.replace(/\n+$/, '')} empty="(vide)" />
                  <Value label="attendu" text={String(t.expected ?? '').replace(/\n+$/, '')} empty="(rien)" />
                  <Value label="obtenu" text={(t.stdout || '').replace(/\n+$/, '')} empty="(aucune sortie)" />
                  {t.stderr && <Value label="erreur" text={t.stderr.trim()} err />}
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <div className={passed === results.length ? 't-ok' : 't-dim'}>{passed}/{results.length} exemple{results.length > 1 ? 's' : ''} réussi{passed > 1 ? 's' : ''}</div>
    </div>
  )
}

function RunBlock({ entry }) {
  const { command, result: r, language, mode } = entry
  const limit = (r.timeLimitMs || 2000) / 1000
  if (r.available === false) {
    const tool = command.split(' ')[0]
    return (
      <div className="t-block">
        <Prompt command={command} />
        <div className="t-dim">{tool} : l'exécution de ce langage n'est pas disponible sur la plateforme.</div>
        <div className="t-dim">Votre code est bien enregistré ; l'enseignant le corrigera.</div>
      </div>
    )
  }
  if (mode === 'tests') return <TestsBlock r={r} limit={limit} />

  if (language === 'sql') {
    return (
      <div className="t-block">
        <Prompt command={command} />
        {r.stderr && <div className="t-err">{r.stderr}</div>}
        {r.timeout && <div className="t-err">^C Temps limite dépassé : requête arrêtée.</div>}
        {r.table && <pre className="t-pre t-table">{textTable(r.table)}</pre>}
        {r.table && <div className="t-dim">({r.table.total} ligne{r.table.total > 1 ? 's' : ''}{r.table.total > r.table.rows.length ? `, ${r.table.rows.length} affichées` : ''})</div>}
        {!r.table && !r.stderr && !r.timeout && <div className="t-dim">Requête exécutée : {r.changes ?? 0} ligne(s) modifiée(s), aucun résultat à afficher.</div>}
      </div>
    )
  }

  // « Lancer » : comme dans un vrai terminal, la commande puis ce que le programme affiche, rien d'autre
  const transcript = r.transcript || []
  return (
    <div className="t-block">
      <Prompt command={command} />
      {transcript.length > 0 && (
        <pre className="t-pre">
          {transcript.map((c, i) => <span key={i} className={c.k === 'in' ? 't-in' : c.k === 'err' ? 't-err' : undefined}>{c.s}</span>)}
        </pre>
      )}
      {r.timeout && <div className="t-err">^C Temps limite dépassé ({limit} s) : programme arrêté. Boucle infinie, ou programme en attente d'une entrée ?</div>}
      {!r.timeout && r.exitCode ? <div className="t-dim">[le programme s'est arrêté avec le code {r.exitCode}]</div> : null}
    </div>
  )
}

export default function Terminal({ language, history, running, first, onClear }) {
  const env = LANG_ENV[language] || { file: 'main', run: './main' }
  const bodyRef = useRef(null)
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [history, running])

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <SquareTerminal size={15} strokeWidth={1.6} />
        <span>Terminal</span>
        <span className="t-dim">- {env.file}</span>
        <div className="spacer" />
        <button className="terminal-btn" onClick={onClear} disabled={!history.length || running} title="Effacer le terminal">
          <Eraser size={14} strokeWidth={1.6} /> Effacer
        </button>
      </div>
      <div className="terminal-body" ref={bodyRef} role="log" aria-live="polite">
        {!history.length && !running && <div className="t-dim">{language === 'sql' ? `Cliquez sur « Exécuter » pour lancer la requête sur la base de test.` : `Cliquez sur « Lancer » pour exécuter ${env.file} avec l'entrée saisie au-dessus, ou sur « Tester les exemples » pour vérifier votre programme.`}</div>}
        {history.map((h, i) => <RunBlock key={i} entry={h} />)}
        {running ? (
          <div className="t-block">
            <Prompt command={running === 'tests' ? 'tester-exemples' : env.run} />
            <div className="t-dim">{first ? 'Préparation du moteur d\'exécution (quelques secondes la première fois)...' : 'Exécution...'}</div>
          </div>
        ) : (
          <Prompt command="" cursor />
        )}
      </div>
    </div>
  )
}
