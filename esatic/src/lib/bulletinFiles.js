// Fichiers des bulletins : envoi (lecture du fichier choisi) et ouverture / téléchargement
import * as api from '../api/index.js'

export const BULLETIN_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
export const BULLETIN_MAX_BYTES = 2 * 1024 * 1024

// Contenu d'un fichier choisi, encodé en base64 (sans l'en-tête "data:...;base64,")
export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error(`Lecture impossible : ${file.name}`))
    r.readAsDataURL(file)
  })
}

export function checkBulletinFile(file) {
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Format non accepté : PDF, JPG ou PNG.'
  if (file.size > BULLETIN_MAX_BYTES) return `Fichier trop lourd (${fmtSize(file.size)}) : 2 Mo au maximum.`
  if (!file.size) return 'Fichier vide.'
  return null
}

export async function sendBulletin(periodeId, studentId, file) {
  const problem = checkBulletinFile(file)
  if (problem) throw new Error(problem)
  return api.uploadBulletin(periodeId, studentId, { name: file.name, base64: await readFileBase64(file) })
}

async function fetchBlob(id) {
  const f = await api.getBulletinFile(id)
  const bin = atob(f.base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { blob: new Blob([bytes], { type: f.mime }), fileName: f.fileName }
}

// Ouvre le bulletin dans un nouvel onglet. L'onglet est ouvert tout de suite (sinon le navigateur le bloque),
// puis rempli quand le fichier est arrivé.
export async function openBulletin(id) {
  const tab = window.open('', '_blank')
  try {
    const { blob } = await fetchBlob(id)
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    tab?.close()
    throw err
  }
}

export async function downloadBulletin(id) {
  const { blob, fileName } = await fetchBlob(id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}
