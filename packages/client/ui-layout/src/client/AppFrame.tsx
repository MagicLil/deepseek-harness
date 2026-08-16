/**
 * Cursor-style shell frame, registered into the built-in 'root' slot.
 * Owns the grid tracks (activity | primary | editor | conversation |
 * details | sidebar, plus a bottom row under the editor), the drag
 * handles (pointer capture + rAF throttle), the concession chain
 * (columns.ts), and the child-slot render decisions. Pure component:
 * everything arrives through the three framework shares — zero cordis
 * or framework imports, zero self-made hooks.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  chromeMenuBarVisible, chromeTitleBarVisible, computeBottom, computeColumns,
  conversationToggleLabel, MENU_BAR_HEIGHT, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT, TITLE_BAR_HEIGHT,
} from './columns.ts'
import { applyFrameGeometry, frameGridRows, solveFramePaint, type FramePaintPrefs } from './frame-geometry.ts'
import type { createLayoutStore } from './stores.ts'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<
    | 'menuBar' | 'activityBar' | 'primarySidebar' | 'workbench' | 'bottomPanel'
    | 'conversation' | 'details' | 'sidebar' | 'shell.overlay'
  >
  & PropsStore<ReturnType<typeof createLayoutStore>>

/** Editor column grid item (session-body building block). */
function EditorColumn(props: { children?: ReactNode }) {
  return <div className={css.editorCol}>{props.children}</div>
}

/** Conversation column grid item. */
function ConversationColumn(props: { children?: ReactNode }) {
  return <div className={css.conversationCol}>{props.children}</div>
}

/** Details column grid item; width 0 keeps the subtree mounted (never unmount on close). */
function DetailsColumn(props: { children?: ReactNode }) {
  return <div className={css.detailsCol}>{props.children}</div>
}

/** Primary-sidebar grid item; width 0 keeps the subtree mounted. */
function PrimaryColumn(props: { children?: ReactNode }) {
  return <div className={css.primaryCol}>{props.children}</div>
}

/** Bottom-panel grid item; height 0 keeps the subtree mounted. */
function BottomColumn(props: { children?: ReactNode }) {
  return <div className={css.bottomCol}>{props.children}</div>
}

type HandleSide = 'primary' | 'conversation' | 'details' | 'sidebar' | 'bottom'

/** Title-track lockup. Drawn here so desktop does not depend on the
 *  web-shell seed table's BrandWordmark (that SVG used a 130px canvas
 *  and left a hole after 汇). Path matches ui-primitives x-mark. */
function TitleBrand() {
  return (
    <div className={css.titleBrand} data-testid="layout-title-brand">
      <svg width="36" height="22" viewBox="0 0 40 24" aria-hidden="true">
        <g fill="#5BB73B" fillRule="evenodd">
          <path d="M3 0h9l25 24H28zM28 0h9L12 24H3z" />
        </g>
      </svg>
      <span className={css.titleBrandName}>万物智汇</span>
    </div>
  )
}

/** Right-panel glyph: collapse/reveal the conversation column. */
function ConversationPanelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.25 2.2h11.5c.69 0 1.25.56 1.25 1.25v9.1c0 .69-.56 1.25-1.25 1.25H2.25C1.56 13.8 1 13.24 1 12.55v-9.1c0-.69.56-1.25 1.25-1.25Zm9.35 1.2h2.15c.14 0 .25.11.25.25v8.7c0 .14-.11.25-.25.25h-2.15v-9.2ZM2.25 3.4c-.14 0-.25.11-.25.25v8.7c0 .14.11.25.25.25h8.15v-9.2H2.25Z"
      />
    </svg>
  )
}

/** Chat-column toggle; sits in the desktop title track next to Minimize. */
function ConversationToggle(props: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={css.conversationToggle}
      data-testid="layout-conversation-toggle"
      data-open={props.open || undefined}
      aria-pressed={props.open}
      aria-label={conversationToggleLabel(props.open)}
      onClick={props.onToggle}
    >
      <ConversationPanelIcon />
    </button>
  )
}

/**
 * One drag handle: pointer capture, rAF-throttled delta reports against the
 * drag-start origin. `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props: {
  side: HandleSide
  left?: number
  top?: number
  width?: number
  axis?: 'x' | 'y'
  onStart: () => void
  onDrag: (delta: number) => void
  onEnd: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const axis = props.axis ?? 'x'
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = axis === 'x' ? e.clientX : e.clientY
    latest.current = origin.current
    // Arm the frame's [data-dragging] before the first width write so the
    // grid-template transition cannot interpolate the opening delta.
    e.currentTarget.parentElement?.setAttribute('data-dragging', '')
    callbacks.current.onStart()
    setDragging(true)
  }, [axis])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    latest.current = axis === 'x' ? e.clientX : e.clientY
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [axis])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      className={axis === 'y' ? css.handleRow : css.handle}
      style={{
        left: props.left,
        top: props.top,
        width: props.width,
      }}
      data-side={props.side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}

/** The Cursor-style frame (see module doc). */
export function AppFrame({
  useStore,
  useSessions,
  actions,
  renderSlot,
}: AppFrameProps) {
  const panels = useStore(s => s)
  const currentSession = useSessions(s => s.current)
  const detailsSession = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  const lastSession = useRef(detailsSession)
  useLayoutEffect(() => {
    if (detailsSession === undefined) return
    if (lastSession.current !== undefined && lastSession.current !== detailsSession) {
      actions.closeDetails()
    }
    lastSession.current = detailsSession
  }, [actions, detailsSession])

  const lastConversationSession = useRef(currentSession)
  useLayoutEffect(() => {
    if (currentSession !== undefined && lastConversationSession.current !== currentSession) {
      actions.openConversation()
    }
    lastConversationSession.current = currentSession
  }, [actions, currentSession])

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useEffect(() => {
    const el = frameRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
    if (el === null) return
    let raf: number | null = null
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        const box = el.getBoundingClientRect()
        if (box.width > 0 && !draggingRef.current) setViewport({ width: box.width, height: box.height })
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // Narrow viewports auto-collapse the session sidebar; the store mirror
  // keeps toggleSidebar's semantics right (narrow toggles flip the manual
  // re-expand override, stores.ts). Collapsed is decided here, so the
  // solver stays breakpoint-free.
  const narrow = viewport.width < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => {
    actions.setNarrow(narrow)
    actions.setFrameWidth(viewport.width)
  }, [actions, narrow, viewport.width])
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const workbenchPanels = currentSession !== undefined
  const cols = computeColumns(
    viewport.width,
    sidebarPreference,
    detailsSession !== undefined ? panels.details : 0,
    workbenchPanels ? panels.workbench : 0,
    panels.conversation,
  )
  const chromeMenu = chromeMenuBarVisible()
  const titleOverlay = chromeTitleBarVisible()
  const menuBarPx = chromeMenu ? MENU_BAR_HEIGHT : 0
  const titleBarPx = titleOverlay ? TITLE_BAR_HEIGHT : 0
  const bottom = workbenchPanels
    ? computeBottom(Math.max(0, viewport.height - menuBarPx - titleBarPx), panels.bottom)
    : 0
  const colsRef = useRef(cols)
  colsRef.current = cols
  const bottomRef = useRef(bottom)
  bottomRef.current = bottom

  const primaryBase = useRef(0)
  const conversationBase = useRef(0)
  const detailsBase = useRef(0)
  const sidebarBase = useRef(0)
  const bottomBase = useRef(0)
  const live = useRef<Partial<{
    workbench: number
    conversation: number
    details: number
    sidebar: number
    bottom: number
  }>>({})
  const prefsRef = useRef<FramePaintPrefs>({
    viewport,
    sidebar: sidebarPreference,
    details: panels.details,
    workbench: panels.workbench,
    conversation: panels.conversation,
    bottom: panels.bottom,
    workbenchPanels,
    detailsOn: detailsSession !== undefined,
    menuBarPx,
    titleBarPx,
  })
  prefsRef.current = {
    viewport,
    sidebar: sidebarPreference,
    details: panels.details,
    workbench: panels.workbench,
    conversation: panels.conversation,
    bottom: panels.bottom,
    workbenchPanels,
    detailsOn: detailsSession !== undefined,
    menuBarPx,
    titleBarPx,
  }

  const paintLive = useCallback(() => {
    const el = frameRef.current
    if (el === null) return
    const p = prefsRef.current
    const l = live.current
    const solved = solveFramePaint({
      ...p,
      sidebar: l.sidebar ?? p.sidebar,
      details: l.details ?? p.details,
      workbench: l.workbench ?? p.workbench,
      conversation: l.conversation ?? p.conversation,
      bottom: l.bottom ?? p.bottom,
      prefer: l.workbench !== undefined ? 'primary' : 'conversation',
    })
    applyFrameGeometry(el, solved, p.viewport, p.menuBarPx, p.titleBarPx)
  }, [])

  useLayoutEffect(() => {
    if (draggingRef.current) paintLive()
  })

  const onDragEnd = useCallback(() => {
    const l = live.current
    const p = prefsRef.current
    if (l.workbench !== undefined) {
      const solved = solveFramePaint({
        ...p,
        workbench: l.workbench,
        prefer: 'primary',
      })
      if (solved.cols.primary === 0) actions.closeWorkbench()
      else actions.setWorkbench(solved.cols.primary)
      if (solved.cols.conversation === 0) actions.closeConversation()
      else actions.setConversation(solved.cols.conversation)
    }
    else if (l.conversation !== undefined) actions.setConversation(l.conversation)
    if (l.details !== undefined) actions.setDetails(l.details)
    if (l.sidebar !== undefined) actions.setSidebar(l.sidebar)
    if (l.bottom !== undefined) actions.setBottom(l.bottom)
    live.current = {}
    draggingRef.current = false
    frameRef.current?.removeAttribute('data-dragging')
  }, [actions])
  const onPrimaryStart = useCallback(() => {
    primaryBase.current = colsRef.current.primary
    live.current = { workbench: primaryBase.current }
    draggingRef.current = true
  }, [])
  const onConversationStart = useCallback(() => {
    conversationBase.current = colsRef.current.conversation
    live.current = { conversation: conversationBase.current }
    draggingRef.current = true
  }, [])
  const onDetailsStart = useCallback(() => {
    detailsBase.current = colsRef.current.details
    live.current = { details: detailsBase.current }
    draggingRef.current = true
  }, [])
  const onSidebarStart = useCallback(() => {
    sidebarBase.current = colsRef.current.sidebar
    live.current = { sidebar: sidebarBase.current }
    draggingRef.current = true
  }, [])
  const onBottomStart = useCallback(() => {
    bottomBase.current = bottomRef.current
    live.current = { bottom: bottomBase.current }
    draggingRef.current = true
  }, [])
  const onPrimaryDrag = useCallback((dx: number) => {
    live.current = { workbench: primaryBase.current + dx }
    paintLive()
  }, [paintLive])
  const onConversationDrag = useCallback((dx: number) => {
    live.current = { conversation: conversationBase.current - dx }
    paintLive()
  }, [paintLive])
  const onDetailsDrag = useCallback((dx: number) => {
    live.current = { details: detailsBase.current - dx }
    paintLive()
  }, [paintLive])
  const onSidebarDrag = useCallback((dx: number) => {
    live.current = { sidebar: sidebarBase.current - dx }
    paintLive()
  }, [paintLive])
  const onBottomDrag = useCallback((dy: number) => {
    live.current = { bottom: bottomBase.current - dy }
    paintLive()
  }, [paintLive])

  const primaryLeft = cols.activity + cols.primary
  const conversationLeft = primaryLeft + cols.editor
  const detailsLeft = conversationLeft + cols.conversation
  const sidebarLeft = viewport.width - cols.sidebar

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{
        gridTemplateColumns: `${cols.activity}px ${cols.primary}px minmax(0, 1fr) ${cols.conversation}px ${cols.details}px ${cols.sidebar}px`,
        gridTemplateRows: frameGridRows(menuBarPx, bottom, titleBarPx),
      }}
      data-chrome-menu={chromeMenu || undefined}
      data-title-overlay={titleOverlay || undefined}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-details-collapsed={cols.details === 0 || undefined}
      data-primary-collapsed={cols.primary === 0 || undefined}
      data-conversation-collapsed={cols.conversation === 0 || undefined}
      data-bottom-collapsed={bottom === 0 || undefined}
    >
      {chromeMenu
        ? <div className={css.menuBar}>{renderSlot('menuBar', {})}</div>
        : null}
      <div className={css.activityCol}>
        {renderSlot('activityBar', {
          primaryOpen: cols.primary > 0,
          bottomOpen: bottom > 0,
        })}
      </div>
      <PrimaryColumn>
        {renderSlot('primarySidebar', { width: workbenchPanels ? cols.primary : 0 })}
      </PrimaryColumn>
      <EditorColumn>{renderSlot('workbench', { width: cols.editor })}</EditorColumn>
      <BottomColumn>{renderSlot('bottomPanel', { height: bottom })}</BottomColumn>
      <ConversationColumn>{renderSlot('conversation', {})}</ConversationColumn>
      <DetailsColumn>{renderSlot('details', {})}</DetailsColumn>
      <div className={css.sidebarCol}>
        {renderSlot('sidebar', {
          collapsed: sidebarCollapsed,
          width: cols.sidebar,
        })}
      </div>
      <div className={css.overlayLayer} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      {titleOverlay
        ? (
          <div className={css.titleBar} data-testid="layout-title-drag">
            <TitleBrand />
            <div className={css.titleMenu}>{renderSlot('menuBar', {})}</div>
            <div className={css.titleSpacer} />
            <ConversationToggle
              open={cols.conversation > 0}
              onToggle={() => { actions.toggleConversation() }}
            />
          </div>
        )
        : (
          <ConversationToggle
            open={cols.conversation > 0}
            onToggle={() => { actions.toggleConversation() }}
          />
        )}
      {cols.primary > 0 && (
        <DragHandle
          side="primary"
          left={primaryLeft}
          onStart={onPrimaryStart}
          onDrag={onPrimaryDrag}
          onEnd={onDragEnd}
        />
      )}
      {cols.conversation > 0 && (
        <DragHandle
          side="conversation"
          left={conversationLeft}
          onStart={onConversationStart}
          onDrag={onConversationDrag}
          onEnd={onDragEnd}
        />
      )}
      {cols.details > 0 && (
        <DragHandle
          side="details"
          left={detailsLeft}
          onStart={onDetailsStart}
          onDrag={onDetailsDrag}
          onEnd={onDragEnd}
        />
      )}
      {!sidebarCollapsed && (
        <DragHandle
          side="sidebar"
          left={sidebarLeft}
          onStart={onSidebarStart}
          onDrag={onSidebarDrag}
          onEnd={onDragEnd}
        />
      )}
      {bottom > 0 && (
        <DragHandle
          side="bottom"
          axis="y"
          left={primaryLeft}
          top={viewport.height - bottom}
          width={cols.editor}
          onStart={onBottomStart}
          onDrag={onBottomDrag}
          onEnd={onDragEnd}
        />
      )}
    </div>
  )
}
