// @vitest-environment jsdom
/**
 * ActivityBar: icon toggles for the primary sidebar. Terminal lives on the menu bar.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { ActivityBar } from '../src/client/ActivityBar.tsx'
import type { ActivityBarProps } from '../src/client/contract.ts'
import { EMPTY_GIT_BADGE, type GitBadgeSnapshot } from '../src/client/git-badge.ts'
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

function mount(opts: { primaryOpen?: boolean; view?: WorkbenchView; badge?: GitBadgeSnapshot }) {
  const setActivity = vi.fn()
  const openPrimary = vi.fn()
  const closePrimary = vi.fn()
  const props = {
    primaryOpen: opts.primaryOpen ?? true,
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    setActivity,
    openPrimary,
    closePrimary,
    useWorkbenchSession: constantHook(opts.view ?? EMPTY_WORKBENCH_VIEW),
    useWorkbenchRegistry: constantHook({ tabs: [], viewers: [], activities: [] }),
    useGitBadge: constantHook(opts.badge ?? EMPTY_GIT_BADGE),
    resolveIcon: () => undefined,
    t,
  } as ActivityBarProps
  render(<ActivityBar {...props} />)
  return { setActivity, openPrimary, closePrimary }
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
    act(() => { screen.getByTestId('xmart-activity-git').click() })
    expect(setActivity).toHaveBeenCalledWith('git')
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
      useWorkbenchSession: constantHook({ ...EMPTY_WORKBENCH_VIEW, activity: 'explorer' }),
      useWorkbenchRegistry: constantHook({
        tabs: [],
        viewers: [],
        activities: [
          { id: 'explorer', title: '资源管理器', enabled: true },
          { id: 'plugins', title: '插件', enabled: true },
        ],
      }),
      useGitBadge: constantHook(EMPTY_GIT_BADGE),
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
      useWorkbenchSession: constantHook(EMPTY_WORKBENCH_VIEW),
      useWorkbenchRegistry: constantHook({
        tabs: [],
        viewers: [],
        activities: [{ id: 'ghost', title: 'Ghost', enabled: true }],
      }),
      useGitBadge: constantHook(EMPTY_GIT_BADGE),
      t,
    } as ActivityBarProps
    render(<ActivityBar {...props} />)
    expect(screen.queryByTestId('xmart-activity-ghost')).toBeNull()
  })

  it('shows settings and keeps terminal off the activity rail', () => {
    mount({})
    expect(screen.getByTestId('xmart-activity-settings')).toBeDefined()
    expect(screen.queryByTestId('xmart-activity-terminal')).toBeNull()
  })

  it('shows a summary bubble on the git icon and hides it when clean', () => {
    mount({ badge: { staged: 1, unstaged: 74, root: '/ws' } })
    expect(screen.getByTestId('xmart-activity-git-badge').textContent).toBe('75')
    cleanup()
    mount({ badge: { staged: 40, unstaged: 60, root: '/ws' } })
    expect(screen.getByTestId('xmart-activity-git-badge').textContent).toBe('100')
    cleanup()
    mount({ badge: { staged: 400, unstaged: 601, root: '/ws' } })
    expect(screen.getByTestId('xmart-activity-git-badge').textContent).toBe('1k+')
    cleanup()
    mount({ badge: EMPTY_GIT_BADGE })
    expect(screen.queryByTestId('xmart-activity-git-badge')).toBeNull()
  })
})
