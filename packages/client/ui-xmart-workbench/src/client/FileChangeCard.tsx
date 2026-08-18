/**
 * File-change card for `edit` / `write` tool calls in chat.
 * Header stays visible; the aligned snippet starts expanded. Keep/Undo
 * stay on the composer Review dock.
 */
import { useEffect, useRef, useState } from 'react'
import { IconCheckOutline16, IconCopyOutline16, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { FileIcon } from './FileIcon.tsx'
import {
  applyNewLineNumbers, firstChangeReveal, flattenFileChangeLines, formatPatch,
  inferStartLine, isCreateHunks, type FileChangeLine,
} from './file-change-diff.ts'
import { FILE_CHANGE_MAX_LINES, fileChangeModel } from './file-change-model.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './FileChangeCard.module.css'

type Translate = (key: WorkbenchKey) => string
type Reveal = { line: number; character?: number }

export type FileChangeCardProps = {
  toolName: string
  block: ToolCallBlock
  cwd?: string | undefined
  openInWorkbench: (path: string, reveal?: Reveal) => void
  readFile?: (path: string) => Promise<string | undefined>
  openReviewDiff?: (path: string) => void
  t: Translate
}

/**
 * Render one write/edit call as a file-change card or a compact fallback row.
 * @param props - frozen call slice plus workbench callbacks.
 */
export function FileChangeCard(props: FileChangeCardProps) {
  const { toolName, block, cwd, openInWorkbench, readFile, openReviewDiff, t } = props
  const model = fileChangeModel(toolName, block, cwd)
  const [open, setOpen] = useState(true)
  const [full, setFull] = useState(false)
  const [fileText, setFileText] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(0)
  const cardPath = model.kind === 'card' ? model.path : undefined
  useEffect(() => () => { window.clearTimeout(copiedTimer.current) }, [])
  useEffect(() => {
    if (cardPath === undefined || readFile === undefined) return
    let cancelled = false
    void readFile(cardPath).then(
      (text) => { if (!cancelled) setFileText(text) },
      () => { if (!cancelled) setFileText(undefined) },
    )
    return () => { cancelled = true }
  }, [cardPath, readFile])
  if (model.kind === 'fallback') {
    const fallbackPath = model.path
    return (
      <div
        className={css.fallback}
        data-testid="file-change-fallback"
        data-state={model.state}
      >
        <FileIcon path={model.displayPath} kind="file" size={14} />
        {fallbackPath === undefined ? (
          <span className={css.fallbackText}>{model.summary}</span>
        ) : (
          <button
            type="button"
            className={css.pathBtn}
            data-testid="file-change-path"
            title={t('fileCard.open')}
            onClick={() => { openPath(openInWorkbench, fallbackPath) }}
          >
            {model.summary}
          </button>
        )}
      </div>
    )
  }
  const raw = flattenFileChangeLines(model.hunks)
  const created = isCreateHunks(model.hunks)
  const start = inferStartLine(fileText, raw, created)
  const lines = start === undefined ? raw : applyNewLineNumbers(raw, start)
  const hidden = lines.length - FILE_CHANGE_MAX_LINES
  const shown = hidden > 0 && !full ? lines.slice(0, FILE_CHANGE_MAX_LINES) : lines
  const reveal = firstChangeReveal(lines)
  const onCopy = () => {
    if (copied) return
    void writeClipboard(formatPatch(model.displayPath, lines, start, created)).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => { setCopied(false) }, 1200)
    })
  }
  return (
    <div
      className={css.card}
      data-testid="file-change-card"
      data-state={model.state}
    >
      <div className={css.header}>
        <FileIcon path={model.displayPath} kind="file" size={14} />
        <button
          type="button"
          className={css.pathBtn}
          data-testid="file-change-path"
          title={t('fileCard.open')}
          onClick={() => { openPath(openInWorkbench, model.path, reveal) }}
        >
          {model.displayPath}
        </button>
        <span className={css.stats}>
          {model.added > 0 && <span className={css.add}>+{model.added}</span>}
          {model.removed > 0 && <span className={css.del}>-{model.removed}</span>}
        </span>
        {lines.length > 0 && (
          <button
            type="button"
            className={css.iconBtn}
            data-testid="file-change-copy"
            title={copied ? t('fileCard.copied') : t('fileCard.copy')}
            aria-label={copied ? t('fileCard.copied') : t('fileCard.copy')}
            onClick={onCopy}
          >
            {copied ? <IconCheckOutline16 size={12} /> : <IconCopyOutline16 size={12} />}
          </button>
        )}
        {openReviewDiff !== undefined && (
          <button
            type="button"
            className={css.iconBtn}
            data-testid="file-change-review"
            title={t('fileCard.review')}
            aria-label={t('fileCard.review')}
            onClick={() => { openReviewDiff(model.path) }}
          >
            {t('fileCard.review')}
          </button>
        )}
        <button
          type="button"
          className={css.toggle}
          data-testid="file-change-toggle"
          aria-expanded={open}
          aria-label={t('fileCard.toggle')}
          onClick={() => { setOpen(value => !value) }}
        >
          <span className={css.chevron} data-open={open || undefined}>▾</span>
        </button>
      </div>
      {open && (
        <div className={css.body}>
          {shown.map((line, index) => {
            const lineNo = line.line
            return (
              <DiffLine
                key={index}
                line={line}
                t={t}
                onJump={lineNo === undefined
                  ? undefined
                  : () => { openPath(openInWorkbench, model.path, { line: lineNo - 1, character: 0 }) }}
              />
            )
          })}
          {hidden > 0 && (
            <button
              type="button"
              className={css.more}
              data-testid="file-change-more"
              aria-expanded={full}
              onClick={() => { setFull(value => !value) }}
            >
              {full
                ? t('fileCard.collapse')
                : t('fileCard.expand').replace('{n}', String(hidden))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DiffLine(props: {
  line: FileChangeLine
  t: Translate
  onJump: (() => void) | undefined
}) {
  const { line, t, onJump } = props
  const jump = line.line === undefined
    ? undefined
    : t('fileCard.jump').replace('{n}', String(line.line))
  const inner = (
    <>
      <span className={css.gutter}>{line.line === undefined ? '' : String(line.line)}</span>
      <span className={css.sign} data-kind={line.kind}>
        {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : line.kind === 'ctx' ? ' ' : ''}
      </span>
      <span className={css.text}><LineText line={line} /></span>
    </>
  )
  if (onJump === undefined) {
    return (
      <div
        className={`${css.line} ${css[line.kind]}`}
        data-testid="file-change-line"
        data-kind={line.kind}
      >
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`${css.line} ${css.lineBtn} ${css[line.kind]}`}
      data-testid="file-change-line"
      data-kind={line.kind}
      data-line={String(line.line)}
      title={jump}
      onClick={onJump}
    >
      {inner}
    </button>
  )
}

function LineText({ line }: { line: FileChangeLine }) {
  if (line.marks === undefined) return line.text
  return line.marks.map((mark, index) => (
    <span
      key={index}
      className={mark.kind === 'ins' ? css.markIns : mark.kind === 'del' ? css.markDel : undefined}
    >
      {mark.text}
    </span>
  ))
}

function openPath(
  openInWorkbench: (path: string, reveal?: Reveal) => void,
  path: string,
  reveal?: Reveal,
): void {
  if (reveal === undefined) openInWorkbench(path)
  else openInWorkbench(path, reveal)
}
