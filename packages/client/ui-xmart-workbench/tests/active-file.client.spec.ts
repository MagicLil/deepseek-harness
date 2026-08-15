import { describe, expect, it } from 'vitest'
import { activeEditorPath } from '../src/client/active-file.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'

describe('activeEditorPath', () => {
  it('returns undefined when the editor strip is empty', () => {
    expect(activeEditorPath(EMPTY_WORKBENCH_VIEW)).toBeUndefined()
    expect(activeEditorPath({
      ...EMPTY_WORKBENCH_VIEW,
      tabs: [{ id: 'explorer:1', type: 'explorer', title: '资源管理器' }],
      activeTabId: 'explorer:1',
    })).toBeUndefined()
  })

  it('prefers the focused file tab and falls back to the last file tab', () => {
    const view = {
      ...EMPTY_WORKBENCH_VIEW,
      tabs: [
        { id: 'explorer:1', type: 'explorer', title: '资源管理器' },
        { id: 'editor:1', type: 'editor', title: 'a.ts', path: '/ws/a.ts' },
        { id: 'editor:2', type: 'editor', title: 'B.java', path: 'D:\\ws\\B.java' },
      ],
      activeTabId: 'editor:1',
    }
    expect(activeEditorPath(view)).toBe('/ws/a.ts')
    expect(activeEditorPath({ ...view, activeTabId: 'explorer:1' })).toBe('D:\\ws\\B.java')
  })
})
