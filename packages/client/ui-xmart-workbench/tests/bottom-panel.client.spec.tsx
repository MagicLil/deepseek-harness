// @vitest-environment jsdom
/**
 * BottomPanel: terminal tab strip under the editor track.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { BottomPanel } from '../src/client/BottomPanel.tsx'
import type { BottomPanelProps } from '../src/client/contract.ts'
import { EMPTY_WORKBENCH_VIEW } from '../src/client/service.ts'
import type { TabBodyProps, WorkbenchView } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function constantHook<T>(value: T) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(value)
  }
}

function Stub({ tab }: TabBodyProps) {
  return <div data-testid="xmart-bottom-body">{tab.title}</div>
}

function mount(opts: {
  height: number
  view?: WorkbenchView
  resolveBody?: BottomPanelProps['resolveBody']
}) {
  const activateTab = vi.fn()
  const closeTab = vi.fn()
  const newTerminal = vi.fn()
  const props = {
    height: opts.height,
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    resolveBody: opts.resolveBody ?? (() => Stub),
    activateTab,
    closeTab,
    newTerminal,
    useWorkbenchSession: constantHook(opts.view ?? EMPTY_WORKBENCH_VIEW),
    t,
  } as BottomPanelProps
  render(<BottomPanel {...props} />)
  return { activateTab, closeTab, newTerminal }
}

const twoTerms: WorkbenchView = {
  ...EMPTY_WORKBENCH_VIEW,
  activeTabId: 'terminal:2',
  tabs: [
    { id: 'ed', type: 'editor', title: 'a.ts' },
    { id: 'terminal:1', type: 'terminal', title: '终端 1' },
    { id: 'terminal:2', type: 'terminal', title: '终端 2' },
  ],
}

describe('BottomPanel', () => {
  it('renders nothing while closed', () => {
    mount({ height: 0, view: twoTerms })
    expect(screen.queryByTestId('xmart-bottom-panel')).toBeNull()
  })

  it('renders the active terminal body and switches tabs', () => {
    const { activateTab, closeTab, newTerminal } = mount({ height: 200, view: twoTerms })
    expect(screen.getByTestId('xmart-bottom-panel')).toBeTruthy()
    expect(screen.getByTestId('xmart-bottom-body').textContent).toBe('终端 2')
    act(() => { screen.getByText('终端 1').click() })
    expect(activateTab).toHaveBeenCalledWith('terminal:1')
    act(() => { screen.getByTestId('xmart-bottom-tab-terminal:1').querySelector('button[aria-label]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(closeTab).toHaveBeenCalledWith('terminal:1')
    act(() => { screen.getByTestId('xmart-bottom-new').click() })
    expect(newTerminal).toHaveBeenCalledOnce()
  })

  it('shows empty copy when no terminal tab is open', () => {
    mount({ height: 200 })
    expect(screen.getByTestId('xmart-bottom-empty').textContent).toContain('新建终端')
  })

  it('shows empty copy when the terminal type is unregistered', () => {
    mount({ height: 200, view: twoTerms, resolveBody: () => undefined })
    expect(screen.getByTestId('xmart-bottom-empty')).toBeTruthy()
    expect(screen.queryByTestId('xmart-bottom-body')).toBeNull()
  })

  it('renders problems and checks tabs alongside terminals', () => {
    const { closeTab } = mount({
      height: 200,
      view: {
        ...EMPTY_WORKBENCH_VIEW,
        activeTabId: 'problems:1',
        tabs: [
          { id: 'problems:1', type: 'problems', title: '问题' },
          { id: 'checks:1', type: 'checks', title: '检查' },
          { id: 'terminal:1', type: 'terminal', title: '终端 1' },
        ],
      },
    })
    expect(screen.getByTestId('xmart-bottom-tab-problems:1')).toBeTruthy()
    expect(screen.getByTestId('xmart-bottom-tab-checks:1')).toBeTruthy()
    expect(screen.getByTestId('xmart-bottom-body').textContent).toBe('问题')
    act(() => {
      screen.getByTestId('xmart-bottom-tab-problems:1')
        .querySelector('button[aria-label]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(closeTab).toHaveBeenCalledWith('problems:1')
    act(() => {
      screen.getByTestId('xmart-bottom-tab-checks:1')
        .querySelector('button[aria-label]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(closeTab).toHaveBeenCalledWith('checks:1')
  })

  it('remounts the body when switching between same-type tabs so state is isolated', () => {
    // A stateful stub whose useState initializer captures the FIRST tab.id it
    // sees. Without a key on <Body>, React reuses the instance and the initializer
    // never re-runs, so the stale tab.id leaks into the new tab. With key={active.id}
    // the component remounts and the initializer runs fresh for each tab.
    let mountCount = 0
    function StatefulStub({ tab }: TabBodyProps) {
      mountCount += 1
      const [seed] = useState(tab.id)
      return <div data-testid="xmart-bottom-body" data-seed={seed}>{tab.title}</div>
    }
    const baseView: WorkbenchView = {
      ...EMPTY_WORKBENCH_VIEW,
      activeTabId: 'terminal:1',
      tabs: [
        { id: 'terminal:1', type: 'terminal', title: '终端 1' },
        { id: 'terminal:2', type: 'terminal', title: '终端 2' },
      ],
    }
    function makeProps(view: WorkbenchView): BottomPanelProps {
      return {
        height: 200,
        sessionId: 's1' as SessionId,
        useSession: (() => null) as never,
        useSessions: (() => null) as never,
        useWorkspaces: (() => null) as never,
        resolveBody: () => StatefulStub,
        activateTab: vi.fn(),
        closeTab: vi.fn(),
        newTerminal: vi.fn(),
        useWorkbenchSession: constantHook(view),
        t,
      } as BottomPanelProps
    }
    const { rerender } = render(<BottomPanel {...makeProps(baseView)} />)
    expect(screen.getByTestId('xmart-bottom-body').dataset.seed).toBe('terminal:1')
    expect(mountCount).toBe(1)

    // Switch to terminal:2 — must remount, not reuse terminal:1's state.
    rerender(<BottomPanel {...makeProps({ ...baseView, activeTabId: 'terminal:2' })} />)
    expect(screen.getByTestId('xmart-bottom-body').dataset.seed).toBe('terminal:2')
    expect(mountCount).toBe(2)
  })

  it('disables + at the session quota', () => {
    mount({
      height: 200,
      view: {
        ...EMPTY_WORKBENCH_VIEW,
        tabs: [
          { id: 'terminal:1', type: 'terminal', title: '终端 1' },
          { id: 'terminal:2', type: 'terminal', title: '终端 2' },
          { id: 'terminal:3', type: 'terminal', title: '终端 3' },
        ],
      },
    })
    expect((screen.getByTestId('xmart-bottom-new') as HTMLButtonElement).disabled).toBe(true)
  })
})
