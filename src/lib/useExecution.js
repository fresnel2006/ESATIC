// Langages exécutables sur la plateforme : ceux qui tournent dans le navigateur (Python, JavaScript, PHP, SQL,
// C de base). Les autres (C++, Java, OCaml, pseudo-code) restent utilisables dans les épreuves : l'étudiant
// écrit son code, il est enregistré, et l'enseignant le corrige à la main.
import { BROWSER_LANGS } from './browserRunner.js'
import { TEST_MODE } from '../config.js'

export const canRunLanguage = (lang) => TEST_MODE.runCodeInBrowser && BROWSER_LANGS.includes(lang)

// Gardé sous forme de hook pour les pages qui l'utilisent
export function useExecution() {
  return { known: true, canRun: canRunLanguage }
}
