import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Empty } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="card">
      <Empty icon={Compass} title="Page introuvable">
        Cette adresse ne correspond à aucune page. <Link to="/">Retour à l'accueil</Link>
      </Empty>
    </div>
  )
}
