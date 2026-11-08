import { useEffect, useRef } from 'react'
import { internalClipboard } from './clipboard.js'

// Surveillance pendant la composition. Chaque comportement est enregistré dans le journal ;
// l'étudiant reçoit un message calme. Les sorties (plein écran, autre onglet, bouton Retour) sont
// remontées à la page, qui applique la règle de l'épreuve (avertissement puis envoi de la copie).
export function useExamGuard({ active, blockPaste, requireFullscreen, onEvent, onCalm, onFullscreenLost }) {
  const cb = useRef({ onEvent, onCalm, onFullscreenLost })
  useEffect(() => {
    cb.current = { onEvent, onCalm, onFullscreenLost }
  }, [onEvent, onCalm, onFullscreenLost])

  useEffect(() => {
    if (!active) return
    const log = (type, detail) => cb.current.onEvent(type, detail)
    const calm = (msg) => cb.current.onCalm(msg)
    const inAnswer = (el) => el instanceof Element && !!el.closest('.answer-zone')

    function selectedTextOf(el) {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        return el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? 0)
      }
      return ''
    }

    function onCopy(e) {
      if (!blockPaste) return
      if (inAnswer(e.target)) {
        // Champ texte : on retient la sélection. Éditeur : géré par CodeEditor.
        const t = selectedTextOf(e.target)
        if (t) internalClipboard.set(t)
        return
      }
      e.preventDefault()
      log('copy_blocked')
      calm('La copie du sujet n\'est pas disponible pendant l\'épreuve.')
    }

    function onPaste(e) {
      if (!blockPaste) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (inAnswer(e.target) && internalClipboard.matches(text)) {
        internalClipboard.markAllowed()
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      log('paste_blocked', { length: text.length })
      calm('Le collage depuis l\'extérieur n\'est pas autorisé. Vous pouvez coller ce que vous avez copié dans vos réponses.')
    }

    function onDrop(e) {
      if (!blockPaste) return
      e.preventDefault()
      e.stopImmediatePropagation()
      log('drop_blocked')
    }
    const onDragOver = (e) => blockPaste && e.preventDefault()

    function onContextMenu(e) {
      if (!blockPaste) return
      e.preventDefault()
      log('contextmenu_blocked')
    }

    function onKeyDown(e) {
      const k = e.key.toLowerCase()
      const devtools = e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')
      if (devtools) {
        e.preventDefault()
        log('devtools_key', { key: e.key })
        return
      }
      if (e.ctrlKey && (k === 'p' || k === 's')) e.preventDefault() // impression / enregistrement de la page
    }

    // Rechargement ou fermeture de la page (coupure, F5) : le navigateur quitte le plein écran et cache
    // l'onglet, mais ce n'est pas une sortie de l'épreuve. L'étudiant doit pouvoir reprendre sa copie.
    let unloading = false
    let unloadTimer = null
    function onBeforeUnload() {
      unloading = true
      clearTimeout(unloadTimer)
      // Si l'étudiant annule la fermeture, on revient à la normale (et on l'invite à repasser en plein écran)
      unloadTimer = setTimeout(() => {
        unloading = false
        if (requireFullscreen && !document.fullscreenElement) cb.current.onFullscreenLost()
      }, 1500)
    }
    function onPageHide() {
      unloading = true
    }

    let hiddenAt = 0
    function onVisibility() {
      if (unloading) return
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        log('tab_hidden')
      } else if (hiddenAt) {
        const away = Math.round((Date.now() - hiddenAt) / 1000)
        hiddenAt = 0
        calm('Restez sur la page de l\'épreuve.')
        log('tab_visible', { seconds: away })
      }
    }

    // Fenêtre qui perd le focus (Alt+Tab vers une autre application...). Si l'étudiant ne revient pas
    // dans les 2 secondes, c'est une sortie. Le focus passé dans l'aperçu HTML (iframe) n'est pas une sortie.
    let lastBlur = 0
    let leftTimer = null
    function onBlur() {
      setTimeout(() => {
        if (unloading || document.activeElement?.tagName === 'IFRAME') return
        if (document.visibilityState !== 'visible') return // déjà compté comme changement d'onglet
        if (Date.now() - lastBlur > 3000) {
          lastBlur = Date.now()
          log('window_blur')
        }
        clearTimeout(leftTimer)
        leftTimer = setTimeout(() => {
          if (!document.hasFocus() && document.visibilityState === 'visible' && !unloading) {
            log('window_left')
            calm('Restez sur la fenêtre de l\'épreuve.')
          }
        }, 2000)
      }, 150)
    }
    function onFocus() {
      clearTimeout(leftTimer)
    }

    function onFullscreen() {
      if (unloading) return
      if (requireFullscreen && !document.fullscreenElement) {
        log('fullscreen_exit')
        cb.current.onFullscreenLost()
      }
    }

    document.addEventListener('copy', onCopy, true)
    document.addEventListener('cut', onCopy, true)
    document.addEventListener('paste', onPaste, true)
    document.addEventListener('drop', onDrop, true)
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('visibilitychange', onVisibility)
    // Bouton « Retour » du navigateur : on reste sur la copie et c'est compté comme une sortie
    window.history.pushState({ esaticExam: true }, '', window.location.href)
    function onPopState() {
      window.history.pushState({ esaticExam: true }, '', window.location.href)
      log('navigation_away')
      calm('Pour quitter, utilisez le bouton « Rendre ». La copie reste ouverte.')
    }

    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onBeforeUnload, true)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('focus', onFocus)
      clearTimeout(leftTimer)
      clearTimeout(unloadTimer)
      window.removeEventListener('beforeunload', onBeforeUnload, true)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('copy', onCopy, true)
      document.removeEventListener('cut', onCopy, true)
      document.removeEventListener('paste', onPaste, true)
      document.removeEventListener('drop', onDrop, true)
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('blur', onBlur)
      internalClipboard.clear()
    }
  }, [active, blockPaste, requireFullscreen])
}
