import { Suspense } from 'react'
import { page } from './pages/prefetch.js'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import AppLayout from './components/AppLayout.jsx'
import { Loader, Splash } from './components/ui.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ROLE_HOME } from './lib/format.js'

import Login from './pages/Login.jsx'

// Pages chargées à la demande : la première page ne télécharge que le nécessaire
const ChangePassword = page(() => import('./pages/account/ChangePassword.jsx'), [])
const Profile = page(() => import('./pages/account/Profile.jsx'), [])
const NotFound = page(() => import('./pages/NotFound.jsx'), [])

const StudentHome = page(() => import('./pages/student/StudentHome.jsx'), ['student'])
const StudentDevoirs = page(() => import('./pages/student/StudentDevoirs.jsx'), ['student'])
const StudentExamens = page(() => import('./pages/student/StudentExamens.jsx'), ['student'])
const StudentResultats = page(() => import('./pages/student/StudentResultats.jsx'), ['student'])
const StudentResultDetail = page(() => import('./pages/student/StudentResultDetail.jsx'), ['student'])
const StudentAnnonces = page(() => import('./pages/student/StudentAnnonces.jsx'), ['student'])
const AssessmentDetail = page(() => import('./pages/student/AssessmentDetail.jsx'), ['student'])

const TeacherHome = page(() => import('./pages/teacher/TeacherHome.jsx'), ['teacher'])
const TeacherEpreuves = page(() => import('./pages/teacher/TeacherEpreuves.jsx'), ['teacher'])
const QuestionBank = page(() => import('./pages/teacher/QuestionBank.jsx'), ['teacher'])
const Corrections = page(() => import('./pages/teacher/Corrections.jsx'), ['teacher'])
const CorrectionDetail = page(() => import('./pages/teacher/CorrectionDetail.jsx'), ['teacher'])
const CorrectionByQuestion = page(() => import('./pages/teacher/CorrectionByQuestion.jsx'), ['teacher'])
const TeacherResultats = page(() => import('./pages/teacher/TeacherResultats.jsx'), ['teacher'])
const TeacherClasses = page(() => import('./pages/teacher/TeacherClasses.jsx'), ['teacher'])

const ProctorSessions = page(() => import('./pages/proctor/ProctorSessions.jsx'), ['proctor'])
const ProctorSessionDetail = page(() => import('./pages/proctor/ProctorSessionDetail.jsx'), ['proctor'])
const ProctorAlertes = page(() => import('./pages/proctor/ProctorAlertes.jsx'), ['proctor'])
const ProctorHistorique = page(() => import('./pages/proctor/ProctorHistorique.jsx'), ['proctor'])

const AdminDashboard = page(() => import('./pages/admin/AdminDashboard.jsx'), ['admin'])
const AdminUsers = page(() => import('./pages/admin/AdminUsers.jsx'), ['admin'])
const AdminStructure = page(() => import('./pages/admin/AdminStructure.jsx'), ['admin'])
const AdminEpreuves = page(() => import('./pages/admin/AdminEpreuves.jsx'), ['admin'])
const BulletinsDepot = page(() => import('./pages/BulletinsDepot.jsx'), ['educator', 'pedagogy', 'admin'])
const PedagogyEvaluations = page(() => import('./pages/PedagogyEvaluations.jsx'), ['pedagogy'])
const StudentEvaluations = page(() => import('./pages/student/StudentEvaluations.jsx'), ['student'])
const TimetablesManage = page(() => import('./pages/TimetablesManage.jsx'), ['pedagogy', 'admin'])
const MyTimetables = page(() => import('./pages/MyTimetables.jsx'), ['student', 'teacher'])
const AbsencesPage = page(() => import('./pages/AbsencesPage.jsx'), ['educator', 'pedagogy', 'admin'])
const StudentAbsences = page(() => import('./pages/student/StudentAbsences.jsx'), ['student'])
const TeacherAttendance = page(() => import('./pages/teacher/TeacherAttendance.jsx'), ['teacher'])
const AdminJournal = page(() => import('./pages/admin/AdminJournal.jsx'), ['admin'])
const AdminParametres = page(() => import('./pages/admin/AdminParametres.jsx'), ['admin'])

// Pages lourdes (éditeur Monaco)
const TakeAttempt = page(() => import('./pages/student/TakeAttempt.jsx'), [])
const EpreuveWizard = page(() => import('./pages/teacher/EpreuveWizard.jsx'), [])

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
