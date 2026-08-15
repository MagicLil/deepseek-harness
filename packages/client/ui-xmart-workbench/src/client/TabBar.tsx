/**
 * Workbench tab strip: horizontal scroll, middle-click close, and a + menu
 * of registered available types.
 */
import { useState } from 'react'
import { IconPlusOutline16, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkbenchKey } from './locales.ts'
import type { WorkbenchMenuItem, WorkbenchTab } from './types.ts'
import { FileIcon } from './FileIcon.tsx'
import css from './WorkbenchColumn.module.css'

/** Tab-bar callbacks and labels. */
export type TabBarProps = {
  tabs: readonly WorkbenchTab[]
  activeTabId: string | null
  menu: readonly WorkbenchMenuItem[]
  t: (key: WorkbenchKey) => string
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
  onOpen: (type: string) => void
}

/** Session tab strip plus the + menu (see module doc). */
export function TabBar({
  tabs, activeTabId, menu, t, onActivate, onClose, onOpen,
}: TabBarProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.bar} data-testid="xmart-workbench-tabbar">
      <div className={css.tabs} role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={selected ? `${css.tab} ${css.tabActive}` : css.tab}
              data-testid={`xmart-workbench-tab-${tab.id}`}
              data-active={selected ? 'true' : undefined}
              onMouseDown={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                onClose(tab.id)
              }}
            >
              <button
                type="button"
                role="tab"
                className={css.tabLabel}
                aria-selected={selected}
                onClick={() => { onActivate(tab.id) }}
              >
                <FileIcon path={tab.path ?? tab.title} kind="file" size={14} />
                {tab.title}
              </button>
              <button
                type="button"
                className={css.tabClose}
                aria-label={t('tab.close')}
                onClick={() => { onClose(tab.id) }}
              >
                <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={menu.map(item => ({ id: item.id, label: item.title, disabled: item.disabled }))}
        onSelect={(id) => {
          setOpen(false)
          onOpen(id)
        }}
        align="end"
        portal
        compact
        anchor={(
          <button
            type="button"
            className={css.add}
            data-testid="xmart-workbench-add"
            aria-label={t('tab.add')}
            aria-expanded={open}
            onClick={() => { setOpen(value => !value) }}
          >
            <IconPlusOutline16 size={14} />
          </button>
        )}
      />
    </div>
  )
}
