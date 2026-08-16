/** Tool names whose file writes happen out of process (ACP / subagent). */

/** Default opaque mutators: child agents write without parent `write`/`edit`. */
export const OPAQUE_MUTATION_TOOLS = new Set([
  'cursor_agent',
  'subagent',
  'subagent_fork',
  'subagent_acp',
])

/**
 * Whether this tool name should be captured via a before/after git status scan.
 * @param name - registered tool name.
 * @param extra - Config extras.
 */
export function isOpaqueMutationTool(name: string, extra: readonly string[] = []): boolean {
  return OPAQUE_MUTATION_TOOLS.has(name) || extra.includes(name)
}
