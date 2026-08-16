/**
 * Problems bottom-panel body: Cursor-like grouped diagnostics with filter + jump.
 */
import { useEffect, useMemo, useState } from 'react'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import {
  countProblemSeverities,
  filterProblemsByQuery,
  groupProblems,
  splitProblemPath,
  type ProblemGroupBy,
  type ProblemItem,
} from './problem-model.ts'
import { collectMonacoProblems } from './monaco-problems.ts'
import type { ChecksStore } from './checks-store.ts'
import { requestReveal } from './editor-nav.ts'
import css from './ProblemsTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type ProblemsTabProps = TabBodyProps & {
  t: Translate
  checks: ChecksStore
  openProblem: (path: string, line: number, character: number) => void
}

/** Problems list (see module doc). */
export function ProblemsTab({
  t, checks, openProblem, visible,
}: ProblemsTabProps) {
  const [groupBy, setGroupBy] = useState<ProblemGroupBy>('file')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [lsp, setLsp] = useState<readonly ProblemItem[]>([])
  const checkProblems = useStoreProblems(checks)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    const tick = (): void => {
      void collectMonacoProblems().then((items) => {
        if (!cancelled) setLsp(items)
      })
    }
    tick()
    const id = window.setInterval(tick, 1500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [visible])

  const items = useMemo(
    () => filterProblemsByQuery([...lsp, ...checkProblems], query),
    [lsp, checkProblems, query],
  )
  const groups = useMemo(() => groupProblems(items, groupBy), [items, groupBy])
  const { errors, warnings } = countProblemSeverities(items)

  function toggleGroup(key: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function collapseAll(): void {
    setCollapsed(new Set(groups.map(g => g.key)))
  }

  return (
    <div className={css.root} data-testid="xmart-problems-tab">
      <div className={css.toolbar}>
        <span className={css.summary} data-testid="xmart-problems-count">
          <span className={css.errBadge} data-testid="xmart-problems-errors">{errors}</span>
          <span className={css.warnBadge} data-testid="xmart-problems-warnings">{warnings}</span>
          <span>{t('problems.count').replace('{n}', String(items.length)).replace('{e}', String(errors))}</span>
        </span>
        <button
          type="button"
          className={css.iconBtn}
          data-testid="xmart-problems-collapse"
          title={t('problems.collapseAll')}
          onClick={() => { collapseAll() }}
        >
          ▢
        </button>
        <label className={css.group}>
          <span>{t('problems.groupBy')}</span>
          <select
            value={groupBy}
            data-testid="xmart-problems-groupby"
            onChange={(e) => { setGroupBy(e.target.value as ProblemGroupBy) }}
          >
            <option value="file">{t('problems.group.file')}</option>
            <option value="source">{t('problems.group.source')}</option>
            <option value="severity">{t('problems.group.severity')}</option>
          </select>
        </label>
      </div>
      <div className={css.filterRow}>
        <input
          className={css.filter}
          data-testid="xmart-problems-filter"
          value={query}
          placeholder={t('problems.filterPlaceholder')}
          onChange={(e) => { setQuery(e.target.value) }}
        />
      </div>
      <div className={css.list}>
        {groups.length === 0
          ? <div className={css.empty} data-testid="xmart-problems-empty">{t('problems.empty')}</div>
          : groups.map((group) => {
            const open = !collapsed.has(group.key)
            const fileBits = groupBy === 'file' && group.key.length > 0
              ? splitProblemPath(group.key)
              : undefined
            return (
              <div key={group.key} className={css.groupBlock} data-testid={`xmart-problems-group-${group.key || 'none'}`}>
                <button
                  type="button"
                  className={css.groupTitle}
                  data-testid="xmart-problems-group-toggle"
                  onClick={() => { toggleGroup(group.key) }}
                >
                  <span className={css.chevron}>{open ? '▾' : '▸'}</span>
                  {fileBits === undefined
                    ? <span className={css.groupLabel}>{group.label}</span>
                    : (
                      <>
                        <span className={css.fileName}>{fileBits.name}</span>
                        {fileBits.dir.length > 0
                          ? <span className={css.fileDir}>{fileBits.dir}</span>
                          : null}
                      </>
                    )}
                  <span className={css.groupCount}>{group.items.length}</span>
                </button>
                {open
                  ? group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={css.row}
                      data-testid="xmart-problems-row"
                      data-severity={item.severity}
                      onClick={() => {
                        if (item.path === undefined) return
                        const line = item.line ?? 0
                        const character = item.character ?? 0
                        requestReveal(item.path, { line, character })
                        openProblem(item.path, line, character)
                      }}
                    >
                      <span className={css.sev} data-severity={item.severity} aria-hidden>
                        {severityMark(item.severity)}
                      </span>
                      <span className={css.msg}>{item.message}</span>
                      <span className={css.meta}>
                        <span className={css.source}>({item.source})</span>
                        {item.line === undefined
                          ? ''
                          : ` [${t('problems.lineCol')
                            .replace('{line}', String(item.line + 1))
                            .replace('{col}', String((item.character ?? 0) + 1))}]`}
                      </span>
                    </button>
                  ))
                  : null}
              </div>
            )
          })}
      </div>
    </div>
  )
}

function severityMark(severity: ProblemItem['severity']): string {
  if (severity === 'error') return '✕'
  if (severity === 'warning') return '⚠'
  if (severity === 'info') return 'ℹ'
  return '·'
}

function useStoreProblems(checks: ChecksStore): readonly ProblemItem[] {
  const [items, setItems] = useState(checks.getSnapshot().problems)
  useEffect(() => checks.subscribe(() => {
    setItems(checks.getSnapshot().problems)
  }), [checks])
  return items
}
