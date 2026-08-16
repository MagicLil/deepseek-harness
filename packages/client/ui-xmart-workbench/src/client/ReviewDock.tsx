/**
 * Cursor-style Agent change review strip above the composer
 * (`conversation.input.dock`). Only entry for accept / revert.
 */
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'
import { useCallback, useEffect, useState } from 'react'
import { IconCheckOutline16, IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { isActionable, pickReviewTurn, reviewKindCounts, reviewPendingTotal, showShellOnlyWarn } from './review-counts.ts'
import { readShellDismissed, roughLineStats, unwrapReview, writeShellDismissed } from './review-client.ts'
import { basename } from './route-file.ts'
import css from './ReviewDock.module.css'
/**
 * Composer-adjacent review dock (Keep All / Undo All / file list).
 * @param props - remotes and session scope.
 */
export function ReviewDock(props) {
  const { sessionId, t, review, files, openReviewDiff } = props
  const [session, setSession] = useState()
  const [expanded, setExpanded] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState()
  const [chips, setChips] = useState({})
  const [shellDismissedTurn, setShellDismissedTurn] = useState()
  const reload = useCallback(async () => {
    try {
      const next = await unwrapReview(review.get({ sessionId }))
      setSession(next)
    }
    catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught))
    }
  }, [review, sessionId])
  useEffect(() => {
    void reload()
    const id = window.setInterval(() => { void reload() }, 2500)
    return () => { window.clearInterval(id) }
  }, [reload])
  const turn = pickReviewTurn(session)
  const pending = reviewPendingTotal(session)
  const counts = reviewKindCounts(turn)
  const pendingFiles = (turn !== undefined && Array.isArray(turn.files))
    ? turn.files.filter(isActionable)
    : []
  const shellOnly = showShellOnlyWarn(turn, pending)
        && turn !== undefined
        && shellDismissedTurn !== turn.turn
        && !readShellDismissed(sessionId, turn.turn)
  useEffect(() => {
    if (!expanded || turn === undefined || pendingFiles.length === 0)
      return
    const turnNo = turn.turn
    const paths = pendingFiles.slice(0, 40)
    let cancelled = false
    const load = async () => {
      const next = {}
      await Promise.all(paths.map(async (file) => {
        try {
          const diff = await unwrapReview(review.diff({ sessionId, turn: turnNo, path: file.path }))
          if (diff.ok)
            next[file.path] = roughLineStats(diff.before, diff.after)
        }
        catch {
          /* chip optional */
        }
      }))
      if (!cancelled)
        setChips(prev => ({ ...prev, ...next }))
    }
    void load()
    return () => { cancelled = true }
  }, [expanded, review, sessionId, turn?.turn, pendingFiles.length])
  const applyJob = async (result) => {
    if (!result.ok) {
      setMessage(t(errorKey(result.error)))
    }
    else if (result.skipped !== undefined && result.skipped.length > 0) {
      setMessage(t('review.skipped').replace('{n}', String(result.skipped.length)))
    }
    else {
      setMessage(undefined)
    }
    if (result.review !== undefined)
      setSession(result.review)
    else
      await reload()
  }
  const run = async (action) => {
    setBusy(true)
    try {
      await applyJob(await unwrapReview(action()))
    }
    catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught))
    }
    finally {
      setBusy(false)
    }
  }
  const dirty = path => files?.draftOf(path) !== undefined
  if (turn === undefined)
    return null
  if (pending <= 0 && !shellOnly)
    return null
  return (_jsxs('div', { className: css.root, 'data-testid': 'review-dock', children: [_jsxs('div', { className: css.header, children: [_jsxs('button', { type: 'button', className: css.titleBtn, 'data-testid': 'review-dock-toggle', 'aria-expanded': expanded, onClick: () => { setExpanded(v => !v) }, children: [_jsx('span', { className: css.chevron, 'aria-hidden': true, children: expanded ? '▾' : '▸' }), _jsx('span', { children: pending > 0
    ? t('review.files').replace('{n}', String(pending))
    : t('review.shellTitle') })] }), _jsxs('div', { className: css.headerActions, children: [pending > 0 && (_jsxs(_Fragment, { children: [_jsx('button', { type: 'button', className: css.textBtn, disabled: busy || counts.pending === 0, 'data-testid': 'review-dock-undo-all', onClick: () => {
    const blocked = pendingFiles.some(file => dirty(file.path))
    if (blocked) {
      setMessage(t('review.dirty'))
      return
    }
    void run(() => review.revertAll({ sessionId, turn: turn.turn }))
  }, children: t('review.undoAll') }), _jsx('button', { type: 'button', className: css.textBtn, disabled: busy || counts.pending === 0, 'data-testid': 'review-dock-keep-all', onClick: () => {
    void run(() => review.acceptAll({ sessionId, turn: turn.turn }))
  }, children: t('review.keepAll') }), _jsx('button', { type: 'button', className: css.reviewBtn, 'data-testid': 'review-dock-review', disabled: busy || pendingFiles.length === 0, onClick: () => {
    setExpanded(true)
    const first = pendingFiles[0]
    if (first !== undefined)
      openReviewDiff(first.path, turn.turn)
  }, children: t('review.review') })] })), shellOnly && (_jsx('button', { type: 'button', className: css.textBtn, 'data-testid': 'review-shell-dismiss', onClick: () => {
    setShellDismissedTurn(turn.turn)
    writeShellDismissed(sessionId, turn.turn)
    if (typeof review.dismissShell === 'function')
      void run(() => review.dismissShell({ sessionId, turn: turn.turn }))
  }, children: t('review.shellDismiss') }))] })] }), turn.shellMaybeMutated && pending > 0 && (_jsx('div', { className: css.warn, 'data-testid': 'review-shell-warn', children: t('review.shellWarn') })), shellOnly && (_jsx('div', { className: css.warn, 'data-testid': 'review-shell-warn', children: t('review.shellWarn') })), message !== undefined && (_jsx('div', { className: css.message, 'data-testid': 'review-message', children: message })), expanded && pendingFiles.length > 0 && (_jsx('ul', { className: css.list, 'data-testid': 'review-dock-list', children: pendingFiles.map(file => (_jsx(DockRow, { file: file, chip: chips[file.path], t: t, busy: busy, onOpen: () => { openReviewDiff(file.path, turn.turn) }, onKeep: () => {
    void run(() => review.accept({ sessionId, turn: turn.turn, path: file.path }))
  }, onUndo: () => {
    if (dirty(file.path)) {
      setMessage(t('review.dirty'))
      return
    }
    void (async () => {
      setBusy(true)
      try {
        let result = await unwrapReview(review.revert({ sessionId, turn: turn.turn, path: file.path }))
        if (result.error === 'conflict') {
          const ok = window.confirm(t('review.conflictForce'))
          if (!ok) {
            setMessage(t('review.conflict'))
            return
          }
          result = await unwrapReview(review.revert({
            sessionId, turn: turn.turn, path: file.path, force: true,
          }))
        }
        await applyJob(result)
      }
      catch (caught) {
        setMessage(caught instanceof Error ? caught.message : String(caught))
      }
      finally {
        setBusy(false)
      }
    })()
  } }, file.path))) }))] }))
}
function DockRow(props) {
  const { file, chip, t, busy, onOpen, onKeep, onUndo } = props
  return (_jsxs('li', { className: css.row, 'data-testid': 'review-dock-row', children: [_jsxs('button', { type: 'button', className: css.pathBtn, onClick: onOpen, children: [_jsx('span', { className: css.kind, children: kindMark(file) }), _jsx('span', { className: css.name, children: basename(file.path) }), chip !== undefined && (chip.add > 0 || chip.del > 0) && (_jsxs('span', { className: css.chip, children: [chip.add > 0 && _jsxs('span', { className: css.add, children: ['+', chip.add] }), chip.del > 0 && _jsxs('span', { className: css.del, children: ['\u2212', chip.del] })] }))] }), _jsxs('span', { className: css.rowActions, children: [_jsx('button', { type: 'button', className: css.iconBtn, disabled: busy || file.status === 'irreversible', 'data-testid': 'review-dock-undo', title: t('review.undo'), 'aria-label': t('review.undo'), onClick: onUndo, children: _jsx(IconCloseOutline16, { size: 14 }) }), _jsx('button', { type: 'button', className: css.iconBtn, disabled: busy || file.status === 'irreversible', 'data-testid': 'review-dock-keep', title: t('review.keep'), 'aria-label': t('review.keep'), onClick: onKeep, children: _jsx(IconCheckOutline16, { size: 14 }) })] })] }))
}
function kindMark(file) {
  if (file.kind === 'create')
    return 'A'
  if (file.kind === 'delete')
    return 'D'
  return 'M'
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
