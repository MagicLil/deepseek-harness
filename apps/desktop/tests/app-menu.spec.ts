import { describe, expect, it } from 'vitest'
import { desktopAppMenuLabels, desktopAppMenuSpec } from '../src/app-menu.ts'

describe('desktopAppMenuSpec', () => {
  it('builds the 万物智汇 menu in Chinese', () => {
    const labels = desktopAppMenuLabels('zh-CN')
    expect(labels.file).toBe('文件')
    expect(labels.helpAbout).toBe('关于万物智汇')
    expect(desktopAppMenuSpec(labels).map(row => row.id)).toEqual([
      'file', 'edit', 'view', 'terminal', 'help',
    ])
    const file = desktopAppMenuSpec(labels)[0]
    expect(file.submenu).toEqual([
      { type: 'command', id: 'session-new', label: '新会话', accelerator: 'CommandOrControl+N' },
      { type: 'command', id: 'workspace-open', label: '打开工作区…', accelerator: 'CommandOrControl+O' },
      { type: 'separator' },
      { type: 'command', id: 'file-save', label: '保存', accelerator: 'CommandOrControl+S' },
      { type: 'command', id: 'file-close', label: '关闭编辑器', accelerator: 'CommandOrControl+W' },
      { type: 'separator' },
      { type: 'command', id: 'settings-open', label: '设置', accelerator: 'CommandOrControl+,' },
      { type: 'separator' },
      { type: 'role', role: 'quit' },
    ])
    const terminal = desktopAppMenuSpec(labels)[3]
    expect(terminal).toMatchObject({
      id: 'terminal',
      label: '终端',
      submenu: [
        { type: 'command', id: 'terminal-new', label: '新建终端' },
        { type: 'command', id: 'terminal-toggle', label: '切换终端', accelerator: 'CommandOrControl+`' },
      ],
    })
    expect(desktopAppMenuSpec(labels)[4]?.submenu).toEqual([
      { type: 'about', label: '关于万物智汇' },
      { type: 'separator' },
      { type: 'role', role: 'toggleDevTools' },
    ])
  })

  it('uses English copy when the OS locale is not Chinese', () => {
    expect(desktopAppMenuLabels('en-US').terminal).toBe('Terminal')
    expect(desktopAppMenuLabels('EN').fileNewSession).toBe('New Session')
    expect(desktopAppMenuLabels('en').helpAbout).toBe('About Xmart')
  })
})
