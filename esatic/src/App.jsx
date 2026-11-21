import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AppLayout from './components/AppLayout.jsx'
import { Loader, Splash } from './components/ui.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ROLE_HOME } from './lib/format.js'

import Login from './pages/Login.jsx'

// Pages chargées à la demande : la première page ne télécharge que le nécessaire
const ChangePassword = lazy(() => import('./pages/account/ChangePassword.jsx'))
const Profile = lazy(() => import('./pages/account/Profile.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const StudentHome = lazy(() => import('./pages/student/StudentHome.jsx'))
const StudentDevoirs = lazy(() => import('./pages/student/StudentDevoirs.jsx'))
const StudentExamens = lazy(() => import('./pages/student/StudentExamens.jsx'))
const StudentResultats = lazy(() => import('./pages/student/StudentResultats.jsx'))
const StudentResultDetail = lazy(() => import('./pages/student/StudentResultDetail.jsx'))
const StudentAnnonces = lazy(() => import('./pages/student/StudentAnnonces.jsx'))
const AssessmentDetail = lazy(() => import('./pages/student/AssessmentDetail.jsx'))

const TeacherHome = lazy(() => import('./pages/teacher/TeacherHome.jsx'))
const TeacherEpreuves = lazy(() => import('./pages/teacher/TeacherEpreuves.jsx'))
const QuestionBank = lazy(() => import('./pages/teacher/QuestionBank.jsx'))
const Corrections = lazy(() => import('./pages/teacher/Corrections.jsx'))
const CorrectionDetail = lazy(() => import('./pages/teacher/CorrectionDetail.jsx'))
const CorrectionByQuestion = lazy(() => import('./pages/teacher/CorrectionByQuestion.jsx'))
const TeacherResultats = lazy(() => import('./pages/teacher/TeacherResultats.jsx'))
const TeacherClasses = lazy(() => import('./pages/teacher/TeacherClasses.jsx'))

const ProctorSessions = lazy(() => import('./pages/proctor/ProctorSessions.jsx'))
const ProctorSessionDetail = lazy(() => import('./pages/proctor/ProctorSessionDetail.jsx'))
const ProctorAlertes = lazy(() => import('./pages/proctor/ProctorAlertes.jsx'))
const ProctorHistorique = lazy(() => import('./pages/proctor/ProctorHistorique.jsx'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'))
const AdminStructure = lazy(() => import('./pages/admin/AdminStructure.jsx'))
const AdminEpreuves = lazy(() => import('./pages/admin/AdminEpreuves.jsx'))
const BulletinsDepot = lazy(() => import('./pages/BulletinsDepot.jsx'))
const PedagogyEvaluations = lazy(() => import('./pages/PedagogyEvaluations.jsx'))
const StudentEvaluations = lazy(() => import('./pages/student/StudentEvaluations.jsx'))
const TeacherEvaluations = lazy(() => import('./pages/teacher/TeacherEvaluations.jsx'))
const TimetablesManage = lazy(() => import('./pages/TimetablesManage.jsx'))
const MyTimetables = lazy(() => import('./pages/MyTimetables.jsx'))
const AbsencesPage = lazy(() => import('./pages/AbsencesPage.jsx'))
const StudentAbsences = lazy(() => import('./pages/student/StudentAbsences.jsx'))
const TeacherAttendance = lazy(() => import('./pages/teacher/TeacherAttendance.jsx'))
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal.jsx'))
const AdminParametres = lazy(() => import('./pages/admin/AdminParametres.jsx'))

// Pages lourdes (éditeur Monaco)
const TakeAttempt = lazy(() => import('./pages/student/TakeAttempt.jsx'))
const EpreuveWizard = lazy(() => import('./pages/teacher/EpreuveWizard.jsx'))

function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/premiere-connexion') {
    return <Navigate to="/premiere-connexion" replace />
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return <Navigate to={user ? ROLE_HOME[user.role] : '/connexion'} replace />
}

const lazyPage = (el, fallback = <Loader variant="form" />) => <ErrorBoundary><Suspense fallback={fallback}>{el}</Suspense></ErrorBoundary>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/premiere-connexion" element={<RequireAuth><ChangePassword firstLogin /></RequireAuth>} />

      {/* Composition : plein écran, sans la navigation */}
      <Route path="/etudiant/composer/:attemptId" element={<RequireAuth roles={['student']}>{lazyPage(<TakeAttempt />, <Splash label="Ouverture de l'épreuve..." />)}</RequireAuth>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/compte/profil" element={<Profile />} />
        <Route path="/compte/mot-de-passe" element={<ChangePassword />} />

        <Route path="/etudiant" element={<RequireAuth roles={['student']}><StudentHome /></RequireAuth>} />
        <Route path="/etudiant/devoirs" element={<RequireAuth roles={['student']}><StudentDevoirs /></RequireAuth>} />
        <Route path="/etudiant/examens" element={<RequireAuth roles={['student']}><StudentExamens /></RequireAuth>} />
        <Route path="/etudiant/resultats" element={<RequireAuth roles={['student']}><StudentResultats /></RequireAuth>} />
        <Route path="/etudiant/resultats/:attemptId" element={<RequireAuth roles={['student']}><StudentResultDetail /></RequireAuth>} />
        <Route path="/etudiant/annonces" element={<RequireAuth roles={['student']}><StudentAnnonces /></RequireAuth>} />
        <Route path="/etudiant/absences" element={<RequireAuth roles={['student']}><StudentAbsences /></RequireAuth>} />
        <Route path="/etudiant/emplois-du-temps" element={<RequireAuth roles={['student']}><MyTimetables /></RequireAuth>} />
        <Route path="/etudiant/evaluations" element={<RequireAuth roles={['student']}><StudentEvaluations /></RequireAuth>} />
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
        <Route path="/enseignant/appel" element={<RequireAuth roles={['teacher']}><TeacherAttendance /></RequireAuth>} />
        <Route path="/enseignant/emplois-du-temps" element={<RequireAuth roles={['teacher']}><MyTimetables /></RequireAuth>} />
        <Route path="/enseignant/evaluations" element={<RequireAuth roles={['teacher']}><TeacherEvaluations /></RequireAuth>} />

        <Route path="/surveillant/sessions" element={<RequireAuth roles={['proctor']}><ProctorSessions /></RequireAuth>} />
        <Route path="/surveillant/sessions/:id" element={<RequireAuth roles={['proctor']}><ProctorSessionDetail /></RequireAuth>} />
        <Route path="/surveillant/alertes" element={<RequireAuth roles={['proctor']}><ProctorAlertes /></RequireAuth>} />
        <Route path="/surveillant/historique" element={<RequireAuth roles={['proctor']}><ProctorHistorique /></RequireAuth>} />

        <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/utilisateurs" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
        <Route path="/admin/structure" element={<RequireAuth roles={['admin']}><AdminStructure /></RequireAuth>} />
        <Route path="/admin/epreuves" element={<RequireAuth roles={['admin']}><AdminEpreuves /></RequireAuth>} />
        <Route path="/admin/bulletins" element={<RequireAuth roles={['admin']}><BulletinsDepot /></RequireAuth>} />
        <Route path="/admin/absences" element={<RequireAuth roles={['admin']}><AbsencesPage /></RequireAuth>} />
        <Route path="/admin/emplois-du-temps" element={<RequireAuth roles={['admin']}><TimetablesManage /></RequireAuth>} />
        <Route path="/admin/journal" element={<RequireAuth roles={['admin']}><AdminJournal /></RequireAuth>} />
        <Route path="/admin/parametres" element={<RequireAuth roles={['admin']}><AdminParametres /></RequireAuth>} />

        <Route path="/educateur/absences" element={<RequireAuth roles={['educator']}><AbsencesPage /></RequireAuth>} />
        <Route path="/educateur/bulletins" element={<RequireAuth roles={['educator']}><BulletinsDepot /></RequireAuth>} />
        <Route path="/direction/evaluations" element={<RequireAuth roles={['pedagogy']}><PedagogyEvaluations /></RequireAuth>} />
        <Route path="/direction/emplois-du-temps" element={<RequireAuth roles={['pedagogy']}><TimetablesManage /></RequireAuth>} />
        <Route path="/direction/absences" element={<RequireAuth roles={['pedagogy']}><AbsencesPage /></RequireAuth>} />
        <Route path="/direction/bulletins" element={<RequireAuth roles={['pedagogy']}><BulletinsDepot /></RequireAuth>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
