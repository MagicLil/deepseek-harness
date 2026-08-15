/**
 * Public types for `ctx.xmartWorkbench`: tab/viewer descriptors, session
 * snapshot, and the open-tab seed. Components never see ctx; a tab body
 * receives only this package's {@link TabBodyProps}.
 */
import type { ComponentType } from 'react'

/** Capability version published on the service (`IXmartWorkbench.version`). */
export const XMART_WORKBENCH_VERSION = 1

/** Feature flags published on the service (`IXmartWorkbench.features`). */
export const XMART_WORKBENCH_FEATURES = ['tabs', 'fileViewers', 'settingsToggles', 'activities'] as const

/** localStorage key prefix for per-session open tabs (`${TABS_PERSIST}.${sessionId}`). */
export const TABS_PERSIST = 'dsh.xmart.workbench.tabs'

/** localStorage key for the settings enable maps. */
export const PREFS_PERSIST = 'dsh.xmart.workbench.prefs'

/** Default `+` menu order when a descriptor omits `order`. */
export const DEFAULT_TAB_ORDER = 100

/** Default activity-bar order when a descriptor omits `order`. */
export const DEFAULT_ACTIVITY_ORDER = 100

/** Activity-bar views that live in the primary sidebar, not the editor tab bar. */
export const SHELL_TAB_TYPES = ['explorer', 'git', 'tasks', 'terminal'] as const

/** Max UI terminal tabs per session (host enforces the same cap). */
export const TERMINAL_TAB_LIMIT = 3

/**
 * Primary-sidebar activity id. Built-in ids stay `explorer` / `git` /
 * `tasks`; other plugins register more through `registerActivity`.
 */
export type ActivityId = string

/** Built-in activity ids that remain valid before any plugin registers. */
export const PRIMARY_ACTIVITIES = ['explorer', 'git', 'tasks'] as const

/** True when an id is a built-in primary-sidebar activity. */
export function isPrimaryActivity(id: string): id is typeof PRIMARY_ACTIVITIES[number] {
  return (PRIMARY_ACTIVITIES as readonly string[]).includes(id)
}

/** True when a tab type belongs on the activity bar / bottom panel, not the editor strip. */
export function isShellTabType(type: string): boolean {
  return (SHELL_TAB_TYPES as readonly string[]).includes(type)
}

/** Session identity the service methods accept (cwd arrives in a later phase). */
export type SessionScope = {
  /** Session whose workbench state the call reads or writes. */
  sessionId: string
}

/** One open tab instance in a session. */
export type WorkbenchTab = {
  /** Instance id (unique within the session). */
  id: string
  /** Registered tab type id. */
  type: string
  /** Tab-bar label. */
  title: string
  /** Optional path or URL payload (editor / file stub / browser seed). */
  path?: string
}

/** Durable per-session tab list (no derived `+` menu). */
export type WorkbenchSessionState = {
  /** Open tabs in bar order. */
  tabs: WorkbenchTab[]
  /** Focused tab id, or null when the bar is empty. */
  activeTabId: string | null
  /** Next default-mint counter (starts at 1). */
  nextSeq: number
  /** Primary-sidebar activity id (`explorer` until a plugin registers another). */
  activity: ActivityId
}

/** One `+` menu row (hidden and settings-disabled types are omitted). */
export type WorkbenchMenuItem = {
  /** Tab type id passed to `openTab`. */
  id: string
  /** Locale-resolved label. */
  title: string
  /** True when `available()` returned false (row stays visible but inert). */
  disabled: boolean
}

/** Session snapshot published to the column (state plus derived menu). */
export type WorkbenchView = WorkbenchSessionState & {
  /** `+` menu rows for this session, sorted by descriptor `order`. */
  menu: readonly WorkbenchMenuItem[]
}

/** Settings-page row for one registered tab or viewer type. */
export type WorkbenchRegistryRow = {
  /** Type id. */
  id: string
  /** Locale-resolved title (falls back to id for untitled viewers). */
  title: string
  /** False only after an explicit settings disable. */
  enabled: boolean
}

/** Registry snapshot for the settings page and column inject hook. */
export type WorkbenchRegistrySnapshot = {
  /** Registered tab types (including hidden and disabled). */
  tabs: readonly WorkbenchRegistryRow[]
  /** Registered file viewers (including disabled). */
  viewers: readonly WorkbenchRegistryRow[]
  /** Registered activity-bar rows, sorted by `order`. */
  activities: readonly WorkbenchRegistryRow[]
}

/** Props passed to a registered tab body. No ctx, no store object. */
export type TabBodyProps = {
  /** The open tab instance. */
  tab: WorkbenchTab
  /** True when this tab is active and the column is on screen. */
  visible: boolean
  /** Session that owns the tab. */
  sessionId: string
}

/** How a file viewer obtains bytes (matching is independent of this field). */
export type FetchStrategy = 'none' | 'fsRead' | 'mediaUrl' | 'custom' | 'binary-download'

/**
 * Seed for {@link IXmartWorkbench.openTab}. `createTab` descriptors ignore
 * `id` and `path`; `title` and `url` still overlay a newly minted tab.
 */
export type OpenTabSeed = {
  /** Registered tab type id. */
  type: string
  /** Optional instance id (id safety net focuses an existing match). */
  id?: string
  /** Optional label; wins over the descriptor title on a newly created tab. */
  title?: string
  /** Optional file path payload. */
  path?: string
  /** Optional URL written to `tab.path` on a newly created tab. */
  url?: string
}

/**
 * Tab type registration. `registerTab` returns a disposer; a duplicate `id`
 * throws. `available` gates the `+` menu only — it does not reject `openTab`.
 */
export type TabDescriptor = {
  /** Unique type id (also the default `single` dedupe key). */
  id: string
  /** Tab-bar / menu / settings label (string or locale thunk). */
  title: string | (() => string)
  /** `+` menu sort key; default {@link DEFAULT_TAB_ORDER}. */
  order?: number
  /** When true, the type is omitted from the `+` menu. */
  hidden?: boolean
  /**
   * `+` menu disable predicate. False shows a disabled row; a throw is
   * treated as disabled. Does not reject `openTab`.
   */
  available?: (scope: SessionScope, state: WorkbenchSessionState) => boolean
  /** Sugar for `dedupeKey: tab => tab.type`. An explicit `dedupeKey` wins. */
  single?: boolean
  /**
   * Dedupe key. `openTab` evaluates it on the incoming tab and again on
   * each existing tab; a matching key focuses instead of creating. Return
   * undefined to skip that candidate. Throws propagate.
   */
  dedupeKey?: (tab: WorkbenchTab) => string | undefined
  /**
   * Custom mint. Return null to refuse. `patch.nextSeq` applies only when
   * the minted tab is actually appended (not when id/dedupe focuses).
   */
  createTab?: (state: WorkbenchSessionState) =>
    | { tab: WorkbenchTab; patch?: Pick<Partial<WorkbenchSessionState>, 'nextSeq'> }
    | null
  /** Tab body. The column renders this; unregistered types show a placeholder. */
  component: ComponentType<TabBodyProps>
}

/**
 * File-viewer registration. Matching is {@link matchFileViewer}: priority
 * descending, detect before extensions, sniff-only catch-alls never claim
 * without head bytes. Settings-disabled viewers are skipped.
 */
export type FileViewerDescriptor = {
  /** Unique viewer id. */
  id: string
  /** Settings-list label; defaults to `id`. */
  title?: string | (() => string)
  /** Lowercase extension tokens without a dot. `[]` is a catch-all. */
  exts: readonly string[]
  /** Higher wins; default 0. Equal priority keeps registration order. */
  priority?: number
  /** Byte-fetch strategy (stored for later phases; matching ignores it). */
  fetchStrategy: FetchStrategy
  /** Content sniff. When present, it is consulted before `exts` if `head` is given. */
  detect?: (path: string, head: Uint8Array) => boolean
  /** `fetchStrategy: 'custom'` loader (unused until a later phase). */
  load?: (path: string, scope: SessionScope, signal?: AbortSignal) => Promise<unknown>
  /** Viewer body (unused until a later phase; required so the API stays complete). */
  component: ComponentType<Record<string, never>>
}

/**
 * Activity-bar registration. `registerActivity` returns a disposer; a
 * duplicate `id` throws. The primary sidebar renders `component`.
 */
export type ActivityDescriptor = {
  /** Unique activity id (also the persist value). */
  id: string
  /** Activity-bar accessible name and sidebar title. */
  title: string | (() => string)
  /** Activity-bar sort key; default {@link DEFAULT_ACTIVITY_ORDER}. */
  order?: number
  /** 16–18px activity-bar icon. */
  icon: ComponentType<{ size?: number }>
  /** Primary-sidebar body. Receives the same props as a tab body. */
  component: ComponentType<TabBodyProps>
}
