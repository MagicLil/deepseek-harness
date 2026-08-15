/**
 * Monaco layout seat. Column drags on Windows/Electron clear the canvas if
 * the host box changes before the next paint; Cursor keeps the last frame
 * by not resizing the editor until the sash is released. We freeze the host
 * on sash pointerdown (capture, before AppFrame writes widths) and layout
 * once on pointerup.
 */

/** Editor instance face used by the layout binder (avoids the Monaco type). */
export interface LayoutEditor {
  layout: (dimension?: { width: number; height: number }) => void
}

/** True when the event started on an AppFrame drag handle. */
export function isSashTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-side]') !== null
}

/**
 * Observe `host` and keep the editor box in sync with its CSS size, except
 * while a sash drag is live — then the last painted frame is clipped.
 * @param editor - created Monaco editor.
 * @param host - the DOM node Monaco was created on.
 * @returns disposer (ResizeObserver + pointer listeners).
 */
export function bindEditorLayout(editor: LayoutEditor, host: HTMLElement): () => void {
  let lastW = -1
  let lastH = -1
  let frozen = false

  const paint = (): void => {
    if (frozen) return
    const width = host.clientWidth
    const height = host.clientHeight
    if (width < 1 || height < 1) return
    if (width === lastW && height === lastH) return
    lastW = width
    lastH = height
    editor.layout({ width, height })
  }

  const freeze = (): void => {
    if (frozen) return
    const width = host.clientWidth
    const height = host.clientHeight
    if (width < 1 || height < 1) return
    frozen = true
    host.style.width = `${String(width)}px`
    host.style.height = `${String(height)}px`
    host.style.flex = 'none'
  }

  const unfreeze = (): void => {
    if (!frozen) return
    frozen = false
    host.style.width = ''
    host.style.height = ''
    host.style.flex = ''
    lastW = -1
    lastH = -1
    paint()
  }

  const onDown = (event: PointerEvent): void => {
    if (isSashTarget(event.target)) freeze()
  }
  const onUp = (): void => { unfreeze() }

  const resize = new ResizeObserver(paint)
  resize.observe(host)
  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('pointerup', onUp, true)
  document.addEventListener('pointercancel', onUp, true)
  paint()
  return () => {
    resize.disconnect()
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('pointerup', onUp, true)
    document.removeEventListener('pointercancel', onUp, true)
    if (frozen) {
      host.style.width = ''
      host.style.height = ''
      host.style.flex = ''
    }
  }
}
