// Fichiers des emplois du temps (PDF) : envoi, affichage dans la page, ouverture et téléchargement
import * as api from '../api/index.js'
import { fmtSize, readFileBase64 } from './bulletinFiles.js'

export const TIMETABLE_ACCEPT = '.pdf,application/pdf'
export const TIMETABLE_MAX_BYTES = 3 * 1024 * 1024

export function checkTimetableFile(file) {
  if (!file) return 'Choisissez le fichier PDF de l\'emploi du temps.'
  if (!/\.pdf$/i.test(file.name)) return 'Format non accepté : l\'emploi du temps doit être un fichier PDF.'
  if (file.size > TIMETABLE_MAX_BYTES) return `Fichier trop lourd (${fmtSize(file.size)}) : 3 Mo au maximum. Réduisez la qualité à l'export du PDF.`
  if (!file.size) return 'Fichier vide.'
  return null
}

export async function timetablePayload(file) {
  const problem = checkTimetableFile(file)
  if (problem) throw new Error(problem)
  return { name: file.name, base64: await readFileBase64(file) }
}

// Fichiers déjà chargés pendant la visite (clé : identifiant et version) : pas de nouveau téléchargement
const cache = new Map()
export async function timetableBlob(item) {
  const k = `${item.id}:${item.version}`
  if (!cache.has(k)) {
    const p = api.getTimetableFile(item.id).then((f) => {
      const bin = atob(f.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { blob: new Blob([bytes], { type: 'application/pdf' }), fileName: f.fileName }
    })
    p.catch(() => cache.delete(k))
    cache.set(k, p)
  }
  return cache.get(k)
}

// Ouvre dans un nouvel onglet (ouvert tout de suite, sinon le navigateur le bloque)
export async function openTimetable(item) {
  const tab = window.open('', '_blank')
  try {
    const { blob } = await timetableBlob(item)
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (err) {
    tab?.close()
    throw err
  }
}

export async function downloadTimetable(item) {
  const { blob, fileName } = await timetableBlob(item)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
