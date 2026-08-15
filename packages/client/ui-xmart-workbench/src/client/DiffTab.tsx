/**
 * Hidden diff tab: per-file unified diff from host.gitDiff / gitCommitDiff.
 */
import { useEffect, useState } from 'react'
import type { GitDiff, GitDiffSide } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import { parseDiffPath } from './git-diff-path.ts'
import {
  attachTokens, newGutter, oldGutter, paintDiffLines, sourceSides, splitUnifiedPatch,
  type DiffFileSection, type DiffPaintRow,
} from './diff-patch.ts'
import { highlightSource } from './monaco-highlight.ts'
import { languageFromPath } from './language-from-path.ts'
import { darkTheme } from './MonacoHost.tsx'
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
  const cwd = seed?.root ?? getCwd(sessionId)
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
  const [rows, setRows] = useState<DiffPaintRow[]>(() => attachTokens(painted, [], []))
  useEffect(() => {
    const { oldLines, newLines } = sourceSides(painted)
    const language = languageFromPath(props.section.path)
    const dark = darkTheme()
    const controller = new AbortController()
    void Promise.all([
      highlightSource(oldLines.join('\n'), language, dark),
      highlightSource(newLines.join('\n'), language, dark),
    ]).then(([oldTokens, newTokens]) => {
      if (!controller.signal.aborted) setRows(attachTokens(painted, oldTokens, newTokens))
    })
    return () => { controller.abort() }
  }, [props.section.path, props.section.lines])
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
            {rows.map((line, index) => (
              <div
                key={index}
                className={`${css.line} ${css[line.kind]}`}
                data-kind={line.kind}
              >
                <span className={css.gutterOld}>{oldGutter(line)}</span>
                <span className={css.gutterNew}>{newGutter(line)}</span>
                <span className={css.text}>
                  {line.tokens.length === 0
                    ? ' '
                    : line.tokens.map((token, tokenIndex) => (
                      <span
                        key={tokenIndex}
                        data-token
                        style={token.color === undefined ? undefined : { color: token.color }}
                      >
                        {token.text === '' ? ' ' : token.text}
                      </span>
                    ))}
                </span>
              </div>
            ))}
          </pre>
        )
        : null}
    </section>
  )
}
