/**
 * Which open editor tabs should keep a language-server document alive.
 * The active Monaco widget only sees one file; the rest still need didOpen.
 */
import { isJavaPath, isTsPath, isVuePath } from './editor-lsp.ts'

/** Minimal tab face the sync walks. */
export type LspSyncTab = {
  readonly type: string
  readonly path?: string
}

/**
 * Supported editor paths currently open, first occurrence wins.
 * @param tabs - workbench file tabs (shell types already filtered or not).
 */
export function editorLspPaths(tabs: readonly LspSyncTab[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const tab of tabs) {
    if (tab.type !== 'editor') continue
    const path = tab.path
    if (path === undefined || path === '' || seen.has(path)) continue
    if (!isVuePath(path) && !isTsPath(path) && !isJavaPath(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/**
 * Documents the sync opened that are no longer among the wanted paths.
 * @param opened - paths this session already sent didOpen for.
 * @param wanted - {@link editorLspPaths} result.
 */
export function lspDocsToClose(opened: readonly string[], wanted: readonly string[]): string[] {
  const keep = new Set(wanted)
  return opened.filter(path => !keep.has(path))
}

/**
 * Buffer text for didOpen: unsaved draft, else disk, else empty.
 * @param path - absolute file path.
 * @param draft - `files.draftOf` result.
 * @param readFile - host read, when present.
 * @param signal - abort when the tab set changes.
 */
export async function lspOpenText(
  path: string,
  draft: string | undefined,
  readFile: ((file: string, signal?: AbortSignal) => Promise<string>) | undefined,
  signal?: AbortSignal,
): Promise<string> {
  if (typeof draft === 'string') return draft
  if (readFile === undefined) return ''
  try {
    return await readFile(path, signal)
  }
  catch {
    return ''
  }
}
