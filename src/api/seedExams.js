// Examens de programmation supplémentaires (démonstration).
// Ajoutés aussi aux bases de démo déjà créées, sans effacer les données (voir migrate() dans index.js).

const H = 3600 * 1000
const D = 24 * H
const at = (offsetMs, hour, minute = 0) => {
  const d = new Date(Date.now() + offsetMs)
  if (hour !== undefined) d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

let qid = 5000
const q = (type, statement, points, data = {}) => ({ id: ++qid, type, statement, points, data })
const code = (language, statement, starter, tests, timeLimitMs = 2000) =>
  q('code', statement, tests.reduce((s, t) => s + t.points, 0), {
    language, starter, timeLimitMs,
    tests: tests.map((t, i) => ({ id: `t${i + 1}`, hidden: false, ...t })),
  })
// Question web : fichiers de départ et grille de critères [[libellé, points], ...]
const web = (statement, starters, criteria) =>
  q('html', statement, criteria.reduce((s, [, p]) => s + p, 0), {
    ...starters,
    criteria: criteria.map(([label, points], i) => ({ id: `c${i + 1}`, label, points })),
  })
const security = (over = {}) => ({
  fullscreen: true, blockPaste: true, sebRequired: false, sebKeys: '', shuffleQuestions: false, showResultsAfter: false, exitWarnings: 1, ...over,
})

const SCHEMA_NOTES = `CREATE TABLE etudiant (id INTEGER PRIMARY KEY, nom TEXT, prenom TEXT, classe TEXT);
CREATE TABLE matiere (id INTEGER PRIMARY KEY, libelle TEXT, coefficient INTEGER);
CREATE TABLE note (etudiant_id INTEGER, matiere_id INTEGER, valeur REAL);`
const SEED_NOTES = `INSERT INTO etudiant VALUES (1,'Traore','Fresnel','L2A'),(2,'Diallo','Aminata','L2A'),(3,'Konan','Jean','L2A'),(4,'Sanogo','Moussa','L2B');
INSERT INTO matiere VALUES (1,'Algorithmique',4),(2,'Bases de données',3),(3,'Développement web',2);
INSERT INTO note VALUES (1,1,15),(1,2,12.5),(1,3,17),(2,1,11),(2,2,16),(3,1,8.5),(3,3,10);`

export function buildExtraExams() {
  qid = 5000
  const exams = [
    {
      id: 10, matiereId: 4, title: 'TP noté - Python : chaînes et listes', durationMin: 90,
      description: 'Manipulation de chaînes de caractères et de listes en Python.',
      questions: [
        code('python', 'Lire un mot et afficher « oui » si c\'est un palindrome (il se lit pareil dans les deux sens), sinon « non ».',
          'mot = input().strip()\n# à compléter\n',
          [{ name: 'radar', stdin: 'radar', expected: 'oui', points: 2 }, { name: 'esatic', stdin: 'esatic', expected: 'non', points: 2 }, { name: 'kayak', stdin: 'kayak', expected: 'oui', points: 2, hidden: true }]),
        code('python', 'Lire une phrase et afficher le nombre de voyelles (a, e, i, o, u, y), sans tenir compte des majuscules.',
          'phrase = input()\n# à compléter\n',
          [{ name: 'Exemple', stdin: 'Bonjour Abidjan', expected: '6', points: 2 }, { name: 'Majuscules', stdin: 'ESATIC', expected: '3', points: 2, hidden: true }]),
        code('python', 'Lire des notes séparées par des espaces et afficher leur moyenne avec 2 chiffres après la virgule.',
          'notes = list(map(float, input().split()))\n# à compléter\n',
          [{ name: 'Exemple', stdin: '12 15 9', expected: '12.00', points: 2 }, { name: 'Décimales', stdin: '10 11', expected: '10.50', points: 2, hidden: true }]),
        q('qcm', 'Que renvoie `"esatic"[::-1]` ?', 1, {
          multiple: false, choices: [{ id: 'a', text: '"citase"' }, { id: 'b', text: '"esatic"' }, { id: 'c', text: 'Une erreur' }, { id: 'd', text: '"e"' }], correct: ['a'],
        }),
      ],
    },
    {
      id: 11, matiereId: 3, teacherId: 3, title: 'Examen - JavaScript : tableaux et boucles', durationMin: 60,
      description: 'JavaScript côté console. L\'entrée se lit avec require(\'fs\').readFileSync(0, \'utf8\').',
      questions: [
        code('javascript', 'Lire des entiers séparés par des espaces et afficher leur somme.',
          "const nombres = require('fs').readFileSync(0, 'utf8').trim().split(' ').map(Number);\n// à compléter\n",
          [{ name: 'Exemple', stdin: '3 4 5', expected: '12', points: 2 }, { name: 'Négatifs', stdin: '-2 10 -3', expected: '5', points: 2, hidden: true }]),
        code('javascript', 'Lire n et afficher les nombres de 1 à n, un par ligne, en remplaçant les multiples de 3 par Fizz, de 5 par Buzz, et des deux par FizzBuzz.',
          "const n = Number(require('fs').readFileSync(0, 'utf8').trim());\n// à compléter\n",
          [{ name: 'n = 5', stdin: '5', expected: '1\n2\nFizz\n4\nBuzz', points: 3 }, { name: 'n = 15', stdin: '15', expected: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', points: 3, hidden: true }]),
        code('javascript', 'Lire des entiers séparés par des espaces et afficher seulement les pairs, séparés par une virgule.',
          "const nombres = require('fs').readFileSync(0, 'utf8').trim().split(' ').map(Number);\n// à compléter\n",
          [{ name: 'Exemple', stdin: '1 2 3 4 5 6', expected: '2,4,6', points: 2 }]),
      ],
    },
    {
      id: 12, matiereId: 5, title: 'Examen - Algorithmique en Python', durationMin: 120,
      description: 'Algorithmes classiques : tri, recherche, nombres premiers.',
      questions: [
        code('python', 'Lire des entiers séparés par des espaces et les afficher triés par ordre croissant, sans utiliser sort() ni sorted() (tri à bulles par exemple).',
          'tab = list(map(int, input().split()))\n# à compléter\nprint(*tab)\n',
          [{ name: 'Exemple', stdin: '5 2 9 1', expected: '1 2 5 9', points: 3 }, { name: 'Déjà trié', stdin: '1 2 3', expected: '1 2 3', points: 1, hidden: true }]),
        code('python', 'Lire un entier n et afficher « premier » si n est un nombre premier, sinon « non premier ».',
          'n = int(input())\n# à compléter\n',
          [{ name: 'n = 7', stdin: '7', expected: 'premier', points: 2 }, { name: 'n = 12', stdin: '12', expected: 'non premier', points: 1 }, { name: 'n = 1', stdin: '1', expected: 'non premier', points: 1, hidden: true }]),
        code('python', 'Recherche dichotomique : la 1re ligne contient une liste triée, la 2e la valeur cherchée. Afficher sa position (à partir de 0), ou -1 si elle est absente.',
          'tab = list(map(int, input().split()))\nx = int(input())\n# à compléter\n',
          [{ name: 'Présent', stdin: '1 3 5 7 9\n7', expected: '3', points: 2 }, { name: 'Absent', stdin: '1 3 5\n4', expected: '-1', points: 2 }]),
        q('qcm', 'Quelle est la complexité du tri à bulles dans le pire des cas ?', 1, {
          multiple: false, choices: [{ id: 'a', text: 'O(n)' }, { id: 'b', text: 'O(n log n)' }, { id: 'c', text: 'O(n²)' }, { id: 'd', text: 'O(log n)' }], correct: ['c'],
        }),
      ],
    },
    {
      id: 13, matiereId: 2, title: 'Examen - SQL : jointures et agrégats', durationMin: 60,
      description: 'Requêtes sur une base de notes : étudiants, matières, notes.',
      questions: [
        q('sql', 'Afficher le nom de chaque étudiant et sa moyenne (toutes matières confondues), de la meilleure à la moins bonne.', 4, {
          schemaSql: SCHEMA_NOTES, seedSql: SEED_NOTES, orderMatters: true,
          expectedQuery: 'SELECT e.nom, AVG(n.valeur) AS moyenne FROM etudiant e JOIN note n ON n.etudiant_id = e.id GROUP BY e.id ORDER BY moyenne DESC;',
        }),
        q('sql', 'Afficher les étudiants qui n\'ont aucune note (nom, prénom).', 3, {
          schemaSql: SCHEMA_NOTES, seedSql: SEED_NOTES, orderMatters: false,
          expectedQuery: 'SELECT e.nom, e.prenom FROM etudiant e LEFT JOIN note n ON n.etudiant_id = e.id WHERE n.etudiant_id IS NULL;',
        }),
        q('sql', 'Pour chaque matière, afficher le libellé et la meilleure note obtenue.', 3, {
          schemaSql: SCHEMA_NOTES, seedSql: SEED_NOTES, orderMatters: false,
          expectedQuery: 'SELECT m.libelle, MAX(n.valeur) FROM matiere m JOIN note n ON n.matiere_id = m.id GROUP BY m.id;',
        }),
      ],
    },
    {
      id: 14, matiereId: 1, title: 'Examen - C, C++ et Java : bases', durationMin: 90,
      description: 'Langages compilés : exécution par le serveur de correction (Docker).',
      questions: [
        code('c', 'C : lire n puis n entiers et afficher leur moyenne avec 2 décimales.',
          '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    // à compléter\n    return 0;\n}\n',
          [{ name: 'Exemple', stdin: '3\n10 12 14', expected: '12.00', points: 3 }]),
        code('cpp', 'C++ : lire un mot et l\'afficher en majuscules.',
          '#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string mot;\n    cin >> mot;\n    // à compléter\n    return 0;\n}\n',
          [{ name: 'Exemple', stdin: 'esatic', expected: 'ESATIC', points: 3 }]),
        code('java', 'Java : lire n et afficher la table de multiplication de n de 1 à 3, au format « n x i = r ».',
          'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // à compléter\n    }\n}\n',
          [{ name: 'n = 4', stdin: '4', expected: '4 x 1 = 4\n4 x 2 = 8\n4 x 3 = 12', points: 4 }], 3000),
      ],
    },
    {
      id: 15, matiereId: 3, teacherId: 3, title: 'Examen - Web : HTML, CSS et JavaScript', durationMin: 90,
      description: 'Pages web interactives. Le rendu de votre page s\'affiche en direct à droite du code ; la console montre vos console.log() et les erreurs.',
      questions: [
        web('Compteur de clics. Un bouton « +1 » augmente le nombre affiché, un bouton « Remettre à zéro » le remet à 0. Le nombre devient rouge à partir de 10.', {
          starterHtml: '<main class="compteur">\n  <h1>Compteur</h1>\n  <p id="valeur">0</p>\n  <!-- ajouter les deux boutons -->\n</main>\n',
          starterCss: '.compteur {\n  font-family: sans-serif;\n  text-align: center;\n  padding: 40px;\n}\n\n#valeur {\n  font-size: 64px;\n  margin: 10px 0;\n}\n',
          starterJs: "const valeur = document.getElementById('valeur');\nlet n = 0;\n\n// à compléter\n",
        }, [['Les deux boutons sont présents', 2], ['Le compteur augmente et se remet à zéro', 4], ['Couleur rouge à partir de 10', 2]]),
        web('Liste de tâches. Un champ texte et un bouton « Ajouter » ajoutent la tâche à la liste. Un champ vide n\'ajoute rien. Cliquer sur une tâche la barre.', {
          starterHtml: '<h1>Mes tâches</h1>\n<input id="tache" placeholder="Nouvelle tâche">\n<button id="ajouter">Ajouter</button>\n<ul id="liste"></ul>\n',
          starterCss: 'body {\n  font-family: sans-serif;\n  max-width: 420px;\n  margin: 30px auto;\n}\n\n.faite {\n  text-decoration: line-through;\n  color: #888;\n}\n',
          starterJs: "const champ = document.getElementById('tache');\nconst liste = document.getElementById('liste');\n\ndocument.getElementById('ajouter').addEventListener('click', () => {\n  // à compléter\n});\n",
        }, [['Ajout d\'une tâche', 3], ['Champ vide refusé', 2], ['Tâche barrée au clic', 3]]),
        web('Formulaire d\'inscription en deux colonnes (Flexbox ou Grid) : nom, email, mot de passe. À l\'envoi, afficher un message d\'erreur sous chaque champ vide, sans recharger la page.', {
          starterHtml: '<form id="inscription">\n  <!-- champs à compléter -->\n  <button type="submit">S\'inscrire</button>\n</form>\n',
          starterCss: '',
          starterJs: "document.getElementById('inscription').addEventListener('submit', (e) => {\n  e.preventDefault();\n  // à compléter\n});\n",
        }, [['Mise en page en deux colonnes', 3], ['Messages d\'erreur sous les champs vides', 3], ['Pas de rechargement de la page', 2]]),
        q('qcm', 'Quelle instruction sélectionne l\'élément `<p id="valeur">` ?', 1, {
          multiple: false,
          choices: [{ id: 'a', text: "document.getElementById('valeur')" }, { id: 'b', text: "document.querySelector('valeur')" }, { id: 'c', text: "document.getElement('#valeur')" }, { id: 'd', text: "window.valeur.select()" }],
          correct: ['a'],
        }),
      ],
    },
  ]

  exams.push({
    id: 16, matiereId: 3, teacherId: 3, title: 'TP noté - PHP : tableaux et chaînes', durationMin: 60,
    description: 'PHP 8.3 en ligne de commande. L\'entrée se lit avec fgets(STDIN), readline() ou fscanf(STDIN, ...).',
    questions: [
      code('php', 'Lire un entier n et afficher la table de multiplication de n de 1 à 5, au format « n x i = r ».',
        '<?php\n$n = (int) trim(fgets(STDIN));\n// à compléter\n',
        [{ name: 'n = 3', stdin: '3', expected: '3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15', points: 3 }, { name: 'n = 7', stdin: '7', expected: '7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35', points: 2, hidden: true }]),
      code('php', 'Lire des notes séparées par des espaces et afficher la moyenne avec 2 décimales, puis « Admis » si elle vaut au moins 10, sinon « Ajourné ».',
        '<?php\n$notes = array_map(\'floatval\', explode(\' \', trim(fgets(STDIN))));\n// à compléter\n',
        [{ name: 'Admis', stdin: '12 15 9', expected: '12.00\nAdmis', points: 3 }, { name: 'Ajourné', stdin: '8 9 10', expected: '9.00\nAjourné', points: 2, hidden: true }]),
      code('php', 'Lire un mot et afficher « palindrome » s\'il se lit pareil dans les deux sens (sans tenir compte des majuscules), sinon « non ».',
        '<?php\n$mot = trim(fgets(STDIN));\n// à compléter\n',
        [{ name: 'Kayak', stdin: 'Kayak', expected: 'palindrome', points: 2 }, { name: 'esatic', stdin: 'esatic', expected: 'non', points: 2, hidden: true }]),
    ],
  })

  const codes = { 10: 'PYTP10', 11: 'JSEX11', 12: 'ALGO12', 13: 'SQL013', 14: 'CJAV14', 15: 'WEB015', 16: 'PHP016' }
  const assessments = exams.map((e) => ({
    schoolId: 1, teacherId: 2, classeId: 1, kind: 'examen', status: 'publie',
    startAt: at(-1 * H), endAt: at(30 * D, 18, 0), maxAttempts: 1,
    security: security(), resultsPublished: false, createdAt: at(-1 * H),
    languages: [...new Set(e.questions.filter((x) => x.type === 'code').map((x) => x.data.language))],
    ...e,
  }))
  const sessions = assessments.map((a, i) => ({
    id: 20 + i, schoolId: 1, assessmentId: a.id, code: codes[a.id], room: 'Salle informatique 2',
    status: 'ouverte', proctorId: 4, openedAt: at(-1 * H), closedAt: null,
  }))
  return { assessments, sessions }
}
