/**
 * Community plugins (dsh-market) spawn `process.execPath -e <script>` to
 * hand off a restart. Under Electron that binary is `electron.exe`, which
 * treats the script source as an app path and shows "Error launching app".
 * @module @deepseek-ai/dsh-desktop/node-eval-spawn
 */

import { createRequire } from 'node:module'
import type { ChildProcess, SpawnOptions } from 'node:child_process'

const childProcess = createRequire(import.meta.url)('node:child_process') as typeof import('node:child_process')

/** How the desktop host should treat an `execPath -e` spawn. */
export type ElectronEvalPlan =
  | { kind: 'passthrough' }
  | { kind: 'relaunch' }
  | { kind: 'node-eval'; file: string; args: string[]; env: NodeJS.ProcessEnv }

/** Facts needed to classify a child_process.spawn under Electron. */
export interface ElectronEvalSpawnInput {
  /** argv[0] the caller asked to spawn. */
  readonly file: string
  /** Remaining argv. */
  readonly args: readonly string[]
  /** Spawn env, when the caller supplied one. */
  readonly env?: NodeJS.ProcessEnv | undefined
  /** `process.execPath` of this Electron process. */
  readonly execPath: string
  /** Real Node recorded by the desktop relaunch (`DSH_NODE_EXEC_PATH`). */
  readonly nodePath?: string | undefined
}

/**
 * Whether two executable paths name the same binary.
 * @param left - first path.
 * @param right - second path.
 */
export function sameExecPath(left: string, right: string): boolean {
  const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return normalize(left) === normalize(right)
}

/**
 * Whether this `-e` script is dsh-market's detached restart helper.
 * @param args - spawn argv after the binary.
 */
export function isMarketRestartEval(args: readonly string[]): boolean {
  const script = args[1]
  return args[0] === '-e' && typeof script === 'string' && script.includes('dsh-market-restart')
}

/**
 * Decide whether an Electron `execPath -e` spawn should relaunch, run as
 * Node, or pass through unchanged.
 * @param input - spawn argv plus this process's Electron / Node paths.
 */
export function planElectronEvalSpawn(input: ElectronEvalSpawnInput): ElectronEvalPlan {
  if (!sameExecPath(input.file, input.execPath)) return { kind: 'passthrough' }
  if (input.args[0] !== '-e' || input.args[1] === undefined) return { kind: 'passthrough' }
  if (isMarketRestartEval(input.args)) return { kind: 'relaunch' }
  const args = [...input.args]
  const env = { ...(input.env ?? {}) }
  const nodePath = input.nodePath
  if (typeof nodePath === 'string' && nodePath !== '') {
    return { kind: 'node-eval', file: nodePath, args, env }
  }
  return { kind: 'node-eval', file: input.file, args, env: { ...env, ELECTRON_RUN_AS_NODE: '1' } }
}

/** Options for patching `child_process.spawn` in the Electron main process. */
export interface InstallElectronEvalSpawnOptions {
  /** `process.execPath` of this Electron process. */
  readonly execPath: string
  /** Real Node recorded by the desktop relaunch. */
  readonly nodePath?: string | undefined
  /** Electron-native restart used instead of dsh-market's helper. */
  readonly onRelaunch: () => void
}

/**
 * Minimal child the market only `unref()`s and reads `pid` from.
 * @returns a stub that looks enough like a detached helper.
 */
export function createRestartHelperStub(): ChildProcess {
  const stub = {
    pid: 1,
    unref(): ChildProcess { return stub as unknown as ChildProcess },
    ref(): ChildProcess { return stub as unknown as ChildProcess },
    kill(): boolean { return true },
  }
  return stub as unknown as ChildProcess
}

/**
 * Whether the second spawn argument is options rather than argv.
 * @param value - argv or options.
 */
function isSpawnOptions(value: readonly string[] | SpawnOptions): value is SpawnOptions {
  return !Array.isArray(value)
}

/**
 * Split the `spawn(file, args?, options?)` overload pair.
 * @param argsOrOptions - argv or options.
 * @param options - options when argv was passed.
 */
function splitSpawnArgs(
  argsOrOptions?: readonly string[] | SpawnOptions,
  options?: SpawnOptions,
): { args: readonly string[]; options: SpawnOptions | undefined } {
  if (argsOrOptions !== undefined && isSpawnOptions(argsOrOptions)) {
    return { args: [], options: argsOrOptions }
  }
  return { args: argsOrOptions ?? [], options }
}

/**
 * Invoke the original spawn without fighting its overload set.
 * @param run - original spawn.
 * @param file - argv[0].
 * @param args - remaining argv.
 * @param options - spawn options, if any.
 */
function invokeSpawn(
  run: typeof childProcess.spawn,
  file: string,
  args: readonly string[],
  options: SpawnOptions | undefined,
): ChildProcess {
  if (options === undefined) return run(file, [...args])
  return run(file, [...args], options)
}

/** Mutable `spawn` slot (the real `child_process` module, or a test fake). */
export interface SpawnTarget {
  /** `child_process.spawn` or a stand-in the installer replaces. */
  spawn: typeof import('node:child_process').spawn
}

/**
 * Rewrite `electron -e` children so community restart helpers do not open
 * the "Error launching app" dialog. dsh-market's helper becomes `app.relaunch`.
 * @param options - this process's Electron / Node paths and relaunch hook.
 * @param target - module whose `spawn` is replaced (defaults to `child_process`).
 * @returns disposer that restores the original `spawn`.
 */
export function installElectronEvalSpawn(
  options: InstallElectronEvalSpawnOptions,
  target: SpawnTarget = childProcess,
): () => void {
  const original = target.spawn
  const patched: typeof childProcess.spawn = ((
    file: string,
    argsOrOptions?: readonly string[] | SpawnOptions,
    maybeOptions?: SpawnOptions,
  ) => {
    const split = splitSpawnArgs(argsOrOptions, maybeOptions)
    const env = split.options?.env
    const plan = planElectronEvalSpawn({
      file,
      args: split.args,
      env,
      execPath: options.execPath,
      nodePath: options.nodePath,
    })
    if (plan.kind === 'relaunch') {
      options.onRelaunch()
      return createRestartHelperStub()
    }
    if (plan.kind === 'node-eval') {
      const nextOptions: SpawnOptions = { ...split.options, env: plan.env }
      return invokeSpawn(original, plan.file, plan.args, nextOptions)
    }
    if (argsOrOptions !== undefined && isSpawnOptions(argsOrOptions)) {
      return original(file, argsOrOptions)
    }
    return invokeSpawn(original, file, argsOrOptions ?? [], maybeOptions)
  }) as typeof childProcess.spawn
  target.spawn = patched
  return () => {
    target.spawn = original
  }
}
