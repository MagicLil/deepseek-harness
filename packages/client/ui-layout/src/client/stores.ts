/**
 * The root entry's transient layout store: panel geometry as plain widths in
 * px (0 = closed). Module level exports the factory only — a module-level
 * handle would pin the store's identity in the module
 * cache (a de-facto singleton surviving plugin reloads). register() receives
 * the factory (exclusive use: the framework instantiates per entry), AppFrame
 * derives its PropsStore share from the return type, and the service face
 * receives the bound actions through the registration's inject hook.
 *
 * `workbench` is the primary-sidebar width (Explorer/Git/Tasks). The editor
 * center track is always 1fr and has no preference. `conversation` is the
 * chat column. `bottom` is the editor-stacked panel height.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  BOTTOM_DEFAULT, BOTTOM_MAX, BOTTOM_MIN, clampWidth, computeColumns,
  CONVERSATION_DEFAULT, CONVERSATION_MAX, CONVERSATION_MIN,
  DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  planPrimaryReveal, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
  WORKBENCH_DEFAULT, WORKBENCH_MAX, WORKBENCH_MIN,
} from './columns.ts'

/**
 * Layout store state: panel width/height preferences in px (0 = closed), plus
 * the narrow-viewport pair — `narrow` mirrors AppFrame's breakpoint reading
 * (viewport < SIDEBAR_AUTO_COLLAPSE) so toggleSidebar can pick semantics, and
 * `narrowExpanded` is the manual override that re-expands the auto-collapsed
 * session sidebar over the squeezed editor without rewriting the width preference.
 */
type LayoutState = {
  sidebar: number
  details: number
  workbench: number
  conversation: number
  bottom: number
  /** Live AppFrame width; 0 until the first measure. */
  frameWidth: number
  narrow: boolean
  narrowExpanded: boolean
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setDetails: (draft: LayoutState, px: number) => void
  setWorkbench: (draft: LayoutState, px: number) => void
  setConversation: (draft: LayoutState, px: number) => void
  setBottom: (draft: LayoutState, px: number) => void
  toggleSidebar: (draft: LayoutState) => void
  setNarrow: (draft: LayoutState, narrow: boolean) => void
  setFrameWidth: (draft: LayoutState, px: number) => void
  openDetails: (draft: LayoutState) => void
  closeDetails: (draft: LayoutState) => void
  openWorkbench: (draft: LayoutState) => void
  closeWorkbench: (draft: LayoutState) => void
  toggleWorkbench: (draft: LayoutState) => void
  openBottom: (draft: LayoutState) => void
  closeBottom: (draft: LayoutState) => void
  toggleBottom: (draft: LayoutState) => void
}

/**
 * Session-sidebar preference AppFrame would pass to the solver (0 = rail).
 * Mirrors AppFrame's narrow / collapsed reading so reveal plans the same pack.
 */
function solveSidebar(d: LayoutState): number {
  const collapsed = d.narrow ? !d.narrowExpanded : d.sidebar === 0
  return collapsed ? 0 : (d.sidebar === 0 ? SIDEBAR_DEFAULT : d.sidebar)
}

/** True when the current preferences already paint a non-zero primary track. */
function primaryRenders(d: LayoutState): boolean {
  if (d.workbench === 0 || d.frameWidth <= 0) return false
  return computeColumns(
    d.frameWidth, solveSidebar(d), d.details, d.workbench, d.conversation,
  ).primary > 0
}

/** Write explorer + conversation prefs so the primary track becomes visible. */
function revealPrimary(d: LayoutState): void {
  const plan = planPrimaryReveal(d.frameWidth, solveSidebar(d), d.details, d.conversation)
  d.workbench = plan.primary
  d.conversation = plan.conversation
}

/**
 * Create the layout panel store handle. The preference IS the width, so
 * closing a panel forgets its drag width — reopening restores the contract
 * default. Actions are the complete write set: drag writes clamp
 * into the panel's contract range and never cross the open/closed line;
 * open/close transitions write 0 / the default explicitly. Below the
 * auto-collapse breakpoint (AppFrame feeds setNarrow) the sidebar toggle
 * flips the narrowExpanded override instead of the preference. Session-scoped
 * primary-sidebar width memory lives in the workbench plugin's persist store,
 * which writes these actions on session change. `openWorkbench` / the opening
 * side of `toggleWorkbench` also reveal a conceded primary (shrink a 2/3
 * conversation so explorer and editor can split the leftover).
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions>  {
  const handle = defineStore({
    init: (): LayoutState => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      workbench: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      bottom: 0,
      frameWidth: 0,
      narrow: false,
      narrowExpanded: false,
    }),
    actions: {
      setSidebar: (d, px: number) => { d.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (d, px: number) => { d.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      setWorkbench: (d, px: number) => { d.workbench = clampWidth(px, WORKBENCH_MIN, WORKBENCH_MAX) },
      setConversation: (d, px: number) => { d.conversation = clampWidth(px, CONVERSATION_MIN, CONVERSATION_MAX) },
      setBottom: (d, px: number) => { d.bottom = clampWidth(px, BOTTOM_MIN, BOTTOM_MAX) },
      // Narrow toggles flip only the override: the width preference survives
      // untouched, so re-widening restores the pre-squeeze layout.
      toggleSidebar: (d) => {
        if (d.narrow) d.narrowExpanded = !d.narrowExpanded
        else d.sidebar = d.sidebar === 0 ? SIDEBAR_DEFAULT : 0
      },
      // Crossing the breakpoint in either direction drops the override: the
      // narrow default is auto-collapsed, the wide state is the preference.
      setNarrow: (d, narrow: boolean) => {
        if (d.narrow === narrow) return
        d.narrow = narrow
        d.narrowExpanded = false
      },
      setFrameWidth: (d, px: number) => {
        if (px <= 0) return
        d.frameWidth = Math.round(px)
      },
      openDetails: (d) => { if (d.details === 0) d.details = DETAILS_DEFAULT },
      closeDetails: (d) => { d.details = 0 },
      openWorkbench: (d) => {
        if (d.frameWidth <= 0) {
          if (d.workbench === 0) d.workbench = WORKBENCH_DEFAULT
          return
        }
        if (primaryRenders(d)) return
        revealPrimary(d)
      },
      closeWorkbench: (d) => { d.workbench = 0 },
      toggleWorkbench: (d) => {
        if (d.frameWidth <= 0) {
          d.workbench = d.workbench === 0 ? WORKBENCH_DEFAULT : 0
          return
        }
        if (primaryRenders(d)) d.workbench = 0
        else revealPrimary(d)
      },
      openBottom: (d) => { if (d.bottom === 0) d.bottom = BOTTOM_DEFAULT },
      closeBottom: (d) => { d.bottom = 0 },
      toggleBottom: (d) => {
        if (d.bottom === 0) d.bottom = BOTTOM_DEFAULT
        else d.bottom = 0
      },
    },
  })
  return handle
}
