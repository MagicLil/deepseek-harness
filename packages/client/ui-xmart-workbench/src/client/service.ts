/**
 * XmartWorkbenchController: the `ctx.xmartWorkbench` registry and
 * per-session tab list. Registration is in-memory; tab lists and enable
 * maps persist in localStorage. The column reads snapshots through
 * {@link XmartWorkbenchController.observeSession} /
 * {@link XmartWorkbenchController.observeRegistry}.
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { matchFileViewer as matchViewer } from './match-viewer.ts'
import { basename, tabTypeForViewer } from './route-file.ts'
import {
  DEFAULT_ACTIVITY_ORDER,
  DEFAULT_TAB_ORDER,
  PREFS_PERSIST,
  TABS_PERSIST,
  XMART_WORKBENCH_FEATURES,
  XMART_WORKBENCH_VERSION,
  isPrimaryActivity,
  isBottomPanelTabType,
  type ActivityDescriptor,
  type FileViewerDescriptor,
  type OpenTabSeed,
  type SessionScope,
  type TabDescriptor,
  type WorkbenchMenuItem,
  type WorkbenchRegistrySnapshot,
  type WorkbenchSessionState,
  type WorkbenchTab,
  type WorkbenchView,
} from './types.ts'

/** Settings enable maps (absent key = enabled). */
type WorkbenchPrefs = {
  tabsEnabled: Record<string, boolean>
  viewersEnabled: Record<string, boolean>
}

const EMPTY_PREFS: WorkbenchPrefs = { tabsEnabled: {}, viewersEnabled: {} }

const EMPTY_STATE: WorkbenchSessionState = {
  tabs: [], activeTabId: null, nextSeq: 1, activity: 'explorer',
}

const ACTIVITY_ID = /^[a-z][a-z0-9-]*$/

/** Frozen empty view (same reference until a session is first written). */
export const EMPTY_WORKBENCH_VIEW: WorkbenchView = Object.freeze({
  ...EMPTY_STATE,
  menu: Object.freeze([] as WorkbenchMenuItem[]),
})

/**
 * The outward workbench face (`ctx.xmartWorkbench`): tab/viewer
 * registration, open/close/activate, file routing, and snapshots.
 */
export interface IXmartWorkbench {
  /**
   * Register a tab type. Duplicate ids throw.
   * @param descriptor - tab type to add.
   * @returns disposer that removes the type (open instances stay).
   */
  registerTab(descriptor: TabDescriptor): () => void
  /**
   * Register a file viewer. Duplicate ids throw.
   * @param descriptor - viewer to add.
   * @returns disposer that removes the viewer.
   */
  registerFileViewer(descriptor: FileViewerDescriptor): () => void
  /**
   * Register a primary-sidebar activity. Duplicate ids throw.
   * @param descriptor - activity to add.
   * @returns disposer that removes the activity (persist keeps the id).
   */
  registerActivity(descriptor: ActivityDescriptor): () => void
  /**
   * Open or focus a tab in a session. Settings-disabled types are a no-op.
   * `available` does not reject. Content seeds (`path` / `url`) open the column.
   * @param seed - type plus optional id/title/path/url.
   * @param scope - target session; defaults to the column-bound session.
   * @returns the focused tab id, or undefined when the open is refused.
   */
  openTab(seed: OpenTabSeed, scope?: SessionScope): string | undefined
  /**
   * Close a tab. Unknown ids are a no-op.
   * @param tabId - instance id.
   * @param scope - target session; defaults to the column-bound session.
   */
  closeTab(tabId: string, scope?: SessionScope): void
  /**
   * Focus a tab. Unknown ids are a no-op.
   * @param tabId - instance id.
   * @param scope - target session; defaults to the column-bound session.
   */
  activateTab(tabId: string, scope?: SessionScope): void
  /**
   * Open a file in the workbench. Matching picks `editor` / `image` /
   * `binary`; the column opens so the user can see it.
   * @param path - file path.
   * @param scope - target session; defaults to the column-bound session.
   * @param head - optional leading bytes forwarded to {@link matchFileViewer}.
   * @returns the focused tab id, or undefined when the open is refused.
   */
  openFile(path: string, scope?: SessionScope, head?: Uint8Array): string | undefined
  /**
   * Session snapshot (tabs, focus, derived `+` menu).
   * @param sessionId - session to read; defaults to the column-bound session.
   * @returns the view, or {@link EMPTY_WORKBENCH_VIEW} when no session is bound.
   */
  getSnapshot(sessionId?: string): WorkbenchView
  /**
   * Subscribe to registry, prefs, and any session change.
   * @param listener - called after a published change.
   * @returns unsubscribe.
   */
  subscribe(listener: () => void): () => void
  /**
   * Registered tab types in registration order (includes hidden and disabled).
   * @returns the live descriptor list.
   */
  getTabs(): readonly TabDescriptor[]
  /**
   * Registered file viewers in registration order (includes disabled).
   * @returns the live descriptor list.
   */
  getFileViewers(): readonly FileViewerDescriptor[]
  /**
   * Registered activities in registration order.
   * @returns the live descriptor list.
   */
  getActivities(): readonly ActivityDescriptor[]
  /**
   * Look up one activity.
   * @param id - activity id.
   * @returns the descriptor, or undefined.
   */
  getActivity(id: string): ActivityDescriptor | undefined
  /**
   * Look up one tab type.
   * @param id - type id.
   * @returns the descriptor, or undefined.
   */
  getTab(id: string): TabDescriptor | undefined
  /**
   * Settings enable check. Absent key and unknown ids are enabled.
   * @param id - tab type id.
   * @returns false only after an explicit disable.
   */
  isTabEnabled(id: string): boolean
  /**
   * Settings enable check for a viewer. Absent key and unknown ids are enabled.
   * @param id - viewer id.
   * @returns false only after an explicit disable.
   */
  isViewerEnabled(id: string): boolean
  /**
   * Match a path to an enabled viewer.
   * @param path - file path.
   * @param head - optional leading bytes for `detect`.
   * @returns the winning viewer, or undefined.
   */
  matchFileViewer(path: string, head?: Uint8Array): FileViewerDescriptor | undefined
  /**
   * Set the primary-sidebar activity for a session.
   * @param activity - registered or built-in activity id.
   * @param scope - target session; defaults to the column-bound session.
   */
  setActivity(activity: string, scope?: SessionScope): void
  /** Capability version. */
  readonly version: number
  /** Feature flags (`tabs`, `fileViewers`, `settingsToggles`). */
  readonly features: readonly string[]
}

/**
 * Resolve a string-or-thunk title.
 * @param title - descriptor title.
 * @returns the current string.
 */
function resolveTitle(title: string | (() => string)): string {
  return typeof title === 'function' ? title() : title
}

/**
 * Drop persist garbage at the localStorage boundary.
 * @param raw - value just read from the snapshot store.
 * @returns a well-formed session state.
 */
function sanitizeSession(raw: unknown): WorkbenchSessionState {
  if (raw === null || typeof raw !== 'object') return { ...EMPTY_STATE }
  const rec = raw as Record<string, unknown>
  const tabs = Array.isArray(rec.tabs) ? rec.tabs.filter(isTab) : []
  const active = typeof rec.activeTabId === 'string' && tabs.some(tab => tab.id === rec.activeTabId)
    ? rec.activeTabId
    : (tabs[tabs.length - 1]?.id ?? null)
  const nextSeq = typeof rec.nextSeq === 'number' && Number.isInteger(rec.nextSeq) && rec.nextSeq >= 1
    ? rec.nextSeq
    : 1
  const activity = typeof rec.activity === 'string' && ACTIVITY_ID.test(rec.activity)
    ? rec.activity
    : 'explorer'
  return { tabs, activeTabId: active, nextSeq, activity }
}

/**
 * Drop persist garbage for the enable maps.
 * @param raw - value just read from the prefs store.
 * @returns a well-formed prefs object.
 */
function sanitizePrefs(raw: unknown): WorkbenchPrefs {
  if (raw === null || typeof raw !== 'object') return { tabsEnabled: {}, viewersEnabled: {} }
  const rec = raw as Record<string, unknown>
  return {
    tabsEnabled: flagMap(rec.tabsEnabled),
    viewersEnabled: flagMap(rec.viewersEnabled),
  }
}

function flagMap(raw: unknown): Record<string, boolean> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

function isTab(value: unknown): value is WorkbenchTab {
  if (value === null || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  if (typeof rec.id !== 'string' || typeof rec.type !== 'string' || typeof rec.title !== 'string') {
    return false
  }
  return rec.path === undefined || typeof rec.path === 'string'
}

/** Cross-plugin workbench registry and per-session tab list (`ctx.xmartWorkbench`). */
export class XmartWorkbenchController implements IXmartWorkbench {
  readonly version = XMART_WORKBENCH_VERSION
  readonly features: readonly string[] = XMART_WORKBENCH_FEATURES

  readonly #tabs = new Map<string, TabDescriptor>()
  readonly #viewers = new Map<string, FileViewerDescriptor>()
  readonly #activities = new Map<string, ActivityDescriptor>()
  readonly #stores = new Map<string, SnapshotStore<WorkbenchSessionState>>()
  readonly #views = new Map<string, WorkbenchView>()
  readonly #sessionSources = new Map<string, HostObservable<WorkbenchView>>()
  readonly #listeners = new Set<() => void>()
  readonly #prefs: SnapshotStore<WorkbenchPrefs>
  #registryView: WorkbenchRegistrySnapshot = { tabs: [], viewers: [], activities: [] }
  readonly #registrySource: HostObservable<WorkbenchRegistrySnapshot> = {
    getSnapshot: () => this.#registryView,
    subscribe: fn => this.subscribe(fn),
  }
  #currentSession: string | undefined
  #openPanel: (() => void) | undefined

  /** Construct an empty registry with persisted prefs. */
  constructor() {
    this.#prefs = createSnapshotStore<WorkbenchPrefs>(EMPTY_PREFS, { persist: { name: PREFS_PERSIST } })
    this.#prefs.set(sanitizePrefs(this.#prefs.getSnapshot()))
    this.#publishRegistry()
  }

  /**
   * Remember which session the column is showing (used when callers omit scope).
   * @param sessionId - live session id from the workbench slot inject.
   */
  bindSession(sessionId: string): void {
    this.#currentSession = sessionId
  }

  /**
   * Adopt the layout open callback so a content `openTab` / `openFile` reveals
   * the column.
   * @param open - `ctx.layout.openWorkbench`.
   */
  attachPanel(open: () => void): void {
    this.#openPanel = open
  }

  /**
   * Stable per-session view source for the column inject `hooks` compartment.
   * @param sessionId - session to observe.
   * @returns a source whose object identity stays fixed for this session.
   */
  observeSession(sessionId: string): HostObservable<WorkbenchView> {
    this.#ensure(sessionId)
    let source = this.#sessionSources.get(sessionId)
    if (source === undefined) {
      source = {
        getSnapshot: () => {
          /* v8 ignore next -- #ensure publishes this session's view before the source is read. */
          return this.#views.get(sessionId) ?? EMPTY_WORKBENCH_VIEW
        },
        subscribe: fn => this.subscribe(fn),
      }
      this.#sessionSources.set(sessionId, source)
    }
    return source
  }

  /**
   * Stable registry source for the settings page and column.
   * @returns the registry observable.
   */
  observeRegistry(): HostObservable<WorkbenchRegistrySnapshot> {
    return this.#registrySource
  }

  /**
   * Write a tab-type enable flag (settings page).
   * @param id - tab type id.
   * @param enabled - false hides the type from `+` and refuses `openTab`.
   */
  setTabEnabled(id: string, enabled: boolean): void {
    if (this.isTabEnabled(id) === enabled) return
    this.#prefs.update((draft) => {
      draft.tabsEnabled[id] = enabled
    })
    this.#publishRegistry()
    this.#republishSessions()
    this.#notify()
  }

  /**
   * Write a viewer enable flag (settings page).
   * @param id - viewer id.
   * @param enabled - false skips the viewer in {@link matchFileViewer}.
   */
  setViewerEnabled(id: string, enabled: boolean): void {
    if (this.isViewerEnabled(id) === enabled) return
    this.#prefs.update((draft) => {
      draft.viewersEnabled[id] = enabled
    })
    this.#publishRegistry()
    this.#notify()
  }

  /** @inheritdoc */
  registerTab(descriptor: TabDescriptor): () => void {
    if (this.#tabs.has(descriptor.id)) {
      throw new Error(`tab type "${descriptor.id}" already registered`)
    }
    this.#tabs.set(descriptor.id, descriptor)
    this.#publishRegistry()
    this.#republishSessions()
    this.#notify()
    return () => {
      if (!this.#tabs.delete(descriptor.id)) return
      this.#publishRegistry()
      this.#republishSessions()
      this.#notify()
    }
  }

  /** @inheritdoc */
  registerFileViewer(descriptor: FileViewerDescriptor): () => void {
    if (this.#viewers.has(descriptor.id)) {
      throw new Error(`file viewer "${descriptor.id}" already registered`)
    }
    this.#viewers.set(descriptor.id, descriptor)
    this.#publishRegistry()
    this.#notify()
    return () => {
      if (!this.#viewers.delete(descriptor.id)) return
      this.#publishRegistry()
      this.#notify()
    }
  }

  /** @inheritdoc */
  registerActivity(descriptor: ActivityDescriptor): () => void {
    if (this.#activities.has(descriptor.id)) {
      throw new Error(`activity "${descriptor.id}" already registered`)
    }
    this.#activities.set(descriptor.id, descriptor)
    this.#publishRegistry()
    this.#republishSessions()
    this.#notify()
    return () => {
      if (!this.#activities.delete(descriptor.id)) return
      this.#publishRegistry()
      this.#republishSessions()
      this.#notify()
    }
  }

  /** @inheritdoc */
  openTab(seed: OpenTabSeed, scope?: SessionScope): string | undefined {
    const sessionId = this.#resolveSession(scope)
    if (sessionId === undefined) return undefined
    const descriptor = this.#tabs.get(seed.type)
    if (descriptor === undefined) return undefined
    if (!this.isTabEnabled(seed.type)) return undefined
    const state = this.#ensure(sessionId).getSnapshot()
    if (seed.id !== undefined) {
      const bySeed = state.tabs.find(existing => existing.id === seed.id)
      if (bySeed !== undefined) {
        this.#focus(sessionId, bySeed.id)
        this.#maybeOpenPanel(seed)
        return bySeed.id
      }
    }
    let tab: WorkbenchTab
    let patch: Pick<Partial<WorkbenchSessionState>, 'nextSeq'> | undefined
    if (descriptor.createTab !== undefined) {
      const minted = descriptor.createTab(state)
      if (minted === null) return undefined
      tab = overlayCreated(minted.tab, seed)
      patch = minted.patch
    }
    else {
      const path = seed.path ?? seed.url
      tab = {
        id: seed.id ?? `${seed.type}:${state.nextSeq}`,
        type: seed.type,
        title: seed.title ?? resolveTitle(descriptor.title),
        ...path !== undefined ? { path } : {},
      }
    }
    const existing = this.#findExisting(state.tabs, descriptor, tab)
    if (existing !== undefined) {
      this.#focus(sessionId, existing.id)
      this.#maybeOpenPanel(seed)
      return existing.id
    }
    this.#write(sessionId, (draft) => {
      if (descriptor.createTab === undefined && seed.id === undefined) draft.nextSeq += 1
      if (patch?.nextSeq !== undefined) draft.nextSeq = patch.nextSeq
      draft.tabs.push(tab)
      draft.activeTabId = tab.id
    })
    this.#maybeOpenPanel(seed)
    return tab.id
  }

  /** @inheritdoc */
  closeTab(tabId: string, scope?: SessionScope): void {
    const sessionId = this.#resolveSession(scope)
    if (sessionId === undefined) return
    const state = this.#ensure(sessionId).getSnapshot()
    const index = state.tabs.findIndex(tab => tab.id === tabId)
    if (index < 0) return
    this.#write(sessionId, (draft) => {
      draft.tabs.splice(index, 1)
      if (draft.activeTabId === tabId) {
        draft.activeTabId = draft.tabs[index - 1]?.id ?? draft.tabs[index]?.id ?? null
      }
    })
  }

  /** @inheritdoc */
  activateTab(tabId: string, scope?: SessionScope): void {
    const sessionId = this.#resolveSession(scope)
    if (sessionId === undefined) return
    const state = this.#ensure(sessionId).getSnapshot()
    if (!state.tabs.some(tab => tab.id === tabId)) return
    if (state.activeTabId === tabId) return
    this.#focus(sessionId, tabId)
  }

  /** @inheritdoc */
  openFile(path: string, scope?: SessionScope, head?: Uint8Array): string | undefined {
    const viewer = this.matchFileViewer(path, head)
    return this.openTab({ type: tabTypeForViewer(viewer?.id), path, title: basename(path) }, scope)
  }

  /** @inheritdoc */
  getSnapshot(sessionId?: string): WorkbenchView {
    const id = sessionId ?? this.#currentSession
    if (id === undefined) return EMPTY_WORKBENCH_VIEW
    this.#ensure(id)
    /* v8 ignore next -- #ensure publishes this session's view before the read. */
    return this.#views.get(id) ?? EMPTY_WORKBENCH_VIEW
  }

  /** @inheritdoc */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  /** @inheritdoc */
  getTabs(): readonly TabDescriptor[] {
    return [...this.#tabs.values()]
  }

  /** @inheritdoc */
  getFileViewers(): readonly FileViewerDescriptor[] {
    return [...this.#viewers.values()]
  }

  /** @inheritdoc */
  getActivities(): readonly ActivityDescriptor[] {
    return [...this.#activities.values()]
  }

  /** @inheritdoc */
  getActivity(id: string): ActivityDescriptor | undefined {
    return this.#activities.get(id)
  }

  /** @inheritdoc */
  getTab(id: string): TabDescriptor | undefined {
    return this.#tabs.get(id)
  }

  /** @inheritdoc */
  isTabEnabled(id: string): boolean {
    return this.#prefs.getSnapshot().tabsEnabled[id] !== false
  }

  /** @inheritdoc */
  isViewerEnabled(id: string): boolean {
    return this.#prefs.getSnapshot().viewersEnabled[id] !== false
  }

  /**
   * Set the primary-sidebar activity for a session.
   * @param activity - registered or built-in activity id.
   * @param scope - target session; defaults to the column-bound session.
   */
  setActivity(activity: string, scope?: SessionScope): void {
    const sessionId = this.#resolveSession(scope)
    if (sessionId === undefined) return
    const state = this.#ensure(sessionId).getSnapshot()
    if (state.activity === activity) return
    this.#write(sessionId, (draft) => {
      draft.activity = activity
    })
  }

  /**
   * Copy explorer activity and editor tabs onto another session in the
   * same project. Terminal tabs stay behind — their PTY is bound to the
   * source session. An existing target list is overwritten so switching
   * chats in the folder keeps the live editor.
   * @param fromId - session that currently has the open files.
   * @param toId - session that should show the same editor chrome.
   * @returns true when the target was written.
   */
  inheritSession(fromId: string, toId: string): boolean {
    if (fromId === toId) return false
    const from = this.#ensure(fromId).getSnapshot()
    const tabs = from.tabs.filter(tab => !isBottomPanelTabType(tab.type)).map(tab => ({ ...tab }))
    const active = tabs.some(tab => tab.id === from.activeTabId)
      ? from.activeTabId
      : (tabs[tabs.length - 1]?.id ?? null)
    this.#write(toId, (draft) => {
      draft.tabs = tabs
      draft.activeTabId = active
      draft.nextSeq = from.nextSeq
      draft.activity = from.activity
    })
    return true
  }

  /** @inheritdoc */
  matchFileViewer(path: string, head?: Uint8Array): FileViewerDescriptor | undefined {
    return matchViewer(
      [...this.#viewers.values()],
      id => this.isViewerEnabled(id),
      path,
      head,
    )
  }

  #resolveSession(scope?: SessionScope): string | undefined {
    return scope?.sessionId ?? this.#currentSession
  }

  #ensure(sessionId: string): SnapshotStore<WorkbenchSessionState> {
    let store = this.#stores.get(sessionId)
    if (store !== undefined) return store
    store = createSnapshotStore<WorkbenchSessionState>(
      { ...EMPTY_STATE },
      { persist: { name: `${TABS_PERSIST}.${sessionId}` } },
    )
    store.set(sanitizeSession(store.getSnapshot()))
    this.#stores.set(sessionId, store)
    this.#publishSession(sessionId)
    return store
  }

  #write(sessionId: string, mutator: (draft: WorkbenchSessionState) => void): void {
    this.#ensure(sessionId).update(mutator)
    this.#publishSession(sessionId)
    this.#notify()
  }

  #focus(sessionId: string, tabId: string): void {
    const state = this.#ensure(sessionId).getSnapshot()
    if (state.activeTabId === tabId) return
    this.#write(sessionId, (draft) => {
      draft.activeTabId = tabId
    })
  }

  #findExisting(
    tabs: readonly WorkbenchTab[],
    descriptor: TabDescriptor,
    incoming: WorkbenchTab,
  ): WorkbenchTab | undefined {
    const byId = tabs.find(tab => tab.id === incoming.id)
    if (byId !== undefined) return byId
    const keyFn = descriptor.dedupeKey ?? (descriptor.single === true
      ? opened => opened.type
      : undefined)
    if (keyFn === undefined) return undefined
    const incomingKey = keyFn(incoming)
    if (incomingKey === undefined) return undefined
    return tabs.find(tab => keyFn(tab) === incomingKey)
  }

  #maybeOpenPanel(seed: OpenTabSeed): void {
    if (seed.path === undefined && seed.url === undefined) return
    this.#openPanel?.()
  }

  #menuFor(sessionId: string, state: WorkbenchSessionState): WorkbenchMenuItem[] {
    const items: { item: WorkbenchMenuItem; order: number }[] = []
    for (const descriptor of this.#tabs.values()) {
      if (descriptor.hidden === true) continue
      if (!this.isTabEnabled(descriptor.id)) continue
      let disabled = false
      if (descriptor.available !== undefined) {
        try {
          disabled = !descriptor.available({ sessionId }, state)
        }
        catch {
          disabled = true
        }
      }
      items.push({
        order: descriptor.order ?? DEFAULT_TAB_ORDER,
        item: { id: descriptor.id, title: resolveTitle(descriptor.title), disabled },
      })
    }
    items.sort((a, b) => a.order - b.order)
    return items.map(row => row.item)
  }

  #publishSession(sessionId: string): void {
    const store = this.#stores.get(sessionId)
    /* v8 ignore next -- called after #ensure or while iterating #stores.keys(). */
    if (store === undefined) return
    const state = store.getSnapshot()
    const activity = isKnownActivity(state.activity, this.#activities)
      ? state.activity
      : 'explorer'
    this.#views.set(sessionId, { ...state, activity, menu: this.#menuFor(sessionId, state) })
  }

  #republishSessions(): void {
    for (const sessionId of this.#stores.keys()) this.#publishSession(sessionId)
  }

  #publishRegistry(): void {
    const activities = [...this.#activities.values()]
      .map(descriptor => ({
        id: descriptor.id,
        title: resolveTitle(descriptor.title),
        enabled: true,
        order: descriptor.order ?? DEFAULT_ACTIVITY_ORDER,
      }))
      .sort((a, b) => a.order - b.order)
    this.#registryView = {
      tabs: [...this.#tabs.values()].map(descriptor => ({
        id: descriptor.id,
        title: resolveTitle(descriptor.title),
        enabled: this.isTabEnabled(descriptor.id),
      })),
      viewers: [...this.#viewers.values()].map(descriptor => ({
        id: descriptor.id,
        title: descriptor.title !== undefined ? resolveTitle(descriptor.title) : descriptor.id,
        enabled: this.isViewerEnabled(descriptor.id),
      })),
      activities: activities.map(({ id, title, enabled }) => ({ id, title, enabled })),
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}

/**
 * Overlay seed title/url onto a createTab result (id/path from the seed are ignored).
 * @param tab - minted tab.
 * @param seed - caller seed.
 * @returns the tab with title/url overlays.
 */
/**
 * Built-in ids stay visible before registration; a registered id becomes
 * known as soon as its disposer is still live.
 * @param id - persist or setActivity value.
 * @param registered - live activity map.
 */
function isKnownActivity(id: string, registered: ReadonlyMap<string, ActivityDescriptor>): boolean {
  return isPrimaryActivity(id) || registered.has(id)
}

function overlayCreated(tab: WorkbenchTab, seed: OpenTabSeed): WorkbenchTab {
  let next = tab
  if (seed.title !== undefined) next = { ...next, title: seed.title }
  if (seed.url !== undefined) next = { ...next, path: seed.url }
  return next
}
