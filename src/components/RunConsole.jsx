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

function RunBlock({ entry }) {
  const { command, result: r, language } = entry
  const limit = (r.timeLimitMs || 2000) / 1000
  if (r.available === false) {
    const tool = command.split(' ')[0]
    return (
      <div className="t-block">
        <Prompt command={command} />
        <div className="t-dim">{tool} : exécution réservée au bac à sable du serveur de correction (Docker), pas encore branché.</div>
        <div className="t-dim">Votre code est bien enregistré.</div>
      </div>
    )
  }

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

  const results = r.results || []
  const passed = results.filter((x) => x.passed).length
  return (
    <div className="t-block">
      <Prompt command={command} />
      <pre className="t-pre">
        {(r.transcript || []).map((c, i) => <span key={i} className={c.k === 'in' ? 't-in' : c.k === 'err' ? 't-err' : undefined}>{c.s}</span>)}
      </pre>
      {r.timeout && <div className="t-err">^C Temps limite dépassé ({limit} s) : programme arrêté. Boucle infinie, ou programme en attente d'une entrée ?</div>}
      <div className="t-dim">[code de sortie {r.exitCode ?? 0}{r.durationMs !== undefined && !r.timeout ? ` - ${r.durationMs} ms` : ''}]</div>

      {results.length > 0 && (
        <>
          <Prompt command="verifier-exemples" />
          {results.map((t, i) => (
            <div key={i}>
              <div className="t-line">
                {t.passed ? <span className="t-ok">[ OK  ]</span> : <span className="t-err">[ÉCHEC]</span>} {t.name}
              </div>
              {!t.passed && (
                <div className="t-diff">
                  {t.timeout ? <div className="t-err">temps limite dépassé ({limit} s)</div> : (
                    <>
                      <div><span className="t-dim">entrée  :</span> {t.stdin.replace(/\n/g, ' / ') || '(vide)'}</div>
                      <div><span className="t-dim">attendu :</span> {t.expected}</div>
                      <div><span className="t-dim">obtenu  :</span> {t.stdout.trimEnd() || '(aucune sortie)'}</div>
                      {t.stderr && <div className="t-err">{t.stderr.split('\n').slice(-1)[0]}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className={passed === results.length ? 't-ok' : 't-dim'}>{passed}/{results.length} exemple{results.length > 1 ? 's' : ''} réussi{passed > 1 ? 's' : ''}</div>
        </>
      )}
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
        {history.some((h) => h.result?.browser) && <span className="t-dim small">mode test : exécuté dans le navigateur</span>}
        <button className="terminal-btn" onClick={onClear} disabled={!history.length || running} title="Effacer le terminal">
          <Eraser size={14} strokeWidth={1.6} /> Effacer
        </button>
      </div>
      <div className="terminal-body" ref={bodyRef} role="log" aria-live="polite">
        {!history.length && !running && <div className="t-dim">{language === 'sql' ? `Cliquez sur « Exécuter » pour lancer la requête sur la base de test.` : `Cliquez sur « Lancer » pour exécuter ${env.file}. L'entrée du programme est celle saisie à gauche.`}</div>}
        {history.map((h, i) => <RunBlock key={i} entry={h} />)}
        {running ? (
          <div className="t-block">
            <Prompt command={env.run} />
            <div className="t-dim">{first ? 'Préparation du moteur d\'exécution (quelques secondes la première fois)...' : 'Exécution...'}</div>
          </div>
        ) : (
          <Prompt command="" cursor />
        )}
      </div>
    </div>
  )
}
