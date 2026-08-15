// @vitest-environment jsdom
/**
 * AppFrame interaction spec under the four-share props form: real layout
 * store instance, a recording renderSlot stub, and a render-prop
 * SessionProvider stub. Drag sequences, concession response to viewport
 * change, and zero-width columns staying mounted are the preserved
 * behavior assertions. jsdom has no layout engine, so the frame size
 * comes from a mocked getBoundingClientRect and ResizeObserver stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { AppFrame } from '@deepseek-ai/dsh-client-ui-layout/src/client/AppFrame.tsx'
import type { AppFrameProps } from '@deepseek-ai/dsh-client-ui-layout/src/client/AppFrame.tsx'
import {
  ACTIVITY_WIDTH, CONVERSATION_DEFAULT, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, WORKBENCH_DEFAULT,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'
import { createLayoutStore } from '@deepseek-ai/dsh-client-ui-layout/src/client/stores.ts'
import type {
  SessionId, SessionListState, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'

const selectedSession = { current: 's-test' as SessionId | undefined }
const selectedSessionBlank = { current: false }
const baselinesReady = { current: true }

const SessionProviderStub: AppFrameProps['SessionProvider'] = ({ children, empty }) =>
  selectedSession.current === undefined ? <>{empty?.() ?? null}</> : <>{children(selectedSession.current)}</>

let fireResize: (() => void) | null = null
class ResizeObserverStub {
  #cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) { this.#cb = cb }
  observe(): void { fireResize = () => { this.#cb([], this) } }
  unobserve(): void {}
  disconnect(): void { fireResize = null }
}

let frameWidth = 1920
let frameHeight = 1080

function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S { return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot)) }
}

function mountFrame() {
  window.innerWidth = frameWidth
  window.innerHeight = frameHeight
  const instance = createLayoutStore().create()
  const slotCalls: { key: string; props: unknown }[] = []
  const renderSlot = ((key: string, owner: object) => {
    slotCalls.push({ key, props: owner })
    if (key === 'sidebar') return <div data-testid="sidebar-content" />
    if (key === 'conversation') return <div data-testid="center-content" />
    if (key === 'details') return <div data-testid="details-content" />
    if (key === 'workbench') return <div data-testid="workbench-content" />
    if (key === 'activityBar') return <div data-testid="activity-content" />
    if (key === 'primarySidebar') return <div data-testid="primary-content" />
    if (key === 'bottomPanel') return <div data-testid="bottom-content" />
    return <div data-testid="other-content" />
  }) as AppFrameProps['renderSlot']
  const useSessions = ((sel: (s: SessionListState) => unknown) => {
    const current = selectedSession.current
    const sessionState = {
      ids: current === undefined ? [] : [current],
      byId: current === undefined
        ? {}
        : { [current]: { id: current, displayTitle: 'Test', running: false, blank: selectedSessionBlank.current, updatedAt: 1 } },
      current,
      phase: 'ready',
    } as SessionListState
    return sel(sessionState)
  }) as never
  const workspaceState: WorkspaceListState = {
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: baselinesReady.current, recentWorkspaceId: undefined,
  }
  const element = () => (
    <AppFrame
      useStore={hookOf(instance)}
      actions={instance.actions}
      renderSlot={renderSlot}
      useSessions={useSessions}
      useWorkspaces={((sel: (s: WorkspaceListState) => unknown) => sel(workspaceState)) as never}
      SessionProvider={SessionProviderStub}
    />
  )
  const utils = render(element())
  const frame = utils.container.firstElementChild as HTMLElement
  return { instance, frame, slotCalls, rerenderFrame: () => { utils.rerender(element()) }, ...utils }
}

/** activity, primary, conversation, details, sidebar */
function tracks(frame: HTMLElement): number[] {
  const m = /^(\d+)px (\d+)px minmax\(0, 1fr\) (\d+)px (\d+)px (\d+)px$/.exec(frame.style.gridTemplateColumns)
  if (m === null) throw new Error(`unexpected template: ${frame.style.gridTemplateColumns}`)
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]
}

function row(frame: HTMLElement): number {
  const m = /^minmax\(0, 1fr\) (\d+)px$/.exec(frame.style.gridTemplateRows)
  if (m === null) throw new Error(`unexpected rows: ${frame.style.gridTemplateRows}`)
  return Number(m[1])
}

const DEFAULT_TRACKS = [ACTIVITY_WIDTH, WORKBENCH_DEFAULT, CONVERSATION_DEFAULT, 0, SIDEBAR_DEFAULT]

function drag(handle: Element, from: number, to: number, axis: 'x' | 'y' = 'x'): void {
  const down = new PointerEvent('pointerdown', {
    pointerId: 1, clientX: axis === 'x' ? from : 0, clientY: axis === 'y' ? from : 0, bubbles: true,
  })
  const move = new PointerEvent('pointermove', {
    pointerId: 1, clientX: axis === 'x' ? to : 0, clientY: axis === 'y' ? to : 0, bubbles: true,
  })
  const up = new PointerEvent('pointerup', {
    pointerId: 1, clientX: axis === 'x' ? to : 0, clientY: axis === 'y' ? to : 0, bubbles: true,
  })
  act(() => { handle.dispatchEvent(down) })
  act(() => { handle.dispatchEvent(move); vi.advanceTimersByTime(20) })
  act(() => { handle.dispatchEvent(up) })
}

function handleOf(frame: HTMLElement, side: string): Element {
  const found = [...frame.querySelectorAll('[data-side]')].find(el => el.getAttribute('data-side') === side)
  if (found === undefined) throw new Error(`missing handle ${side}`)
  return found
}

beforeEach(() => {
  frameWidth = 1920
  frameHeight = 1080
  selectedSession.current = 's-test' as SessionId
  selectedSessionBlank.current = false
  baselinesReady.current = true
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => { cb(0) }, 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (h: number) => { clearTimeout(h) })
  window.innerWidth = frameWidth
  window.innerHeight = frameHeight
  Element.prototype.getBoundingClientRect = function () {
    return {
      width: frameWidth, height: frameHeight, top: 0, left: 0,
      right: frameWidth, bottom: frameHeight, x: 0, y: 0, toJSON: () => ({}),
    }
  }
  const captured = new WeakSet<Element>()
  Element.prototype.setPointerCapture = function () { captured.add(this) }
  Element.prototype.releasePointerCapture = function () { captured.delete(this) }
  Element.prototype.hasPointerCapture = function () { return captured.has(this) }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('AppFrame', () => {
  it('renders six column tracks from store state', () => {
    const { frame } = mountFrame()
    expect(tracks(frame)).toEqual(DEFAULT_TRACKS)
    expect(row(frame)).toBe(0)
  })

  it('renders the session pair with empty owner shares (sessionId is framework-standard)', () => {
    const { slotCalls, getByTestId } = mountFrame()
    expect(getByTestId('center-content')).toBeTruthy()
    expect(getByTestId('details-content')).toBeTruthy()
    expect(getByTestId('workbench-content')).toBeTruthy()
    expect(getByTestId('activity-content')).toBeTruthy()
    expect(getByTestId('primary-content')).toBeTruthy()
    expect(getByTestId('bottom-content')).toBeTruthy()
    const keys = slotCalls.map(c => c.key)
    expect(keys).toContain('conversation')
    expect(keys).toContain('details')
    expect(keys).toContain('workbench')
    expect(keys).toContain('activityBar')
    expect(keys).toContain('primarySidebar')
    expect(keys).toContain('bottomPanel')
    expect(slotCalls.find(c => c.key === 'conversation')!.props).toEqual({})
    expect(slotCalls.find(c => c.key === 'details')!.props).toEqual({})
    expect(slotCalls.find(c => c.key === 'workbench')!.props).toEqual({
      width: 1920 - ACTIVITY_WIDTH - WORKBENCH_DEFAULT - CONVERSATION_DEFAULT - SIDEBAR_DEFAULT,
    })
    expect(slotCalls.find(c => c.key === 'activityBar')!.props).toEqual({ primaryOpen: true, bottomOpen: false })
    expect(slotCalls.find(c => c.key === 'primarySidebar')!.props).toEqual({ width: WORKBENCH_DEFAULT })
    expect(slotCalls.find(c => c.key === 'bottomPanel')!.props).toEqual({ height: 0 })
  })

  it('keeps the conversation slot mounted while no session is current', () => {
    selectedSession.current = undefined
    const { slotCalls, getByTestId, frame } = mountFrame()
    expect(getByTestId('center-content')).toBeTruthy()
    expect(slotCalls.map(c => c.key)).toContain('conversation')
    expect(tracks(frame)).toEqual([ACTIVITY_WIDTH, 0, CONVERSATION_DEFAULT, 0, SIDEBAR_DEFAULT])
  })

  it('renders both column occupants before baselines settle (no loading gate)', () => {
    baselinesReady.current = false
    const { slotCalls } = mountFrame()
    expect(slotCalls.map(c => c.key)).toContain('conversation')
    expect(slotCalls.map(c => c.key)).toContain('details')
  })

  it('ignores unselected states and closes only when the Session id changes', () => {
    const { frame, instance, rerenderFrame } = mountFrame()
    expect(tracks(frame)).toEqual(DEFAULT_TRACKS)

    act(() => { instance.actions.openDetails() })
    expect(tracks(frame)[3]).toBe(360)

    selectedSession.current = 's-next' as SessionId
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(0)

    act(() => { instance.actions.openDetails() })
    selectedSession.current = 's-blank' as SessionId
    selectedSessionBlank.current = true
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(0)
    expect(instance.getSnapshot().details).toBe(360)

    selectedSession.current = 's-next' as SessionId
    selectedSessionBlank.current = false
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(360)

    selectedSession.current = undefined
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(0)
    selectedSession.current = 's-test' as SessionId
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(0)
  })

  it('keeps details closed when the first Session materializes', () => {
    selectedSession.current = undefined
    const { frame, instance, rerenderFrame } = mountFrame()
    expect(instance.getSnapshot().details).toBe(0)
    selectedSession.current = 's-first' as SessionId
    act(() => { rerenderFrame() })
    expect(tracks(frame)[3]).toBe(0)
  })

  it('sidebar slot receives live concession output as owner props', () => {
    const { slotCalls } = mountFrame()
    expect(slotCalls.find(c => c.key === 'sidebar')!.props).toEqual({ collapsed: false, width: 280 })
  })

  it('sidebar drag widens leftward through rAF-batched pointer moves', () => {
    const { frame } = mountFrame()
    drag(handleOf(frame, 'sidebar'), 1920 - 280, 1920 - 350)
    expect(tracks(frame)[4]).toBe(350)
  })

  it('primary drag widens rightward', () => {
    const { frame } = mountFrame()
    drag(handleOf(frame, 'primary'), ACTIVITY_WIDTH + WORKBENCH_DEFAULT, ACTIVITY_WIDTH + WORKBENCH_DEFAULT + 40)
    expect(tracks(frame)[1]).toBe(WORKBENCH_DEFAULT + 40)
  })

  it('conversation drag widens leftward', () => {
    const { frame } = mountFrame()
    const editor = 1920 - ACTIVITY_WIDTH - WORKBENCH_DEFAULT - CONVERSATION_DEFAULT - SIDEBAR_DEFAULT
    const left = ACTIVITY_WIDTH + WORKBENCH_DEFAULT + editor
    drag(handleOf(frame, 'conversation'), left, left - 60)
    expect(tracks(frame)[2]).toBe(CONVERSATION_DEFAULT + 60)
  })

  it('details drag widens leftward (negative dx grows the panel)', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.openDetails() })
    const editor = 1920 - ACTIVITY_WIDTH - WORKBENCH_DEFAULT - CONVERSATION_DEFAULT - 360 - SIDEBAR_DEFAULT
    const left = ACTIVITY_WIDTH + WORKBENCH_DEFAULT + editor + CONVERSATION_DEFAULT
    drag(handleOf(frame, 'details'), left, left - 60)
    expect(tracks(frame)[3]).toBe(420)
  })

  it('bottom drag grows upward', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.openBottom() })
    expect(row(frame)).toBe(200)
    drag(handleOf(frame, 'bottom'), 1080 - 200, 1080 - 260, 'y')
    expect(row(frame)).toBe(260)
  })

  it('details column stays mounted at zero width', () => {
    const { frame, getByTestId } = mountFrame()
    expect(tracks(frame)[3]).toBe(0)
    expect(getByTestId('details-content')).toBeTruthy()
    expect(frame.hasAttribute('data-details-collapsed')).toBe(true)
  })

  it('closed sidebar keeps its compact rail with mounted slot content and collapsed owner props', () => {
    const { frame, instance, slotCalls, getByTestId } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)[4]).toBe(SIDEBAR_COLLAPSED)
    expect(getByTestId('sidebar-content')).toBeTruthy()
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(true)
    const lastSidebarCall = slotCalls.filter(c => c.key === 'sidebar').at(-1)!
    expect(lastSidebarCall.props).toEqual({ collapsed: true, width: SIDEBAR_COLLAPSED })
  })

  it('viewport shrink triggers the concession chain via ResizeObserver', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.openDetails() })
    expect(tracks(frame)[3]).toBe(360)
    frameWidth = 1700
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)[3]).toBeGreaterThan(0)
    expect(tracks(frame)[3]).toBeLessThan(360)
    frameWidth = 1920
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)[3]).toBe(360)
  })

  it('drag handles disappear for collapsed columns', () => {
    const { frame, instance } = mountFrame()
    expect(frame.querySelectorAll('[data-side]')).toHaveLength(3)
    act(() => { instance.actions.openDetails() })
    expect(frame.querySelectorAll('[data-side]')).toHaveLength(4)
    act(() => { instance.actions.closeDetails() })
    expect(frame.querySelectorAll('[data-side]')).toHaveLength(3)
    act(() => { instance.actions.toggleSidebar() })
    expect(frame.querySelectorAll('[data-side="sidebar"]')).toHaveLength(0)
    act(() => { instance.actions.openBottom() })
    expect(frame.querySelectorAll('[data-side="bottom"]')).toHaveLength(1)
  })

  it('editor column stays mounted and receives the resolved editor width', () => {
    const { frame, getByTestId, slotCalls } = mountFrame()
    expect(getByTestId('workbench-content')).toBeTruthy()
    expect(slotCalls.find(c => c.key === 'workbench')!.props).toEqual({
      width: 1920 - ACTIVITY_WIDTH - WORKBENCH_DEFAULT - CONVERSATION_DEFAULT - SIDEBAR_DEFAULT,
    })
    expect(frame.hasAttribute('data-primary-collapsed')).toBe(false)
  })

  it('does not close the primary sidebar when the Session id changes', () => {
    const { frame, instance, rerenderFrame } = mountFrame()
    expect(tracks(frame)[1]).toBe(WORKBENCH_DEFAULT)
    selectedSession.current = 's-next' as SessionId
    act(() => { rerenderFrame() })
    expect(tracks(frame)[1]).toBe(WORKBENCH_DEFAULT)
    expect(instance.getSnapshot().workbench).toBe(WORKBENCH_DEFAULT)
  })
})

describe('AppFrame — narrow-viewport auto-collapse', () => {
  it('mounts the session sidebar collapsed below the breakpoint', () => {
    frameWidth = 980
    const { frame, slotCalls } = mountFrame()
    expect(tracks(frame)[4]).toBe(SIDEBAR_COLLAPSED)
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(true)
    expect(slotCalls.filter(c => c.key === 'sidebar').at(-1)!.props).toEqual({
      collapsed: true, width: SIDEBAR_COLLAPSED,
    })
    expect(frame.querySelectorAll('[data-side="sidebar"]')).toHaveLength(0)
  })

  it('narrow toggle re-expands the session sidebar and back', () => {
    frameWidth = 980
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)[4]).toBe(SIDEBAR_DEFAULT)
    expect(frame.hasAttribute('data-sidebar-collapsed')).toBe(false)
    expect(frame.querySelectorAll('[data-side="sidebar"]')).toHaveLength(1)
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)[4]).toBe(SIDEBAR_COLLAPSED)
  })

  it('a wide-closed preference re-expands at the contract default while narrow', () => {
    frameWidth = 1920
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.toggleSidebar() })
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    act(() => { instance.actions.toggleSidebar() })
    expect(tracks(frame)[4]).toBe(SIDEBAR_DEFAULT)
    expect(instance.getSnapshot().sidebar).toBe(0)
  })

  it('shrinking across the breakpoint auto-collapses; re-widening restores the drag width', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.setSidebar(400) })
    frameWidth = 980
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)[4]).toBe(SIDEBAR_COLLAPSED)
    frameWidth = 1920
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)[4]).toBe(400)
  })
})

describe('AppFrame — guard branches', () => {
  it('pointer moves without capture are ignored (no width write)', () => {
    const { frame, instance } = mountFrame()
    const handle = handleOf(frame, 'sidebar')
    const before = instance.getSnapshot().sidebar
    act(() => {
      handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: 500, bubbles: true }))
      vi.advanceTimersByTime(20)
      handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: 500, bubbles: true }))
    })
    expect(instance.getSnapshot().sidebar).toBe(before)
  })

  it('two moves inside one frame coalesce through the pending rAF', () => {
    const { frame, instance } = mountFrame()
    const handle = handleOf(frame, 'sidebar')
    const origin = 1920 - 280
    act(() => { handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: origin, bubbles: true })) })
    act(() => {
      handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: origin - 40, bubbles: true }))
      handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: origin - 60, bubbles: true }))
      vi.advanceTimersByTime(20)
    })
    act(() => { handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: origin - 60, bubbles: true })) })
    expect(instance.getSnapshot().sidebar).toBe(340)
  })

  it('pointerup with a pending rAF cancels it and commits the final position', () => {
    const { frame, instance } = mountFrame()
    const handle = handleOf(frame, 'sidebar')
    const origin = 1920 - 280
    act(() => { handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: origin, bubbles: true })) })
    act(() => {
      handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: origin - 80, bubbles: true }))
      handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: origin - 80, bubbles: true }))
    })
    expect(instance.getSnapshot().sidebar).toBe(360)
  })

  it('zero-width resize reports are ignored (display:none window)', () => {
    const { frame } = mountFrame()
    frameWidth = 0
    act(() => { fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)).toEqual(DEFAULT_TRACKS)
  })
})

describe('AppFrame — unmount with an in-flight resize frame', () => {
  it('cancels the pending rAF on unmount (no post-unmount setState)', () => {
    const { unmount } = mountFrame()
    frameWidth = 800
    act(() => { fireResize?.() })
    unmount()
    expect(() => { vi.advanceTimersByTime(20) }).not.toThrow()
  })

  it('double resize inside one frame rides the pending rAF (??= guard)', () => {
    const { frame, instance } = mountFrame()
    act(() => { instance.actions.openDetails() })
    frameWidth = 1700
    act(() => { fireResize?.(); fireResize?.(); vi.advanceTimersByTime(20) })
    expect(tracks(frame)[3]).toBeGreaterThan(0)
    expect(tracks(frame)[3]).toBeLessThan(360)
  })
})
