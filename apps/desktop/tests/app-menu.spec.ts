import { describe, expect, it } from 'vitest'
import { desktopAppMenuLabels, desktopAppMenuSpec } from '../src/app-menu.ts'

describe('desktopAppMenuSpec', () => {
  it('builds the 万物智汇 menu in Chinese', () => {
    const labels = desktopAppMenuLabels('zh-CN')
    expect(labels.file).toBe('文件')
    expect(labels.helpAbout).toBe('关于万物智汇')
    expect(desktopAppMenuSpec(labels).map(row => row.id)).toEqual([
      'file', 'edit', 'go', 'view', 'terminal', 'help',
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
    const go = desktopAppMenuSpec(labels)[2]
    expect(go?.submenu).toEqual(expect.arrayContaining([
      { type: 'command', id: 'file-quick-open', label: '转到文件', accelerator: 'CommandOrControl+P' },
      { type: 'command', id: 'file-goto-definition', label: '转到定义', accelerator: 'F12' },
    ]))
    const terminal = desktopAppMenuSpec(labels)[4]
    expect(terminal).toMatchObject({
      id: 'terminal',
      label: '终端',
      submenu: [
        { type: 'command', id: 'terminal-new', label: '新建终端' },
        { type: 'command', id: 'terminal-toggle', label: '切换终端', accelerator: 'CommandOrControl+`' },
      ],
    })
    const edit = desktopAppMenuSpec(labels)[1]
    expect(edit?.submenu).toEqual(expect.arrayContaining([
      { type: 'command', id: 'file-find', label: '查找', accelerator: 'CommandOrControl+F' },
      { type: 'command', id: 'file-replace', label: '替换', accelerator: 'CommandOrControl+H' },
    ]))
    expect(desktopAppMenuSpec(labels)[5]?.submenu).toEqual([
      { type: 'about', label: '关于万物智汇' },
      { type: 'separator' },
      { type: 'role', role: 'toggleDevTools' },
    ])
  })

  it('uses English copy when the OS locale is not Chinese', () => {
    expect(desktopAppMenuLabels('en-US').fileFind).toBe('Find')
    expect(desktopAppMenuLabels('en-US').fileReplace).toBe('Replace')
    expect(desktopAppMenuLabels('en-US').goFile).toBe('Go to File')
    expect(desktopAppMenuLabels('en-US').terminal).toBe('Terminal')
    expect(desktopAppMenuLabels('EN').fileNewSession).toBe('New Session')
    expect(desktopAppMenuLabels('en').helpAbout).toBe('About Xmart')
  })
})
