import {
  House, Files, CalendarClock, FileBadge, Megaphone,
  FolderKanban, Library, ClipboardCheck, ChartColumn, Users,
  MonitorPlay, BellRing, History,
  LayoutDashboard, Network, FileStack, ScrollText, Settings, UserCog,
} from 'lucide-react'

// Une entrée = une page. Aucun élément n'est répété entre la barre latérale et le menu du compte.
// `mobile: true` : entrée affichée dans la barre du bas (5 maximum, le reste va dans "Plus").
export const NAV = {
  student: [
    { to: '/etudiant', label: 'Accueil', icon: House, end: true, mobile: true },
    { to: '/etudiant/devoirs', label: 'Devoirs', icon: Files, mobile: true },
    { to: '/etudiant/examens', label: 'Examens', icon: CalendarClock, mobile: true },
    { to: '/etudiant/resultats', label: 'Bulletins', icon: FileBadge, mobile: true },
    { to: '/etudiant/annonces', label: 'Annonces', icon: Megaphone, mobile: true },
  ],
  teacher: [
    { to: '/enseignant', label: 'Accueil', icon: House, end: true, mobile: true },
    { to: '/enseignant/epreuves', label: 'Mes épreuves', icon: FolderKanban, mobile: true },
    { to: '/enseignant/banque', label: 'Banque de questions', icon: Library },
    { to: '/enseignant/corrections', label: 'Corrections', icon: ClipboardCheck, mobile: true },
    { to: '/enseignant/resultats', label: 'Résultats', icon: ChartColumn, mobile: true },
    { to: '/enseignant/classes', label: 'Mes classes', icon: Users },
  ],
  proctor: [
    { to: '/surveillant/sessions', label: 'Sessions', icon: MonitorPlay, mobile: true },
    { to: '/surveillant/alertes', label: 'Alertes', icon: BellRing, mobile: true },
    { to: '/surveillant/historique', label: 'Historique', icon: History, mobile: true },
  ],
  educator: [
    { to: '/educateur/bulletins', label: 'Bulletins', icon: FileBadge, mobile: true },
  ],
  admin: [
    { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true, mobile: true },
    { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UserCog, mobile: true },
    { to: '/admin/structure', label: 'Structure', icon: Network, mobile: true },
    { to: '/admin/epreuves', label: 'Épreuves', icon: FileStack, mobile: true },
    { to: '/admin/bulletins', label: 'Bulletins', icon: FileBadge },
    { to: '/admin/journal', label: "Journal d'activité", icon: ScrollText },
    { to: '/admin/parametres', label: 'Paramètres', icon: Settings },
  ],
}
