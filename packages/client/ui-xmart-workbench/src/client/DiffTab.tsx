/**
 * Hidden diff tab: per-file unified diff from host.gitDiff / gitCommitDiff.
 */
import { useEffect, useState } from 'react'
import type { GitDiff, GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { parseDiffPath } from './git-diff-path.ts'
import { paintDiffLines, splitUnifiedPatch, type DiffFileSection } from './diff-patch.ts'
import { gitPathParts } from './git-display.ts'
import { letter, markKind } from './git-marks.ts'
import css from './DiffTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type DiffTabProps = TabBodyProps & {
  t: Translate
  getCwd: (sessionId: string) => string | undefined
  gitDiff: (path: string, side: GitDiffSide, file?: string, signal?: AbortSignal) => Promise<GitDiff>
  gitCommitDiff: (path: string, commit: string, signal?: AbortSignal) => Promise<GitDiff>
}

/** Unified-diff viewer with Cursor-style per-file sections. */
export function DiffTab({ tab, sessionId, t, getCwd, gitDiff, gitCommitDiff }: DiffTabProps) {
  const seed = parseDiffPath(tab.path)
  const cwd = getCwd(sessionId)
  const [text, setText] = useState<string | undefined>()
  const [error, setError] = useState(false)
  const [closed, setClosed] = useState<ReadonlySet<number>>(new Set())
  const side = seed?.kind === 'side' ? seed.side : undefined
  const file = seed?.kind === 'side' ? seed.file : undefined
  const commit = seed?.kind === 'commit' ? seed.commit : undefined

  useEffect(() => {
    if (seed === undefined || cwd === undefined || cwd === '') return
    const controller = new AbortController()
    const load = seed.kind === 'commit'
      ? gitCommitDiff(cwd, seed.commit, controller.signal)
      : gitDiff(cwd, seed.side, seed.file, controller.signal)
    load.then(
      (diff) => {
        if (!controller.signal.aborted) setText(diff.text)
      },
      () => {
        if (!controller.signal.aborted) setError(true)
      },
    )
    return () => { controller.abort() }
  }, [cwd, side, file, commit, gitDiff, gitCommitDiff])

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
  const sections = splitUnifiedPatch(text, file)
  return (
    <div className={css.root} data-testid="xmart-workbench-diff">
      {seed.kind === 'commit'
        ? (
          <div className={css.commitHead}>
            {tab.title}
            <span className={css.fileCount}> ({sections.length} {t('diff.files')})</span>
          </div>
        )
        : null}
      {sections.map((section, index) => (
        <DiffFileBlock
          key={`${section.path}:${index}`}
          section={section}
          open={!closed.has(index)}
          onToggle={() => {
            setClosed((current) => {
              const next = new Set(current)
              if (next.has(index)) next.delete(index)
              else next.add(index)
              return next
            })
          }}
        />
      ))}
    </div>
  )
}

function DiffFileBlock(props: {
  section: DiffFileSection
  open: boolean
  onToggle: () => void
}) {
  const parts = gitPathParts(props.section.path)
  const painted = paintDiffLines(props.section.lines).filter(line => line.kind !== 'meta')
  return (
    <section className={css.file}>
      <button
        type="button"
        className={css.fileHead}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        <span className={css.fileName}>{parts.name === '' ? props.section.path : parts.name}</span>
        {parts.dir !== '' ? <span className={css.fileDir}>{parts.dir}</span> : null}
        <span className={`${css.mark} ${css[markKind(props.section.status)]}`}>
          {letter(props.section.status)}
        </span>
      </button>
      {props.open
        ? (
          <pre className={css.body}>
            {painted.map((line, index) => (
              <div
                key={index}
                className={`${css.line} ${css[line.kind]}`}
                data-kind={line.kind}
              >
                <span className={css.gutter}>{lineNumber(line)}</span>
                <span className={css.text}>{line.text === '' ? ' ' : line.text}</span>
              </div>
            ))}
          </pre>
        )
        : null}
    </section>
  )
}

function lineNumber(line: { kind: string; oldNo?: number; newNo?: number }): string {
  if (line.kind === 'del' && line.oldNo !== undefined) return String(line.oldNo)
  if (line.kind === 'add' && line.newNo !== undefined) return String(line.newNo)
  if (line.kind === 'ctx' && line.newNo !== undefined) return String(line.newNo)
  return ''
}
