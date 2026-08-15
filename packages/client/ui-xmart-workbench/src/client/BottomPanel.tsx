/**
 * Editor-stacked bottom panel. Hosts terminal tab instances under the editor.
 * Height 0 unmounts the body; host PTYs stay alive until the tab is closed.
 */
import { IconPlusOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BottomPanelProps } from './contract.ts'
import { TERMINAL_TAB_LIMIT } from './types.ts'
import css from './BottomPanel.module.css'

/** Bottom panel (see module doc). */
export function BottomPanel({
  height,
  sessionId,
  resolveBody,
  activateTab,
  closeTab,
  newTerminal,
  useWorkbenchSession,
  t,
}: BottomPanelProps) {
  const view = useWorkbenchSession(s => s)
  if (height === 0) return null
  const tabs = view.tabs.filter(tab => tab.type === 'terminal')
  const active = tabs.find(tab => tab.id === view.activeTabId) ?? tabs[tabs.length - 1]
  const Body = resolveBody('terminal')
  return (
    <div className={css.root} data-testid="xmart-bottom-panel">
      <div className={css.bar} data-testid="xmart-bottom-tabbar">
        <div className={css.tabs} role="tablist">
          {tabs.map((tab) => {
            const selected = tab.id === active?.id
            return (
              <div
                key={tab.id}
                className={selected ? `${css.tab} ${css.tabActive}` : css.tab}
                data-testid={`xmart-bottom-tab-${tab.id}`}
              >
                <button
                  type="button"
                  role="tab"
                  className={css.tabLabel}
                  aria-selected={selected}
                  onClick={() => { activateTab(tab.id) }}
                >
                  {tab.title}
                </button>
                <button
                  type="button"
                  className={css.tabClose}
                  aria-label={t('tab.close')}
                  onClick={() => { closeTab(tab.id) }}
                >
                  <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          className={css.add}
          aria-label={t('menu.terminal.new')}
          data-testid="xmart-bottom-new"
          disabled={tabs.length >= TERMINAL_TAB_LIMIT}
          onClick={() => { newTerminal() }}
        >
          <IconPlusOutline16 />
        </button>
      </div>
      <div className={css.body}>
        {active === undefined || Body === undefined
          ? <div className={css.empty} data-testid="xmart-bottom-empty">{t('terminal.empty')}</div>
          : <Body tab={active} visible sessionId={sessionId} />}
      </div>
    </div>
  )
}
