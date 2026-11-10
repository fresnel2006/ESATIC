
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
