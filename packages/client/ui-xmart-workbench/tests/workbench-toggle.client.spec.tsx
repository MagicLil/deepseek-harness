// @vitest-environment jsdom
/**
 * WorkbenchToggle: visible only for a live session while the workbench is closed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { WorkbenchToggle } from '../src/client/WorkbenchToggle.tsx'
import type { WorkbenchToggleProps } from '../src/client/contract.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function useSessionsOf(current: SessionId | undefined, blank = false): WorkbenchToggleProps['useSessions'] {
  return ((sel: (s: SessionListState) => unknown) => {
    const sessionState = {
      ids: current === undefined ? [] : [current],
      byId: current === undefined
        ? {}
        : { [current]: { id: current, displayTitle: 'Test', running: false, blank, updatedAt: 1 } },
      current,
      phase: 'ready',
    } as SessionListState
    return sel(sessionState)
  }) as WorkbenchToggleProps['useSessions']
}

function mount(opts: { current?: SessionId; blank?: boolean; open: boolean }) {
  const openWorkbench = vi.fn()
  const props = {
    useSessions: useSessionsOf(opts.current, opts.blank),
    useWorkbenchOpen: ((sel: (open: boolean) => unknown) => sel(opts.open)) as WorkbenchToggleProps['useWorkbenchOpen'],
    useWorkspaces: (() => null) as never,
    openWorkbench,
    t,
  } as WorkbenchToggleProps
  render(<WorkbenchToggle {...props} />)
  return { openWorkbench }
}

describe('WorkbenchToggle', () => {
  it('hides when no live session is current', () => {
    mount({ open: false })
    expect(screen.queryByTestId('xmart-workbench-toggle')).toBeNull()
  })

  it('hides when the current session is blank', () => {
    mount({ current: 's1' as SessionId, blank: true, open: false })
    expect(screen.queryByTestId('xmart-workbench-toggle')).toBeNull()
  })

  it('hides when the workbench is already open', () => {
    mount({ current: 's1' as SessionId, open: true })
    expect(screen.queryByTestId('xmart-workbench-toggle')).toBeNull()
  })

  it('opens the workbench from the overlay control', () => {
    const { openWorkbench } = mount({ current: 's1' as SessionId, open: false })
    screen.getByTestId('xmart-workbench-toggle').click()
    expect(openWorkbench).toHaveBeenCalledOnce()
    expect(screen.getByText('打开工作台')).toBeTruthy()
  })
})
