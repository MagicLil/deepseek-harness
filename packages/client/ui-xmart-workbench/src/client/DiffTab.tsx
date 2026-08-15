/**
 * Hidden diff tab: colored unified diff from host.gitDiff.
 */
import { useEffect, useState } from 'react'
import type { GitDiff, GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { parseDiffPath } from './git-diff-path.ts'
import { diffLineKind } from './diff-line.ts'
import css from './ExplorerTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type DiffTabProps = TabBodyProps & {
  t: Translate
  getCwd: (sessionId: string) => string | undefined
  gitDiff: (path: string, side: GitDiffSide, file?: string, signal?: AbortSignal) => Promise<GitDiff>
}

/** Unified-diff viewer. */
export function DiffTab({ tab, sessionId, t, getCwd, gitDiff }: DiffTabProps) {
  const seed = parseDiffPath(tab.path)
  const cwd = getCwd(sessionId)
  const [text, setText] = useState<string | undefined>()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (seed === undefined || cwd === undefined || cwd === '') return
    const controller = new AbortController()
    gitDiff(cwd, seed.side, seed.file, controller.signal).then(
      (diff) => {
        if (!controller.signal.aborted) setText(diff.text)
      },
      () => {
        if (!controller.signal.aborted) setError(true)
      },
    )
    return () => { controller.abort() }
  }, [cwd, seed?.side, seed?.file, gitDiff])

  if (seed === undefined || cwd === undefined || cwd === '') {
    return <div className={css.note} data-testid="xmart-workbench-diff">{t('diff.noPath')}</div>
  }
  if (error) {
    return <div className={css.note} data-testid="xmart-workbench-diff">{t('diff.error')}</div>
  }
  if (text === undefined) {
    return <div className={css.note} data-testid="xmart-workbench-diff">{t('diff.loading')}</div>
  }
  if (text === '') {
    return <div className={css.note} data-testid="xmart-workbench-diff">{t('diff.empty')}</div>
  }
  return (
    <pre data-testid="xmart-workbench-diff" style={{ margin: 0, padding: 8, overflow: 'auto', fontSize: 12 }}>
      {text.split('\n').map((line, index) => (
        <div key={index} data-kind={diffLineKind(line)}>{line === '' ? ' ' : line}</div>
      ))}
    </pre>
  )
}
