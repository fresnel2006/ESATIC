
// --- ESATIC (ajouté par scripts/copy-drawio.mjs) ------------------------------------------------------
// Formes à lignes de draw.io (classe UML, table, entité...) : draw.io recalcule leur hauteur au plus juste,
// ce qui empêche de les agrandir à la main. On les laisse agrandir librement : elles grandissent toujours
// toutes seules quand on ajoute une ligne et ne descendent pas sous leur contenu, et la dernière ligne
// occupe la place gagnée.
(function () {
  if (typeof mxStackLayout === 'undefined' || mxStackLayout.prototype.__esatic) return
  var execute = mxStackLayout.prototype.execute
  mxStackLayout.prototype.execute = function () {
    if (!this.horizontal && this.resizeParent) {
      this.resizeParentMax = true
      this.resizeLast = true
    }
    return execute.apply(this, arguments)
  }
  mxStackLayout.prototype.__esatic = true
})()

// Saisie fluide (ESATIC) :
// - la forme suit le texte : pendant la frappe, elle grandit toute seule (en hauteur si le texte va à la ligne,
//   sinon en largeur) ; elle ne rétrécit jamais sous le texte ;
// - poignées de redimensionnement plus grandes, faciles à attraper à la souris ou au pavé tactile ;
// - pas d'assistant d'écriture du navigateur (Edge / Copilot, correcteur) : il ouvrirait une fenêtre de connexion
//   qui fait sortir de l'épreuve.
;(function () {
  if (typeof mxCellEditor === 'undefined' || mxCellEditor.prototype.__esaticGrow) return
  mxCellEditor.prototype.__esaticGrow = true

  var NO_ASSIST = { writingsuggestions: 'false', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', 'data-gramm': 'false', 'data-ms-editor': 'false' }
  function noAssist(el) {
    if (!el || !el.setAttribute) return
    for (var k in NO_ASSIST) el.setAttribute(k, NO_ASSIST[k])
  }
  noAssist(document.documentElement)
  // Tous les champs de saisie de draw.io, y compris ceux créés plus tard (dialogues, recherche...)
  try {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var added = list[i].addedNodes
        for (var j = 0; j < added.length; j++) {
          var n = added[j]
          if (n.nodeType !== 1) continue
          if (n.matches && n.matches('input, textarea, [contenteditable]')) noAssist(n)
          if (n.querySelectorAll) n.querySelectorAll('input, textarea, [contenteditable]').forEach(noAssist)
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true })
  } catch (e) { /* navigateur ancien */ }

  // Poignées plus grandes
  if (typeof mxConstants !== 'undefined') {
    mxConstants.HANDLE_SIZE = 11
    mxConstants.LABEL_HANDLE_SIZE = 9
  }
  if (typeof mxVertexHandler !== 'undefined') mxVertexHandler.prototype.tolerance = 10

  // La forme grandit avec le texte pendant la frappe
  function grow(editor) {
    var graph = editor.graph
    var cell = editor.getEditingCell && editor.getEditingCell()
    var ta = editor.textarea
    if (!graph || !cell || !ta || !graph.model.isVertex(cell)) return
    var geo = graph.getCellGeometry(cell)
    if (!geo || geo.relative) return
    var style = graph.getCellStyle(cell) || {}
    var scale = graph.view.scale || 1
    var wrap = style.whiteSpace === 'wrap' || style.html === '1'
    var container = style.childLayout === 'stackLayout' || style.shape === 'swimlane' || style.shape === 'table'
    var pad = 10
    var needH = Math.ceil(ta.scrollHeight / scale) + pad
    var needW = Math.ceil(ta.scrollWidth / scale) + pad
    var w = geo.width
    var h = geo.height
    if (container) {
      // En-tête d'une classe UML, d'une table ou d'une entité : seulement la largeur
      if (needW > w) w = needW
    } else {
      if (wrap) { if (needH > h) h = needH } else { if (needW > w) w = needW; if (needH > h) h = needH }
    }
    if (w > geo.width + 1 || h > geo.height + 1) {
      geo = geo.clone()
      geo.width = w
      geo.height = h
      graph.model.setGeometry(cell, geo)
      if (editor.resize) editor.resize()
    }
  }

  var start = mxCellEditor.prototype.startEditing
  mxCellEditor.prototype.startEditing = function () {
    var r = start.apply(this, arguments)
    var editor = this
    var ta = this.textarea
    noAssist(ta)
    if (ta && !ta.__esaticGrow) {
      ta.__esaticGrow = true
      var timer = null
      ta.addEventListener('input', function () {
        clearTimeout(timer)
        timer = setTimeout(function () { try { grow(editor) } catch (e) { /* forme particulière */ } }, 40)
      })
    }
    return r
  }
})()
