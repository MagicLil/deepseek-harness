/**
 * Layout plugin, browser half: one register() call contributes AppFrame into
 * the runtime's built-in 'root' slot and, in the same breath, declares the
 * five child slots (declaration = exclusive render authority), seats the
 * layout store (panel geometry), and wires the panel-action service face.
 * ctx.layout is the cross-plugin panel-action contract; navigation state lives
 * with the runtime sessions service. A second effect seats the theme
 * presenter, which projects ctx.theme snapshots onto document.body.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { PanelActions } from './service.ts'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { LayoutController } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'

// Contract exports only (export-convergence rule: cross-package consumers
// keep a symbol exported; test-only/package-internal symbols live off /src).
// ILayout: the ctx.layout face consumers and test fakes type against.
// OwnerShare contracts below are the render-side halves registrants compose
// against; the frame components and the store factory are package-internal.
export { LayoutController } from './service.ts'
export type { ILayout } from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The outward face only; the concrete service stays inside this plugin. */
    layout: import('./service.ts').ILayout
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // The 'root' entry itself is the runtime's built-in slot (declared
    // there); these are the frame's children, declared by the same
    // register() call that contributes AppFrame. Session owners never pass
    // sessionId: the framework injects it as a standard prop.
    /**
     * Far-right session / workspace column. OCCUPIED by ui-sidebar's
     * SidebarRoot, which declares the workspace and settings seats inside it
     * — registering here replaces the navigation column outright rather than
     * adding to it, and the seats it declares disappear with it. To add
     * something to the sidebar, register into one of those inner seats
     * instead.
     *
     * The occupant receives the frame's live column state (collapsed, width)
     * and is expected to render the compact control rail while collapsed.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    /**
     * Chat column to the right of the editor, across both the no-session
     * hero and a live conversation. OCCUPIED by ui-conversation's
     * ConversationRoot, which declares the session body, composer, and input
     * seats inside it — registering here replaces the entire conversation
     * surface (and removes every seat it declares) rather than adding to it.
     *
     * Current-session-optional: the occupant owns both states without
     * changing its React identity, so it keeps its own state across a session
     * switch. It receives no owner props; session facts arrive through the
     * framework hooks of the `session-maybe` scope.
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConvOwnerProps }
    /**
     * Tool-details column between conversation and the session sidebar,
     * shown when the layout opens it. OCCUPIED by ui-conversation's
     * DetailsPanel. Absent an occupant the column renders nothing.
     *
     * No owner props: the framework injects the session id and hooks for the
     * `session` scope, and `ctx.layout` owns whether the column is open.
     */
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    /**
     * Center editor column (file tabs). OCCUPIED by ui-xmart-workbench.
     * Always visible — the occupant receives the concession-resolved editor
     * width. Registering here replaces the column.
     *
     * Current-session-optional so switching conversations does not remount
     * Monaco / the tab strip. Session facts arrive through session-maybe hooks.
     */
    'workbench': { kind: 'single'; scope: 'session-maybe'; owner: WorkbenchOwnerProps }
    /**
     * Full-width top menu bar (web only). OCCUPIED by ui-xmart-workbench.
     * Desktop hides this row — Terminal sits on the Electron File menu.
     *
     * Session-maybe: the bar stays mounted when current conversation changes.
     */
    'menuBar': { kind: 'single'; scope: 'session-maybe'; owner: MenuBarOwnerProps }
    /**
     * Far-left activity bar (icon rail). OCCUPIED by ui-xmart-workbench.
     * Always visible at ACTIVITY_WIDTH. The occupant receives whether the
     * primary sidebar and bottom panel are open so icons can stay in sync.
     *
     * Session-maybe: the rail stays mounted when current conversation changes.
     */
    'activityBar': { kind: 'single'; scope: 'session-maybe'; owner: ActivityBarOwnerProps }
    /**
     * Left primary sidebar (Explorer / Git / Tasks). OCCUPIED by
     * ui-xmart-workbench. Width 0 means closed (no rail — the activity bar
     * is the rail). `ctx.layout` openWorkbench/closeWorkbench drive this
     * track.
     *
     * Session-maybe: Explorer's loaded tree survives a same-project chat switch.
     */
    'primarySidebar': { kind: 'single'; scope: 'session-maybe'; owner: PrimarySidebarOwnerProps }
    /**
     * Bottom panel stacked under the editor track only. OCCUPIED by
     * ui-xmart-workbench. Height 0 means closed; the subtree stays mounted.
     *
     * Session-maybe: the panel chrome stays mounted when current conversation changes.
     */
    'bottomPanel': { kind: 'single'; scope: 'session-maybe'; owner: BottomPanelOwnerProps }
    /**
     * Frame-wide floating layer, above every column and outside their scroll
     * containers. Deliberately generic and unowned by any feature: a badge, a
     * toast stack or a status pill all belong here, and entries order among
     * themselves. The layer itself is click-through — entries opt back into
     * pointer events — so an occupant never blocks the app underneath.
     *
     * This is the additive seat for a frame-wide surface of your own: a fresh
     * `id` is added beside the shipped entries instead of replacing them.
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

// OwnerShare contracts — the render-side share the slot owner supplies at
// renderSlot. Registrants IMPORT these and compose their full component props
// through the four-share intersection (PropsRuntime & PropsRenderSlots &
// PropsStore & I). Conversation business state and actions arrive through
// framework-standard hooks and each registrant's inject face, not owner props.

/** Sidebar owner share: live column state from the frame's concession solve. */
export interface SidebarOwnerProps {
  /** True when the sidebar is closed (the column renders the compact control rail). */
  collapsed: boolean
  /** Rendered column width in px (SIDEBAR_COLLAPSED when collapsed). */
  width: number
}

/** Conversation owner share: business state and actions belong to the registrant. */
export interface ConvOwnerProps {}

/** Details owner share: empty — sessionId arrives as a framework-standard prop. */
export interface DetailsOwnerProps {}

/** Workbench (editor) owner share: the concession-resolved editor width. */
export interface WorkbenchOwnerProps {
  /** Rendered editor-track width in px (the center 1fr solve). */
  width: number
}

/** Top menu-bar owner share: empty — sessionId arrives as a framework-standard prop. */
export interface MenuBarOwnerProps {}

/** Activity-bar owner share: live open flags from the concession solve. */
export interface ActivityBarOwnerProps {
  /** True when the primary sidebar track is greater than 0. */
  primaryOpen: boolean
  /** True when the bottom-panel track is greater than 0. */
  bottomOpen: boolean
}

/** Primary-sidebar owner share: live track width (0 = closed). */
export interface PrimarySidebarOwnerProps {
  /** Rendered primary-sidebar width in px; 0 means closed. */
  width: number
}

/** Bottom-panel owner share: live track height (0 = closed). */
export interface BottomPanelOwnerProps {
  /** Rendered bottom-panel height in px; 0 means closed. */
  height: number
}

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['slots', 'theme']

/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with the five child-slot declarations, the layout store seat,
 * and the inject hook that hands the store's bound actions to the service.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const layout = new LayoutController()
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'menuBar': { kind: 'single', scope: 'session-maybe' },
        'activityBar': { kind: 'single', scope: 'session-maybe' },
        'primarySidebar': { kind: 'single', scope: 'session-maybe' },
        'workbench': { kind: 'single', scope: 'session-maybe' },
        'bottomPanel': { kind: 'single', scope: 'session-maybe' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'sidebar': { kind: 'single', scope: 'root' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      // Exclusive store: the factory itself — the framework instantiates per
      // entry and delivers useStore/actions to AppFrame as standard props.
      store: createLayoutStore,
      // The hook's only side effect connects the root store to ctx.layout;
      // conversation business actions belong to their registrants.
      inject: (actions: PanelActions) => {
        layout.attachPanels(actions)
        return {}
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
      void disposeService()
    }
  }, 'ui-layout: service + root registration')

  // Theme presentation: pure DOM writes from resolved snapshots — initial
  // state through the getter once, then event-driven only; no React path.
  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'ui-layout: theme presenter')
}
