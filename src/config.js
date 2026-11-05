// Mode test : réglé par une variable, jamais actif en ligne sans le demander.
// - sur le serveur : TEST_EXAMS_WITHOUT_CODE=true dans server/.env (c'est le serveur qui décide vraiment) ;
// - dans le site : VITE_TEST_EXAMS_WITHOUT_CODE=true dans esatic/.env.development (affichage du bouton).
// En ligne (Vercel), ne définissez pas ces variables : codes d'accès, horaires et tentatives sont appliqués.
const serverTestMode = globalThis.process?.env?.TEST_EXAMS_WITHOUT_CODE === 'true'
const siteTestMode = import.meta.env?.VITE_TEST_EXAMS_WITHOUT_CODE === 'true'

export const TEST_MODE = {
  // Entrer dans n'importe quel examen sans code d'accès, sans attendre que le surveillant ouvre la session,
  // à toute heure et autant de fois que l'on veut. La durée de l'examen compte à partir de l'entrée.
  examsWithoutCode: serverTestMode || siteTestMode,

  // Entrer dans l'espace enseignant sans mot de passe (bouton sur la page de connexion), pour les essais.
  // Serveur : TEST_OPEN_TEACHER=true (server/.env). Site : VITE_TEST_OPEN_TEACHER=true (esatic/.env.development).
  // À ne jamais activer en ligne : n'importe qui pourrait modifier les épreuves et les notes.
  openTeacher: globalThis.process?.env?.TEST_OPEN_TEACHER === 'true' || import.meta.env?.VITE_TEST_OPEN_TEACHER === 'true',

  // Bouton « Lancer » : exécuter Python, JavaScript et SQL dans le navigateur (Web Worker isolé, temps limité).
  // Cela sert à essayer le code ; la note des tests reste faite par l'enseignant en attendant le serveur.
  runCodeInBrowser: true,
}

// Où sont les données :
// - 'serveur' : le serveur Node.js du dossier server/, qui enregistre tout dans Firebase (Firestore) ;
// - 'demo'    : dans ce navigateur uniquement (localStorage), sans serveur.
// Peut aussi se choisir au lancement : VITE_API_MODE=demo npm run dev
export const API_MODE = import.meta.env?.VITE_API_MODE || 'serveur'

// Outils de démonstration (comptes affichés sur la page de connexion, bouton « Réinitialiser la démo ») :
// visibles en développement seulement. En ligne, il faut VITE_DEMO_TOOLS=true pour les afficher.
export const DEMO_TOOLS = Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_DEMO_TOOLS === 'true'
