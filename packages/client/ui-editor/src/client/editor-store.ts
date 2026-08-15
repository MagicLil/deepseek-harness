/**
 * The editor view's session store: which file is open, which tree directories
 * are expanded, and the unsaved buffer per file — the state that must survive
 * the conversation view ring remounting this tab. Module level exports the
 * factory only (a module-level handle would pin the store identity across
 * plugin reloads); register() receives the factory and the view derives its
 * PropsStore share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Editor viewing/draft state persisted across view-tab remounts. */
type EditorViewState = {
  /** Open file per workspace root (the tab may serve several roots over one session's life). */
  openFileByRoot: Record<string, string>
  /** Expanded tree directories by absolute path (absolute keys already scope roots). */
  expanded: Record<string, boolean>
  /** Unsaved buffers by absolute file path; an entry exists only while dirty. */
  drafts: Record<string, string>
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type EditorViewActions = {
  setOpenFile: (draft: EditorViewState, root: string, path: string | undefined) => void
  setExpanded: (draft: EditorViewState, path: string, expanded: boolean) => void
  setDraft: (draft: EditorViewState, path: string, content: string | undefined) => void
}

/** Record minus one key (immer-draft-friendly stand-in for dynamic delete). */
function withoutKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key))
}

/**
 * Create the editor view store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createEditorViewStore(): EngineStoreHandle<EditorViewState, EditorViewActions> {
  return defineStore({
    init: (): EditorViewState => ({
      openFileByRoot: {},
      expanded: {},
      drafts: {},
    }),
    actions: {
      setOpenFile: (d, root: string, path: string | undefined) => {
        if (path === undefined) d.openFileByRoot = withoutKey(d.openFileByRoot, root)
        else d.openFileByRoot[root] = path
      },
      setExpanded: (d, path: string, expanded: boolean) => {
        if (expanded) d.expanded[path] = true
        else d.expanded = withoutKey(d.expanded, path)
      },
      setDraft: (d, path: string, content: string | undefined) => {
        if (content === undefined) d.drafts = withoutKey(d.drafts, path)
        else d.drafts[path] = content
      },
    },
  })
}
