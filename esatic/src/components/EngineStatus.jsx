// Avancement du téléchargement et du démarrage des moteurs d'exécution du navigateur (Python, PHP, C, SQL),
// visible par l'étudiant : « Préparation de l'environnement PHP : 3,2 Mo sur 7,1 Mo ».
import { useCallback, useSyncExternalStore } from 'react'
import { Loader2, CircleCheck, TriangleAlert, RotateCw } from 'lucide-react'
import { engineState, onEngineChange, prepareEngine } from '../lib/engines.js'
import { BROWSER_LANGS } from '../lib/browserRunner.js'
import { TOOLS } from '../lib/format.js'

function useEngine(lang) {
  const subscribe = useCallback((notify) => onEngineChange((l) => { if (l === lang) notify() }), [lang])
  return useSyncExternalStore(subscribe, () => engineState(lang))
}

const mb = (n) => (n / 1048576).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Une ligne par langage ; rien n'est affiché quand le moteur est prêt (sauf showReady)
export function EngineLine({ lang, showReady = false }) {
  const s = useEngine(lang)
  if (!BROWSER_LANGS.includes(lang) || lang === 'javascript') return null
  const name = TOOLS[lang]?.label ?? lang
  if (s.state === 'ready') {
    return showReady ? <div className="engine-line ready"><CircleCheck size={14} /> Environnement {name} prêt.</div> : null
  }
  if (s.state === 'error') {
    return (
      <div className="engine-line error">
        <TriangleAlert size={14} />
        <span>L'environnement {name} n'a pas pu être téléchargé (connexion interrompue ?).</span>
        <button className="btn btn-secondary btn-sm" onClick={() => prepareEngine(lang)}><RotateCw size={13} /> Réessayer</button>
      </div>
    )
  }
  if (s.state === 'starting') {
    return <div className="engine-line"><Loader2 size={14} className="spin" /> Démarrage de l'environnement {name}...</div>
  }
  if (s.state !== 'downloading') return null
  const pct = s.total ? Math.min(100, Math.round((s.loaded / s.total) * 100)) : null
  return (
    <div className="engine-line">
      <Loader2 size={14} className="spin" />
      <div className="engine-text">
        <div>
          Téléchargement de l'environnement {name} (premier lancement seulement) :{' '}
          <strong>{mb(s.loaded)} Mo{s.total ? ` sur ${mb(s.total)} Mo` : ''}</strong>{pct !== null && ` (${pct} %)`}
        </div>
        <div className="exec-progress"><span style={{ width: `${pct ?? 5}%` }} /></div>
      </div>
    </div>
  )
}

export default function EngineStatus({ languages, showReady = false }) {
  return (
    <div className="engine-status">
      {languages.map((l) => <EngineLine key={l} lang={l} showReady={showReady} />)}
    </div>
  )
}
