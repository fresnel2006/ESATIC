import { Component } from 'react'
import { RotateCcw } from 'lucide-react'

// Filet de sécurité : si une page plante, on affiche un message clair au lieu d'une page blanche.
// Pendant une composition, les réponses sont déjà enregistrées (serveur + brouillon local) : recharger suffit.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur dans la page :', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="exam" style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 520, width: '100%' }}>
          <div className="card-body stack" style={{ textAlign: 'center', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.25rem' }}>La page n'a pas pu s'afficher</h1>
            <p className="muted">Vos réponses déjà saisies sont enregistrées. Rechargez la page pour continuer. Si le problème revient, prévenez le surveillant.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}><RotateCcw size={16} /> Recharger la page</button>
            <details style={{ width: '100%', textAlign: 'left' }}>
              <summary className="small muted" style={{ cursor: 'pointer' }}>Détail technique</summary>
              <pre className="code-block" style={{ marginTop: 8 }}>{String(this.state.error?.message || this.state.error)}</pre>
            </details>
          </div>
        </div>
      </div>
    )
  }
}
