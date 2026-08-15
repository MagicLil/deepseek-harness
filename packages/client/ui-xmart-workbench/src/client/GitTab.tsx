/**
 * Git tab: status, stage/unstage/discard, commit, log, and open-as-diff.
 * When the session cwd is a multi-project folder, discovers git repos in
 * immediate child directories (VS Code `git.autoRepositoryDetection`).
 */
import { useEffect, useState } from 'react'
import type { FileListing, GitChange, GitLogEntry, GitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchFilesStore } from './files-store.ts'
import { letter } from './git-marks.ts'
import { absPath, basename } from './route-file.ts'
import {
  probeGitRoots, readGitSnapshot, visibleChildDirectories,
} from './git-root.ts'
import css from './ExplorerTab.module.css'

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
  openFile: (path: string) => void
  openDiff: (side: 'worktree' | 'staged', file: string) => void
  files: WorkbenchFilesStore
}

/** Git SCM tab body. */
export function GitTab({
  sessionId, t, getCwd, watchSessions, listEntries, gitStatus, gitStage, gitUnstage,
  gitDiscard, gitCommit, gitLog, openFile, openDiff, files,
}: GitTabProps) {
  const [cwd, setCwd] = useState(() => getCwd(sessionId))
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<GitStatus | undefined>()
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [repos, setRepos] = useState<string[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [detail, setDetail] = useState<string | undefined>()
  const [message, setMessage] = useState('')
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
    const apply = (next: GitStatus, rows: GitLogEntry[], roots?: string[]) => {
      setStatus(next)
      setLog(rows)
      setRepos(current => roots ?? (current.length > 0 ? current : [next.root]))
      setDetail(undefined)
      setPhase('ready')
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
        apply(first.status, first.log)
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
      apply(nested.status, nested.log, found)
      setSelected(pick)
    })()
    return () => { controller.abort() }
  }, [cwd, nonce, selected, gitStatus, gitLog, listEntries])

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
  const changes = status.changes
  const run = (op: () => Promise<unknown>) => {
    void op().then(() => { files.bumpRefresh() }, () => { files.bumpRefresh() })
  }

  return (
    <div className={css.root} data-testid="xmart-workbench-git">
      <div className={css.toolbar}>
        {repos.length > 1
          ? (
            <select
              className={css.input}
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
        <span>{status.detached ? t('git.detached') : status.branch} ↑{status.ahead} ↓{status.behind}</span>
        <button type="button" className={css.tool} onClick={() => { files.bumpRefresh() }}>{t('explorer.refresh')}</button>
      </div>
      <form
        className={css.form}
        onSubmit={(event) => {
          event.preventDefault()
          const text = message.trim()
          if (text === '') return
          run(() => gitCommit(root, text).then(() => { setMessage('') }))
        }}
      >
        <input
          className={css.input}
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
        <button type="submit" className={css.tool}>{t('git.commit')}</button>
      </form>
      <div className={css.treeWrap}>
        {changes.length === 0
          ? <div className={css.note}>{t('git.clean')}</div>
          : changes.map(change => (
            <button
              key={change.path}
              type="button"
              className={css.tool}
              onClick={() => { openFile(absPath(root, change.path)) }}
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({ change, x: event.clientX, y: event.clientY })
              }}
            >
              {letter(change.status)} {change.path}
            </button>
          ))}
        {log.map(row => (
          <div key={row.hash} className={css.note}>{row.hash.slice(0, 7)} {row.subject}</div>
        ))}
      </div>
      <Menu
        open={menu !== null}
        onClose={() => { setMenu(null) }}
        portal
        compact
        getAnchorRect={() => gitMenuAnchor(menu)}
        items={[
          { id: 'stage', label: t('git.stage') },
          { id: 'unstage', label: t('git.unstage') },
          { id: 'discard', label: t('git.discard') },
          { id: 'diff-work', label: t('git.diffWorktree') },
          { id: 'diff-staged', label: t('git.diffStaged') },
          { id: 'open', label: t('git.open') },
        ]}
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
