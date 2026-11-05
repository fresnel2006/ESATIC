// Génération du bulletin en PDF, dans le navigateur (jsPDF, sans connexion internet).
const fmt = (n) => (n === null || n === undefined ? '-' : String(n).replace('.', ','))

// Le logo SVG est converti en image pour le PDF
async function logoPng() {
  const img = new Image()
  img.src = '/img/logo-esatic.svg'
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 820
  canvas.height = 196
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export async function downloadBulletinPdf(bulletin) {
  const { jsPDF } = await import('jspdf')
  const d = bulletin.data
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210
  const M = 16
  const blue = [13, 98, 179]
  const gray = [110, 117, 130]
  let y = 16

  try {
    doc.addImage(await logoPng(), 'PNG', M, y, 50, 12, undefined, 'FAST')
  } catch { /* logo indisponible : on continue sans */ }
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30)
  doc.text(d.school.name, W - M, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...gray)
  doc.text(`${d.school.city} - Année académique ${d.school.year}`, W - M, y + 9, { align: 'right' })
  y += 22
  doc.setDrawColor(...blue).setLineWidth(0.6).line(M, y, W - M, y)
  y += 10

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...blue)
  doc.text(d.template.title, W / 2, y, { align: 'center' })
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...gray)
  doc.text(`${d.periode.name} - du ${new Date(d.periode.start).toLocaleDateString('fr-FR')} au ${new Date(d.periode.end).toLocaleDateString('fr-FR')}`, W / 2, y, { align: 'center' })
  y += 10

  // Identité
  doc.setFillColor(243, 246, 250).roundedRect(M, y, W - 2 * M, 16, 2, 2, 'F')
  const cols = [['Étudiant', d.student.name], ['Matricule', d.student.matricule], ['Classe', d.classe], ['Effectif', String(d.effectif)]]
  const cw = (W - 2 * M) / cols.length
  cols.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...gray).text(k.toUpperCase(), M + 4 + i * cw, y + 6)
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(30).text(doc.splitTextToSize(v, cw - 6)[0], M + 4 + i * cw, y + 12)
  })
  y += 24

  // Tableau des matières
  const X = { matiere: M, coef: M + 62, notes: M + 76, avg: M + 124, appr: M + 142 }
  doc.setFillColor(...blue).rect(M, y, W - 2 * M, 8, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(255)
  doc.text('MATIÈRE', X.matiere + 2, y + 5.3)
  doc.text('COEF.', X.coef + 2, y + 5.3)
  doc.text('NOTES /20', X.notes + 2, y + 5.3)
  doc.text('MOY.', X.avg + 2, y + 5.3)
  doc.text('APPRÉCIATION', X.appr + 2, y + 5.3)
  y += 8
  d.lines.forEach((l, i) => {
    const appr = doc.splitTextToSize(l.appreciation, W - M - X.appr - 3)
    const notes = doc.splitTextToSize(l.notes.map((n) => fmt(n.note20)).join('   ') || '-', X.avg - X.notes - 4)
    const h = Math.max(9, 4 + 4.2 * Math.max(appr.length, notes.length))
    if (i % 2) doc.setFillColor(248, 249, 251).rect(M, y, W - 2 * M, h, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30).text(doc.splitTextToSize(l.matiere, 58), X.matiere + 2, y + 5.8)
    doc.setFont('helvetica', 'normal').text(String(l.coefficient), X.coef + 2, y + 5.8)
    doc.setTextColor(70).text(notes, X.notes + 2, y + 5.8)
    doc.setFont('helvetica', 'bold').setTextColor(30).text(fmt(l.avg), X.avg + 2, y + 5.8)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(70).text(appr, X.appr + 2, y + 5.8)
    y += h
  })
  doc.setDrawColor(220).setLineWidth(0.2).line(M, y, W - M, y)
  y += 8

  // Résultats
  const boxes = [['Moyenne générale', `${fmt(d.general)} / 20`], ['Mention', d.mention]]
  if (d.rank) boxes.push(['Rang', `${d.rank}e / ${d.effectif}`])
  if (d.classStats) boxes.push(['Moyenne de la classe', `${fmt(d.classStats.average)} / 20`])
  const bw = (W - 2 * M - (boxes.length - 1) * 4) / boxes.length
  boxes.forEach(([k, v], i) => {
    const x = M + i * (bw + 4)
    doc.setDrawColor(...blue).setLineWidth(0.4).roundedRect(x, y, bw, 16, 2, 2, 'S')
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...gray).text(k.toUpperCase(), x + 4, y + 6)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...blue).text(v, x + 4, y + 12.5)
  })
  y += 24

  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...gray).text('APPRÉCIATION GÉNÉRALE', M, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(30)
  const ag = doc.splitTextToSize(d.appreciationGenerale, W - 2 * M)
  doc.text(ag, M, y + 6)
  y += 10 + ag.length * 5

  // Pied : code de vérification et signature
  const fy = 262
  doc.setDrawColor(220).setLineWidth(0.2).line(M, fy - 6, W - M, fy - 6)
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...gray).text('CODE DE VÉRIFICATION', M, fy)
  doc.setFont('courier', 'bold').setFontSize(13).setTextColor(30).text(bulletin.code, M, fy + 7)
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...gray)
  doc.text(`Vérifiable sur la plateforme, page « Vérifier un bulletin ». Version ${bulletin.version}, émise le ${new Date(bulletin.updatedAt).toLocaleDateString('fr-FR')}.`, M, fy + 13)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(30).text(d.template.signatory, W - M, fy, { align: 'right' })
  if (d.template.footer) doc.setFontSize(7).setTextColor(...gray).text(d.template.footer, W / 2, 288, { align: 'center' })

  const name = `bulletin-${d.student.matricule}-${d.periode.name}`.replace(/\s+/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '')
  doc.save(`${name}.pdf`)
}
