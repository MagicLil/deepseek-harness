/**
 * Active editor-column path from a session snapshot. Shell tabs (explorer /
 * git / tasks / terminal) never count — they live outside this strip.
 */
import { activeFileTab } from './app-menu-dispatch.ts'
import type { WorkbenchView } from './types.ts'

/**
 * Path of the focused file tab, or the last file tab when focus is on a
 * shell type. Undefined when the editor strip is empty.
 * @param view - per-session workbench snapshot.
 */
export function activeEditorPath(view: WorkbenchView): string | undefined {
  return activeFileTab(view)?.path
}
