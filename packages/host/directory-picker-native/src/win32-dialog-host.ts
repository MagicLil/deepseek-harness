/**
 * Real-process half of the Win32 dialog driver: spawn the dialog child
 * process (source or built plane) and close a dialog thread's windows. The
 * module itself loads everywhere (the import chain from native-picker.ts is
 * static); what stays win32-only is koffi, imported dynamically inside the
 * bindings' functions. The driver's logic is tested against fakes of this
 * surface instead.
 *
 * Desktop (`dsh desktop`) hosts this plugin inside Electron. `process.execPath`
 * is then `electron.exe`. Prefer the Node binary recorded in
 * `DSH_NODE_EXEC_PATH` (desktop relaunch, or the packaged bundled Node
 * installed by `electron-main`) so koffi loads against the Node ABI it was
 * built for. Hosts without that path fall back to the same `execPath` with
 * `ELECTRON_RUN_AS_NODE=1`. Spawning `electron.exe` as a GUI child exits
 * before the IPC protocol.
 */

import { spawn, type StdioOptions } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Win32DialogWorkerData } from './win32-dialog-worker.ts'

/** Override the process facts `spawnDialogWorker` reads (tests only). */
export interface DialogWorkerSpawnInternals {
  /** Replaces `process.execPath`. */
  execPath?: string
  /** Replaces `process.env` (title is still written onto a shallow copy). */
  env?: NodeJS.ProcessEnv
  /** Replaces `process.versions.electron`; `undefined` means plain node. */
  electron?: string
  /**
   * Replaces `DSH_NODE_EXEC_PATH`: the real Node binary to spawn under
   * Electron instead of `electron.exe` + `ELECTRON_RUN_AS_NODE`.
   */
  nodeExecPath?: string
  /** Replaces `import.meta.url` so tests can hit the built-output argv arm. */
  metaUrl?: string
  /** Replaces `child_process.spawn`. */
  spawn?: typeof spawn
}

/**
 * Spawn the dialog child process. Built consumers launch the bundled CJS
 * entry next to this module under plain node; unbuilt (source) consumers
 * bootstrap tsx first, mirroring the dsh CLI's source launch. The dialog is
 * the child's first window, so Windows activates it without a foreground
 * call. Under Electron the child prefers a real Node binary
 * (`DSH_NODE_EXEC_PATH`) and otherwise runs `electron.exe` as Node via
 * `ELECTRON_RUN_AS_NODE`.
 * @param data - the child payload (dialog title).
 * @param internals - process-fact overrides for deterministic tests.
 * @returns the spawned child process.
 */
export function spawnDialogWorker(
  data: Win32DialogWorkerData,
  internals: DialogWorkerSpawnInternals = {},
): ReturnType<typeof spawn> {
  const env: NodeJS.ProcessEnv = { ...(internals.env ?? process.env), DSH_DIALOG_TITLE: data.title }
  const electron = internals.electron ?? process.versions.electron
  const nodeExecPath = internals.nodeExecPath ?? env.DSH_NODE_EXEC_PATH
  const preferNode = electron !== undefined && typeof nodeExecPath === 'string' && nodeExecPath !== ''
  if (electron !== undefined && !preferNode) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }
  const execPath = preferNode && typeof nodeExecPath === 'string'
    ? nodeExecPath
    : internals.execPath ?? process.execPath
  const metaUrl = internals.metaUrl ?? import.meta.url
  const run = internals.spawn ?? spawn
  const stdio: StdioOptions = ['ignore', 'inherit', 'inherit', 'ipc']
  if (!metaUrl.endsWith('.ts')) {
    return run(execPath, [fileURLToPath(new URL('./worker.cjs', metaUrl))], { env, stdio, windowsHide: true })
  }
  return run(execPath, [
    '--import', import.meta.resolve('tsx/esm'),
    fileURLToPath(new URL('./win32-dialog-worker.ts', metaUrl)),
  ], { env, stdio, windowsHide: true })
}

export { closeThreadWindows } from './win32-dialog-bindings.ts'
