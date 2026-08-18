/**
 * Developer-mode store for tool-error presentation. A single handle is created
 * in `apply` and shared by the tool-call tree and details registrations, so one
 * toggle governs whether raw tool failure text renders across the conversation
 * and the details panel. It is a viewing preference, not business data, and
 * lives in a declared store (never a module-level singleton).
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Developer-mode state: whether the conversation may reveal raw tool errors. */
export type ToolErrorViewState = {
  developerMode: boolean
}

/** Write surface for the developer-mode flag. */
type ToolErrorViewActions = {
  setDeveloperMode: (draft: ToolErrorViewState, on: boolean) => void
}

/**
 * Create the tool-error view store handle.
 * @returns the store handle shared across the tool-call and details registrations.
 */
export function createToolErrorViewStore(): EngineStoreHandle<ToolErrorViewState, ToolErrorViewActions> {
  return defineStore({
    init: (): ToolErrorViewState => ({ developerMode: false }),
    actions: {
      setDeveloperMode: (draft, on: boolean) => { draft.developerMode = on },
    },
  })
}

/** The handle type the slot contract references in its `PropsStore` share. */
export type ToolErrorViewStore = ReturnType<typeof createToolErrorViewStore>
