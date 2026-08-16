/**
 * LayoutController: the cross-plugin panel-action face behind ctx.layout.
 * Panel geometry itself lives in the root entry's layout store (stores.ts);
 * the current-session selection lives with the runtime sessions service, and
 * the per-session active view dissolved into ui-conversation's session store
 * (its only consumer). What remains here is the contract other plugins'
 * apply worlds reach for panel transitions (sidebar toggle from ui-sidebar,
 * details open/close from ui-conversation, primary-sidebar open/close from
 * ui-xmart-workbench) — writes stay inside the store's
 * declared action set, delivered as the registration's bound actions.
 *
 * `openWorkbench` / `closeWorkbench` / `toggleWorkbench` / `setWorkbench`
 * drive the left primary sidebar (Explorer/Git/Tasks), not the editor
 * center — the editor track is always visible.
 */
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'

/** The layout store's bound action set (framework-baked, draft params peeled). */
export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

/**
 * The outward layout face (`ctx.layout`): the panel transitions other
 * plugins may trigger — and exactly what a test fake must supply. The
 * attachPanels wiring hook stays on the concrete class (root-entry assembly
 * only).
 */
export interface ILayout {
  /** Toggle the far-right session sidebar (closed ⟷ contract default width). */
  toggleSidebar(): void
  /** Open the details panel (no-op when already open). */
  openDetails(): void
  /** Close the details panel. */
  closeDetails(): void
  /**
   * Open the primary sidebar. No-op when it already paints a non-zero
   * track; if a wide conversation has conceded it to zero, shrinks
   * conversation so explorer and editor can split the leftover.
   */
  openWorkbench(): void
  /** Close the primary sidebar. */
  closeWorkbench(): void
  /**
   * Toggle the primary sidebar. A conceded (preference open, painted
   * zero) track reveals instead of closing.
   */
  toggleWorkbench(): void
  /**
   * Write the primary-sidebar width preference (clamped to the contract range).
   * @param px - requested width in px; closing uses {@link closeWorkbench} instead.
   */
  setWorkbench(px: number): void
  /**
   * Write the primary-sidebar width preference. Alias of {@link setWorkbench}.
   * @param px - requested width in px.
   */
  setPrimarySidebar(px: number): void
  /** Open the editor bottom panel (no-op when already open). */
  openBottom(): void
  /** Close the editor bottom panel. */
  closeBottom(): void
  /** Toggle the editor bottom panel (closed ⟷ contract default height). */
  toggleBottom(): void
  /**
   * Write the bottom-panel height preference (clamped to the contract range).
   * @param px - requested height in px; closing uses {@link closeBottom} instead.
   */
  setBottomHeight(px: number): void
  /** Open the conversation column (no-op when already open). */
  openConversation(): void
  /** Close the conversation column. */
  closeConversation(): void
  /** Toggle the conversation column (closed ⟷ contract default width). */
  toggleConversation(): void
}

/** Cross-plugin panel-action face (ctx.layout). */
export class LayoutController implements ILayout {
  #panels: PanelActions | undefined

  /**
   * Adopt the root entry's bound store actions. Called from the root
   * registration's inject hook (a sanctioned assembly side effect), so the
   * face is live from the entry's first render; on entry re-register the
   * fresh actions overwrite the stale set.
   * @param actions - bound actions of the entry's layout store instance.
   */
  attachPanels(actions: PanelActions): void {
    this.#panels = actions
  }

  /** Toggle the far-right session sidebar (closed ⟷ contract default width). */
  toggleSidebar(): void {
    this.#require().toggleSidebar()
  }

  /** Open the details panel (no-op when already open). */
  openDetails(): void {
    this.#require().openDetails()
  }

  /** Close the details panel. */
  closeDetails(): void {
    this.#require().closeDetails()
  }

  /**
   * Open the primary sidebar. No-op when it already paints a non-zero
   * track; if a wide conversation has conceded it to zero, shrinks
   * conversation so explorer and editor can split the leftover.
   */
  openWorkbench(): void {
    this.#require().openWorkbench()
  }

  /** Close the primary sidebar. */
  closeWorkbench(): void {
    this.#require().closeWorkbench()
  }

  /**
   * Toggle the primary sidebar. A conceded (preference open, painted
   * zero) track reveals instead of closing.
   */
  toggleWorkbench(): void {
    this.#require().toggleWorkbench()
  }

  /**
   * Write the primary-sidebar width preference (clamped to the contract range).
   * @param px - requested width in px; closing uses {@link closeWorkbench} instead.
   */
  setWorkbench(px: number): void {
    this.#require().setWorkbench(px)
  }

  /**
   * Write the primary-sidebar width preference. Alias of {@link setWorkbench}.
   * @param px - requested width in px.
   */
  setPrimarySidebar(px: number): void {
    this.#require().setWorkbench(px)
  }

  /** Open the editor bottom panel (no-op when already open). */
  openBottom(): void {
    this.#require().openBottom()
  }

  /** Close the editor bottom panel. */
  closeBottom(): void {
    this.#require().closeBottom()
  }

  /** Toggle the editor bottom panel (closed ⟷ contract default height). */
  toggleBottom(): void {
    this.#require().toggleBottom()
  }

  /**
   * Write the bottom-panel height preference (clamped to the contract range).
   * @param px - requested height in px; closing uses {@link closeBottom} instead.
   */
  setBottomHeight(px: number): void {
    this.#require().setBottom(px)
  }

  /** Open the conversation column (no-op when already open). */
  openConversation(): void {
    this.#require().openConversation()
  }

  /** Close the conversation column. */
  closeConversation(): void {
    this.#require().closeConversation()
  }

  /** Toggle the conversation column (closed ⟷ contract default width). */
  toggleConversation(): void {
    this.#require().toggleConversation()
  }

  #require(): PanelActions {
    // Callers are UI gestures, which cannot fire before the root entry
    // rendered (the inject hook runs in its first render) — reaching this
    // unwired is a boot-order bug, not a race to tolerate.
    if (this.#panels === undefined) throw new Error('layout: panel actions not wired (root entry not mounted)')
    return this.#panels
  }
}
