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
  computeBottom, computeColumns, SIDEBAR_AUTO_COLLAPSE, SIDEBAR_DEFAULT,
} from './columns.ts'
import type { createLayoutStore } from './stores.ts'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<
    | 'activityBar' | 'primarySidebar' | 'workbench' | 'bottomPanel'
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
  const detailsSession = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
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
        if (box.width > 0) setViewport({ width: box.width, height: box.height })
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
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])
  const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const sessionPanels = detailsSession !== undefined
  // Conversation has no close action (setConversation clamps to CONVERSATION_MIN);
  // concession in computeColumns is what visually collapses it.
  const cols = computeColumns(
    viewport.width,
    sidebarPreference,
    sessionPanels ? panels.details : 0,
    sessionPanels ? panels.workbench : 0,
    panels.conversation,
  )
  const bottom = sessionPanels ? computeBottom(viewport.height, panels.bottom) : 0
  const colsRef = useRef(cols)
  colsRef.current = cols
  const bottomRef = useRef(bottom)
  bottomRef.current = bottom

  const primaryBase = useRef(0)
  const conversationBase = useRef(0)
  const detailsBase = useRef(0)
  const sidebarBase = useRef(0)
  const bottomBase = useRef(0)
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onPrimaryStart = useCallback(() => { primaryBase.current = colsRef.current.primary; setDragging(true) }, [])
  const onConversationStart = useCallback(() => { conversationBase.current = colsRef.current.conversation; setDragging(true) }, [])
  const onDetailsStart = useCallback(() => { detailsBase.current = colsRef.current.details; setDragging(true) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onBottomStart = useCallback(() => { bottomBase.current = bottomRef.current; setDragging(true) }, [])
  const onPrimaryDrag = useCallback((dx: number) => {
    actions.setWorkbench(primaryBase.current + dx)
  }, [actions])
  const onConversationDrag = useCallback((dx: number) => {
    actions.setConversation(conversationBase.current - dx)
  }, [actions])
  const onDetailsDrag = useCallback((dx: number) => {
    actions.setDetails(detailsBase.current - dx)
  }, [actions])
  const onSidebarDrag = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current - dx)
  }, [actions])
  const onBottomDrag = useCallback((dy: number) => {
    actions.setBottom(bottomBase.current - dy)
  }, [actions])

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
        gridTemplateRows: `minmax(0, 1fr) ${bottom}px`,
      }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-details-collapsed={cols.details === 0 || undefined}
      data-primary-collapsed={cols.primary === 0 || undefined}
      data-conversation-collapsed={cols.conversation === 0 || undefined}
      data-bottom-collapsed={bottom === 0 || undefined}
      data-dragging={dragging || undefined}
    >
      <div className={css.activityCol}>
        {renderSlot('activityBar', {
          primaryOpen: cols.primary > 0,
          bottomOpen: bottom > 0,
        })}
      </div>
      <PrimaryColumn>
        {renderSlot('primarySidebar', { width: sessionPanels ? cols.primary : 0 })}
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
