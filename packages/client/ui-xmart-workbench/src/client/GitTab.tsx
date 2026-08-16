/**
 * Git tab: Cursor-style staged / changes lists, hover verbs, commit, log, diff.
 * When the session cwd is a multi-project folder, discovers git repos in
 * immediate child directories (VS Code `git.autoRepositoryDetection`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  FileListing, GitBranch, GitChange, GitLogEntry, GitStatus, GitSyncMode,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  HoverCard, IconCheckOutline16, IconChevronDownOutline14, IconCopyOutline16,
  IconLinkOutline16, IconPlusOutline16, IconRefreshOutline16, IconSparkle16,
  IconUserOutline16, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { letter, markKind } from './git-marks.ts'
import { absPath, basename } from './route-file.ts'
import { FileIcon } from './FileIcon.tsx'
import {
  probeGitRoots, readGitSnapshot, visibleChildDirectories,
} from './git-root.ts'
import { gitPathParts } from './git-display.ts'
import {
  GIT_GRAPH_DOT, GIT_GRAPH_MERGE_DOT, GIT_GRAPH_MERGE_RING, GIT_GRAPH_MID, GIT_GRAPH_ROW,
  gitGraphMergePath, gitGraphPageWidth, gitGraphX, gitLaneClass, gitRefClass,
  layoutGitGraph, type GitGraphNode, type GitGraphRef,
} from './git-graph.ts'
import { gitHoverModel, gitRelativeLabel, gitWebLabel } from './git-hover.ts'
import {
  GIT_LOG_PAGE_SIZE, canRequestGitLogPage, gitHistoryObserverTarget, gitLogHasMore,
  mergeGitLogPage, observeGitHistorySentinel, shouldLoadMoreFromScroll,
} from './git-log-page.ts'
import {
  EMPTY_GIT_BADGE, gitChangeCounts, type GitBadgeStore,
} from './git-badge.ts'
import {
  gitActionMessage, gitBranchPickerItems, gitChangeKey, gitCheckoutNameForPicker,
  gitDiffSideOf, gitMenuItemIds, gitSectionPaths, isGitBranchName,
  localBranchNameForRemote, partitionGitChanges, runGitSyncSequence,
} from './git-scm.ts'
import { stagedFingerprint } from './change-summary.ts'
import { draftCommitMessage } from './commit-message.ts'
import { recommendGates } from './recommend-gates.ts'
import { canCreateCommit, precommitBlockReason } from './precommit-gate.ts'
import { refreshChecksDiscovery } from './checks-discover.ts'
import { peekWorkspaceChecks } from './checks-client.ts'
import { runChecksBatch } from './checks-runner.ts'
import { buildAgentFixPrompt } from './agent-fix-prompt.ts'
import { PrecommitSection } from './PrecommitSection.tsx'
import type { ChecksStore } from './checks-store.ts'
import type { CheckFsEntry } from './resolve-check-package.ts'
import type { CheckKind } from './discover-scripts.ts'
import css from './GitTab.module.css'

type Translate = (key: WorkbenchKey) => string
type Phase = 'loading' | 'ready' | 'missing' | 'error'

/**
 * Toolbar picker whose open list paints color and background on the same
 * row. Native `<select>` and a portaled Menu both split those two paints
 * (OS chrome / another package's CSS), which is the contrast failure.
 */
function GitToolbarSelect(props: {
  label: string
  testId: string
  value: string
  display: string
  disabled?: boolean
  items: readonly { id: string; label: string; heading?: boolean }[]
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const root = rootRef.current
    /* v8 ignore next -- the trigger span is committed before this effect */
    if (root === null) return
    const onPointerDown = (event: PointerEvent) => {
      if (root.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span ref={rootRef} className={css.picker}>
      <button
        type="button"
        className={css.branchSelect}
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={props.testId}
        disabled={props.disabled}
        title={props.display}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className={css.pickerLabel}>{props.display}</span>
        <IconChevronDownOutline14 className={css.pickerChevron} />
      </button>
      {open
        ? (
          <div className={css.pickerMenu} role="menu" data-testid={`${props.testId}-menu`}>
            {props.items.map(item => (
              item.heading === true
                ? (
                  <div key={item.id} className={css.pickerHeading} role="presentation">{item.label}</div>
                )
                : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={item.id === props.value ? `${css.pickerItem} ${css.pickerItemCurrent}` : css.pickerItem}
                    onClick={() => {
                      setOpen(false)
                      props.onSelect(item.id)
                    }}
                  >
                    {item.label}
                  </button>
                )
            ))}
          </div>
        )
        : null}
    </span>
  )
}

export type GitTabProps = TabBodyProps & {
  t: Translate
  getCwd: (sessionId: string) => string | undefined
  watchSessions: (fn: () => void) => () => void
  listEntries: (path: string, signal?: AbortSignal) => Promise<FileListing>
  gitStatus: (path: string, signal?: AbortSignal) => Promise<GitStatus>
  gitStage: (path: string, files: readonly string[]) => Promise<void>
  gitUnstage: (path: string, files: readonly string[]) => Promise<void>
  gitDiscard: (path: string, files: readonly string[]) => Promise<void>
  gitCommit: (path: string, message: string) => Promise<unknown>
  gitLog: (
    path: string,
    limit?: number,
    signal?: AbortSignal,
    skip?: number,
  ) => Promise<GitLogEntry[]>
  gitSync: (path: string, mode: GitSyncMode) => Promise<void>
  gitBranches: (path: string, signal?: AbortSignal) => Promise<GitBranch[]>
  gitCheckout: (path: string, name: string, create?: boolean) => Promise<void>
  gitCheckoutCommit: (path: string, hash: string) => Promise<void>
  gitSuggestCommit: (path: string, sessionId: string) => Promise<{ message: string }>
  openFile: (path: string) => void
  openDiff: (side: 'worktree' | 'staged', file: string, root: string) => void
  openCommit: (hash: string, subject: string, root: string) => void
  files: WorkbenchFilesStore
  gitBadge: GitBadgeStore
  /** Shared Checks store (optional in unit tests). */
  checks?: ChecksStore
  checksRemote?: unknown
  listCheckEntries?: (dir: string) => Promise<readonly CheckFsEntry[]>
  readCheckFile?: (path: string) => Promise<string | undefined>
  askAgent?: (text: string) => Promise<void>
  openChecks?: () => void
}

/** Git SCM tab body. */
export function GitTab({
  sessionId, t, getCwd, watchSessions, listEntries, gitStatus, gitStage, gitUnstage,
  gitDiscard, gitCommit, gitLog, gitSync, gitBranches, gitCheckout, gitCheckoutCommit,
  gitSuggestCommit, openFile, openDiff, openCommit, files, gitBadge,
  checks, checksRemote, listCheckEntries, readCheckFile, askAgent, openChecks,
}: GitTabProps) {
  const [cwd, setCwd] = useState(() => getCwd(sessionId))
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<GitStatus | undefined>()
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [logHasMore, setLogHasMore] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [repos, setRepos] = useState<string[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [detail, setDetail] = useState<string | undefined>()
  const [message, setMessage] = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [actionError, setActionError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [asking, setAsking] = useState(false)
  const [checkTick, setCheckTick] = useState(0)
  const messageTouched = useRef(false)
  const stagedFp = useRef('')
  const [activeHash, setActiveHash] = useState<string>()
  const [menu, setMenu] = useState<{ change: GitChange; x: number; y: number } | null>(null)
  const [nonce, setNonce] = useState(0)
  const [sectionOpen, setSectionOpen] = useState({ staged: true, changes: true, graph: true })
  const toggleSection = (key: keyof typeof sectionOpen) => {
    setSectionOpen(current => ({ ...current, [key]: !current[key] }))
  }
  const bodyRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const logRef = useRef(log)
  const hasMoreRef = useRef(false)
  const moreLock = useRef(false)
  const rootRef = useRef<string | undefined>()
  logRef.current = log

  useEffect(() => watchSessions(() => { setCwd(getCwd(sessionId)) }), [getCwd, sessionId, watchSessions])
  useEffect(() => files.subscribe(() => { setNonce(files.getSnapshot().refreshNonce) }), [files])
  useEffect(() => {
    if (checks === undefined) return
    return checks.subscribe(() => { setCheckTick(n => n + 1) })
  }, [checks])
  useEffect(() => {
    setSelected(undefined)
    setRepos([])
  }, [cwd])
  useEffect(() => {
    if (checks === undefined || status === undefined) return
    if (listCheckEntries === undefined || readCheckFile === undefined) return
    void refreshChecksDiscovery({
      store: checks,
      workspaceRoot: status.root,
      listEntries: listCheckEntries,
      readFile: readCheckFile,
    }).catch(() => undefined)
  }, [checks, listCheckEntries, readCheckFile, status?.root])
  useEffect(() => {
    if (status === undefined) return
    const next = stagedFingerprint(status.changes)
    if (next === stagedFp.current) return
    stagedFp.current = next
    setConfirmed(false)
    const stagedRows = partitionGitChanges(status.changes).staged
    if (!messageTouched.current && stagedRows.length > 0) {
      setMessage(draftCommitMessage(status.changes))
    }
  }, [status])

  useEffect(() => {
    if (cwd === undefined || cwd === '') {
      setPhase('missing')
      setStatus(undefined)
      gitBadge.set(sessionId, EMPTY_GIT_BADGE)
      return
    }
    const controller = new AbortController()
    setPhase(current => (current === 'ready' ? 'ready' : 'loading'))
    const apply = async (next: GitStatus, rows: GitLogEntry[], roots?: string[]) => {
      setStatus(next)
      setLog(rows)
      const more = gitLogHasMore(rows)
      hasMoreRef.current = more
      rootRef.current = next.root
      moreLock.current = false
      setLogHasMore(more)
      setLogLoading(false)
      setRepos(current => roots ?? (current.length > 0 ? current : [next.root]))
      setDetail(undefined)
      setPhase('ready')
      gitBadge.set(sessionId, { ...gitChangeCounts(next.changes), root: next.root })
      let listed: GitBranch[] = []
      try {
        listed = await gitBranches(next.root, controller.signal)
      }
      catch {
        listed = []
      }
      if (!controller.signal.aborted) setBranches(listed)
    }
    const fail = (unavailable: boolean, text: string | undefined) => {
      setStatus(undefined)
      setDetail(text)
      setPhase(unavailable ? 'missing' : 'error')
      gitBadge.set(sessionId, EMPTY_GIT_BADGE)
    }
    void (async () => {
      const first = await readGitSnapshot(selected ?? cwd, gitStatus, gitLog, controller.signal)
      if (controller.signal.aborted) return
      if (first.ok) {
        await apply(first.status, first.log)
        return
      }
      if (selected !== undefined || !first.unavailable) {
        fail(first.unavailable, first.message)
        return
      }
      let children: string[]
      try {
        children = visibleChildDirectories(await listEntries(cwd, controller.signal))
      }
      catch {
        fail(true, first.message)
        return
      }
      const found = await probeGitRoots(children, gitStatus, controller.signal)
      const pick = found[0]
      if (pick === undefined) {
        fail(true, first.message)
        return
      }
      const nested = await readGitSnapshot(pick, gitStatus, gitLog, controller.signal)
      if (!nested.ok) {
        fail(nested.unavailable, nested.message)
        return
      }
      await apply(nested.status, nested.log, found)
      setSelected(pick)
    })()
    return () => { controller.abort() }
  }, [cwd, nonce, selected, sessionId, gitStatus, gitLog, gitBranches, listEntries, gitBadge])

  const requestMore = () => {
    const nextRoot = rootRef.current
    if (!canRequestGitLogPage(nextRoot, moreLock.current, hasMoreRef.current)) return
    moreLock.current = true
    setLogLoading(true)
    void gitLog(nextRoot, GIT_LOG_PAGE_SIZE, undefined, logRef.current.length).then(
      (rows) => {
        const page = Array.isArray(rows) ? rows : []
        const merged = mergeGitLogPage(logRef.current, page)
        setLog(merged.rows)
        hasMoreRef.current = merged.hasMore
        setLogHasMore(merged.hasMore)
        moreLock.current = false
        setLogLoading(false)
      },
      () => {
        moreLock.current = false
        setLogLoading(false)
      },
    )
  }

  useEffect(() => {
    const target = gitHistoryObserverTarget(logHasMore, moreRef.current)
    if (target === null) return
    return observeGitHistorySentinel(target, bodyRef.current, requestMore)
  }, [logHasMore, log.length, gitLog])

  if (cwd === undefined || cwd === '') {
    return <div className={css.note} data-testid="xmart-workbench-git">{t('git.noWorkspace')}</div>
  }
  if (phase === 'loading') {
    return <div className={css.note} data-testid="xmart-workbench-git">{t('git.loading')}</div>
  }
  if (phase === 'missing') {
    return <div className={css.note} data-testid="xmart-workbench-git">{t('git.missing')}</div>
  }
  if (phase === 'error' || status === undefined) {
    return (
      <div className={css.note} data-testid="xmart-workbench-git">
        {t('git.error')}
        {detail !== undefined && detail !== '' ? <div>{detail}</div> : null}
        <button type="button" className={css.tool} onClick={() => { files.bumpRefresh() }}>{t('explorer.retry')}</button>
      </div>
    )
  }

  const root = status.root
  const { staged, unstaged } = partitionGitChanges(status.changes)
  const run = (op: () => Promise<unknown>) => {
    setBusy(true)
    setActionError(undefined)
    void op().then(
      () => {
        setBusy(false)
        files.bumpRefresh()
      },
      (error: unknown) => {
        setBusy(false)
        setActionError(gitActionMessage(error))
        files.bumpRefresh()
      },
    )
  }
  const checkSnap = checks?.getSnapshot()
  void checkTick
  const dirtyPaths = status.changes.map(change => change.path)
  const startRecommended = (onlyKind?: CheckKind) => {
    if (checks === undefined) return
    if (peekWorkspaceChecks(checksRemote) === undefined) {
      setActionError(t('precommit.remoteMissing'))
      return
    }
    const snap = checks.getSnapshot()
    run(() => runChecksBatch({
      store: checks,
      remote: checksRemote,
      workspaceRoot: snap.packageRoot ?? root,
      packageManager: snap.packageManager,
      discovered: snap.discovered,
      relatedPaths: dirtyPaths,
      relatedMode: onlyKind === undefined,
      ...(onlyKind === undefined ? {} : { onlyKinds: [onlyKind] }),
    }))
    openChecks?.()
  }
  const gates = checkSnap === undefined
    ? []
    : recommendGates(checkSnap.discovered, dirtyPaths, checkSnap.packageManager)
  const gateRows = gates.map(gate => ({
    recommended: gate.recommended,
    status: checkSnap?.rows.find(row => row.kind === gate.kind)?.status ?? 'idle',
  }))
  const canCommit = canCreateCommit({
    message,
    stagedCount: staged.length,
    confirmed,
    gates: gateRows,
  })
  const blockReason = precommitBlockReason({
    message,
    stagedCount: staged.length,
    confirmed,
    gates: gateRows,
  })
  const canSuggest = staged.length > 0 && !busy && !suggesting
  const graph = layoutGitGraph(log)
  const graphWidth = gitGraphPageWidth(graph)
  const suggest = () => {
    setSuggesting(true)
    setActionError(undefined)
    void gitSuggestCommit(root, sessionId).then(
      (result) => {
        setSuggesting(false)
        messageTouched.current = true
        setMessage(result.message)
      },
      (error: unknown) => {
        setSuggesting(false)
        setActionError(gitActionMessage(error))
      },
    )
  }

  return (
    <div className={css.root} data-testid="xmart-workbench-git">
      <div className={css.toolbar}>
        {repos.length > 1
          ? (
            <GitToolbarSelect
              label={t('git.repo')}
              testId="xmart-workbench-git-repo"
              value={root}
              display={basename(root)}
              items={repos.map(path => ({ id: path, label: basename(path) }))}
              onSelect={(path) => { setSelected(path) }}
            />
          )
          : (
            <span className={css.repo} data-testid="xmart-workbench-git-repo-name" title={root}>
              {basename(root)}
            </span>
          )}
        {branches.length > 0
          ? (
            <GitToolbarSelect
              label={t('git.branch')}
              testId="xmart-workbench-git-branch"
              value={status.detached ? '' : status.branch}
              display={status.detached ? t('git.detached') : status.branch}
              disabled={busy}
              items={gitBranchPickerItems(branches, {
                local: t('git.localBranches'),
                remote: t('git.remoteBranches'),
              })}
              onSelect={(id) => {
                const name = gitCheckoutNameForPicker(id, branches)
                if (name === undefined || name === status.branch) return
                run(() => gitCheckout(root, name))
              }}
            />
          )
          : (
            <span className={css.branch}>
              {status.detached ? t('git.detached') : status.branch}
            </span>
          )}
        <button
          type="button"
          className={`${css.iconBtn} ${busy ? css.syncing : ''}`}
          data-testid="xmart-workbench-git-sync"
          disabled={busy}
          aria-label={busy ? t('git.syncing') : t('git.sync')}
          onClick={() => { run(() => runGitSyncSequence(root, { gitSync, gitStatus })) }}
        >
          <IconRefreshOutline16 size={14} />
          <span className={css.counts}>
            {busy ? t('git.syncing') : null}
            {' '}
            ↑{status.ahead}
            {' '}
            ↓{status.behind}
          </span>
        </button>
        <button
          type="button"
          className={css.iconBtn}
          aria-label={t('explorer.refresh')}
          onClick={() => { files.bumpRefresh() }}
        >
          <IconRefreshOutline16 size={14} />
        </button>
      </div>
      <form
        className={css.branchForm}
        onSubmit={(event) => {
          event.preventDefault()
          const name = newBranch.trim()
          if (!isGitBranchName(name)) {
            setActionError(t('git.badBranch'))
            return
          }
          run(() => gitCheckout(root, name, true).then(() => { setNewBranch('') }))
        }}
      >
        <input
          className={css.input}
          value={newBranch}
          disabled={busy}
          onChange={(event) => { setNewBranch(event.target.value) }}
          placeholder={t('git.newBranch')}
          aria-label={t('git.newBranch')}
        />
        <button
          type="submit"
          className={css.iconBtn}
          disabled={busy || newBranch.trim() === ''}
          aria-label={t('git.createBranch')}
        >
          <IconPlusOutline16 size={12} />
        </button>
      </form>
      {actionError !== undefined && actionError !== ''
        ? <div className={css.actionError} data-testid="xmart-workbench-git-action-error">{actionError}</div>
        : null}
      <PrecommitSection
        t={t}
        changes={status.changes}
        gates={gates}
        rows={checkSnap?.rows ?? []}
        busy={busy || checkSnap?.busy === true}
        asking={asking}
        confirmed={confirmed}
        blockReason={blockReason}
        onConfirm={setConfirmed}
        onRunRecommended={() => { startRecommended() }}
        onRunGate={(kind) => { startRecommended(kind) }}
        onAskAgent={askAgent === undefined
          ? undefined
          : () => {
            /* v8 ignore next -- the Agent button only renders when checks exist */
            if (checkSnap === undefined) return
            const failed = checkSnap.rows.filter(row => row.status === 'failed')
            setAsking(true)
            void askAgent(buildAgentFixPrompt({
              failed: failed.map(row => ({
                kind: row.kind,
                script: row.script,
                command: row.command,
                exitCode: row.exitCode,
              })),
              log: checkSnap.log,
              dirtyPaths,
            })).then(() => { setAsking(false); openChecks?.() }, (error: unknown) => {
              setAsking(false)
              setActionError(gitActionMessage(error))
            })
          }}
      />
      <form
        className={css.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!canCommit) return
          run(() => gitCommit(root, message.trim()).then(() => {
            setMessage('')
            setConfirmed(false)
            messageTouched.current = false
            stagedFp.current = ''
          }))
        }}
      >
        <textarea
          className={css.input}
          rows={2}
          value={message}
          onChange={(event) => {
            messageTouched.current = true
            setMessage(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={t('git.commitPlaceholder')}
          aria-label={t('git.commitPlaceholder')}
        />
        <button
          type="button"
          className={css.commit}
          disabled={!canSuggest}
          aria-label={suggesting ? t('git.generating') : t('git.generate')}
          data-testid="xmart-git-suggest"
          onClick={suggest}
        >
          <IconSparkle16 size={16} />
        </button>
        <button type="submit" className={css.commit} disabled={!canCommit || busy} aria-label={t('git.commit')}>
          <IconCheckOutline16 size={16} />
        </button>
      </form>
      <div
        ref={bodyRef}
        className={css.body}
        data-testid="xmart-git-body"
        onScroll={(event) => {
          if (shouldLoadMoreFromScroll(event.currentTarget)) requestMore()
        }}
      >
        {staged.length === 0 && unstaged.length === 0
          ? <div className={css.note}>{t('git.clean')}</div>
          : (
            <>
              {staged.length > 0
                ? (
                  <GitChangeSection
                    testId="xmart-git-staged"
                    title={t('git.staged')}
                    open={sectionOpen.staged}
                    onToggle={() => { toggleSection('staged') }}
                    count={staged.length}
                    countTestId="xmart-git-staged-count"
                    actions={(
                      <button
                        type="button"
                        className={css.tool}
                        onClick={() => { run(() => gitUnstage(root, gitSectionPaths(staged))) }}
                      >
                        {t('git.unstageAll')}
                      </button>
                    )}
                  >
                    {staged.map(change => (
                      <GitChangeRow
                        key={gitChangeKey(change)}
                        change={change}
                        t={t}
                        onOpen={() => { openDiff(gitDiffSideOf(change), change.path, root) }}
                        onMenu={(x, y) => { setMenu({ change, x, y }) }}
                        onUnstage={() => { run(() => gitUnstage(root, [change.path])) }}
                      />
                    ))}
                  </GitChangeSection>
                )
                : null}
              {unstaged.length > 0
                ? (
                  <GitChangeSection
                    testId="xmart-git-changes"
                    title={t('git.changes')}
                    open={sectionOpen.changes}
                    onToggle={() => { toggleSection('changes') }}
                    count={unstaged.length}
                    countTestId="xmart-git-changes-count"
                    actions={(
                      <>
                        <button
                          type="button"
                          className={css.tool}
                          onClick={() => { run(() => gitStage(root, gitSectionPaths(unstaged))) }}
                        >
                          {t('git.stageAll')}
                        </button>
                        <button
                          type="button"
                          className={css.tool}
                          onClick={() => { run(() => gitDiscard(root, gitSectionPaths(unstaged))) }}
                        >
                          {t('git.discardAll')}
                        </button>
                      </>
                    )}
                  >
                    {unstaged.map(change => (
                      <GitChangeRow
                        key={gitChangeKey(change)}
                        change={change}
                        t={t}
                        onOpen={() => { openDiff(gitDiffSideOf(change), change.path, root) }}
                        onMenu={(x, y) => { setMenu({ change, x, y }) }}
                        onStage={() => { run(() => gitStage(root, [change.path])) }}
                        onDiscard={() => { run(() => gitDiscard(root, [change.path])) }}
                      />
                    ))}
                  </GitChangeSection>
                )
                : null}
            </>
          )}
        {graph.length > 0
          ? (
            <GitChangeSection
              testId="xmart-git-history"
              title={t('git.graph')}
              open={sectionOpen.graph}
              onToggle={() => { toggleSection('graph') }}
            >
              <div className={css.graphList}>
                {graph.map(row => (
                  <HoverCard
                    key={row.hash}
                    openDelayMs={HOVER_SHOW_MS}
                    cardClassName={css.hoverPlate}
                    content={<GitCommitHover row={row} t={t} />}
                    anchor={(
                      <div
                        className={`${css.history} ${activeHash === row.hash ? css.historyActive : ''}`}
                        data-testid={`xmart-git-graph-${row.hash}`}
                        data-active={activeHash === row.hash ? 'true' : undefined}
                      >
                        <button
                          type="button"
                          className={css.historyHit}
                          aria-label={t('git.openCommit')}
                          onClick={() => {
                            setActiveHash(row.hash)
                            openCommit(row.hash, row.subject, root)
                          }}
                        >
                          <svg
                            className={css.graph}
                            width={graphWidth}
                            height={GIT_GRAPH_ROW}
                            aria-hidden
                          >
                            {row.rails.map(rail => (
                              <line
                                key={rail}
                                className={css[gitLaneClass(rail)]}
                                x1={gitGraphX(rail)}
                                y1={-1}
                                x2={gitGraphX(rail)}
                                y2={GIT_GRAPH_ROW + 1}
                              />
                            ))}
                            {row.merges.map(edge => (
                              <path
                                key={`${edge.from}-${edge.to}-${edge.stub === true ? 'stub' : 'join'}`}
                                className={css[gitLaneClass(edge.to)]}
                                fill="none"
                                d={gitGraphMergePath(edge.from, edge.to, edge.stub === true, edge.join === true)}
                              />
                            ))}
                            {row.merge === true
                              ? (
                                <circle
                                  className={`${css.mergeRing} ${css[gitLaneClass(row.lane)]}`}
                                  cx={gitGraphX(row.lane)}
                                  cy={GIT_GRAPH_MID}
                                  r={GIT_GRAPH_MERGE_RING}
                                />
                              )
                              : null}
                            <circle
                              className={css[gitLaneClass(row.lane)]}
                              cx={gitGraphX(row.lane)}
                              cy={GIT_GRAPH_MID}
                              r={row.merge === true ? GIT_GRAPH_MERGE_DOT : GIT_GRAPH_DOT}
                            />
                          </svg>
                          <span className={css.historyBody}>
                            <span className={css.subject}>{row.subject}</span>
                            {row.author !== '' ? <span className={css.author}>{row.author}</span> : null}
                          </span>
                        </button>
                        {row.refs.length > 0
                          ? (
                            <span className={css.refs}>
                              {row.refs.map((ref: GitGraphRef) => (
                                <button
                                  key={`${ref.kind}:${ref.name}`}
                                  type="button"
                                  className={`${css.ref} ${css[gitRefClass(ref.kind)]}`}
                                  title={ref.kind === 'remote' || ref.kind === 'tag' ? t('git.checkoutCommit') : undefined}
                                  disabled={ref.kind === 'head' || busy}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (ref.kind === 'branch') {
                                      run(() => gitCheckout(root, ref.name))
                                      return
                                    }
                                    if (ref.kind === 'remote') {
                                      const local = localBranchNameForRemote(ref.name, branches)
                                      if (local !== undefined) {
                                        run(() => gitCheckout(root, local))
                                        return
                                      }
                                    }
                                    run(() => gitCheckoutCommit(root, row.hash))
                                  }}
                                >
                                  {ref.name}
                                </button>
                              ))}
                            </span>
                          )
                          : null}
                      </div>
                    )}
                  />
                ))}
              </div>
              {logHasMore
                ? (
                  <div
                    ref={moreRef}
                    className={css.historyMore}
                    data-testid="xmart-git-history-more"
                  >
                    {logLoading ? t('git.loadingMore') : null}
                  </div>
                )
                : null}
            </GitChangeSection>
          )
          : null}
      </div>
      <Menu
        open={menu !== null}
        onClose={() => { setMenu(null) }}
        portal
        compact
        getAnchorRect={() => gitMenuAnchor(menu)}
        items={gitMenuItemIds(menu?.change.area).map(id => ({ id, label: t(gitMenuLabel(id)) }))}
        onSelect={(id) => {
          const change = menu?.change
          setMenu(null)
          handleGitMenuSelect(id, change, root, root, {
            run, gitStage, gitUnstage, gitDiscard, openDiff, openFile,
          })
        }}
        anchor={<span />}
      />
    </div>
  )
}

function GitChangeSection(props: {
  testId: string
  title: string
  open: boolean
  onToggle: () => void
  count?: number
  countTestId?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section data-testid={props.testId}>
      <div className={css.sectionHead}>
        <button
          type="button"
          className={css.sectionToggle}
          aria-expanded={props.open}
          data-testid={`${props.testId}-toggle`}
          onClick={props.onToggle}
        >
          <span className={props.open ? css.chevron : `${css.chevron} ${css.chevronClosed}`} aria-hidden>
            <IconChevronDownOutline14 size={14} />
          </span>
          <span className={css.sectionTitle}>{props.title}</span>
        </button>
        {props.actions !== undefined
          ? <span className={css.sectionActions}>{props.actions}</span>
          : null}
        {props.count !== undefined
          ? (
            <span className={css.sectionCount} data-testid={props.countTestId}>
              {props.count}
            </span>
          )
          : null}
      </div>
      {props.open ? props.children : null}
    </section>
  )
}

function gitMenuLabel(id: string): WorkbenchKey {
  if (id === 'stage') return 'git.stage'
  if (id === 'unstage') return 'git.unstage'
  if (id === 'discard') return 'git.discard'
  if (id === 'diff-work') return 'git.diffWorktree'
  if (id === 'diff-staged') return 'git.diffStaged'
  return 'git.open'
}

function GitChangeRow(props: {
  change: GitChange
  t: Translate
  onOpen: () => void
  onMenu: (x: number, y: number) => void
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
}) {
  const kind = markKind(props.change.status)
  const parts = gitPathParts(props.change.path)
  return (
    <div
      className={css.row}
      data-testid={`xmart-git-row-${gitChangeKey(props.change)}`}
    >
      <FileIcon path={parts.name} kind="file" />
      <button
        type="button"
        className={css.path}
        aria-label={props.change.path}
        onClick={() => { props.onOpen() }}
        onContextMenu={(event) => {
          event.preventDefault()
          props.onMenu(event.clientX, event.clientY)
        }}
      >
        <span className={css.file}>{parts.name}</span>
        {parts.dir !== '' ? <span className={css.dir}>{parts.dir}</span> : null}
      </button>
      <span className={css.actions}>
        {props.onStage !== undefined
          ? (
            <button type="button" className={css.tool} aria-label={props.t('git.stage')} onClick={props.onStage}>
              +
            </button>
          )
          : null}
        {props.onUnstage !== undefined
          ? (
            <button type="button" className={css.tool} aria-label={props.t('git.unstage')} onClick={props.onUnstage}>
              −
            </button>
          )
          : null}
        {props.onDiscard !== undefined
          ? (
            <button type="button" className={css.tool} aria-label={props.t('git.discard')} onClick={props.onDiscard}>
              ↺
            </button>
          )
          : null}
      </span>
      <span className={`${css.mark} ${css[kind]}`}>{letter(props.change.status)}</span>
    </div>
  )
}

/** Menu anchor for a context-menu point, or the origin when closed. */
export function gitMenuAnchor(menu: { x: number; y: number } | null) {
  return {
    top: menu?.y ?? 0, left: menu?.x ?? 0, bottom: menu?.y ?? 0, right: menu?.x ?? 0,
    width: 0, height: 0, x: menu?.x ?? 0, y: menu?.y ?? 0, toJSON: () => ({}),
  }
}

/** Dispatch one Git context-menu verb. */
export function handleGitMenuSelect(
  id: string,
  change: GitChange | undefined,
  cwd: string,
  root: string,
  ops: {
    run: (op: () => Promise<unknown>) => void
    gitStage: GitTabProps['gitStage']
    gitUnstage: GitTabProps['gitUnstage']
    gitDiscard: GitTabProps['gitDiscard']
    openDiff: GitTabProps['openDiff']
    openFile: GitTabProps['openFile']
  },
): void {
  if (change === undefined) return
  if (id === 'stage') ops.run(() => ops.gitStage(cwd, [change.path]))
  if (id === 'unstage') ops.run(() => ops.gitUnstage(cwd, [change.path]))
  if (id === 'discard') ops.run(() => ops.gitDiscard(cwd, [change.path]))
  if (id === 'diff-work') ops.openDiff('worktree', change.path, root)
  if (id === 'diff-staged') ops.openDiff('staged', change.path, root)
  if (id === 'open') ops.openFile(absPath(root, change.path))
}

function GitCommitHover(props: { row: GitGraphNode; t: Translate }) {
  const [copied, setCopied] = useState(false)
  const model = gitHoverModel(props.row, Date.now())
  return (
    <div className={css.hover} data-testid="xmart-git-hover">
      <div className={css.hoverMeta}>
        {model.author !== ''
          ? (
            <span className={css.hoverAuthor}>
              <IconUserOutline16 size={12} />
              {model.author}
            </span>
          )
          : null}
        <span className={css.hoverTime}>
          <HoverClockIcon />
          {gitRelativeLabel(model.relative, props.t)}
          <span className={css.hoverExact}>({model.exact})</span>
        </span>
      </div>
      <div className={css.hoverSubject}>{model.subject}</div>
      {model.bodyLines.map(line => (
        <div key={line} className={css.hoverBody}>{line}</div>
      ))}
      {model.coAuthors.map(line => (
        <div key={line} className={css.hoverCoauthor}>Co-authored-by: {line}</div>
      ))}
      {model.refs.length > 0
        ? (
          <div className={css.hoverRefs}>
            {model.refs.map(ref => (
              <span key={`${ref.kind}:${ref.name}`} className={`${css.ref} ${css[gitRefClass(ref.kind)]}`}>
                {ref.name}
              </span>
            ))}
          </div>
        )
        : null}
      <div className={css.hoverRule} role="separator" />
      {model.stats !== undefined
        ? (
          <div className={css.hoverStats} data-testid="xmart-git-hover-stats">
            {model.stats.files}
            {model.stats.insertions !== undefined
              ? <span className={css.hoverIns} data-testid="xmart-git-hover-ins">, {model.stats.insertions}</span>
              : null}
            {model.stats.deletions !== undefined
              ? <span className={css.hoverDel} data-testid="xmart-git-hover-del">, {model.stats.deletions}</span>
              : null}
          </div>
        )
        : null}
      <div className={css.hoverFooter}>
        <button
          type="button"
          className={css.hoverHash}
          aria-label={copied ? props.t('git.copied') : props.t('git.copyHash')}
          onClick={() => {
            const clip = navigator.clipboard
            if (clip === undefined) return
            void clip.writeText(model.hash).then(() => { setCopied(true) })
          }}
        >
          <IconCopyOutline16 size={12} />
          {copied ? props.t('git.copied') : model.shortHash}
        </button>
        {model.web !== undefined
          ? (
            <a
              className={css.hoverLink}
              href={model.web.url}
              target="_blank"
              rel="noreferrer"
            >
              <IconLinkOutline16 size={12} />
              {gitWebLabel(model.web.host, props.t)}
            </a>
          )
          : null}
      </div>
    </div>
  )
}

function HoverClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const HOVER_SHOW_MS = 400
