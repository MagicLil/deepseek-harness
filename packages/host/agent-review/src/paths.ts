/** Parse file paths out of tool-call arguments. */

/**
 * Absolute or model-facing path from write/edit arguments.
 * @param args - tool arguments object.
 */
export function pathFromToolArgs(args: unknown): string | undefined {
  if (args === null || typeof args !== 'object') return undefined
  const record = args as Record<string, unknown>
  const path = record.file_path ?? record.path
  return typeof path === 'string' && path.length > 0 ? path : undefined
}

/**
 * Latest open turn number from a session event list, or null.
 * @param events - session events (scanned in append order).
 */
export function openTurnFromEvents(events: readonly { type: string; data: unknown }[]): number | null {
  let open: number | null = null
  for (const event of events) {
    if (event.type === 'turn/start') {
      const turn = (event.data as { turn?: unknown }).turn
      if (typeof turn === 'number') open = turn
    } else if (event.type === 'turn/end') {
      open = null
    }
  }
  return open
}
