/**
 * Product application menu for the web HTML bar. Desktop hides this row and
 * uses the Electron menu; both call the same `run` commands.
 */
import { useEffect, useState } from 'react'
import { Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuBarProps } from './contract.ts'
import type { AppMenuCommand } from './app-menu-dispatch.ts'
import { isShellTabType, TERMINAL_TAB_LIMIT } from './types.ts'
import css from './MenuBar.module.css'

type MenuId = 'file' | 'edit' | 'view' | 'terminal' | 'help'

/** Full-width product menu (see module doc). */
export function MenuBar({
  run,
  useWorkbenchSession,
  t,
}: MenuBarProps) {
  const canCreate = useWorkbenchSession(
    s => s.tabs.filter(tab => tab.type === 'terminal').length < TERMINAL_TAB_LIMIT,
  )
  const canCloseEditor = useWorkbenchSession(
    s => s.tabs.some(tab => !isShellTabType(tab.type)),
  )
  const [open, setOpen] = useState<MenuId | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.code === 'Backquote' || event.key === '`') {
        event.preventDefault()
        run('terminal-toggle')
        return
      }
      if (event.code === 'KeyN') {
        event.preventDefault()
        run('session-new')
        return
      }
      if (event.code === 'KeyO') {
        event.preventDefault()
        run('workspace-open')
        return
      }
      if (event.code === 'KeyS' && !event.shiftKey) {
        event.preventDefault()
        run('file-save')
        return
      }
      if (event.code === 'Comma') {
        event.preventDefault()
        run('settings-open')
        return
      }
      if (event.code === 'KeyB' && !event.shiftKey) {
        event.preventDefault()
        run('sidebar-primary')
        return
      }
      if (event.code === 'KeyL' && event.shiftKey) {
        event.preventDefault()
        run('sidebar-sessions')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [run])

  const close = (): void => { setOpen(null) }
  const select = (command: AppMenuCommand): void => {
    close()
    run(command)
  }

  return (
    <div className={css.root} data-testid="xmart-menu-bar">
      <TopMenu
        id="file"
        open={open}
        setOpen={setOpen}
        label={t('menu.file')}
        testId="xmart-menu-file"
        items={[
          { id: 'session-new', label: t('menu.file.newSession') },
          { id: 'workspace-open', label: t('menu.file.openWorkspace') },
          { type: 'separator', id: 'file-sep-1' },
          { id: 'file-save', label: t('menu.file.save') },
          { id: 'file-close', label: t('menu.file.closeEditor'), disabled: !canCloseEditor },
          { type: 'separator', id: 'file-sep-2' },
          { id: 'settings-open', label: t('menu.file.settings') },
        ]}
        onSelect={(id) => { select(id as AppMenuCommand) }}
        onClose={close}
      />
      <TopMenu
        id="edit"
        open={open}
        setOpen={setOpen}
        label={t('menu.edit')}
        testId="xmart-menu-edit"
        items={[
          { id: 'undo', label: t('menu.edit.undo') },
          { id: 'redo', label: t('menu.edit.redo') },
          { type: 'separator', id: 'edit-sep' },
          { id: 'cut', label: t('menu.edit.cut') },
          { id: 'copy', label: t('menu.edit.copy') },
          { id: 'paste', label: t('menu.edit.paste') },
          { id: 'selectAll', label: t('menu.edit.selectAll') },
        ]}
        onSelect={(id) => {
          close()
          document.execCommand(id)
        }}
        onClose={close}
      />
      <TopMenu
        id="view"
        open={open}
        setOpen={setOpen}
        label={t('menu.view')}
        testId="xmart-menu-view"
        items={[
          { id: 'activity-explorer', label: t('activity.explorer') },
          { id: 'activity-git', label: t('activity.git') },
          { id: 'activity-tasks', label: t('activity.tasks') },
          { type: 'separator', id: 'view-sep' },
          { id: 'sidebar-primary', label: t('menu.view.primary') },
          { id: 'sidebar-sessions', label: t('menu.view.sessions') },
        ]}
        onSelect={(id) => { select(id as AppMenuCommand) }}
        onClose={close}
      />
      <TopMenu
        id="terminal"
        open={open}
        setOpen={setOpen}
        label={t('menu.terminal')}
        testId="xmart-menu-terminal"
        items={[
          { id: 'new', label: t('menu.terminal.new'), disabled: !canCreate },
          { id: 'toggle', label: t('menu.terminal.toggle') },
        ]}
        onSelect={(id) => {
          close()
          run(id === 'new' ? 'terminal-new' : 'terminal-toggle')
        }}
        onClose={close}
      />
      <TopMenu
        id="help"
        open={open}
        setOpen={setOpen}
        label={t('menu.help')}
        testId="xmart-menu-help"
        items={[{ id: 'about', label: t('menu.help.about') }]}
        onSelect={() => {
          close()
          window.alert(`${t('menu.help.aboutTitle')}\n${t('menu.help.aboutDetail')}`)
        }}
        onClose={close}
      />
    </div>
  )
}

function TopMenu(props: {
  id: MenuId
  open: MenuId | null
  setOpen: (id: MenuId | null) => void
  label: string
  testId: string
  items: MenuEntry[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const shown = props.open === props.id
  return (
    <Menu
      open={shown}
      onClose={props.onClose}
      items={props.items}
      onSelect={props.onSelect}
      align="start"
      compact
      anchor={(
        <button
          type="button"
          className={css.item}
          aria-expanded={shown}
          data-testid={props.testId}
          onClick={() => { props.setOpen(shown ? null : props.id) }}
        >
          {props.label}
        </button>
      )}
    />
  )
}
