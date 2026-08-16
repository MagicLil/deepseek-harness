/**
 * Orchestrate sequential check runs through workspaceChecks Remote.
 */
import {
  buildRunArgv,
  type CheckKind,
  type DiscoveredCheck,
  type PackageManager,
} from './discover-scripts.ts'
import { parseCheckOutput } from './parse-check-output.ts'
import { relatedExtraArgs, shouldSkipRelated } from './related-args.ts'
import type { ProblemItem } from './problem-model.ts'
import {
  peekWorkspaceChecks,
  unwrapCheck,
  type WorkspaceChecksRemote,
} from './checks-client.ts'
import {
  failedKinds,
  rowsFromDiscovered,
  saveChecksPersist,
  type ChecksStore,
  type CheckRow,
} from './checks-store.ts'

const POLL_MS = 400

/** Options for one batch run. */
export type RunChecksOptions = {
  store: ChecksStore
  remote: unknown
  workspaceRoot: string
  packageManager: PackageManager
  discovered: readonly DiscoveredCheck[]
  relatedPaths: readonly string[]
  relatedMode: boolean
  onlyKinds?: readonly CheckKind[]
  signal?: AbortSignal
}

/**
 * Run discovered checks sequentially; updates store; returns collected problems.
 */
export async function runChecksBatch(opts: RunChecksOptions): Promise<readonly ProblemItem[]> {
  const checks = peekWorkspaceChecks(opts.remote)
  if (checks === undefined) {
    opts.store.set({
      log: 'workspaceChecks remote is unavailable on this surface.\n',
      busy: false,
    })
    throw new Error('workspaceChecks remote is unavailable on this surface.')
  }
  const kinds = new Set(opts.onlyKinds ?? opts.discovered.map(d => d.kind))
  const queue = opts.discovered.filter(d => kinds.has(d.kind))
  opts.store.set({
    workspaceRoot: opts.workspaceRoot,
    packageManager: opts.packageManager,
    discovered: opts.discovered,
    rows: rowsFromDiscovered(opts.discovered).map((row) => {
      if (!kinds.has(row.kind)) return row
      if (opts.relatedMode && shouldSkipRelated(row.kind, opts.relatedPaths)) {
        return { ...row, status: 'skipped', exitCode: null }
      }
      return { ...row, status: 'idle', exitCode: null }
    }),
    log: '',
    problems: [],
    busy: true,
    activeRunId: null,
    activeKind: null,
  })

  const allProblems: ProblemItem[] = []
  for (const item of queue) {
    if (opts.signal?.aborted === true) break
    const snap = opts.store.getSnapshot()
    const row = snap.rows.find(r => r.kind === item.kind)
    if (row?.status === 'skipped') continue
    await runOne(checks, opts, item, allProblems)
  }

  opts.store.set({ busy: false, activeRunId: null, activeKind: null, problems: allProblems })
  saveChecksPersist({
    workspaceRoot: opts.workspaceRoot,
    rows: opts.store.getSnapshot().rows,
    log: opts.store.getSnapshot().log,
    problems: allProblems,
    finishedAt: Date.now(),
  })
  return allProblems
}

async function runOne(
  checks: WorkspaceChecksRemote,
  opts: RunChecksOptions,
  item: DiscoveredCheck,
  allProblems: ProblemItem[],
): Promise<void> {
  const extras = opts.relatedMode
    ? relatedExtraArgs(item.kind, opts.relatedPaths)
    : []
  const argv = buildRunArgv(opts.packageManager, item.script, extras)
  const command = argv.join(' ')
  opts.store.updateRows(rows => patchRow(rows, item.kind, {
    status: 'running', exitCode: null, command,
  }))
  opts.store.appendLog(`\n$ ${command}\n`)
  const startedRaw = await unwrapCheck<{
    ok: true
    runId: string
  } | {
    ok: false
    error: { code: string; message: string }
  }>(checks.start({
    workspaceRoot: opts.workspaceRoot,
    argv,
    label: item.script,
  }))
  if (!startedRaw.ok) {
    opts.store.appendLog(`start failed: ${startedRaw.error.message}\n`)
    opts.store.updateRows(rows => patchRow(rows, item.kind, { status: 'failed', exitCode: null }))
    return
  }
  const runId = startedRaw.runId
  opts.store.set({ activeRunId: runId, activeKind: item.kind })
  let stdoutFrom = 0
  let stderrFrom = 0
  let logBuf = ''
  for (;;) {
    if (opts.signal?.aborted === true) {
      await unwrapCheck(checks.stop({ runId })).catch(() => undefined)
      opts.store.updateRows(rows => patchRow(rows, item.kind, { status: 'stopped', exitCode: null }))
      break
    }
    const polled = await unwrapCheck<{
      ok: boolean
      status: 'running' | 'passed' | 'failed' | 'stopped' | 'unknown'
      exitCode: number | null
      stdout: string
      stderr: string
      stdoutNext: number
      stderrNext: number
      lossy: boolean
    }>(checks.poll({ runId, stdoutFrom, stderrFrom }))
    if (polled.stdout.length > 0) {
      opts.store.appendLog(polled.stdout)
      logBuf += polled.stdout
    }
    if (polled.stderr.length > 0) {
      opts.store.appendLog(polled.stderr)
      logBuf += polled.stderr
    }
    stdoutFrom = polled.stdoutNext
    stderrFrom = polled.stderrNext
    if (polled.status !== 'running') {
      const status = polled.status === 'passed'
        ? 'passed'
        : polled.status === 'stopped'
          ? 'stopped'
          : 'failed'
      opts.store.updateRows(rows => patchRow(rows, item.kind, {
        status,
        exitCode: polled.exitCode,
      }))
      const parsed = parseCheckOutput(logBuf, item.kind, opts.workspaceRoot)
      if (parsed.length > 0) {
        allProblems.push(...parsed)
      } else if (status === 'failed') {
        allProblems.push({
          id: `${item.kind}-exit-${String(Date.now())}`,
          source: item.kind,
          severity: 'error',
          message: polled.exitCode === null
            ? `${item.script} failed with no parseable diagnostics (see Checks log)`
            : `${item.script} exited ${String(polled.exitCode)} with no parseable diagnostics (see Checks log)`,
          path: opts.workspaceRoot,
          line: 0,
          character: 0,
        })
      }
      break
    }
    await sleep(POLL_MS)
  }
}

function patchRow(
  rows: readonly CheckRow[],
  kind: CheckKind,
  patch: Partial<CheckRow>,
): CheckRow[] {
  return rows.map(r => (r.kind === kind ? { ...r, ...patch } : r))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Re-run only failed kinds after agent turn. */
export async function rerunFailedChecks(opts: Omit<RunChecksOptions, 'onlyKinds'>): Promise<void> {
  const failed = failedKinds(opts.store.getSnapshot().rows)
  if (failed.length === 0) return
  await runChecksBatch({ ...opts, onlyKinds: failed })
}
