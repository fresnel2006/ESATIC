// Éditeur de diagrammes (questions de modélisation UML et Merise) : draw.io, servi par la plateforme
// (public/drawio, copié par scripts/copy-drawio.mjs), dans un cadre. Échanges par messages (protocole « embed »).
// Le diagramme est rangé en XML draw.io : il se rouvre tel quel pour l'étudiant et pour le correcteur.
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// --- Bibliothèque Merise (MCD, MLD) proposée dans le panneau de gauche ---------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const model = (cells) => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`
// Entité, association avec attributs, table : un bandeau de titre et, dessous, la zone des attributs.
// resizeParent=0 et resizeLast=1 : l'étudiant agrandit ou rétrécit la forme comme il veut, et la zone des
// attributs suit. (Avec resizeParent=1, draw.io recalculait la hauteur tout seul : impossible de la changer.)
const box = (title, lines, { w = 160, rounded = false } = {}) => {
  const h = 26 + lines.length * 20 + 10
  return {
    w, h, title,
    xml: model(
      `<mxCell id="2" value="${esc(title)}" style="swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=0;resizeLast=1;collapsible=0;marginBottom=0;html=1;whiteSpace=wrap;${rounded ? 'rounded=1;arcSize=18;' : ''}" vertex="1" parent="1"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell>`
      + `<mxCell id="3" value="${esc(lines.join('<br>'))}" style="text;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=2;whiteSpace=wrap;overflow=hidden;" vertex="1" parent="2"><mxGeometry y="26" width="${w}" height="${h - 26}" as="geometry"/></mxCell>`,
    ),
  }
}
const shape = (title, value, style, w, h) => ({ title, w, h, xml: model(`<mxCell id="2" value="${esc(value)}" style="${style}" vertex="1" parent="1"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell>`) })
const link = (card) => ({
  title: `Lien ${card}`, w: 120, h: 0,
  xml: model(`<mxCell id="2" value="${card}" style="endArrow=none;html=1;rounded=0;labelBackgroundColor=#ffffff;fontStyle=1;" edge="1" parent="1"><mxGeometry width="120" relative="1" as="geometry"><mxPoint as="sourcePoint"/><mxPoint x="120" as="targetPoint"/></mxGeometry></mxCell>`),
})
const MERISE = [
  box('ENTITÉ', ['<u>identifiant</u>', 'attribut 1', 'attribut 2']),
  shape('Association', 'Association', 'ellipse;whiteSpace=wrap;html=1;', 130, 60),
  box('ASSOCIATION', ['attribut porté'], { w: 140, rounded: true }),
  link('0,1'), link('1,1'), link('0,n'), link('1,n'),
  shape('CIF', 'CIF', 'ellipse;whiteSpace=wrap;html=1;fontStyle=1;', 50, 50),
  box('TABLE (MLD)', ['<u>id_table</u>', '#id_autre_table', 'attribut']),
]

// Toujours les mêmes bibliothèques, dans cet ordre, pour toute question de modélisation :
// Merise, Relation d'entité, UML (plus le Bloc-notes de draw.io)
const LIBRARIES = 'merise;er;uml'

// draw.io garde ses réglages (bibliothèques ouvertes...) dans le navigateur : réglages propres à la plateforme,
// remis à zéro à chaque ouverture, pour que l'éditeur se présente toujours de la même façon.
const SETTINGS_NAME = 'esatic-modelisation'
function resetSettings() {
  try {
    for (const k of ['modelisation', 'merise', 'uml', 'libre']) localStorage.removeItem(`.esatic-${k}-config`)
  } catch { /* stockage indisponible */ }
}

function config() {
  return {
    settingsName: SETTINGS_NAME,
    defaultLibraries: LIBRARIES,
    enabledLibraries: ['merise', 'uml', 'er', 'general', 'basic', 'arrows2', 'flowchart'],
    libraries: [{
      title: { main: 'ESATIC' },
      entries: [{ id: 'merise', title: { main: 'Merise' }, desc: { main: 'MCD et MLD : entités, associations, cardinalités' }, libs: [{ title: { main: 'Merise' }, data: MERISE }] }],
    }],
    compressXml: false,
  }
}

const PARAMS = 'embed=1&proto=json&spin=1&ui=kennedy&lang=fr&libraries=1&configure=1&noSaveBtn=1&noExitBtn=1&saveAndExit=0&offline=1&stealth=1&pwa=0'

// Diagramme vide : aucune forme ni aucun lien
export const isEmptyDiagram = (xml) => !xml || !/<mxCell[^>]*\s(vertex|edge)="1"/.test(xml)

// value : XML du diagramme ; onChange(xml) à chaque modification (« » si le diagramme est vide)
export default function DiagramEditor({ value, onChange, readOnly = false, height = 560, title = 'Éditeur de diagrammes' }) {
  const frame = useRef(null)
  const [ready, setReady] = useState(false)
  const first = useRef(value) // contenu chargé à l'ouverture ; ensuite, c'est l'éditeur qui fait foi
  const cb = useRef(onChange)
  useEffect(() => { cb.current = onChange }, [onChange])

  useEffect(() => {
    function onMessage(e) {
      if (!frame.current || e.source !== frame.current.contentWindow || typeof e.data !== 'string') return
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      const send = (m) => frame.current?.contentWindow?.postMessage(JSON.stringify(m), '*')
      if (msg.event === 'configure') { resetSettings(); send({ action: 'configure', config: config() }) }
      else if (msg.event === 'init') send({ action: 'load', xml: first.current || '', autosave: readOnly ? 0 : 1, noExitBtn: 1 })
      else if (msg.event === 'load') setReady(true)
      else if (msg.event === 'autosave' && !readOnly) cb.current?.(isEmptyDiagram(msg.xml) ? '' : msg.xml)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [readOnly])

  const src = `/drawio/index.html?${PARAMS}${readOnly ? '&chrome=0&nav=1' : ''}`
  return (
    <div className="diagram-editor" style={{ height }}>
      {!ready && <div className="diagram-loading"><Loader2 size={16} className="spin" /> Ouverture de l'éditeur de diagrammes...</div>}
      <iframe ref={frame} src={src} title={title} style={{ visibility: ready ? 'visible' : 'hidden' }} />
    </div>
  )
}

// Affichage d'un diagramme en lecture seule, chargé seulement quand il apparaît à l'écran
// (une page de correction peut en contenir beaucoup)
export function DiagramView({ value, height = 420 }) {
  const holder = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!holder.current || visible) return
    const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) setVisible(true) }, { rootMargin: '200px' })
    io.observe(holder.current)
    return () => io.disconnect()
  }, [visible])
  if (isEmptyDiagram(value)) return <div className="muted small">Diagramme vide.</div>
  return <div ref={holder} style={{ minHeight: height }}>{visible && <DiagramEditor value={value} readOnly height={height} title="Diagramme (lecture seule)" />}</div>
}
