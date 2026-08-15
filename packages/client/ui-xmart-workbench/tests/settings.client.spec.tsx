// @vitest-environment jsdom
/**
 * WorkbenchSettingsSection: one switch per registered tab/viewer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { WorkbenchSettingsSection } from '../src/client/WorkbenchSettingsSection.tsx'
import type { WorkbenchSettingsProps } from '../src/client/contract.ts'
import type { WorkbenchRegistrySnapshot } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function mount(registry: WorkbenchRegistrySnapshot) {
  const setTabEnabled = vi.fn()
  const setViewerEnabled = vi.fn()
  const props = {
    close: vi.fn(),
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    useWorkbenchRegistry: ((sel: (s: WorkbenchRegistrySnapshot) => unknown) => sel(registry)) as never,
    setTabEnabled,
    setViewerEnabled,
    t,
  } as WorkbenchSettingsProps
  render(<WorkbenchSettingsSection {...props} />)
  return { setTabEnabled, setViewerEnabled }
}

describe('WorkbenchSettingsSection', () => {
  it('toggles a tab type and shows the empty viewers copy', () => {
    const { setTabEnabled, setViewerEnabled } = mount({
      tabs: [{ id: 'demo', title: '演示', enabled: true }],
      viewers: [],
      activities: [],
    })
    expect(screen.getByTestId('xmart-workbench-settings')).toBeTruthy()
    expect(screen.getByText('还没有注册文件预览器。')).toBeTruthy()
    act(() => { screen.getByTestId('xmart-workbench-enable-demo').click() })
    expect(setTabEnabled).toHaveBeenCalledWith('demo', false)
    expect(setViewerEnabled).not.toHaveBeenCalled()
  })

  it('toggles a viewer and uses the enable label when the row is off', () => {
    const { setViewerEnabled } = mount({
      tabs: [{ id: 'demo', title: '演示', enabled: false }],
      viewers: [{ id: 'image', title: 'Image', enabled: true }],
      activities: [],
    })
    expect(screen.getByLabelText('启用')).toBeTruthy()
    act(() => { screen.getByTestId('xmart-workbench-enable-image').click() })
    expect(setViewerEnabled).toHaveBeenCalledWith('image', false)
  })
})
