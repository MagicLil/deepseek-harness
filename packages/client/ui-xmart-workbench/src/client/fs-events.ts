/**
 * D7: fold agent file-tool events and notify the files store. The definition
 * publishes no chat Node; `onTouch` is a live-edge callback (seq-gated so
 * replay does not re-fire after the fold has caught up in one apply).
 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'

/** Accumulator for one turn's file-tool touches. */
export type WorkbenchFsState = {
  turn: number
  refresh: string[]
  reload: string[]
}

/** Callback fired when a new (higher seq) file-tool event lands. */
export type WorkbenchFsTouch = (
  seq: number,
  refresh: readonly string[],
  reload: readonly string[],
) => void

/**
 * Paths a mutation call view reports, plus `file_path` / `path` on write/edit
 * arguments when the view is missing (replay without a tool card).
 * @param name - tool name.
 * @param argsJson - `tool/call` arguments JSON string.
 * @param locations - follow-along locations from the call view, when present.
 */
export function pathsFromFileTool(
  name: string,
  argsJson: string,
  locations: readonly { path: string }[] | undefined,
): { refresh: string[]; reload: string[] } {
  const fromView = (locations ?? []).map(location => location.path).filter(path => path.length > 0)
  const fromArgs = pathFromArgs(argsJson)
  const refresh = unique([...fromView, ...fromArgs])
  const mutating = name === 'write' || name === 'edit' || name === 'str_replace_editor'
  return { refresh, reload: mutating ? refresh : [] }
}

/**
 * Parse `file_path` or `path` out of a tool-call arguments JSON string.
 * @param argsJson - raw arguments.
 */
export function pathFromArgs(argsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(argsJson)
    if (parsed === null || typeof parsed !== 'object') return []
    const rec = parsed as Record<string, unknown>
    const path = rec.file_path ?? rec.path
    return typeof path === 'string' && path.length > 0 ? [path] : []
  }
  catch {
    return []
  }
}

function unique(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/**
 * Conversation definition that folds file-tool events and notifies `onTouch`
 * for each newly seen seq (so a live agent write refreshes the tree).
 * @param onTouch - seq-gated live callback.
 */
export function createWorkbenchFsDefinition(
  onTouch: WorkbenchFsTouch,
): ConversationNodeDefinition<WorkbenchFsState> {
  return {
    kind: 'workbench-fs',
    match: (event) => {
      if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
      if (event.type === 'tool/call') return { id: String(event.data.turn), role: 'update' }
      if (event.type === 'tool/result' && isAppendSurfaceEvent(event)) {
        return { id: String(event.data.turn), role: 'update' }
      }
      return null
    },
    start: (_context, match) => {
      if (match.event.type !== 'turn/start') throw new Error('workbench-fs start requires turn/start')
      return { turn: match.event.data.turn, refresh: [], reload: [] }
    },
    update: (context, match) => {
      if (match.event.type !== 'tool/call') return context.state
      const callView = match.view?.for === 'call' ? match.view.view : undefined
      const locations = callView !== undefined && 'locations' in callView
        ? callView.locations
        : undefined
      const next = pathsFromFileTool(
        match.event.data.name,
        match.event.data.arguments,
        locations,
      )
      if (next.refresh.length === 0) return context.state
      onTouch(match.event.seq, next.refresh, next.reload)
      return {
        ...context.state,
        refresh: unique([...context.state.refresh, ...next.refresh]),
        reload: unique([...context.state.reload, ...next.reload]),
      }
    },
  }
}
