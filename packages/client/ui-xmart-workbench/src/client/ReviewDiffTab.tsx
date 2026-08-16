/**
 * Workbench tab: before/after Agent review for one file, with Keep / Undo.
 */
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'
import { useCallback, useEffect, useState } from 'react'
import { IconCheckOutline16, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { unwrapReview } from './review-client.ts'
import { parseAgentReviewPath } from './agent-review-path.ts'
import { basename } from './route-file.ts'
import css from './ReviewDiffTab.module.css'
/**
 * Side-by-side before/after for one pending Agent change.
 * @param props - tab + remotes.
 */
export function ReviewDiffTab(props) {
  const { tab, sessionId, t, review, onSettled } = props
  const encodedPath = typeof tab.path === 'string' ? tab.path : ''
  const seed = parseAgentReviewPath(encodedPath)
  const [diff, setDiff] = useState()
  const [error, setError] = useState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState()
  const reload = useCallback(async () => {
    if (seed === undefined)
      return
    try {
      const next = await unwrapReview(review.diff({ sessionId, turn: seed.turn, path: seed.path }))
      setDiff(next)
      setError(undefined)
    }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [review, seed, sessionId])
  useEffect(() => {
    void reload()
  }, [reload])
  const apply = async (action) => {
    setBusy(true)
    setMessage(undefined)
    try {
      const result = await unwrapReview(action())
      if (!result.ok) {
        if (result.error === 'conflict') {
          const ok = window.confirm(t('review.conflictForce'))
          if (!ok) {
            setMessage(t('review.conflict'))
            return
          }
          if (seed === undefined)
            return
          const forced = await unwrapReview(review.revert({
            sessionId, turn: seed.turn, path: seed.path, force: true,
          }))
          if (!forced.ok) {
            setMessage(t(errorKey(forced.error)))
            return
          }
          onSettled?.()
          return
        }
        setMessage(t(errorKey(result.error)))
        return
      }
      onSettled?.()
    }
    catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught))
    }
    finally {
      setBusy(false)
    }
  }
  if (seed === undefined) {
    return _jsx('div', { className: css.note, 'data-testid': 'review-diff-tab', children: t('review.notFound') })
  }
  if (error !== undefined) {
    return _jsx('div', { className: css.note, 'data-testid': 'review-diff-tab', children: error })
  }
  if (diff === undefined) {
    return _jsx('div', { className: css.note, 'data-testid': 'review-diff-tab', children: t('diff.loading') })
  }
  const beforeLines = diff.before === '' ? [''] : diff.before.split('\n')
  const afterLines = diff.after === '' ? [''] : diff.after.split('\n')
  return (_jsxs('div', { className: css.root, 'data-testid': 'review-diff-tab', children: [_jsxs('div', { className: css.toolbar, children: [_jsx('span', { className: css.title, title: seed.path, children: basename(seed.path) }), _jsxs('div', { className: css.actions, children: [_jsxs('button', { type: 'button', className: css.undo, disabled: busy, 'data-testid': 'review-diff-undo', onClick: () => {
    void apply(() => review.revert({
      sessionId, turn: seed.turn, path: seed.path,
    }))
  }, children: [_jsx(IconCloseOutline16, { size: 14 }), t('review.undo')] }), _jsxs('button', { type: 'button', className: css.keep, disabled: busy, 'data-testid': 'review-diff-keep', onClick: () => {
    void apply(() => review.accept({
      sessionId, turn: seed.turn, path: seed.path,
    }))
  }, children: [_jsx(IconCheckOutline16, { size: 14 }), t('review.keep')] })] })] }), message !== undefined && _jsx('div', { className: css.message, children: message }), _jsxs('div', { className: css.panes, children: [_jsxs('div', { className: css.pane, children: [_jsx('div', { className: css.paneHead, children: t('review.before') }), _jsx('pre', { className: `${css.code} ${css.before}`, children: beforeLines.map((line, i) => (_jsxs('div', { className: css.line, children: [_jsx('span', { className: css.gutter, children: i + 1 }), _jsx('span', { className: css.text, children: line })] }, `b${String(i)}`))) })] }), _jsxs('div', { className: css.pane, children: [_jsx('div', { className: css.paneHead, children: t('review.after') }), _jsx('pre', { className: `${css.code} ${css.after}`, children: afterLines.map((line, i) => (_jsxs('div', { className: css.line, children: [_jsx('span', { className: css.gutter, children: i + 1 }), _jsx('span', { className: css.text, children: line })] }, `a${String(i)}`))) })] })] })] }))
}
function errorKey(code) {
  if (code === 'dirty-editor')
    return 'review.dirty'
  if (code === 'conflict')
    return 'review.conflict'
  if (code === 'irreversible')
    return 'review.status.irreversible'
  if (code === 'not-pending')
    return 'review.notPending'
  if (code === 'not-found')
    return 'review.notFound'
  return 'review.ioError'
}
