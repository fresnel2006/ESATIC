// Données de démonstration. Les dates sont calculées à partir de "maintenant"
// pour que la démo reste cohérente quel que soit le jour où on la lance.

const H = 3600 * 1000
const D = 24 * H

function at(offsetMs, hour, minute = 0) {
  const d = new Date(Date.now() + offsetMs)
  if (hour !== undefined) d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// Hachage de démonstration (SHA-256). En production le hachage se fait côté serveur.
export async function hashPassword(password) {
  const data = new TextEncoder().encode('esatic:' + password)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

import { buildExtraExams } from './seedExams.js'

// Filières et classes de l'ESATIC (année 2026-2027).
// Les classes 1, 2 et 3 gardent leur numéro : les comptes et épreuves de démonstration y sont rattachés.
const FILIERES = ['SRIT', 'TWIN', 'ENTD', 'CSIA', 'DASI', 'BIHAR', 'MBDS', 'SIGL', 'RTEL', 'ERIS', 'I4SEI']
const MASTERS = ['BIHAR', 'MBDS', 'SIGL', 'RTEL', 'ERIS', 'CSIA']
const CLASSES = [
  // [nom, filière, niveau]
  ['SRIT 2 A', 'SRIT', 'L2'], ['SRIT 2 B', 'SRIT', 'L2'], ['SRIT 1 A', 'SRIT', 'L1'],
  ['SRIT 1 B', 'SRIT', 'L1'], ['SRIT 1 C', 'SRIT', 'L1'], ['ENTD 1', 'ENTD', 'L1'], ['TWIN 1', 'TWIN', 'L1'],
  ['TWIN 2', 'TWIN', 'L2'], ['ENTD 2', 'ENTD', 'L2'], ['CSIA 2', 'CSIA', 'L2'],
  ['DASI 3', 'DASI', 'L3'], ['SRIT 3 A', 'SRIT', 'L3'], ['SRIT 3 B', 'SRIT', 'L3'], ['TWIN 3', 'TWIN', 'L3'], ['CSIA 3', 'CSIA', 'L3'], ['ENTD 3', 'ENTD', 'L3'],
  ...MASTERS.map((m) => [`M1 ${m}`, m, 'M1']),
  ...MASTERS.map((m) => [`M2 ${m}`, m, 'M2']),
  // Ajoutées ensuite : toujours en fin de liste, pour ne pas changer le numéro des classes existantes
  ['I4SEI', 'I4SEI', 'L3'],
]

// À augmenter à chaque ajout dans les listes ci-dessus : les bases existantes reçoivent les classes manquantes
export const STRUCTURE_VERSION = 2

export function schoolStructure(year = '2026-2027') {
  const filieres = FILIERES.map((code, i) => ({ id: i + 1, schoolId: 1, code, name: code }))
  const classes = CLASSES.map(([name, fil, level], i) => ({
    id: i + 1, schoolId: 1, name, level, year,
    code: name.replace(/^(M[12]) /, '$1-').replace(/ /g, ''),
    filiereId: FILIERES.indexOf(fil) + 1,
  }))
  return { filieres, classes }
}

// Exercices des épreuves de démonstration : [titre, consigne commune, numéros des questions (à partir de 0)]
const DEMO_SECTIONS = {
  2: [
    ['Jointures', 'Base de test : etudiant(id, nom, classe_id) et classe(id, libelle). Chaque étudiant appartient à une classe.', [0]],
    ['Regroupements', 'Même base. Utilisez GROUP BY et une fonction d\'agrégat.', [1]],
  ],
  5: [['Questions de cours', '', [0]], ['Programmation en C', 'Programme complet, lecture sur l\'entrée standard.', [1]]],
  6: [
    ['Questions de cours', 'Une ou plusieurs réponses possibles selon la question.', [0, 1]],
    ['Programmation', 'Votre programme lit les données sur l\'entrée standard et affiche le résultat.', [2]],
    ['Réflexion', '', [3]],
  ],
  9: [
    ['Python', 'Programmes complets : lisez les données avec input() et affichez le résultat avec print().', [0, 1]],
    ['JavaScript', '', [2]],
    ['SQL', '', [3]],
    ['Langages compilés', 'Java et C s\'exécuteront sur le serveur de correction.', [4, 5]],
    ['Question de cours', '', [6]],
  ],
  15: [
    ['Interactivité en JavaScript', 'Le rendu de votre page s\'affiche à droite du code. Testez vos boutons directement dans l\'aperçu.', [0, 1]],
    ['Formulaires', '', [2]],
    ['Question de cours', '', [3]],
  ],
}

// Range les questions d'une épreuve de démonstration en exercices (une seule fois : si l'épreuve n'en a pas encore)
export function applyDemoSections(a) {
  const plan = DEMO_SECTIONS[a.id]
  if (!plan || a.sections !== undefined) return false
  if (plan.some(([, , idx]) => idx.some((i) => !a.questions[i]))) return false
  a.sections = plan.map(([title, intro], i) => ({ id: `ex${i + 1}`, title, intro }))
  plan.forEach(([, , idx], i) => idx.forEach((k) => { a.questions[k].sectionId = `ex${i + 1}` }))
  return true
}

// Outils informatiques de chaque matière de démonstration (code de la matière -> outils)
export const DEFAULT_TOOLS = {
  PROG: ['c', 'cpp', 'java'],
  BDD: ['sql'],
  WEB: ['html', 'javascript', 'php'],
  PY: ['python'],
  ALGO: ['c', 'python', 'java', 'javascript', 'sql'],
  MATH: [],
}

// Notes saisies à la main par l'administration (oral, TP papier) pour le Semestre 1, L2 Informatique A
export function demoManualGrades() {
  const g = (id, studentId, matiereId, label, score) => ({ id, schoolId: 1, periodeId: 1, classeId: 1, studentId, matiereId, label, score, createdAt: new Date().toISOString(), by: 1 })
  return [
    g(1, 10, 1, 'TP papier - Tableaux', 14), g(2, 10, 2, 'Oral - Modélisation', 15.5), g(3, 10, 4, 'TP papier - Fonctions', 13), g(4, 10, 5, 'Interrogation écrite', 16), g(5, 10, 6, 'Devoir surveillé papier', 12.5),
    g(6, 11, 1, 'TP papier - Tableaux', 12), g(7, 11, 2, 'Oral - Modélisation', 13), g(8, 11, 4, 'TP papier - Fonctions', 15), g(9, 11, 5, 'Interrogation écrite', 11), g(10, 11, 6, 'Devoir surveillé papier', 14),
    g(11, 12, 1, 'TP papier - Tableaux', 9), g(12, 12, 2, 'Oral - Modélisation', 10.5), g(13, 12, 4, 'TP papier - Fonctions', 8), g(14, 12, 5, 'Interrogation écrite', 10), g(15, 12, 6, 'Devoir surveillé papier', 7.5),
    g(16, 13, 1, 'TP papier - Tableaux', 16), g(17, 13, 2, 'Oral - Modélisation', 17), g(18, 13, 4, 'TP papier - Fonctions', 15.5), g(19, 13, 5, 'Interrogation écrite', 14), g(20, 13, 6, 'Devoir surveillé papier', 16),
    g(21, 14, 1, 'TP papier - Tableaux', 11), g(22, 14, 2, 'Oral - Modélisation', 12), g(23, 14, 5, 'Interrogation écrite', 9.5),
    g(24, 15, 1, 'TP papier - Tableaux', 13), g(25, 15, 4, 'TP papier - Fonctions', 12),
  ]
}

export const DEMO_ACCOUNTS = [
  { role: 'admin', login: 'ADM001', password: 'Admin2026!', label: 'Administrateur' },
  { role: 'teacher', login: 'ENS001', password: 'Prof2026!', label: 'Enseignant' },
  { role: 'proctor', login: 'SUR001', password: 'Surv2026!', label: 'Surveillant' },
  { role: 'student', login: 'ETU24001', password: 'Etudiant2026!', label: 'Étudiant' },
  { role: 'student', login: 'ETU24006', password: 'Provisoire1', label: 'Étudiant (1re connexion)' },
]

export async function buildSeed(hash = hashPassword) {
  const SCHOOL = 1
  const pw = {}
  for (const p of ['Admin2026!', 'Prof2026!', 'Surv2026!', 'Etudiant2026!', 'Provisoire1']) {
    pw[p] = await hash(p)
  }

  const { filieres, classes } = schoolStructure()
  const matieres = [
    { id: 1, schoolId: SCHOOL, code: 'PROG', name: 'Programmation C/C++', coefficient: 4, tools: DEFAULT_TOOLS.PROG },
    { id: 2, schoolId: SCHOOL, code: 'BDD', name: 'Bases de données', coefficient: 3, tools: DEFAULT_TOOLS.BDD },
    { id: 3, schoolId: SCHOOL, code: 'WEB', name: 'Développement web', coefficient: 3, tools: DEFAULT_TOOLS.WEB },
    { id: 4, schoolId: SCHOOL, code: 'PY', name: 'Programmation Python', coefficient: 3, tools: DEFAULT_TOOLS.PY },
    { id: 5, schoolId: SCHOOL, code: 'ALGO', name: 'Algorithmique', coefficient: 4, tools: DEFAULT_TOOLS.ALGO },
    { id: 6, schoolId: SCHOOL, code: 'MATH', name: 'Mathématiques', coefficient: 2, tools: DEFAULT_TOOLS.MATH },
  ]
  const periodes = [
    { id: 1, schoolId: SCHOOL, name: 'Semestre 1', start: '2026-10-01', end: '2027-02-15', active: true },
    { id: 2, schoolId: SCHOOL, name: 'Semestre 2', start: '2027-02-16', end: '2027-07-15', active: false },
  ]

  const u = (id, role, matricule, firstName, lastName, extra = {}) => ({
    id, schoolId: SCHOOL, role, matricule, firstName, lastName,
    email: `${firstName}.${lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ']/g, '').replace(/\s+/g, '') + '@esatic.ci',
    passwordHash: null, mustChangePassword: false, active: true, classeId: null,
    createdAt: at(-60 * D), lastLoginAt: null, activeToken: null, ...extra,
  })

  const users = [
    u(1, 'admin', 'ADM001', 'Aïcha', 'Ouattara', { passwordHash: pw['Admin2026!'] }),
    u(2, 'teacher', 'ENS001', 'Yao', 'Kouassi', { passwordHash: pw['Prof2026!'] }),
    u(3, 'teacher', 'ENS002', 'Awa', 'Bamba', { passwordHash: pw['Prof2026!'] }),
    u(4, 'proctor', 'SUR001', 'Mamadou', 'Koné', { passwordHash: pw['Surv2026!'] }),
    u(10, 'student', 'ETU24001', 'Fresnel', 'Traore', { passwordHash: pw['Etudiant2026!'], classeId: 1 }),
    u(11, 'student', 'ETU24002', 'Aminata', 'Diallo', { passwordHash: pw['Etudiant2026!'], classeId: 1 }),
    u(12, 'student', 'ETU24003', 'Jean', 'Konan', { passwordHash: pw['Etudiant2026!'], classeId: 1 }),
    u(13, 'student', 'ETU24004', 'Marie', "N'Guessan", { passwordHash: pw['Etudiant2026!'], classeId: 1 }),
    u(14, 'student', 'ETU24005', 'Ibrahim', 'Coulibaly', { passwordHash: pw['Etudiant2026!'], classeId: 1 }),
    u(15, 'student', 'ETU24006', 'Esther', 'Yao', { passwordHash: pw['Provisoire1'], classeId: 1, mustChangePassword: true }),
    u(16, 'student', 'ETU24007', 'Moussa', 'Sanogo', { passwordHash: pw['Etudiant2026!'], classeId: 2 }),
    u(17, 'student', 'ETU24008', 'Grâce', 'Kouadio', { passwordHash: pw['Etudiant2026!'], classeId: 2 }),
  ]

  const teaching = [
    { id: 1, schoolId: SCHOOL, teacherId: 2, classeId: 1, matiereId: 1 },
    { id: 2, schoolId: SCHOOL, teacherId: 2, classeId: 2, matiereId: 1 },
    { id: 3, schoolId: SCHOOL, teacherId: 2, classeId: 1, matiereId: 2 },
    { id: 4, schoolId: SCHOOL, teacherId: 2, classeId: 1, matiereId: 4 },
    { id: 5, schoolId: SCHOOL, teacherId: 2, classeId: 1, matiereId: 5 },
    { id: 6, schoolId: SCHOOL, teacherId: 3, classeId: 1, matiereId: 3 },
    { id: 7, schoolId: SCHOOL, teacherId: 3, classeId: 2, matiereId: 3 },
    { id: 8, schoolId: SCHOOL, teacherId: 2, classeId: 1, matiereId: 6 },
  ]

  // exitWarnings : 1 = avertissement à la 1re sortie, copie envoyée à la 2e ; null = signalement seulement
  const security = (over = {}) => ({
    fullscreen: true, blockPaste: true, sebRequired: false, sebKeys: '', shuffleQuestions: false, showResultsAfter: false,
    exitWarnings: over.fullscreen === false ? null : 1, ...over,
  })

  // ---------- Questions ----------
  let qid = 100
  const q = (type, statement, points, data = {}) => ({ id: ++qid, type, statement, points, data })

  const qPointeurs = [
    q('qcm', 'Que contient une variable déclarée avec `int *p;` ?', 2, {
      multiple: false,
      choices: [
        { id: 'a', text: 'Un entier' },
        { id: 'b', text: "L'adresse mémoire d'un entier" },
        { id: 'c', text: 'Un tableau d\'entiers' },
        { id: 'd', text: 'Une référence constante' },
      ],
      correct: ['b'],
    }),
    q('code', "Écrire un programme C++ qui lit deux entiers a et b, les échange à l'aide d'une fonction `void echanger(int *x, int *y)` puis affiche `a b` après l'échange.", 6, {
      language: 'cpp',
      starter: '#include <iostream>\nusing namespace std;\n\nvoid echanger(int *x, int *y) {\n    // à compléter\n}\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    echanger(&a, &b);\n    cout << a << " " << b << endl;\n    return 0;\n}\n',
      tests: [
        { id: 't1', name: 'Exemple', stdin: '3 7', expected: '7 3', points: 2, hidden: false },
        { id: 't2', name: 'Négatifs', stdin: '-4 9', expected: '9 -4', points: 2, hidden: true },
        { id: 't3', name: 'Égaux', stdin: '5 5', expected: '5 5', points: 2, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
    q('ouverte', 'Expliquez la différence entre un passage par valeur et un passage par adresse.', 4, {
      answerModel: "Par valeur : la fonction reçoit une copie, la variable d'origine n'est pas modifiée. Par adresse : la fonction reçoit l'adresse et peut modifier la variable d'origine via le pointeur.",
      maxWords: 200,
    }),
  ]

  const sqlSchema = 'CREATE TABLE etudiant (id INTEGER PRIMARY KEY, nom TEXT, classe_id INTEGER);\nCREATE TABLE classe (id INTEGER PRIMARY KEY, libelle TEXT);'
  const sqlSeed = "INSERT INTO classe VALUES (1,'L2 INFO A'),(2,'L2 INFO B');\nINSERT INTO etudiant VALUES (1,'Traore',1),(2,'Diallo',1),(3,'Sanogo',2);"
  const qSql = [
    q('sql', 'Afficher le nom de chaque étudiant avec le libellé de sa classe, triés par nom.', 5, {
      schemaSql: sqlSchema, seedSql: sqlSeed,
      expectedQuery: 'SELECT e.nom, c.libelle FROM etudiant e JOIN classe c ON c.id = e.classe_id ORDER BY e.nom;',
      orderMatters: true,
    }),
    q('sql', 'Afficher le nombre d\'étudiants par classe (libellé, nombre).', 5, {
      schemaSql: sqlSchema, seedSql: sqlSeed,
      expectedQuery: 'SELECT c.libelle, COUNT(*) FROM etudiant e JOIN classe c ON c.id = e.classe_id GROUP BY c.libelle;',
      orderMatters: false,
    }),
  ]

  const qHtml = [
    q('html', 'Réaliser une carte de profil : photo ronde à gauche, nom en gras, filière en dessous. Utiliser Flexbox.', 10, {
      starterHtml: '<div class="carte">\n  <!-- à compléter -->\n</div>',
      starterCss: '.carte {\n  \n}',
      criteria: [
        { id: 'c1', label: 'Structure HTML correcte', points: 3 },
        { id: 'c2', label: 'Utilisation de Flexbox', points: 4 },
        { id: 'c3', label: 'Rendu fidèle à la consigne', points: 3 },
      ],
    }),
  ]

  const qPythonCC = [
    q('qcm', 'Quel est le résultat de `len([1, [2, 3], 4])` ?', 2, {
      multiple: false,
      choices: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }, { id: 'c', text: '2' }, { id: 'd', text: 'Erreur' }],
      correct: ['a'],
    }),
    q('qcm', 'Quels types sont immuables en Python ?', 3, {
      multiple: true,
      choices: [{ id: 'a', text: 'tuple' }, { id: 'b', text: 'list' }, { id: 'c', text: 'str' }, { id: 'd', text: 'dict' }],
      correct: ['a', 'c'],
    }),
    q('code', 'Écrire un programme Python qui lit un entier n et affiche la somme des entiers de 1 à n.', 10, {
      language: 'python',
      starter: 'n = int(input())\n# à compléter\n',
      tests: [
        { id: 't1', name: 'Exemple', stdin: '4', expected: '10', points: 3, hidden: false },
        { id: 't2', name: 'n = 1', stdin: '1', expected: '1', points: 3, hidden: true },
        { id: 't3', name: 'Grand n', stdin: '1000', expected: '500500', points: 4, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
    q('ouverte', "Dans quel cas utiliseriez-vous un dictionnaire plutôt qu'une liste ?", 5, { answerModel: 'Accès par clé, recherche rapide, association clé/valeur.', maxWords: 150 }),
  ]

  const qAlgo = [
    q('qcm', 'Quelle est la complexité de la recherche dichotomique ?', 2, {
      multiple: false,
      choices: [{ id: 'a', text: 'O(n)' }, { id: 'b', text: 'O(log n)' }, { id: 'c', text: 'O(n²)' }, { id: 'd', text: 'O(1)' }],
      correct: ['b'],
    }),
    q('code', 'Écrire un programme C qui lit n puis n entiers et affiche le plus grand.', 8, {
      language: 'c',
      starter: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    // à compléter\n    return 0;\n}\n',
      tests: [
        { id: 't1', name: 'Exemple', stdin: '5\n3 9 2 7 1', expected: '9', points: 4, hidden: false },
        { id: 't2', name: 'Négatifs', stdin: '3\n-5 -2 -9', expected: '-2', points: 4, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
  ]

  const qBdd = [
    q('qcm', 'Quelle clause filtre les groupes après un GROUP BY ?', 2, {
      multiple: false,
      choices: [{ id: 'a', text: 'WHERE' }, { id: 'b', text: 'HAVING' }, { id: 'c', text: 'ORDER BY' }, { id: 'd', text: 'LIMIT' }],
      correct: ['b'],
    }),
    q('ouverte', 'Définissez la notion de clé étrangère.', 3, { answerModel: 'Attribut qui référence la clé primaire d\'une autre table et garantit l\'intégrité référentielle.' }),
  ]

  // Examen d'essai : une question par langage, pour tester les outils de code
  const qEssai = [
    q('code', 'Lire un entier n et afficher la somme des nombres pairs de 1 à n.', 6, {
      language: 'python',
      starter: 'n = int(input())\n# à compléter\n',
      tests: [
        { id: 't1', name: 'n = 10', stdin: '10', expected: '30', points: 2, hidden: false },
        { id: 't2', name: 'n = 7', stdin: '7', expected: '12', points: 2, hidden: false },
        { id: 't3', name: 'n = 1', stdin: '1', expected: '0', points: 2, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
    q('code', 'Lire une ligne d\'entiers séparés par des espaces et afficher le plus grand puis le plus petit, séparés par un espace.', 6, {
      language: 'python',
      starter: 'nombres = list(map(int, input().split()))\n# à compléter\n',
      tests: [
        { id: 't1', name: 'Exemple', stdin: '4 9 -2 7', expected: '9 -2', points: 3, hidden: false },
        { id: 't2', name: 'Un seul nombre', stdin: '5', expected: '5 5', points: 3, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
    q('code', 'JavaScript : lire un mot et l\'afficher à l\'envers.', 4, {
      language: 'javascript',
      starter: "const mot = require('fs').readFileSync(0, 'utf8').trim();\n// à compléter\n",
      tests: [
        { id: 't1', name: 'bonjour', stdin: 'bonjour', expected: 'ruojnob', points: 2, hidden: false },
        { id: 't2', name: 'esatic', stdin: 'esatic', expected: 'citase', points: 2, hidden: true },
      ],
      timeLimitMs: 2000,
    }),
    q('sql', 'Afficher le nombre d\'étudiants de chaque classe (libellé, nombre), du plus grand au plus petit.', 4, {
      schemaSql: sqlSchema, seedSql: sqlSeed,
      expectedQuery: 'SELECT c.libelle, COUNT(*) AS nombre FROM etudiant e JOIN classe c ON c.id = e.classe_id GROUP BY c.libelle ORDER BY nombre DESC;',
      orderMatters: true,
    }),
    q('code', 'Java : lire un entier n et afficher n! (factorielle).', 4, {
      language: 'java',
      starter: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // à compléter\n    }\n}\n',
      tests: [{ id: 't1', name: 'n = 5', stdin: '5', expected: '120', points: 4, hidden: false }],
      timeLimitMs: 3000,
    }),
    q('code', 'C : lire deux entiers et afficher leur somme.', 2, {
      language: 'c',
      starter: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    // à compléter\n    return 0;\n}\n',
      tests: [{ id: 't1', name: 'Exemple', stdin: '3 4', expected: '7', points: 2, hidden: false }],
      timeLimitMs: 2000,
    }),
    q('qcm', 'Quelle structure Python associe des clés à des valeurs ?', 1, {
      multiple: false,
      choices: [{ id: 'a', text: 'list' }, { id: 'b', text: 'tuple' }, { id: 'c', text: 'dict' }, { id: 'd', text: 'set' }],
      correct: ['c'],
    }),
  ]

  const totalPoints = (qs) => qs.reduce((s, x) => s + Number(x.points || 0), 0)

  const assessments = [
    {
      id: 1, schoolId: SCHOOL, teacherId: 2, matiereId: 1, classeId: 1, kind: 'devoir', status: 'publie',
      title: 'Programmation C++ Pointeurs', description: 'Manipulation des pointeurs et passage par adresse.',
      startAt: at(-3 * D), endAt: at(0, 17, 0), durationMin: null, maxAttempts: 2,
      security: security({ fullscreen: false }), questions: qPointeurs, resultsPublished: false, createdAt: at(-4 * D),
    },
    {
      id: 2, schoolId: SCHOOL, teacherId: 2, matiereId: 2, classeId: 1, kind: 'devoir', status: 'publie',
      title: 'Requêtes SQL - Jointures', description: 'Jointures et regroupements sur une base de test.',
      startAt: at(-1 * D), endAt: at(3 * D, 23, 59), durationMin: null, maxAttempts: 3,
      security: security({ fullscreen: false }), questions: qSql, resultsPublished: false, createdAt: at(-2 * D),
    },
    {
      id: 3, schoolId: SCHOOL, teacherId: 3, matiereId: 3, classeId: 1, kind: 'devoir', status: 'publie',
      title: 'Mise en page HTML/CSS', description: 'Carte de profil avec Flexbox.',
      startAt: at(-14 * D), endAt: at(-7 * D, 18, 0), durationMin: null, maxAttempts: 1,
      security: security({ fullscreen: false }), questions: qHtml, resultsPublished: true, createdAt: at(-15 * D),
    },
    {
      id: 4, schoolId: SCHOOL, teacherId: 2, matiereId: 4, classeId: 1, kind: 'devoir', status: 'annule',
      title: 'TP Python - Listes', description: 'Devoir annulé : remplacé par le contrôle continu.',
      startAt: at(-5 * D), endAt: at(2 * D, 18, 0), durationMin: null, maxAttempts: 1,
      security: security({ fullscreen: false }), questions: [], resultsPublished: false, createdAt: at(-6 * D),
    },
    {
      id: 5, schoolId: SCHOOL, teacherId: 2, matiereId: 5, classeId: 1, kind: 'examen', status: 'publie',
      title: 'Examen partiel - Algorithmique et C', description: 'Examen surveillé en salle informatique.',
      startAt: at(1 * D, 9, 0), endAt: at(1 * D, 11, 0), durationMin: 120, maxAttempts: 1,
      security: security(), questions: qAlgo, resultsPublished: false, createdAt: at(-7 * D),
    },
    {
      id: 6, schoolId: SCHOOL, teacherId: 2, matiereId: 4, classeId: 1, kind: 'examen', status: 'publie',
      title: 'Contrôle continu - Python', description: 'Contrôle surveillé, salle informatique 2.',
      startAt: at(-1 * H), endAt: at(3 * H), durationMin: 60, maxAttempts: 1,
      security: security(), questions: qPythonCC, resultsPublished: false, createdAt: at(-5 * D),
    },
    {
      id: 7, schoolId: SCHOOL, teacherId: 2, matiereId: 2, classeId: 1, kind: 'examen', status: 'publie',
      title: 'Examen - Bases de données', description: 'Examen de mi-semestre.',
      startAt: at(-10 * D, 8, 0), endAt: at(-10 * D, 10, 0), durationMin: 90, maxAttempts: 1,
      security: security(), questions: qBdd, resultsPublished: true, createdAt: at(-20 * D),
    },
    {
      id: 8, schoolId: SCHOOL, teacherId: 2, matiereId: 1, classeId: 2, kind: 'devoir', status: 'brouillon',
      title: 'Structures et listes chaînées', description: 'En préparation.',
      startAt: at(5 * D, 8, 0), endAt: at(12 * D, 18, 0), durationMin: null, maxAttempts: 1,
      security: security({ fullscreen: false }), questions: [], resultsPublished: false, createdAt: at(-1 * D),
    },
    {
      id: 9, schoolId: SCHOOL, teacherId: 2, matiereId: 5, classeId: 1, kind: 'examen', status: 'publie',
      title: 'Examen d\'essai - Programmation', description: 'Examen d\'entraînement pour essayer les outils : Python, JavaScript et SQL s\'exécutent dans le navigateur ; Java et C attendent le serveur de correction.',
      startAt: at(-1 * H), endAt: at(30 * D, 18, 0), durationMin: 120, maxAttempts: 1,
      security: security(), questions: qEssai, resultsPublished: false, createdAt: at(-2 * H),
    },
  ]

  const extra = buildExtraExams()
  assessments.push(...extra.assessments)
  for (const a of assessments) applyDemoSections(a)

  // Langages de programmation de chaque épreuve (choisis par l'enseignant dans l'assistant)
  for (const a of assessments) {
    a.languages = [...new Set(a.questions.filter((x) => x.type === 'code').map((x) => x.data.language))]
  }

  const sessions = [
    { id: 1, schoolId: SCHOOL, assessmentId: 6, code: 'PY4K2M', room: 'Salle informatique 2', status: 'ouverte', proctorId: 4, openedAt: at(-50 * 60 * 1000), closedAt: null },
    { id: 2, schoolId: SCHOOL, assessmentId: 5, code: 'AL7Q3C', room: 'Salle informatique 1', status: 'planifiee', proctorId: 4, openedAt: null, closedAt: null },
    { id: 3, schoolId: SCHOOL, assessmentId: 7, code: 'BD2X9P', room: 'Salle informatique 1', status: 'fermee', proctorId: 4, openedAt: at(-10 * D, 8, 0), closedAt: at(-10 * D, 10, 0) },
    { id: 4, schoolId: SCHOOL, assessmentId: 9, code: 'ESSAI1', room: 'Salle informatique 2', status: 'ouverte', proctorId: 4, openedAt: at(-1 * H), closedAt: null },
    ...extra.sessions,
  ]

  const ans = (value, extra = {}) => ({ value, updatedAt: at(-2 * H), autoScore: null, manualScore: null, feedback: '', ...extra })

  const attempts = [
    // Devoir HTML corrigé et publié pour Traore
    {
      id: 1, schoolId: SCHOOL, assessmentId: 3, studentId: 10, sessionId: null, number: 1,
      startedAt: at(-8 * D, 14, 0), deadlineAt: null, submittedAt: at(-8 * D, 15, 10), status: 'corrige',
      answers: {
        [qHtml[0].id]: ans({ html: '<div class="carte">\n  <img src="" alt="photo">\n  <div><strong>Fresnel Traore</strong><p>Génie logiciel</p></div>\n</div>', css: '.carte { display: flex; gap: 12px; align-items: center; }\nimg { width: 64px; height: 64px; border-radius: 50%; background: #ccc; }' }, { manualScore: 8.5, feedback: 'Bon travail, alignement vertical à revoir.', criteria: { c1: 3, c2: 3.5, c3: 2 } }),
      },
      snapshots: [], events: [], score: 8.5, maxScore: totalPoints(qHtml), gradedAt: at(-6 * D),
    },
    {
      id: 2, schoolId: SCHOOL, assessmentId: 3, studentId: 11, sessionId: null, number: 1,
      startedAt: at(-9 * D, 10, 0), deadlineAt: null, submittedAt: at(-9 * D, 11, 0), status: 'corrige',
      answers: { [qHtml[0].id]: ans({ html: '<div class="carte"><img><b>Aminata</b></div>', css: '.carte{display:block}' }, { manualScore: 5, feedback: 'Flexbox non utilisé.' }) },
      snapshots: [], events: [], score: 5, maxScore: totalPoints(qHtml), gradedAt: at(-6 * D),
    },
    // Examen BDD corrigé
    {
      id: 3, schoolId: SCHOOL, assessmentId: 7, studentId: 10, sessionId: 3, number: 1,
      startedAt: at(-10 * D, 8, 5), deadlineAt: at(-10 * D, 9, 35), submittedAt: at(-10 * D, 9, 20), status: 'corrige',
      answers: {
        [qBdd[0].id]: ans(['b'], { autoScore: 2 }),
        [qBdd[1].id]: ans('Une clé étrangère est une colonne qui fait référence à la clé primaire d\'une autre table.', { manualScore: 2.5, feedback: 'Il manque la notion d\'intégrité référentielle.' }),
      },
      snapshots: [], events: [{ type: 'fullscreen_exit', at: at(-10 * D, 8, 40) }], score: 4.5, maxScore: totalPoints(qBdd), gradedAt: at(-8 * D),
    },
    {
      id: 4, schoolId: SCHOOL, assessmentId: 7, studentId: 12, sessionId: 3, number: 1,
      startedAt: at(-10 * D, 8, 3), deadlineAt: at(-10 * D, 9, 33), submittedAt: at(-10 * D, 9, 30), status: 'corrige',
      answers: { [qBdd[0].id]: ans(['a'], { autoScore: 0 }), [qBdd[1].id]: ans('Une clé qui vient d\'ailleurs.', { manualScore: 1, feedback: 'Trop vague.' }) },
      snapshots: [], events: [], score: 1, maxScore: totalPoints(qBdd), gradedAt: at(-8 * D),
    },
    // Devoir pointeurs : rendu par Diallo, à corriger
    {
      id: 5, schoolId: SCHOOL, assessmentId: 1, studentId: 11, sessionId: null, number: 1,
      startedAt: at(-1 * D, 20, 0), deadlineAt: null, submittedAt: at(-1 * D, 21, 15), status: 'rendu',
      answers: {
        [qPointeurs[0].id]: ans(['b'], { autoScore: 2 }),
        [qPointeurs[1].id]: ans('#include <iostream>\nusing namespace std;\n\nvoid echanger(int *x, int *y) {\n    int t = *x;\n    *x = *y;\n    *y = t;\n}\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    echanger(&a, &b);\n    cout << a << " " << b << endl;\n    return 0;\n}\n'),
        [qPointeurs[2].id]: ans('Par valeur on copie la variable, par adresse on donne son adresse donc la fonction peut la modifier.'),
      },
      snapshots: [], events: [{ type: 'paste_blocked', at: at(-1 * D, 20, 30), detail: { length: 212 } }], score: null, maxScore: totalPoints(qPointeurs), gradedAt: null,
    },
    // Contrôle Python en cours pour deux camarades (pour la vue surveillant)
    {
      id: 6, schoolId: SCHOOL, assessmentId: 6, studentId: 12, sessionId: 1, number: 1,
      startedAt: at(-40 * 60 * 1000), deadlineAt: at(20 * 60 * 1000), submittedAt: null, status: 'en_cours',
      answers: { [qPythonCC[0].id]: ans(['a']) }, snapshots: [],
      events: [
        { type: 'started', at: at(-40 * 60 * 1000) },
        { type: 'fullscreen_exit', at: at(-25 * 60 * 1000) },
        { type: 'tab_hidden', at: at(-24 * 60 * 1000) },
        { type: 'paste_blocked', at: at(-12 * 60 * 1000), detail: { length: 180 } },
      ],
      score: null, maxScore: totalPoints(qPythonCC), gradedAt: null, lastSeenAt: at(-30 * 1000),
    },
    {
      id: 7, schoolId: SCHOOL, assessmentId: 6, studentId: 13, sessionId: 1, number: 1,
      startedAt: at(-38 * 60 * 1000), deadlineAt: at(22 * 60 * 1000), submittedAt: null, status: 'en_cours',
      answers: {}, snapshots: [], events: [{ type: 'started', at: at(-38 * 60 * 1000) }],
      score: null, maxScore: totalPoints(qPythonCC), gradedAt: null, lastSeenAt: at(-20 * 1000),
    },
  ]

  const bank = [
    { id: 900, ownerId: 2, matiereId: 1, tags: ['pointeurs'], ...q('qcm', 'Quel opérateur permet d\'obtenir l\'adresse d\'une variable en C ?', 1, { multiple: false, choices: [{ id: 'a', text: '*' }, { id: 'b', text: '&' }, { id: 'c', text: '->' }, { id: 'd', text: '#' }], correct: ['b'] }) },
    { id: 901, ownerId: 2, matiereId: 4, tags: ['boucles'], ...q('code', 'Afficher les nombres pairs de 0 à n (un par ligne).', 4, { language: 'python', starter: 'n = int(input())\n', tests: [{ id: 't1', name: 'n=4', stdin: '4', expected: '0\n2\n4', points: 4, hidden: false }], timeLimitMs: 2000 }) },
    { id: 902, ownerId: 2, matiereId: 2, tags: ['sql', 'select'], ...q('sql', 'Lister tous les étudiants de la classe 1.', 2, { schemaSql: sqlSchema, seedSql: sqlSeed, expectedQuery: 'SELECT * FROM etudiant WHERE classe_id = 1;', orderMatters: false }) },
    { id: 904, ownerId: 2, matiereId: 1, tags: ['java', 'boucles'], ...q('code', 'Écrire un programme Java qui lit un entier n et affiche n! (factorielle).', 4, { language: 'java', starter: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        // à compléter
    }
}
`, tests: [{ id: 't1', name: 'n = 5', stdin: '5', expected: '120', points: 2, hidden: false }, { id: 't2', name: 'n = 0', stdin: '0', expected: '1', points: 2, hidden: true }], timeLimitMs: 3000 }) },
    { id: 903, ownerId: 2, matiereId: 5, tags: ['complexité'], ...q('ouverte', 'Expliquez pourquoi le tri fusion est en O(n log n).', 4, { answerModel: 'Division en deux à chaque niveau (log n niveaux), fusion linéaire à chaque niveau.' }) },
  ].map((b) => ({ ...b, id: b.id }))

  const announcements = [
    { id: 1, schoolId: SCHOOL, authorId: 1, title: 'Ouverture de la plateforme d\'examens', body: 'Les devoirs et examens de programmation se font désormais sur la plateforme. Votre mot de passe provisoire vous a été remis par l\'administration.', classeId: null, createdAt: at(-6 * D) },
    { id: 2, schoolId: SCHOOL, authorId: 1, title: 'Salle informatique 2 - horaires', body: 'La salle informatique 2 est accessible de 8h à 18h pour les entraînements, sauf pendant les examens.', classeId: null, createdAt: at(-3 * D) },
    { id: 3, schoolId: SCHOOL, authorId: 2, title: 'Partiel d\'algorithmique', body: 'Le partiel aura lieu demain à 9h en salle informatique 1. Présentez-vous 15 minutes avant avec votre carte d\'étudiant.', classeId: 1, createdAt: at(-1 * D) },
  ]

  const notifications = [
    { id: 1, userId: 10, title: 'Note publiée', body: 'Mise en page HTML/CSS : votre note est disponible.', link: '/etudiant/resultats', read: false, createdAt: at(-6 * D) },
    { id: 2, userId: 10, title: 'Nouvel examen', body: 'Examen partiel - Algorithmique et C, demain à 9h.', link: '/etudiant/examens', read: false, createdAt: at(-1 * D) },
    { id: 3, userId: 2, title: 'Copie rendue', body: 'Aminata Diallo a rendu « Programmation C++ Pointeurs ».', link: '/enseignant/corrections', read: false, createdAt: at(-1 * D) },
    { id: 4, userId: 4, title: 'Session ouverte', body: 'Contrôle continu - Python est en cours en salle informatique 2.', link: '/surveillant/sessions', read: false, createdAt: at(-1 * H) },
  ]

  const audit = [
    { id: 1, schoolId: SCHOOL, userId: 1, action: 'import_etudiants', target: 'SRIT 2 A', detail: '6 comptes créés', at: at(-30 * D) },
    { id: 2, schoolId: SCHOOL, userId: 2, action: 'publication_epreuve', target: 'Programmation C++ Pointeurs', detail: '', at: at(-3 * D) },
    { id: 3, schoolId: SCHOOL, userId: 4, action: 'ouverture_session', target: 'Contrôle continu - Python', detail: 'Code PY4K2M', at: at(-50 * 60 * 1000) },
  ]

  return {
    version: 1,
    school: {
      id: SCHOOL, name: 'École Supérieure Africaine des TIC', shortName: 'ESATIC', city: 'Abidjan', demo: true,
      settings: { academicYear: '2026-2027', autosaveSeconds: 25, singleSession: true, showRank: false, sebDefault: false, passwordMinLength: 8 },
    },
    filieres, classes, matieres, periodes, users, teaching, assessments, sessions, attempts, bank,
    announcements, notifications, audit,
    bulletins: [], manualGrades: demoManualGrades(),
    seq: { structure: STRUCTURE_VERSION, bulletin: 100, manualGrade: 100, user: 100, classe: 50, filiere: 20, matiere: 10, periode: 10, teaching: 20, assessment: 20, question: 1000, session: 40, attempt: 50, bank: 1000, announcement: 10, notification: 50, audit: 50 },
  }
}
