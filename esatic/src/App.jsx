import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AppLayout from './components/AppLayout.jsx'
import { Loader } from './components/ui.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ROLE_HOME } from './lib/format.js'

import Login from './pages/Login.jsx'
import ChangePassword from './pages/account/ChangePassword.jsx'
import Profile from './pages/account/Profile.jsx'
import NotFound from './pages/NotFound.jsx'

import StudentHome from './pages/student/StudentHome.jsx'
import StudentDevoirs from './pages/student/StudentDevoirs.jsx'
import StudentExamens from './pages/student/StudentExamens.jsx'
import StudentResultats from './pages/student/StudentResultats.jsx'
import StudentResultDetail from './pages/student/StudentResultDetail.jsx'
import StudentAnnonces from './pages/student/StudentAnnonces.jsx'
import AssessmentDetail from './pages/student/AssessmentDetail.jsx'

import TeacherHome from './pages/teacher/TeacherHome.jsx'
import TeacherEpreuves from './pages/teacher/TeacherEpreuves.jsx'
import QuestionBank from './pages/teacher/QuestionBank.jsx'
import Corrections from './pages/teacher/Corrections.jsx'
import CorrectionDetail from './pages/teacher/CorrectionDetail.jsx'
import CorrectionByQuestion from './pages/teacher/CorrectionByQuestion.jsx'
import TeacherResultats from './pages/teacher/TeacherResultats.jsx'
import TeacherClasses from './pages/teacher/TeacherClasses.jsx'

import ProctorSessions from './pages/proctor/ProctorSessions.jsx'
import ProctorSessionDetail from './pages/proctor/ProctorSessionDetail.jsx'
import ProctorAlertes from './pages/proctor/ProctorAlertes.jsx'
import ProctorHistorique from './pages/proctor/ProctorHistorique.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminStructure from './pages/admin/AdminStructure.jsx'
import AdminEpreuves from './pages/admin/AdminEpreuves.jsx'
import BulletinsDepot from './pages/BulletinsDepot.jsx'
import AdminJournal from './pages/admin/AdminJournal.jsx'
import AdminParametres from './pages/admin/AdminParametres.jsx'

// Pages lourdes (éditeur Monaco) chargées seulement quand on en a besoin
const TakeAttempt = lazy(() => import('./pages/student/TakeAttempt.jsx'))
const EpreuveWizard = lazy(() => import('./pages/teacher/EpreuveWizard.jsx'))

function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/premiere-connexion') {
    return <Navigate to="/premiere-connexion" replace />
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return <Navigate to={user ? ROLE_HOME[user.role] : '/connexion'} replace />
}

const lazyPage = (el) => <ErrorBoundary><Suspense fallback={<Loader />}>{el}</Suspense></ErrorBoundary>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/premiere-connexion" element={<RequireAuth><ChangePassword firstLogin /></RequireAuth>} />

      {/* Composition : plein écran, sans la navigation */}
      <Route path="/etudiant/composer/:attemptId" element={<RequireAuth roles={['student']}>{lazyPage(<TakeAttempt />)}</RequireAuth>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/compte/profil" element={<Profile />} />
        <Route path="/compte/mot-de-passe" element={<ChangePassword />} />

        <Route path="/etudiant" element={<RequireAuth roles={['student']}><StudentHome /></RequireAuth>} />
        <Route path="/etudiant/devoirs" element={<RequireAuth roles={['student']}><StudentDevoirs /></RequireAuth>} />
        <Route path="/etudiant/examens" element={<RequireAuth roles={['student']}><StudentExamens /></RequireAuth>} />
        <Route path="/etudiant/resultats" element={<RequireAuth roles={['student']}><StudentResultats /></RequireAuth>} />
        <Route path="/etudiant/resultats/:attemptId" element={<RequireAuth roles={['student']}><StudentResultDetail /></RequireAuth>} />
        <Route path="/etudiant/annonces" element={<RequireAuth roles={['student']}><StudentAnnonces /></RequireAuth>} />
        <Route path="/etudiant/epreuve/:id" element={<RequireAuth roles={['student']}><AssessmentDetail /></RequireAuth>} />

        <Route path="/enseignant" element={<RequireAuth roles={['teacher']}><TeacherHome /></RequireAuth>} />
        <Route path="/enseignant/epreuves" element={<RequireAuth roles={['teacher']}><TeacherEpreuves /></RequireAuth>} />
        <Route path="/enseignant/epreuves/nouvelle" element={<RequireAuth roles={['teacher']}>{lazyPage(<EpreuveWizard />)}</RequireAuth>} />
        <Route path="/enseignant/epreuves/:id" element={<RequireAuth roles={['teacher']}>{lazyPage(<EpreuveWizard />)}</RequireAuth>} />
        <Route path="/enseignant/banque" element={<RequireAuth roles={['teacher']}><QuestionBank /></RequireAuth>} />
        <Route path="/enseignant/corrections" element={<RequireAuth roles={['teacher']}><Corrections /></RequireAuth>} />
        <Route path="/enseignant/corrections/:attemptId" element={<RequireAuth roles={['teacher']}><CorrectionDetail /></RequireAuth>} />
        <Route path="/enseignant/corrections/epreuve/:id" element={<RequireAuth roles={['teacher']}><CorrectionByQuestion /></RequireAuth>} />
        <Route path="/enseignant/resultats" element={<RequireAuth roles={['teacher']}><TeacherResultats /></RequireAuth>} />
        <Route path="/enseignant/classes" element={<RequireAuth roles={['teacher']}><TeacherClasses /></RequireAuth>} />

        <Route path="/surveillant/sessions" element={<RequireAuth roles={['proctor']}><ProctorSessions /></RequireAuth>} />
        <Route path="/surveillant/sessions/:id" element={<RequireAuth roles={['proctor']}><ProctorSessionDetail /></RequireAuth>} />
        <Route path="/surveillant/alertes" element={<RequireAuth roles={['proctor']}><ProctorAlertes /></RequireAuth>} />
        <Route path="/surveillant/historique" element={<RequireAuth roles={['proctor']}><ProctorHistorique /></RequireAuth>} />

        <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/utilisateurs" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
        <Route path="/admin/structure" element={<RequireAuth roles={['admin']}><AdminStructure /></RequireAuth>} />
        <Route path="/admin/epreuves" element={<RequireAuth roles={['admin']}><AdminEpreuves /></RequireAuth>} />
        <Route path="/admin/bulletins" element={<RequireAuth roles={['admin']}><BulletinsDepot /></RequireAuth>} />
        <Route path="/admin/journal" element={<RequireAuth roles={['admin']}><AdminJournal /></RequireAuth>} />
        <Route path="/admin/parametres" element={<RequireAuth roles={['admin']}><AdminParametres /></RequireAuth>} />

        <Route path="/educateur/bulletins" element={<RequireAuth roles={['educator']}><BulletinsDepot /></RequireAuth>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
