/**
 * Git-panel pre-commit checklist: change counts and confirm.
 * File lists live in the Git Changes section below — this block is counts only.
 */
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkbenchKey } from './locales.ts'
import { changeSummaryHeadline, summarizeChanges } from './change-summary.ts'
import type { PrecommitBlockReason } from './precommit-gate.ts'
import css from './PrecommitSection.module.css'

type Translate = (key: WorkbenchKey) => string

export type PrecommitSectionProps = {
  t: Translate
  changes: readonly GitChange[]
  confirmed: boolean
  blockReason: PrecommitBlockReason | undefined
  onConfirm: (value: boolean) => void
}

/** Pre-commit checklist body (see module doc). */
export function PrecommitSection(props: PrecommitSectionProps) {
  const { t, changes, confirmed, blockReason, onConfirm } = props
  const summary = summarizeChanges(changes)

  return (
    <div className={css.root} data-testid="xmart-precommit">
      <div className={css.headline} data-testid="xmart-precommit-summary">
        <span className={css.title}>{t('precommit.summary')}</span>
        <span className={css.counts}>{changeSummaryHeadline(summary)}</span>
      </div>
      <p className={css.hint} data-testid="xmart-precommit-hint">{t('precommit.summaryHint')}</p>
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

function blockKey(reason: PrecommitBlockReason): WorkbenchKey {
  if (reason === 'empty-message') return 'precommit.needMessage'
  if (reason === 'unconfirmed') return 'precommit.needConfirm'
  return 'precommit.needStaged'
}
