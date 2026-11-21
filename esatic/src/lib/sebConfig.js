// Fichier de configuration Safe Exam Browser (.seb) pour les postes de la salle d'examen.
// Ouvert sur un poste où SEB est installé, il lance SEB sur la plateforme, en plein écran verrouillé : pas de
// changement d'application (Alt+Tab, gestes du pavé tactile, touche Windows), pas d'autre site. Le fichier est en
// XML non chiffré ; l'administration peut l'ouvrir dans « SEB Config Tool » pour ajouter un mot de passe de sortie.

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function sebConfigXml(origin = window.location.origin) {
  const host = new URL(origin).host
  const entries = [
    ['startURL', 'string', `${origin}/connexion`],
    ['sendBrowserExamKey', 'false'],
    ['browserViewMode', 'integer', 1], // plein écran
    ['mainBrowserWindowWidth', 'string', '100%'],
    ['mainBrowserWindowHeight', 'string', '100%'],
    ['allowQuit', 'true'],
    ['allowSwitchToApplications', 'false'],
    ['enableAppSwitcherCheck', 'true'],
    ['allowVirtualMachine', 'false'],
    ['allowSpellCheck', 'false'],
    ['allowDictionaryLookup', 'false'],
    ['enableRightMouse', 'false'],
    ['allowDownUploads', 'true'],
    ['newBrowserWindowByLinkPolicy', 'integer', 0], // liens en nouvelle fenêtre : bloqués
    ['newBrowserWindowByScriptPolicy', 'integer', 0],
    ['URLFilterEnable', 'true'],
    ['URLFilterEnableContentFilter', 'false'],
  ]
  const body = entries.map(([k, type, v]) => (type === 'true' || type === 'false'
    ? `\t<key>${k}</key>\n\t<${type}/>`
    : `\t<key>${k}</key>\n\t<${type}>${xml(v)}</${type}>`)).join('\n')
  // Seule la plateforme est autorisée dans SEB
  const rules = `\t<key>URLFilterRules</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>action</key>\n\t\t\t<integer>1</integer>\n\t\t\t<key>active</key>\n\t\t\t<true/>\n\t\t\t<key>expression</key>\n\t\t\t<string>${xml(host)}</string>\n\t\t\t<key>regex</key>\n\t\t\t<false/>\n\t\t</dict>\n\t</array>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}\n${rules}\n</dict>\n</plist>\n`
}

export function downloadSebConfig() {
  const blob = new Blob([sebConfigXml()], { type: 'application/seb' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ESATIC-examen.seb'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// Le navigateur actuel est-il Safe Exam Browser ?
export const inSafeExamBrowser = () => /SEB\//i.test(navigator.userAgent)
