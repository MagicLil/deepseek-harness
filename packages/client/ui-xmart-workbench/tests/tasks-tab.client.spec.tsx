// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { readTaskTurn, TasksTab } from '../src/client/TasksTab.tsx'
import { TerminalTab } from '../src/client/TerminalTab.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

describe('readTaskTurn', () => {
  it('prefers the live snapshot and drops calls when idle', () => {
    expect(readTaskTurn(undefined, undefined)).toEqual({ running: false, calls: [] })
    expect(readTaskTurn(true, undefined)).toEqual({ running: true, calls: [] })
    expect(readTaskTurn(false, {
      running: true,
      runningCalls: [{ callId: 'c1', name: 'Read' }],
    })).toEqual({ running: true, calls: [{ id: 'c1', name: 'Read' }] })
    expect(readTaskTurn(false, {
      running: false,
      runningCalls: [{ callId: 'stale', name: 'Read' }],
    })).toEqual({ running: false, calls: [] })
  })
})

describe('TasksTab', () => {
  it('shows empty copy and then live rows', () => {
    const jobs = [] as const
    const subs = [] as const
    const watch = vi.fn((fn: () => void) => {
      fn()
      return () => {}
    })
    render(
      <TasksTab
        tab={{ id: 't', type: 'tasks', title: '任务' }}
        visible
        sessionId="s1"
        t={t}
        watchSessions={watch}
        listTurn={() => ({ running: false, calls: [] })}
        listJobs={() => jobs}
        listSubagents={() => subs}
        cancelTurn={vi.fn()}
        cancelSubagent={vi.fn()}
        openSubagent={vi.fn()}
      />,
    )
    expect(screen.getByText('这个会话现在没有正在执行的任务。')).toBeTruthy()
    expect(screen.getByText('没有子代理。')).toBeTruthy()
    expect(screen.queryByTestId('xmart-workbench-turn')).toBeNull()
  })

  it('shows the live turn and its tool calls', () => {
    const cancelTurn = vi.fn()
    render(
      <TasksTab
        tab={{ id: 't', type: 'tasks', title: '任务' }}
        visible
        sessionId="s1"
        t={t}
        watchSessions={() => () => {}}
        listTurn={() => ({ running: true, calls: [{ id: 'c1', name: 'Read' }] })}
        listJobs={() => []}
        listSubagents={() => []}
        cancelTurn={cancelTurn}
        cancelSubagent={vi.fn()}
        openSubagent={vi.fn()}
      />,
    )
    expect(screen.getByTestId('xmart-workbench-turn').textContent).toContain('智能体正在工作')
    expect(screen.getByTestId('xmart-workbench-call-c1').textContent).toBe('Read')
    expect(screen.queryByText('这个会话现在没有正在执行的任务。')).toBeNull()
    fireEvent.click(screen.getByText('停止'))
    expect(cancelTurn).toHaveBeenCalledOnce()
  })

  it('opens and stops a running subagent and shows job detail', () => {
    const cancelSubagent = vi.fn()
    const openSubagent = vi.fn()
    let notify = () => {}
    render(
      <TasksTab
        tab={{ id: 't', type: 'tasks', title: '任务' }}
        visible
        sessionId="s1"
        t={t}
        watchSessions={(fn) => {
          notify = fn
          return () => {}
        }}
        listTurn={() => ({ running: false, calls: [] })}
        listJobs={() => [
          { id: 'bash-1' as never, kind: 'bash', label: 'ls', status: 'running' },
          { id: 'bash-2' as never, kind: 'bash', label: 'pwd', status: 'failed', detail: 'exit 1' },
        ]}
        listSubagents={() => [
          { id: 'c1', label: 'child', activity: 'running' },
          { id: 'c2', activity: 'inactive' },
        ]}
        cancelTurn={vi.fn()}
        cancelSubagent={cancelSubagent}
        openSubagent={openSubagent}
      />,
    )
    act(() => { notify() })
    expect(screen.getByText('ls · running')).toBeTruthy()
    expect(screen.getByText('pwd · failed · exit 1')).toBeTruthy()
    fireEvent.click(screen.getByText('child · running'))
    expect(openSubagent).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByText('停止'))
    expect(cancelSubagent).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByText('c2 · inactive'))
    expect(openSubagent).toHaveBeenCalledWith('c2')
  })
})

describe('TerminalTab', () => {
  it('renders the unavailable copy when the host has no PTY bridge', async () => {
    render(
      <TerminalTab
        tab={{ id: 'term', type: 'terminal', title: '终端' }}
        visible
        sessionId="s1"
        t={t}
        host={{}}
        remote={{}}
      />,
    )
    expect((await screen.findByTestId('xmart-workbench-terminal')).textContent).toContain('还没有挂上主机终端')
  })
})
