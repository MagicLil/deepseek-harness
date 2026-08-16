/**
 * Checks bottom-panel body: discover scripts, run related/all, show log + status.
 */
import { useEffect, useRef, useState } from 'react'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { refreshChecksDiscovery } from './checks-discover.ts'
import type { CheckFsEntry } from './resolve-check-package.ts'
import {
  createChecksStore,
  emptyChecksState,
  type ChecksStore,
  type CheckRowStatus,
} from './checks-store.ts'
import { rerunFailedChecks, runChecksBatch } from './checks-runner.ts'
import { buildAgentFixPrompt } from './agent-fix-prompt.ts'
import css from './ChecksTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type ChecksTabProps = TabBodyProps & {
  t: Translate
  checks: ChecksStore
  remote: unknown
  getWorkspaceRoot: () => string | undefined
  listEntries: (dir: string) => Promise<readonly CheckFsEntry[]>
  readFile: (path: string) => Promise<string | undefined>
  gitDirtyPaths: () => Promise<readonly string[]>
  /** Subscribe to session.running falling edge for auto re-run. */
  watchRunningFallingEdge?: (cb: () => void) => () => void
  /** One-click hand-off of failed checks to the session Agent. */
  askAgent?: (text: string) => Promise<void>
  /** Jump to the Problems tab after a failed run. */
  openProblems?: () => void
}

/** Checks panel (see module doc). */
export function ChecksTab({
  t, checks, remote, visible,
  getWorkspaceRoot, listEntries, readFile, gitDirtyPaths,
  watchRunningFallingEdge, askAgent, openProblems,
}: ChecksTabProps) {
  const state = useChecks(checks)
  const abortRef = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!visible) return
    void refreshDiscovery()
  }, [visible])

  useEffect(() => {
    if (watchRunningFallingEdge === undefined) return
    return watchRunningFallingEdge(() => {
      const snap = checks.getSnapshot()
      if (!snap.autoRerunFailed || snap.busy) return
      if (!snap.rows.some(r => r.status === 'failed')) return
      void kick('failed')
    })
  }, [watchRunningFallingEdge, checks])

  async function refreshDiscovery(): Promise<void> {
    try {
      await refreshChecksDiscovery({
        store: checks,
        workspaceRoot: getWorkspaceRoot(),
        listEntries,
        readFile,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function kick(mode: 'all' | 'related' | 'failed'): Promise<void> {
    const sessionRoot = getWorkspaceRoot()
    if (sessionRoot === undefined) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      await refreshDiscovery()
      const snap = checks.getSnapshot()
      const root = snap.packageRoot ?? sessionRoot
      const relatedPaths = mode === 'all' ? [] : await gitDirtyPaths()
      if (mode === 'failed') {
        await rerunFailedChecks({
          store: checks,
          remote,
          workspaceRoot: root,
          packageManager: snap.packageManager,
          discovered: snap.discovered,
          relatedPaths,
          relatedMode: true,
          signal: ac.signal,
        })
      } else {
        await runChecksBatch({
          store: checks,
          remote,
          workspaceRoot: root,
          packageManager: snap.packageManager,
          discovered: snap.discovered,
          relatedPaths,
          relatedMode: mode === 'related',
          signal: ac.signal,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      checks.set({ busy: false })
    }
  }

  function stop(): void {
    abortRef.current?.abort()
    checks.set({ busy: false })
  }

  async function handOff(): Promise<void> {
    const send = askAgent
    /* v8 ignore next -- the button is hidden when askAgent is missing */
    if (send === undefined) return
    const snap = checks.getSnapshot()
    const failed = snap.rows.filter(row => row.status === 'failed')
    /* v8 ignore next -- the button is hidden when nothing failed */
    if (failed.length === 0) return
    setAsking(true)
    try {
      await send(buildAgentFixPrompt({
        failed: failed.map(row => ({
          kind: row.kind,
          script: row.script,
          command: row.command,
          exitCode: row.exitCode,
        })),
        log: snap.log,
        dirtyPaths: await gitDirtyPaths(),
      }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAsking(false)
    }
  }

  const failedCount = state.rows.filter(row => row.status === 'failed').length
  const packageLabel = state.packageRoot ?? state.workspaceRoot

  return (
    <div className={css.root} data-testid="xmart-checks-tab">
      <div className={css.toolbar}>
        <button type="button" data-testid="xmart-checks-related" disabled={state.busy} onClick={() => { void kick('related') }}>
          {t('checks.runRelated')}
        </button>
        <button type="button" data-testid="xmart-checks-all" disabled={state.busy} onClick={() => { void kick('all') }}>
          {t('checks.runAll')}
        </button>
        <button type="button" data-testid="xmart-checks-stop" disabled={!state.busy} onClick={() => { stop() }}>
          {t('checks.stop')}
        </button>
        {askAgent !== undefined && failedCount > 0
          ? (
            <button
              type="button"
              data-testid="xmart-checks-ask-agent"
              disabled={state.busy || asking}
              onClick={() => { void handOff() }}
            >
              {t('checks.askAgent')}
            </button>
          )
          : null}
        {openProblems !== undefined && failedCount > 0
          ? (
            <button
              type="button"
              data-testid="xmart-checks-open-problems"
              onClick={() => { openProblems() }}
            >
              {t('checks.openProblems')}
            </button>
          )
          : null}
        <label className={css.toggle}>
          <input
            type="checkbox"
            checked={state.autoRerunFailed}
            data-testid="xmart-checks-autorerun"
            onChange={(e) => { checks.set({ autoRerunFailed: e.target.checked }) }}
          />
          {t('checks.autoRerun')}
        </label>
      </div>
      {error !== null ? <div className={css.error} data-testid="xmart-checks-error">{error}</div> : null}
      {state.workspaceRoot === undefined
        ? <div className={css.empty}>{t('checks.noWorkspace')}</div>
        : (
          <>
            {packageLabel !== undefined
              ? (
                <div className={css.rootPath} data-testid="xmart-checks-package-root" title={packageLabel}>
                  {t('checks.packageRoot').replace('{path}', packageLabel)}
                </div>
              )
              : null}
            <ul className={css.rows} data-testid="xmart-checks-rows">
              {state.rows.map(row => (
                <li
                  key={row.kind}
                  data-testid={`xmart-checks-row-${row.kind}`}
                  data-status={row.status}
                  className={row.status === 'failed' && openProblems !== undefined ? css.rowClickable : undefined}
                  onClick={() => {
                    if (row.status === 'failed' && openProblems !== undefined) openProblems()
                  }}
                >
                  <span className={css.kind}>{row.kind}</span>
                  <span className={css.script} title={row.command || row.script}>
                    {row.command || row.script}
                  </span>
                  <span className={css.status}>{statusLabel(t, row.status)}</span>
                </li>
              ))}
              {state.rows.length === 0
                ? <li className={css.empty}>{t('checks.none')}</li>
                : null}
            </ul>
            <pre className={css.log} data-testid="xmart-checks-log">{state.log || t('checks.logEmpty')}</pre>
          </>
        )}
    </div>
  )
}

function useChecks(checks: ChecksStore) {
  const [state, setState] = useState(checks.getSnapshot())
  useEffect(() => checks.subscribe(() => {
    setState(checks.getSnapshot())
  }), [checks])
  return state
}

function statusLabel(t: Translate, status: CheckRowStatus): string {
  const key = `checks.status.${status}` as WorkbenchKey
  return t(key)
}

/** Re-export factory for tests that want an isolated store. */
export { createChecksStore, emptyChecksState }
