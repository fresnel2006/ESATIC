// Direction pédagogique, éducateurs, administration : heures d'absence par classe et par étudiant, justification
import { PageHead } from '../components/ui.jsx'
import { AbsencesBrowser } from '../components/AbsenceWidgets.jsx'

export default function AbsencesPage() {
  return (
    <div>
      <PageHead title="Absences" subtitle="Heures d'absence de chaque étudiant, calculées à partir des appels faits par les enseignants" />
      <AbsencesBrowser />
    </div>
  )
}
