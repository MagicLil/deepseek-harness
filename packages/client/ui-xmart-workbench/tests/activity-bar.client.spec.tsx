// @vitest-environment jsdom
/**
 * ActivityBar: icon toggles for the primary sidebar, bottom panel, and settings.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { ActivityBar } from '../src/client/ActivityBar.tsx'
import type { ActivityBarProps } from '../src/client/contract.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { WorkbenchView } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function constantHook<T>(value: T) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(value)
  }
}

function mount(opts: { primaryOpen?: boolean; bottomOpen?: boolean; view?: WorkbenchView }) {
  const setActivity = vi.fn()
  const openPrimary = vi.fn()
  const closePrimary = vi.fn()
  const toggleBottom = vi.fn()
  const openSettings = vi.fn()
  const props = {
    primaryOpen: opts.primaryOpen ?? true,
    bottomOpen: opts.bottomOpen ?? false,
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    setActivity,
    openPrimary,
    closePrimary,
    toggleBottom,
    openSettings,
    useWorkbenchSession: constantHook(opts.view ?? EMPTY_WORKBENCH_VIEW),
    useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
    resolveIcon: () => undefined,
    t,
  } as ActivityBarProps
  render(<ActivityBar {...props} />)
  return { setActivity, openPrimary, closePrimary, toggleBottom, openSettings }
}

describe('ActivityBar', () => {
  it('opens a closed primary sidebar on the chosen activity', () => {
    const { setActivity, openPrimary, closePrimary } = mount({ primaryOpen: false })
    act(() => { screen.getByTestId('xmart-activity-git').click() })
    expect(setActivity).toHaveBeenCalledWith('git')
    expect(openPrimary).toHaveBeenCalledOnce()
    expect(closePrimary).not.toHaveBeenCalled()
  })

  it('collapses the primary sidebar when the active icon is clicked again', () => {
    const { setActivity, openPrimary, closePrimary } = mount({
      primaryOpen: true,
      view: { ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' },
    })
    act(() => { screen.getByTestId('xmart-activity-explorer').click() })
    expect(closePrimary).toHaveBeenCalledOnce()
    expect(setActivity).not.toHaveBeenCalled()
    expect(openPrimary).not.toHaveBeenCalled()
  })

  it('switches activity while the primary sidebar stays open', () => {
    const { setActivity, openPrimary, closePrimary } = mount({
      primaryOpen: true,
      view: { ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' },
    })
    act(() => { screen.getByTestId('xmart-activity-tasks').click() })
    expect(setActivity).toHaveBeenCalledWith('tasks')
    expect(openPrimary).toHaveBeenCalledOnce()
    expect(closePrimary).not.toHaveBeenCalled()
  })

  it('renders a registered activity from the registry', () => {
    const setActivity = vi.fn()
    const Icon = () => <span data-testid="xmart-plugins-icon" />
    const props = {
      primaryOpen: true,
      bottomOpen: false,
      sessionId: 's1' as SessionId,
      useSession: (() => null) as never,
      useSessions: (() => null) as never,
      useWorkspaces: (() => null) as never,
      setActivity,
      resolveIcon: (id: string) => id === 'plugins' ? Icon : undefined,
      openPrimary: vi.fn(),
      closePrimary: vi.fn(),
      toggleBottom: vi.fn(),
      openSettings: vi.fn(),
      useWorkbenchSession: constantHook({ ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' }),
      useWorkbenchRegistry: constantHook({
        tabs: [],
        viewers: [],
        activities: [
          { id: 'explorer', title: '资源管理器', enabled: true },
          { id: 'plugins', title: '插件', enabled: true },
        ],
      }),
      t,
    } as ActivityBarProps
    render(<ActivityBar {...props} />)
    expect(screen.getByTestId('xmart-activity-plugins')).toBeTruthy()
    act(() => { screen.getByTestId('xmart-activity-plugins').click() })
    expect(setActivity).toHaveBeenCalledWith('plugins')
    expect(screen.queryByTestId('xmart-activity-ghost')).toBeNull()
  })

  it('skips a registered activity that has no icon', () => {
    const props = {
      primaryOpen: true,
      bottomOpen: false,
      sessionId: 's1' as SessionId,
      useSession: (() => null) as never,
      useSessions: (() => null) as never,
      useWorkspaces: (() => null) as never,
      setActivity: vi.fn(),
      resolveIcon: () => undefined,
      openPrimary: vi.fn(),
      closePrimary: vi.fn(),
      toggleBottom: vi.fn(),
      openSettings: vi.fn(),
      useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
      useWorkbenchRegistry: constantHook({
        tabs: [],
        viewers: [],
        activities: [{ id: 'ghost', title: 'Ghost', enabled: true }],
      }),
      t,
    } as ActivityBarProps
    render(<ActivityBar {...props} />)
    expect(screen.queryByTestId('xmart-activity-ghost')).toBeNull()
  })

  it('toggles the bottom panel and opens settings', () => {
    const { toggleBottom, openSettings } = mount({ bottomOpen: true })
    expect(screen.getByTestId('xmart-activity-terminal').getAttribute('aria-pressed')).toBe('true')
    act(() => { screen.getByTestId('xmart-activity-terminal').click() })
    expect(toggleBottom).toHaveBeenCalledOnce()
    act(() => { screen.getByTestId('xmart-activity-settings').click() })
    expect(openSettings).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('设置')).toBeTruthy()
  })
})
