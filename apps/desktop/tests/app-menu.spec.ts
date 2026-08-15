import { describe, expect, it } from 'vitest'
import { desktopAppMenuLabels, desktopAppMenuSpec } from '../src/app-menu.ts'

describe('desktopAppMenuSpec', () => {
  it('puts Terminal in the same row as File / Edit / View', () => {
    const labels = desktopAppMenuLabels('zh-CN')
    expect(labels).toEqual({
      terminal: '终端',
      terminalNew: '新建终端',
      terminalToggle: '切换终端',
    })
    expect(desktopAppMenuSpec(labels).map(row => 'role' in row ? row.role : row.id)).toEqual([
      'fileMenu', 'editMenu', 'viewMenu', 'terminal', 'windowMenu', 'help',
    ])
    const terminal = desktopAppMenuSpec(labels)[3]
    expect(terminal).toMatchObject({
      id: 'terminal',
      label: '终端',
      submenu: [
        { id: 'terminal-new', label: '新建终端' },
        { id: 'terminal-toggle', label: '切换终端', accelerator: 'CommandOrControl+`' },
      ],
    })
  })

  it('uses English copy when the OS locale is not Chinese', () => {
    expect(desktopAppMenuLabels('en-US').terminal).toBe('Terminal')
    expect(desktopAppMenuLabels('EN').terminalNew).toBe('New Terminal')
  })
})
