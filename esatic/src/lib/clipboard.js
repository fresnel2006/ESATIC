// Presse-papiers interne de la composition.
// On retient le dernier texte copié DANS une zone de réponse (éditeur ou champ texte).
// Au collage, seul ce texte est accepté ; tout le reste vient de l'extérieur et est bloqué.

const norm = (s) => (s || '').replace(/\r\n/g, '\n').trim()

let last = ''
let allowedUntil = 0

export const internalClipboard = {
  set(text) {
    last = text || ''
  },
  matches(text) {
    return !!norm(text) && norm(text) === norm(last)
  },
  // Un collage interne vient d'être accepté : on ne le compte pas comme "gros bloc apparu d'un coup"
  markAllowed() {
    allowedUntil = Date.now() + 800
  },
  recentlyAllowed() {
    return Date.now() < allowedUntil
  },
  clear() {
    last = ''
  },
}
