/**
 * Pick the Node binary that should run a Node language-server script.
 * Desktop records `DSH_NODE_EXEC_PATH` (relaunch or packaged bundled Node);
 * Electron without that fact falls back to `electron.exe` + `ELECTRON_RUN_AS_NODE`.
 * @module @deepseek-ai/dsh-lsp-languages/node-launch
 */

/** Process facts tests can override without mutating `process`. */
export interface NodeLaunchInternals {
  /** Ambient env (defaults to `process.env`). */
  readonly env?: NodeJS.ProcessEnv
  /** `process.versions` (defaults to the real one). */
  readonly versions?: NodeJS.ProcessVersions
  /** `process.execPath` (defaults to the real one). */
  readonly execPath?: string
}

/** How to launch a Node script under this host. */
export interface NodeLaunch {
  /** Absolute Node (or Electron-as-Node) executable. */
  readonly command: string
  /** Extra env merged onto the child (may set `ELECTRON_RUN_AS_NODE`). */
  readonly extraEnv: Record<string, string>
}

/**
 * Pick the Node binary for a Node language-server script.
 * @param internals - process-fact overrides for tests.
 */
export function nodeLaunch(internals: NodeLaunchInternals = {}): NodeLaunch {
  const env = internals.env ?? process.env
  const versions = internals.versions ?? process.versions
  const execPath = internals.execPath ?? process.execPath
  const nodeExecPath = env.DSH_NODE_EXEC_PATH
  const electron = versions.electron
  if (electron !== undefined && typeof nodeExecPath === 'string' && nodeExecPath !== '') {
    return { command: nodeExecPath, extraEnv: {} }
  }
  if (electron !== undefined) {
    return { command: execPath, extraEnv: { ELECTRON_RUN_AS_NODE: '1' } }
  }
  return { command: execPath, extraEnv: {} }
}
