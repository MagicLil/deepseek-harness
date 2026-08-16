/**
 * Git-panel pre-commit checklist: change counts, recommended gates, confirm.
 * File lists live in the Git Changes section below — this block is counts only.
 */
import { useState, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkbenchKey } from './locales.ts'
import { changeSummaryHeadline, summarizeChanges } from './change-summary.ts'
import type { CheckKind } from './discover-scripts.ts'
import type { GateRecommendation } from './recommend-gates.ts'
import type { CheckRow, CheckRowStatus } from './checks-store.ts'
import type { PrecommitBlockReason } from './precommit-gate.ts'
import css from './PrecommitSection.module.css'

type Translate = (key: WorkbenchKey) => string

export type PrecommitSectionProps = {
  t: Translate
  changes: readonly GitChange[]
  gates: readonly GateRecommendation[]
  rows: readonly CheckRow[]
  busy: boolean
  asking: boolean
  confirmed: boolean
  blockReason: PrecommitBlockReason | undefined
  onConfirm: (value: boolean) => void
  onRunRecommended: () => void
  onRunGate?: ((kind: CheckKind) => void) | undefined
  onAskAgent?: (() => void) | undefined
}

/** Pre-commit checklist body (see module doc). */
export function PrecommitSection(props: PrecommitSectionProps) {
  const {
    t, changes, gates, rows, busy, asking, confirmed, blockReason,
    onConfirm, onRunRecommended, onRunGate, onAskAgent,
  } = props
  const [gatesOpen, setGatesOpen] = useState(true)
  const summary = summarizeChanges(changes)
  const byKind = new Map(rows.map(row => [row.kind, row]))
  const failed = gates.some((gate) => {
    if (!gate.recommended) return false
    const status = byKind.get(gate.kind)?.status
    return status === 'failed' || status === 'stopped'
  })

  return (
    <div className={css.root} data-testid="xmart-precommit">
      <div className={css.headline} data-testid="xmart-precommit-summary">
        <span className={css.title}>{t('precommit.summary')}</span>
        <span className={css.counts}>{changeSummaryHeadline(summary)}</span>
      </div>
      <p className={css.hint} data-testid="xmart-precommit-hint">{t('precommit.summaryHint')}</p>
      {gates.length > 0
        ? (
          <>
            <SectionHead
              testId="xmart-precommit-gates-head"
              title={t('precommit.gates')}
              open={gatesOpen}
              onToggle={() => { setGatesOpen(current => !current) }}
            >
              <button
                type="button"
                className={css.action}
                data-testid="xmart-precommit-run"
                disabled={busy || summary.files.length === 0}
                onClick={onRunRecommended}
              >
                {t('precommit.runRecommended')}
              </button>
              {failed && onAskAgent !== undefined
                ? (
                  <button
                    type="button"
                    className={css.action}
                    data-testid="xmart-precommit-ask-agent"
                    disabled={busy || asking}
                    onClick={onAskAgent}
                  >
                    {t('checks.askAgent')}
                  </button>
                )
                : null}
            </SectionHead>
            {gatesOpen
              ? (
                <ul className={css.gates} data-testid="xmart-precommit-gates">
                  {gates.map((gate) => {
                    const row = byKind.get(gate.kind)
                    const status: CheckRowStatus = row?.status ?? 'idle'
                    const command = row?.command || gate.command
                    return (
                      <li
                        key={gate.kind}
                        data-testid={`xmart-precommit-gate-${gate.kind}`}
                        data-recommended={gate.recommended ? 'yes' : 'no'}
                        data-status={status}
                      >
                        <span className={css.kind}>{gate.kind}</span>
                        {gate.recommended && onRunGate !== undefined
                          ? (
                            <button
                              type="button"
                              className={css.gateRun}
                              title={command}
                              disabled={busy}
                              aria-label={`${t('precommit.runGate')} ${gate.kind}`}
                              data-testid={`xmart-precommit-run-${gate.kind}`}
                              onClick={() => { onRunGate(gate.kind) }}
                            >
                              {command}
                            </button>
                          )
                          : (
                            <span className={css.command} title={command}>{command}</span>
                          )}
                        <span className={css.status}>
                          {gate.recommended ? statusLabel(t, status) : t('precommit.notNeeded')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )
              : null}
          </>
        )
        : null}
      {summary.staged > 0
        ? (
          <label className={css.confirm}>
            <input
              type="checkbox"
              checked={confirmed}
              data-testid="xmart-git-confirm"
              onChange={(event) => { onConfirm(event.target.checked) }}
            />
            {t('precommit.confirm')}
          </label>
        )
        : null}
      <div className={css.note} data-testid="xmart-precommit-note">{t('precommit.noPush')}</div>
      {blockReason !== undefined && summary.staged > 0
        ? <div className={css.block} data-testid="xmart-precommit-block">{t(blockKey(blockReason))}</div>
        : null}
    </div>
  )
}

function SectionHead(props: {
  testId: string
  title: string
  open: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div className={css.headline} data-testid={props.testId}>
      <button
        type="button"
        className={css.toggle}
        aria-expanded={props.open}
        data-testid={`${props.testId}-toggle`}
        onClick={props.onToggle}
      >
        <span className={props.open ? css.chevron : `${css.chevron} ${css.chevronClosed}`} aria-hidden>
          <IconChevronDownOutline14 size={14} />
        </span>
        <span className={css.title}>{props.title}</span>
      </button>
      {props.children !== undefined && props.children !== null
        ? <div className={css.actions} data-testid={`${props.testId}-actions`}>{props.children}</div>
        : null}
    </div>
  )
}

const STATUS_KEY: Record<CheckRowStatus, WorkbenchKey> = {
  idle: 'checks.status.idle',
  running: 'checks.status.running',
  passed: 'checks.status.passed',
  failed: 'checks.status.failed',
  skipped: 'checks.status.skipped',
  stopped: 'checks.status.stopped',
}

function statusLabel(t: Translate, status: CheckRowStatus): string {
  return t(STATUS_KEY[status])
}

function blockKey(reason: PrecommitBlockReason): WorkbenchKey {
  if (reason === 'empty-message') return 'precommit.needMessage'
  if (reason === 'gates-pending') return 'precommit.needGates'
  if (reason === 'gates-failed') return 'precommit.needFix'
  if (reason === 'unconfirmed') return 'precommit.needConfirm'
  return 'precommit.needStaged'
}
