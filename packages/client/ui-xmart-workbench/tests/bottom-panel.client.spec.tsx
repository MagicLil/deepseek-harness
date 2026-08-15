// @vitest-environment jsdom
/**
 * BottomPanel: terminal tab strip under the editor track.
 */
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
