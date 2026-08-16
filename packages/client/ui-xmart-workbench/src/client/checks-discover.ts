/**
 * Shared package.json discovery for Checks and the Git pre-commit panel.
 */
import {
  detectPackageManager,
  discoverCheckScripts,
} from './discover-scripts.ts'
import { resolveCheckPackage, type CheckFsEntry } from './resolve-check-package.ts'
import {
  emptyChecksState,
  loadChecksPersist,
  mergePersist,
  rowsFromDiscovered,
  type ChecksState,
  type ChecksStore,
} from './checks-store.ts'

/**
 * Re-read nearby scripts + lockfile and merge the last persisted run.
 * Resolves packageRoot when the session cwd has no check scripts.
 * Skips overwrite while a run is busy so the Git panel status stays live.
 */
export async function refreshChecksDiscovery(opts: {
  store: ChecksStore
  workspaceRoot: string | undefined
  listEntries: (dir: string) => Promise<readonly CheckFsEntry[]>
  readFile: (path: string) => Promise<string | undefined>
}): Promise<void> {
  if (opts.workspaceRoot === undefined || opts.workspaceRoot === '') {
    opts.store.set(emptyChecksState())
    return
  }
  const resolved = await resolveCheckPackage({
    workspaceRoot: opts.workspaceRoot,
    listEntries: opts.listEntries,
    readFile: opts.readFile,
  })
  const packageRoot = resolved?.packageRoot ?? opts.workspaceRoot
  const discovered = discoverCheckScripts(resolved?.scripts)
  const packageManager = detectPackageManager(resolved?.entries ?? [])
  const live = opts.store.getSnapshot()
  if (live.busy) return
  let next: ChecksState = {
    ...emptyChecksState(),
    workspaceRoot: opts.workspaceRoot,
    packageRoot,
    packageManager,
    discovered,
    rows: rowsFromDiscovered(discovered),
    relatedMode: live.relatedMode,
    autoRerunFailed: live.autoRerunFailed,
  }
  const persist = loadChecksPersist(packageRoot)
  if (persist !== undefined) next = mergePersist(next, persist)
  opts.store.set(next)
}
