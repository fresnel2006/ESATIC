// Formats de dates et de nombres en français (fuseau du poste, Abidjan = UTC+0)

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const longDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

export const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '-')
export const fmtShort = (iso) => (iso ? shortFmt.format(new Date(iso)) : '-')
export const fmtTime = (iso) => (iso ? timeFmt.format(new Date(iso)).replace(':', 'h') : '-')
export const fmtDateTime = (iso) => (iso ? `${shortFmt.format(new Date(iso))} à ${fmtTime(iso)}` : '-')
export const fmtLongDay = (d = new Date()) => {
  const s = longDayFmt.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// "Ce soir à rendre à 17h00", "Demain à 9h00", "Lun. 4 nov. à 18h00"
export function fmtRelativeDay(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(Date.now() + 86400000)
  const yesterday = new Date(Date.now() - 86400000)
  if (sameDay(d, today)) return d.getHours() >= 17 ? `Ce soir à ${fmtTime(iso)}` : `Aujourd'hui à ${fmtTime(iso)}`
  if (sameDay(d, tomorrow)) return `Demain à ${fmtTime(iso)}`
  if (sameDay(d, yesterday)) return `Hier à ${fmtTime(iso)}`
  const s = dayMonthFmt.format(d)
  return `${s.charAt(0).toUpperCase() + s.slice(1)} à ${fmtTime(iso)}`
}

export function fmtAgo(iso) {
  if (!iso) return '-'
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 45) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`
  if (diff < 86400 * 7) return `il y a ${Math.round(diff / 86400)} j`
  return fmtShort(iso)
}

export function fmtDuration(ms) {
  if (ms <= 0) return '00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function fmtCountdown(ms) {
  if (ms <= 0) return 'maintenant'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)} jours`
}

export const fmtNote = (n) => (n === null || n === undefined ? '-' : String(n).replace('.', ','))

// Pour <input type="datetime-local">
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

export const ROLE_LABELS = {
  superadmin: 'Super administrateur',
  admin: 'Administrateur',
  teacher: 'Enseignant',
  proctor: 'Surveillant',
  educator: 'Éducateur',
  student: 'Étudiant',
}

export const ROLE_HOME = {
  admin: '/admin',
  teacher: '/enseignant',
  proctor: '/surveillant/sessions',
  educator: '/educateur/bulletins',
  student: '/etudiant',
}

export const QUESTION_TYPES = {
  qcm: 'QCM',
  ouverte: 'Question ouverte',
  code: 'Code',
  sql: 'SQL',
  html: 'Page web (HTML, CSS, JS)',
  diagram: 'Modélisation (UML, Merise)',
}

// Taille maximale d'un diagramme (XML draw.io), pour garder les copies légères
export const DIAGRAM_MAX_KB = 300

export const LANGUAGES = {
  c: 'C',
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
  javascript: 'JavaScript',
  php: 'PHP',
  ocaml: 'OCaml',
  algo: 'Pseudo-code (algorithme)',
}

// Langages qui s'écrivent sans jamais s'exécuter : corrigés par l'enseignant
export const isWriteOnly = (lang) => !!TOOLS[lang]?.writeOnly

// Outils informatiques qu'une matière peut utiliser (réglés par l'administrateur dans Structure > Matières).
// `code` : langage proposé dans les questions de code ; `browser` : exécutable dans le navigateur en mode test ;
// `server` : ce qu'il faut installer dans le bac à sable du serveur de correction.
export const TOOLS = {
  // C : interpréteur picoc dans le navigateur (C des cours)
  c: { label: 'C', code: true, browser: true, server: 'Rien : C de base exécuté dans le navigateur' },
  // C++, Java, OCaml : écrits dans l'éditeur, sans exécution ; corrigés par l'enseignant
  cpp: { label: 'C++', code: true, browser: false, server: 'Pas d\'exécution : code écrit, corrigé par l\'enseignant' },
  java: { label: 'Java', code: true, browser: false, server: 'Pas d\'exécution : code écrit, corrigé par l\'enseignant' },
  ocaml: { label: 'OCaml', code: true, browser: false, server: 'Pas d\'exécution : code écrit, corrigé par l\'enseignant' },
  python: { label: 'Python', code: true, browser: true, server: 'Python 3' },
  javascript: { label: 'JavaScript', code: true, browser: true, server: 'Node.js' },
  // PHP : vrai PHP 8.3 en WebAssembly dans le navigateur (environ 7 Mo téléchargés une fois)
  php: { label: 'PHP', code: true, browser: true, server: 'Rien : PHP 8.3 dans le navigateur' },
  sql: { label: 'SQL', code: false, browser: true, server: 'SQLite (bases de test)' },
  html: { label: 'Web (HTML, CSS, JS)', code: false, browser: true, server: 'Rien : aperçu en direct dans le navigateur' },
  // Pseudo-code des cours d'algorithmique : écrit dans l'éditeur, jamais exécuté, corrigé par l'enseignant
  algo: { label: 'Pseudo-code (algorithme)', code: true, browser: false, writeOnly: true, server: 'Rien : écrit seulement, corrigé par l\'enseignant' },
}

// Bases de test des questions SQL : assez pour un exercice, assez légères pour tout PC.
// Le sujet (bases comprises) est envoyé à chaque étudiant à l'ouverture, et la base est recréée à chaque exécution.
// Vérifié dans l'éditeur (message clair) et par le serveur à l'enregistrement de l'épreuve.
export const SQL_LIMITS = {
  maxRows: 2000, // lignes, toutes tables confondues, par question
  maxKb: 100, // schéma + données d'une question, en Ko
  maxTotalKb: 300, // toutes les questions SQL d'une épreuve, en Ko
}
export const sqlSizeKb = (schema = '', seed = '') => new Blob([schema, seed]).size / 1024

// Environnement affiché à l'étudiant pour chaque langage : nom du fichier et commande du terminal
export const LANG_ENV = {
  python: { file: 'main.py', run: 'python3 main.py' },
  javascript: { file: 'main.js', run: 'node main.js' },
  c: { file: 'main.c', run: 'gcc main.c -o main && ./main' },
  cpp: { file: 'main.cpp', run: 'g++ main.cpp -o main && ./main' },
  java: { file: 'Main.java', run: 'javac Main.java && java Main' },
  ocaml: { file: 'main.ml', run: 'ocaml main.ml' },
  php: { file: 'main.php', run: 'php main.php' },
  sql: { file: 'requete.sql', run: 'sqlite3 base_test.db < requete.sql' },
  algo: { file: 'algorithme.txt', run: '' },
}

export const EVENT_LABELS = {
  started: 'Début de la composition',
  submitted: 'Copie rendue',
  auto_submitted: 'Rendu automatique (temps écoulé)',
  closed_by_proctor: 'Session fermée par le surveillant',
  fullscreen_exit: 'Sortie du plein écran',
  tab_hidden: 'Changement d\'onglet ou de fenêtre',
  window_blur: 'Perte du focus de la fenêtre',
  paste_blocked: 'Collage externe bloqué',
  copy_blocked: 'Copie bloquée',
  drop_blocked: 'Glisser-déposer bloqué',
  contextmenu_blocked: 'Clic droit bloqué',
  big_insert: 'Gros bloc de code apparu d\'un coup',
  devtools_key: 'Raccourci d\'outils développeur',
  resumed: 'Reprise de la copie',
  tab_visible: 'Retour sur la page',
  exit_counted: 'Sortie de l\'épreuve : avertissement affiché',
  navigation_away: 'Tentative de quitter la page (bouton Retour)',
  window_left: 'Fenêtre de l\'épreuve quittée (autre application)',
  auto_submitted_exits: 'Copie envoyée automatiquement (sortie après avertissement)',
}

const BOM = String.fromCharCode(0xfeff)

export function downloadCsv(filename, rows) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Séparateur ";" et BOM : ouverture directe dans Excel en français
  const csv = BOM + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Lecture CSV simple (séparateur , ou ; détecté, guillemets gérés)
export function parseCsv(text) {
  const clean = (text.startsWith(BOM) ? text.slice(1) : text)
  const firstLine = clean.split(/\r?\n/)[0] || ''
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim()))
  if (!nonEmpty.length) return []
  const norm = (h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const headers = nonEmpty[0].map(norm)
  return nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])))
}

export const ACTION_LABELS = {
  connexion: 'Connexion',
  changement_mot_de_passe: 'Changement de mot de passe',
  reinitialisation_mot_de_passe: 'Réinitialisation de mot de passe',
  creation_utilisateur: 'Création de compte',
  modification_utilisateur: 'Modification de compte',
  activation_compte: 'Réactivation de compte',
  desactivation_compte: 'Désactivation de compte',
  import_etudiants: 'Import d\'étudiants',
  import_enseignants: 'Import d\'enseignants',
  creation_classe: 'Création de classe',
  modification_classe: 'Modification de classe',
  suppression_classe: 'Suppression de classe',
  creation_filiere: 'Création de filière',
  modification_filiere: 'Modification de filière',
  suppression_filiere: 'Suppression de filière',
  creation_matiere: 'Création de matière',
  modification_matiere: 'Modification de matière',
  suppression_matiere: 'Suppression de matière',
  creation_periode: 'Création de période',
  modification_periode: 'Modification de période',
  suppression_periode: 'Suppression de période',
  creation_teaching: 'Affectation d\'enseignant',
  modification_teaching: 'Modification d\'affectation',
  suppression_teaching: 'Suppression d\'affectation',
  modification_parametres: 'Modification des paramètres',
  creation_brouillon: 'Création de brouillon',
  publication_epreuve: 'Publication d\'épreuve',
  duplication_epreuve: 'Duplication d\'épreuve',
  suppression_brouillon: 'Suppression de brouillon',
  statut_epreuve_annule: 'Annulation d\'épreuve',
  statut_epreuve_brouillon: 'Retour en brouillon',
  correction_copie: 'Correction de copie',
  publication_notes: 'Publication des notes',
  retrait_notes: 'Retrait des notes',
  ouverture_session: 'Ouverture de session',
  fermeture_session: 'Fermeture de session',
  nouveau_code_session: 'Nouveau code de session',
  publication_annonce: 'Publication d\'annonce',
  publication_bulletins: 'Publication des bulletins',
  correction_automatique: 'Correction automatique',
  validation_copies: 'Validation des copies',
  correction_par_question: 'Correction par question',
  modification_bulletin: 'Modification de bulletin',
  saisie_note: 'Saisie de note (oral, TP papier)',
  suppression_note: 'Suppression de note saisie',
  modification_modele_bulletin: 'Modification du modèle de bulletin',
  depot_bulletin: 'Dépôt de bulletin',
  affectations_enseignant: 'Classes attribuées à un enseignant',
  remplacement_bulletin: 'Remplacement de bulletin',
  suppression_bulletin: 'Suppression de bulletin',
}
