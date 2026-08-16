/**
 * Search pane (activity bar → primary sidebar): Cursor-style global text
 * search. Typing debounces into `ctx.workspaces.search`; results group by
 * file with highlighted match runs; a row click opens the file at the match
 * line. State lives in the shared search store so pane unmounts (activity
 * switches) keep the query and results.
 */
import { useEffect, useRef, useState } from 'react'
import type { FileSearchOptions, FileSearchResult } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import type { ExplorerRoot } from './explorer-roots.ts'
import { WORKBENCH_SEARCH_EVENT } from './app-menu-dispatch.ts'
import {
  classifySearchFailure, formatSearchCount, groupSearchHits, revealTarget, splitSearchLine,
  type WorkbenchSearchStore,
} from './search-store.ts'
import css from './SearchTab.module.css'

/** Milliseconds a keystroke waits before the search fires (Enter flushes). */
export const SEARCH_DEBOUNCE_MS = 250

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Search pane callbacks closed over from apply. */
export type SearchTabProps = TabBodyProps & {
  t: Translate
  getRoots: (sessionId: string) => readonly ExplorerRoot[]
  watchSessions: (fn: () => void) => () => void
  search: (path: string, query: string, options: FileSearchOptions, signal?: AbortSignal) => Promise<FileSearchResult>
  openHit: (sessionId: string, path: string, reveal: { line: number; character: number }) => void
  store: WorkbenchSearchStore
}

/** Search pane body (see module doc). */
export function SearchTab({
  sessionId, visible, t, getRoots, watchSessions, search, openHit, store,
}: SearchTabProps) {
  const [state, setState] = useState(() => store.stateOf(sessionId))
  const [roots, setRoots] = useState(() => getRoots(sessionId))
  const [flushNonce, setFlushNonce] = useState(0)
  const flushRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => store.subscribe(() => { setState(store.stateOf(sessionId)) }), [store, sessionId])
  useEffect(() => { setState(store.stateOf(sessionId)) }, [store, sessionId])
  useEffect(() => watchSessions(() => { setRoots(getRoots(sessionId)) }), [getRoots, sessionId, watchSessions])

  // Ctrl+Shift+F while the pane is already mounted refocuses the input; the
  // mount-time focus below covers the activity switch that mounts it.
  useEffect(() => {
    const onFocus = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener(WORKBENCH_SEARCH_EVENT, onFocus)
    return () => { window.removeEventListener(WORKBENCH_SEARCH_EVENT, onFocus) }
  }, [])
  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

  const root = roots[0]
  const rootPath = root?.path
  const { query, regex, caseSensitive, wholeWord, include, exclude } = state

  useEffect(() => {
    const flush = flushRef.current
    flushRef.current = false
    if (rootPath === undefined || query === '') {
      store.update(sessionId, {
        status: 'idle', errorKind: null, hits: [], fileCount: 0, truncated: false,
      })
      return
    }
    const controller = new AbortController()
    const run = (): void => {
      store.update(sessionId, { status: 'searching', errorKind: null })
      search(
        rootPath,
        query,
        {
          regex,
          caseSensitive,
          wholeWord,
          ...(include === '' ? {} : { include }),
          ...(exclude === '' ? {} : { exclude }),
        },
        controller.signal,
      ).then(
        (result) => {
          if (controller.signal.aborted) return
          store.update(sessionId, {
            status: 'done',
            errorKind: null,
            hits: result.hits,
            fileCount: result.fileCount,
            truncated: result.truncated,
          })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          store.update(sessionId, {
            status: 'error',
            errorKind: classifySearchFailure(error),
            hits: [],
            fileCount: 0,
            truncated: false,
          })
        },
      )
    }
    const timer = setTimeout(run, flush ? 0 : SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [store, search, sessionId, rootPath, query, regex, caseSensitive, wholeWord, include, exclude, flushNonce])

  if (root === undefined) {
    return <div className={css.note} data-testid="xmart-workbench-search">{t('search.noWorkspace')}</div>
  }

  const groups = groupSearchHits(state.hits, roots)
  const toggle = (key: 'regex' | 'caseSensitive' | 'wholeWord'): void => {
    store.update(sessionId, { [key]: !state[key] })
  }
  const body = (): React.ReactNode => {
    if (state.status === 'error') {
      return (
        <div className={css.note} data-testid="xmart-search-error">
          {t(state.errorKind === 'invalid' ? 'search.badPattern' : 'search.error')}
        </div>
      )
    }
    if (state.hits.length === 0) {
      if (state.status === 'searching') return <div className={css.note}>{t('search.searching')}</div>
      if (state.status === 'done' && query !== '') {
        return <div className={css.note} data-testid="xmart-search-empty">{t('search.empty')}</div>
      }
      return null
    }
    return (
      <>
        <div className={css.summary} data-testid="xmart-search-summary">
          {formatSearchCount(t('search.summary'), state.hits.length, state.fileCount)}
        </div>
        {state.truncated && (
          <div className={css.truncated} data-testid="xmart-search-truncated">
            {formatSearchCount(t('search.truncated'), state.hits.length)}
          </div>
        )}
        <div className={css.results}>
          {groups.map((group) => {
            const collapsed = state.collapsed[group.path] === true
            return (
              <div key={group.path} className={css.group}>
                <button
                  type="button"
                  className={css.fileRow}
                  aria-expanded={!collapsed}
                  data-testid="xmart-search-file"
                  onClick={() => {
                    store.update(sessionId, {
                      collapsed: { ...state.collapsed, [group.path]: !collapsed },
                    })
                  }}
                >
                  <span className={collapsed ? css.chevron : `${css.chevron} ${css.chevronOpen}`} aria-hidden>
                    ›
                  </span>
                  <span className={css.fileName}>{group.name}</span>
                  {group.dir !== '' && <span className={css.fileDir}>{group.dir}</span>}
                  <span className={css.count}>{group.hits.length}</span>
                </button>
                {!collapsed && group.hits.map(hit => (
                  <button
                    key={hit.line}
                    type="button"
                    className={css.hitRow}
                    data-testid="xmart-search-hit"
                    onClick={() => { openHit(sessionId, hit.path, revealTarget(hit)) }}
                  >
                    <span className={css.lineNo}>{hit.line}</span>
                    <span className={css.lineText}>
                      {splitSearchLine(hit.text, hit.spans).map((segment, index) => segment.hit
                        ? <mark key={index} className={css.hitMark}>{segment.text}</mark>
                        : <span key={index}>{segment.text}</span>)}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <div className={css.root} data-testid="xmart-workbench-search">
      <div className={css.queryRow}>
        <input
          ref={inputRef}
          className={css.input}
          value={query}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          spellCheck={false}
          data-testid="xmart-search-input"
          onChange={(event) => { store.update(sessionId, { query: event.target.value }) }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            flushRef.current = true
            setFlushNonce(nonce => nonce + 1)
          }}
        />
        <button
          type="button"
          className={caseSensitive ? `${css.flag} ${css.flagOn}` : css.flag}
          aria-pressed={caseSensitive}
          aria-label={t('search.caseSensitive')}
          title={t('search.caseSensitive')}
          data-testid="xmart-search-case"
          onClick={() => { toggle('caseSensitive') }}
        >
          Aa
        </button>
        <button
          type="button"
          className={wholeWord ? `${css.flag} ${css.flagOn}` : css.flag}
          aria-pressed={wholeWord}
          aria-label={t('search.wholeWord')}
          title={t('search.wholeWord')}
          data-testid="xmart-search-word"
          onClick={() => { toggle('wholeWord') }}
        >
          <span className={css.wordGlyph}>ab</span>
        </button>
        <button
          type="button"
          className={regex ? `${css.flag} ${css.flagOn}` : css.flag}
          aria-pressed={regex}
          aria-label={t('search.regex')}
          title={t('search.regex')}
          data-testid="xmart-search-regex"
          onClick={() => { toggle('regex') }}
        >
          .*
        </button>
        <button
          type="button"
          className={state.filtersOpen ? `${css.flag} ${css.flagOn}` : css.flag}
          aria-pressed={state.filtersOpen}
          aria-label={t('search.filters')}
          title={t('search.filters')}
          data-testid="xmart-search-filters"
          onClick={() => { store.update(sessionId, { filtersOpen: !state.filtersOpen }) }}
        >
          …
        </button>
      </div>
      {state.filtersOpen && (
        <div className={css.filterRows}>
          <input
            className={css.filterInput}
            value={include}
            placeholder={t('search.include')}
            aria-label={t('search.include')}
            spellCheck={false}
            data-testid="xmart-search-include"
            onChange={(event) => { store.update(sessionId, { include: event.target.value }) }}
          />
          <input
            className={css.filterInput}
            value={exclude}
            placeholder={t('search.exclude')}
            aria-label={t('search.exclude')}
            spellCheck={false}
            data-testid="xmart-search-exclude"
            onChange={(event) => { store.update(sessionId, { exclude: event.target.value }) }}
          />
        </div>
      )}
      {body()}
    </div>
  )
}
