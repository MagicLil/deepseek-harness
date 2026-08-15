// @vitest-environment jsdom
/**
 * createLayoutStore unit account: init shape, the action write set (clamp
 * inside actions), and the absence of browser persistence. Uses the
 * test-sanctioned path: factory self-call + .create() gives the
 * real engine instance (same create path as production).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createLayoutStore } from '@deepseek-ai/dsh-client-ui-layout/src/client/stores.ts'
import {
  BOTTOM_DEFAULT, BOTTOM_MAX, BOTTOM_MIN, computeColumns,
  CONVERSATION_DEFAULT, CONVERSATION_MAX, CONVERSATION_MIN,
  DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
  WORKBENCH_DEFAULT, WORKBENCH_MAX, WORKBENCH_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

const PERSIST_KEY = 'dsh.layout.panels'

const INIT = {
  sidebar: SIDEBAR_DEFAULT,
  details: 0,
  workbench: WORKBENCH_DEFAULT,
  conversation: CONVERSATION_DEFAULT,
  bottom: 0,
  frameWidth: 0,
  narrow: false,
  narrowExpanded: false,
}

beforeEach(() => { localStorage.clear() })

describe('createLayoutStore', () => {
  it('initializes the session sidebar and conversation open, primary open, details and bottom closed', () => {
    const { store } = createLayoutStore().create()
    expect(store.getSnapshot()).toEqual(INIT)
  })

  it('each create() is an independent instance (factory is not a singleton)', () => {
    const a = createLayoutStore().create()
    const b = createLayoutStore().create()
    a.actions.setSidebar(400)
    expect(b.store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)
  })

  it('setters clamp into the contract ranges', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(1)
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_MIN)
    actions.setSidebar(9999)
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_MAX)
    actions.setDetails(1)
    expect(store.getSnapshot().details).toBe(DETAILS_MIN)
    actions.setDetails(9999)
    expect(store.getSnapshot().details).toBe(DETAILS_MAX)
    actions.setWorkbench(1)
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_MIN)
    actions.setWorkbench(9999)
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_MAX)
    actions.setConversation(1)
    expect(store.getSnapshot().conversation).toBe(CONVERSATION_MIN)
    actions.setConversation(9999)
    expect(store.getSnapshot().conversation).toBe(CONVERSATION_MAX)
    actions.setBottom(1)
    expect(store.getSnapshot().bottom).toBe(BOTTOM_MIN)
    actions.setBottom(9999)
    expect(store.getSnapshot().bottom).toBe(BOTTOM_MAX)
  })

  it('toggleSidebar flips closed <-> contract default (drag width forgotten)', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(400)
    actions.toggleSidebar()
    expect(store.getSnapshot().sidebar).toBe(0)
    actions.toggleSidebar()
    expect(store.getSnapshot().sidebar).toBe(SIDEBAR_DEFAULT)
  })

  it('narrow toggleSidebar flips only the re-expand override; the width preference survives', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setSidebar(400)
    actions.setNarrow(true)
    actions.toggleSidebar()
    expect(store.getSnapshot()).toEqual({
      ...INIT, sidebar: 400, narrow: true, narrowExpanded: true,
    })
    actions.toggleSidebar()
    expect(store.getSnapshot().narrowExpanded).toBe(false)
    expect(store.getSnapshot().sidebar).toBe(400)
  })

  it('crossing the breakpoint drops the override; a same-value setNarrow keeps it', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setNarrow(true)
    actions.toggleSidebar()
    expect(store.getSnapshot().narrowExpanded).toBe(true)
    actions.setNarrow(true)
    expect(store.getSnapshot().narrowExpanded).toBe(true)
    actions.setNarrow(false)
    expect(store.getSnapshot()).toMatchObject({ narrow: false, narrowExpanded: false })
    actions.setNarrow(true)
    expect(store.getSnapshot().narrowExpanded).toBe(false)
  })

  it('openDetails uses the contract default, preserves an open width, and closeDetails zeroes', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openDetails()
    expect(store.getSnapshot().details).toBe(DETAILS_DEFAULT)
    actions.setDetails(500)
    actions.openDetails()
    expect(store.getSnapshot().details).toBe(500)
    actions.closeDetails()
    expect(store.getSnapshot().details).toBe(0)
  })

  it('openWorkbench uses the contract default, preserves an open width, and close/toggle forget the drag width', () => {
    const { store, actions } = createLayoutStore().create()
    actions.closeWorkbench()
    actions.openWorkbench()
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_DEFAULT)
    actions.setWorkbench(400)
    actions.openWorkbench()
    expect(store.getSnapshot().workbench).toBe(400)
    actions.closeWorkbench()
    expect(store.getSnapshot().workbench).toBe(0)
    actions.toggleWorkbench()
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_DEFAULT)
    actions.toggleWorkbench()
    expect(store.getSnapshot().workbench).toBe(0)
  })

  it('setFrameWidth records a live measure and ignores non-positive values', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setFrameWidth(0)
    expect(store.getSnapshot().frameWidth).toBe(0)
    actions.setFrameWidth(-10)
    expect(store.getSnapshot().frameWidth).toBe(0)
    actions.setFrameWidth(1920.4)
    expect(store.getSnapshot().frameWidth).toBe(1920)
  })

  it('openWorkbench with a measured frame still uses the default when leftover is generous', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setFrameWidth(1920)
    actions.closeWorkbench()
    actions.openWorkbench()
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_DEFAULT)
    expect(store.getSnapshot().conversation).toBe(CONVERSATION_DEFAULT)
  })

  it('openWorkbench reveals a conceded primary by shrinking a wide conversation', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setFrameWidth(1920)
    // 1100px sits in the concession window: explorer paints 0, a true 2/3 (1280) keeps a sliver.
    actions.setConversation(1100)
    expect(computeColumns(1920, SIDEBAR_DEFAULT, 0, WORKBENCH_DEFAULT, 1100).primary).toBe(0)
    actions.openWorkbench()
    const snap = store.getSnapshot()
    expect(snap.workbench).toBeGreaterThan(0)
    expect(snap.conversation).toBeLessThan(1100)
    expect(computeColumns(1920, snap.sidebar, snap.details, snap.workbench, snap.conversation).primary)
      .toBeGreaterThan(0)
    actions.setWorkbench(400)
    actions.openWorkbench()
    expect(store.getSnapshot().workbench).toBe(400)
  })

  it('toggleWorkbench reveals a conceded primary instead of closing the preference', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setFrameWidth(1920)
    actions.setConversation(1100)
    expect(store.getSnapshot().workbench).toBe(WORKBENCH_DEFAULT)
    actions.toggleWorkbench()
    const snap = store.getSnapshot()
    expect(computeColumns(1920, snap.sidebar, snap.details, snap.workbench, snap.conversation).primary)
      .toBeGreaterThan(0)
    actions.toggleWorkbench()
    expect(store.getSnapshot().workbench).toBe(0)
  })

  it('openWorkbench on a narrow auto-collapsed rail plans against the 56px rail', () => {
    const { store, actions } = createLayoutStore().create()
    actions.setNarrow(true)
    actions.setFrameWidth(980)
    actions.setConversation(600)
    actions.openWorkbench()
    const snap = store.getSnapshot()
    expect(computeColumns(980, 0, snap.details, snap.workbench, snap.conversation).primary)
      .toBeGreaterThan(0)
  })

  it('openWorkbench on a narrow re-expanded rail still plans against the default sidebar width', () => {
    const { store, actions } = createLayoutStore().create()
    actions.toggleSidebar()
    expect(store.getSnapshot().sidebar).toBe(0)
    actions.setNarrow(true)
    actions.toggleSidebar()
    actions.setFrameWidth(1920)
    actions.setConversation(1280)
    actions.openWorkbench()
    const snap = store.getSnapshot()
    expect(computeColumns(1920, SIDEBAR_DEFAULT, snap.details, snap.workbench, snap.conversation).primary)
      .toBeGreaterThan(0)
  })

  it('openBottom uses the contract default and close/toggle forget the drag height', () => {
    const { store, actions } = createLayoutStore().create()
    actions.openBottom()
    expect(store.getSnapshot().bottom).toBe(BOTTOM_DEFAULT)
    actions.setBottom(300)
    actions.openBottom()
    expect(store.getSnapshot().bottom).toBe(300)
    actions.closeBottom()
    expect(store.getSnapshot().bottom).toBe(0)
    actions.toggleBottom()
    expect(store.getSnapshot().bottom).toBe(BOTTOM_DEFAULT)
    actions.toggleBottom()
    expect(store.getSnapshot().bottom).toBe(0)
  })

  it('does not persist panel geometry', () => {
    const first = createLayoutStore().create()
    first.actions.setSidebar(400)
    first.actions.openDetails()
    first.actions.setDetails(500)
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

    const second = createLayoutStore().create()
    expect(second.store.getSnapshot()).toEqual(INIT)
  })
})
