/**
 * Editor-stacked bottom panel. Hosts the reserved terminal tab body.
 * Height 0 unmounts the body; the slot itself stays mounted in AppFrame.
 */
import type { BottomPanelProps } from './contract.ts'
import css from './BottomPanel.module.css'

/** Bottom panel (see module doc). */
export function BottomPanel({
  height,
  sessionId,
  resolveBody,
  t,
}: BottomPanelProps) {
  if (height === 0) return null
  const Body = resolveBody('terminal')
  const tab = { id: 'terminal', type: 'terminal', title: t('tab.terminal') }
  return (
    <div className={css.root} data-testid="xmart-bottom-panel">
      {Body === undefined
        ? null
        : <Body tab={tab} visible sessionId={sessionId} />}
    </div>
  )
}
