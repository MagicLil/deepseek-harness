/**
 * Git tab: Cursor-style staged / changes lists, hover verbs, commit, log, diff.
 * When the session cwd is a multi-project folder, discovers git repos in
 * immediate child directories (VS Code `git.autoRepositoryDetection`).
 */
import { useEffect, useState } from 'react'
import type {
  FileListing, GitBranch, GitChange, GitLogEntry, GitStatus, GitSyncMode,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  IconCheckOutline16, IconPlusOutline16, IconRefreshOutline16, IconSparkle16,
  Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { letter, markKind } from './git-marks.ts'
import { absPath, basename } from './route-file.ts'
import {
  probeGitRoots, readGitSnapshot, visibleChildDirectories,
} from './git-root.ts'
import { gitFileKind, gitPathParts } from './git-display.ts'
import { gitLaneClass, gitRefClass, layoutGitGraph, type GitGraphRef } from './git-graph.ts'
import {
  gitActionMessage, gitChangeKey, gitDiffSideOf, gitMenuItemIds, gitSectionPaths,
  isGitBranchName, partitionGitChanges, runGitSyncSequence,
} from './git-scm.ts'
import css from './GitTab.module.css'

type Translate = (key: WorkbenchKey) => string
type Phase = 'loading' | 'ready' | 'missing' | 'error'

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
  gitLog: (path: string, limit?: number) => Promise<GitLogEntry[]>
  gitSync: (path: string, mode: GitSyncMode) => Promise<void>
  gitBranches: (path: string, signal?: AbortSignal) => Promise<GitBranch[]>
  gitCheckout: (path: string, name: string, create?: boolean) => Promise<void>
  gitCheckoutCommit: (path: string, hash: string) => Promise<void>
  gitSuggestCommit: (path: string, sessionId: string) => Promise<{ message: string }>
  openFile: (path: string) => void
  openDiff: (side: 'worktree' | 'staged', file: string) => void
  openCommit: (hash: string, subject: string) => void
  files: WorkbenchFilesStore
}

/** Git SCM tab body. */
export function GitTab({
  sessionId, t, getCwd, watchSessions, listEntries, gitStatus, gitStage, gitUnstage,
  gitDiscard, gitCommit, gitLog, gitSync, gitBranches, gitCheckout, gitCheckoutCommit,
  gitSuggestCommit, openFile, openDiff, openCommit, files,
}: GitTabProps) {
  const [cwd, setCwd] = useState(() => getCwd(sessionId))
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<GitStatus | undefined>()
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [repos, setRepos] = useState<string[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [detail, setDetail] = useState<string | undefined>()
  const [message, setMessage] = useState('')
  const [newBranch, setNewBranch] = useState('')
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [actionError, setActionError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [activeHash, setActiveHash] = useState<string>()
  const [menu, setMenu] = useState<{ change: GitChange; x: number; y: number } | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => watchSessions(() => { setCwd(getCwd(sessionId)) }), [getCwd, sessionId, watchSessions])
  useEffect(() => files.subscribe(() => { setNonce(files.getSnapshot().refreshNonce) }), [files])
  useEffect(() => {
    setSelected(undefined)
    setRepos([])
  }, [cwd])

  useEffect(() => {
    if (cwd === undefined || cwd === '') {
      setPhase('missing')
      setStatus(undefined)
      return
    }
    const controller = new AbortController()
    setPhase('loading')
    const apply = async (next: GitStatus, rows: GitLogEntry[], roots?: string[]) => {
      setStatus(next)
      setLog(rows)
      setRepos(current => roots ?? (current.length > 0 ? current : [next.root]))
      setDetail(undefined)
      setPhase('ready')
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
  }, [cwd, nonce, selected, gitStatus, gitLog, gitBranches, listEntries])

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
  const canCommit = message.trim() !== '' && staged.length > 0
  const canSuggest = staged.length > 0 && !busy && !suggesting
  const graph = layoutGitGraph(log)
  const suggest = () => {
    setSuggesting(true)
    setActionError(undefined)
    void gitSuggestCommit(root, sessionId).then(
      (result) => {
        setSuggesting(false)
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
            <select
              className={css.repo}
              aria-label={t('git.repo')}
              data-testid="xmart-workbench-git-repo"
              value={root}
              onChange={(event) => { setSelected(event.target.value) }}
            >
              {repos.map(path => (
                <option key={path} value={path}>{basename(path)}</option>
              ))}
            </select>
          )
          : null}
        {branches.length > 0
          ? (
            <select
              className={css.branchSelect}
              aria-label={t('git.branch')}
              data-testid="xmart-workbench-git-branch"
              disabled={busy || status.detached}
              value={status.detached ? '' : status.branch}
              onChange={(event) => {
                const name = event.target.value
                if (name === '' || name === status.branch) return
                run(() => gitCheckout(root, name))
              }}
            >
              {status.detached ? <option value="">{t('git.detached')}</option> : null}
              {branches.map(row => (
                <option key={row.name} value={row.name}>{row.name}</option>
              ))}
            </select>
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
      <form
        className={css.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!canCommit) return
          run(() => gitCommit(root, message.trim()).then(() => { setMessage('') }))
        }}
      >
        <textarea
          className={css.input}
          rows={2}
          value={message}
          onChange={(event) => { setMessage(event.target.value) }}
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
      <div className={css.body}>
        {staged.length === 0 && unstaged.length === 0
          ? <div className={css.note}>{t('git.clean')}</div>
          : (
            <>
              {staged.length > 0
                ? (
                  <section data-testid="xmart-git-staged">
                    <div className={css.sectionHead}>
                      <span>{t('git.staged')} · {staged.length}</span>
                      <span className={css.sectionActions}>
                        <button
                          type="button"
                          className={css.tool}
                          onClick={() => { run(() => gitUnstage(root, gitSectionPaths(staged))) }}
                        >
                          {t('git.unstageAll')}
                        </button>
                      </span>
                    </div>
                    {staged.map(change => (
                      <GitChangeRow
                        key={gitChangeKey(change)}
                        change={change}
                        t={t}
                        onOpen={() => { openDiff(gitDiffSideOf(change), change.path) }}
                        onMenu={(x, y) => { setMenu({ change, x, y }) }}
                        onUnstage={() => { run(() => gitUnstage(root, [change.path])) }}
                      />
                    ))}
                  </section>
                )
                : null}
              {unstaged.length > 0
                ? (
                  <section data-testid="xmart-git-changes">
                    <div className={css.sectionHead}>
                      <span>{t('git.changes')} · {unstaged.length}</span>
                      <span className={css.sectionActions}>
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
                      </span>
                    </div>
                    {unstaged.map(change => (
                      <GitChangeRow
                        key={gitChangeKey(change)}
                        change={change}
                        t={t}
                        onOpen={() => { openDiff(gitDiffSideOf(change), change.path) }}
                        onMenu={(x, y) => { setMenu({ change, x, y }) }}
                        onStage={() => { run(() => gitStage(root, [change.path])) }}
                        onDiscard={() => { run(() => gitDiscard(root, [change.path])) }}
                      />
                    ))}
                  </section>
                )
                : null}
            </>
          )}
        {graph.length > 0
          ? (
            <section data-testid="xmart-git-history">
              <div className={css.sectionHead}>{t('git.graph')}</div>
              {graph.map(row => (
                <div
                  key={row.hash}
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
                      openCommit(row.hash, row.subject)
                    }}
                  >
                    <svg
                      className={css.graph}
                      width={row.railCount * GRAPH_LANE + 8}
                      height={GRAPH_ROW}
                      aria-hidden
                    >
                      {row.rails.map(rail => (
                        <line
                          key={rail}
                          className={css[gitLaneClass(rail)]}
                          x1={rail * GRAPH_LANE + 6}
                          y1={0}
                          x2={rail * GRAPH_LANE + 6}
                          y2={GRAPH_ROW}
                        />
                      ))}
                      {row.merges.map(edge => (
                        <path
                          key={`${edge.from}-${edge.to}`}
                          className={css[gitLaneClass(edge.to)]}
                          fill="none"
                          d={`M ${edge.from * GRAPH_LANE + 6} ${GRAPH_MID} C ${edge.from * GRAPH_LANE + 6} ${GRAPH_ROW - 2}, ${edge.to * GRAPH_LANE + 6} ${GRAPH_MID}, ${edge.to * GRAPH_LANE + 6} ${GRAPH_ROW}`}
                        />
                      ))}
                      {row.refs.some(ref => ref.kind === 'head')
                        ? (
                          <circle
                            className={`${css.headRing} ${css[gitLaneClass(row.lane)]}`}
                            cx={row.lane * GRAPH_LANE + 6}
                            cy={GRAPH_MID}
                            r={6}
                          />
                        )
                        : null}
                      <circle
                        className={css[gitLaneClass(row.lane)]}
                        cx={row.lane * GRAPH_LANE + 6}
                        cy={GRAPH_MID}
                        r={4}
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
              ))}
            </section>
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
  const fileKind = gitFileKind(parts.name)
  return (
    <div
      className={css.row}
      data-testid={`xmart-git-row-${gitChangeKey(props.change)}`}
    >
      <span className={`${css.glyph} ${css[fileKind]}`} aria-hidden>
        {parts.name.slice(0, 1).toUpperCase()}
      </span>
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
  if (id === 'diff-work') ops.openDiff('worktree', change.path)
  if (id === 'diff-staged') ops.openDiff('staged', change.path)
  if (id === 'open') ops.openFile(absPath(root, change.path))
}

const GRAPH_ROW = 28
const GRAPH_LANE = 12
const GRAPH_MID = 14
