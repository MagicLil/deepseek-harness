// @vitest-environment jsdom
/**
 * TerminalTab: unavailable, open/replay, raw write, output events (xterm mock).
 */
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { TerminalTab } from '../src/client/TerminalTab.tsx'
import { XTERM_THEME_DARK, XTERM_THEME_LIGHT } from '../src/client/terminal-theme.ts'
import { resetInflightTerminalOpens } from '../src/client/terminal-client.ts'
import { resetTerminalSeats, setTerminalSeat } from '../src/client/terminal-seats.ts'
import type { HostTerminalMethods, TerminalOutputPayload } from '../src/client/terminal-client.ts'
import { zh } from '../src/client/locales.ts'

type DataHandler = (data: string) => void
type ResizeHandler = (size: { cols: number; rows: number }) => void
type KeyHandler = (event: KeyboardEvent) => boolean

const termState = vi.hoisted(() => ({
  writes: [] as string[],
  onData: undefined as DataHandler | undefined,
  onResize: undefined as ResizeHandler | undefined,
  onKey: undefined as KeyHandler | undefined,
  selection: '',
  disposeCount: 0,
  focusCount: 0,
  fitCount: 0,
  theme: undefined as { background?: string; foreground?: string } | undefined,
  options: undefined as { theme?: { background?: string; foreground?: string } } | undefined,
}))

vi.mock('@xterm/xterm', () => {
  class Terminal {
    cols = 80
    rows = 24
    options: { theme?: { background?: string; foreground?: string } }
    constructor(opts?: { theme?: { background?: string; foreground?: string } }) {
      this.options = { theme: opts?.theme }
      termState.theme = opts?.theme
      termState.options = this.options
    }
    loadAddon(): void {}
    open(): void {}
    focus(): void { termState.focusCount += 1 }
    write(data: string): void { termState.writes.push(data) }
    dispose(): void { termState.disposeCount += 1 }
    hasSelection(): boolean { return termState.selection !== '' }
    getSelection(): string { return termState.selection }
    attachCustomKeyEventHandler(handler: KeyHandler): void { termState.onKey = handler }
    onData(handler: DataHandler): { dispose: () => void } {
      termState.onData = handler
      return { dispose: () => { if (termState.onData === handler) termState.onData = undefined } }
    }
    onResize(handler: ResizeHandler): { dispose: () => void } {
      termState.onResize = handler
      return { dispose: () => { if (termState.onResize === handler) termState.onResize = undefined } }
    }
  }
  return { Terminal }
})

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit(): void { termState.fitCount += 1 }
  },
}))

afterEach(() => {
  cleanup()
  resetTerminalSeats()
  resetInflightTerminalOpens()
})

beforeEach(() => {
  termState.writes = []
  termState.onData = undefined
  termState.onResize = undefined
  termState.onKey = undefined
  termState.selection = ''
  termState.disposeCount = 0
  termState.focusCount = 0
  termState.fitCount = 0
  termState.theme = undefined
  termState.options = undefined
  document.body.removeAttribute('data-ds-dark-theme')
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as typeof ResizeObserver
  }
})

const t = makeTranslate(zh, commonZh)

function ok<T>(value: T) {
  return Promise.resolve({ result: { ok: true as const, value } })
}

function fail(code: string, message: string) {
  return Promise.resolve({ result: { ok: false as const, error: { code, message } } })
}

function mount(
  host: HostTerminalMethods,
  remote: unknown = { $on: () => () => {} },
  cwd?: string,
) {
  return render(
    <TerminalTab
      tab={{ id: 'terminal:1', type: 'terminal', title: '终端 1' }}
      visible
      sessionId="s1"
      t={t}
      host={host}
      remote={remote}
      {...cwd === undefined ? {} : { cwd }}
    />,
  )
}

describe('TerminalTab', () => {
  it('shows the unavailable note when the host has no list method', async () => {
    mount({})
    await waitFor(() => {
      expect(screen.getByTestId('xmart-workbench-terminal').textContent).toContain('还没有挂上主机终端')
    })
  })

  it('shows the unavailable note when list.available is false', async () => {
    mount({ terminalList: () => ok({ available: false, sessions: [] }) })
    await waitFor(() => {
      expect(screen.getByTestId('xmart-workbench-terminal').textContent).toContain('还没有挂上主机终端')
    })
  })

  it('treats a TerminalAccessError as unavailable', async () => {
    mount({ terminalList: () => fail('internal', 'down') })
    await waitFor(() => {
      expect(screen.getByTestId('xmart-workbench-terminal').textContent).toContain('还没有挂上主机终端')
    })
  })

  it('copies selection on Ctrl+C and otherwise leaves Ctrl+C for the PTY', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    mount({
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({ id: 'pty-copy', motd: 'ready\n', status: { kind: 'running' as const } }),
      terminalResize: () => ok({ resized: true as const }),
    })
    await waitFor(() => expect(termState.onKey).toBeDefined())

    const host = screen.getByTestId('xmart-terminal-xterm')
    termState.selection = 'selected output'
    expect(fireEvent.keyDown(host, { ctrlKey: true, key: 'c' })).toBe(false)
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('selected output'))

    termState.selection = ''
    expect(fireEvent.keyDown(host, { ctrlKey: true, key: 'c' })).toBe(true)
    expect(termState.onKey?.(new KeyboardEvent('keydown', { ctrlKey: true, key: 'c' }))).toBe(true)
  })

  it('opens a PTY, writes motd, and appends live output via xterm', async () => {
    let listener: ((payload: TerminalOutputPayload) => void) | undefined
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-1', motd: 'ready\n', status: { kind: 'running' as const },
      })),
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host, {
      $on: (_name: string, fn: (payload: TerminalOutputPayload) => void) => {
        listener = fn
        return () => { listener = undefined }
      },
    }, 'D:\\work\\hmdp')
    await waitFor(() => {
      expect(screen.queryByTestId('xmart-terminal-cwd')).toBeNull()
      expect(screen.getByTestId('xmart-terminal-xterm')).toBeTruthy()
      expect(termState.writes).toContain('ready\n')
    })
    expect(host.terminalOpen).toHaveBeenCalledWith(
      { sessionId: 's1', name: 'terminal:1', cwd: 'D:\\work\\hmdp', cols: 80, rows: 24 },
      undefined,
    )
    expect(host.terminalResize).toHaveBeenCalled()
    act(() => {
      listener?.({ sessionId: 's1', ptyId: 'pty-1', delta: 'hi\n', truncated: false })
      listener?.({ sessionId: 'other', ptyId: 'pty-1', delta: 'nope', truncated: false })
    })
    expect(termState.writes).toEqual(['ready\n', 'hi\n'])
    act(() => { termState.onData?.('ls\r') })
    await waitFor(() => {
      expect(host.terminalWrite).toHaveBeenCalledWith(
        { sessionId: 's1', id: 'pty-1', data: 'ls\r' },
        undefined,
      )
    })
  })

  it('kicks the shell with CR when open and read stay empty', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-kick', motd: '', status: { kind: 'running' as const },
      }),
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(host.terminalWrite).toHaveBeenCalledWith(
        { sessionId: 's1', id: 'pty-kick', data: '\r' },
        undefined,
      )
    })
  })

  it('paints a late scrollback read after an empty motd', async () => {
    let reads = 0
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-late', motd: '', status: { kind: 'running' as const },
      }),
      terminalRead: () => {
        reads += 1
        return ok({ text: reads < 3 ? '' : 'PS> ' })
      },
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.writes).toEqual(['PS> '])
    })
    expect(host.terminalWrite).not.toHaveBeenCalled()
  })

  it('replays scrollback when open returns an empty motd', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-40', motd: '', status: { kind: 'running' as const },
      }),
      terminalRead: () => ok({ text: 'PS D:\\mycode\\deepseek> ' }),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.writes).toEqual(['PS D:\\mycode\\deepseek> '])
    })
  })

  it('attaches to a listed PTY with the same tab name instead of opening again', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({
        available: true,
        sessions: [{ id: 'pty-36', name: 'terminal:1', status: { kind: 'running' as const } }],
      }),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-new', motd: '', status: { kind: 'running' as const },
      })),
      terminalRead: () => ok({ text: 'replay\n' }),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.writes).toEqual(['replay\n'])
    })
    expect(host.terminalOpen).not.toHaveBeenCalled()
  })

  it('opens only one host PTY when Strict Mode remounts the tab', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-1', motd: 'ready\n', status: { kind: 'running' as const },
      })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    render(
      <StrictMode>
        <TerminalTab
          tab={{ id: 'terminal:36', type: 'terminal', title: '终端 36' }}
          visible
          sessionId="s1"
          t={t}
          host={host}
          remote={{ $on: () => () => {} }}
        />
      </StrictMode>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('xmart-terminal-xterm')).toBeTruthy()
    })
    expect(host.terminalOpen).toHaveBeenCalledOnce()
  })

  it('replays scrollback for an existing seat', async () => {
    setTerminalSeat('s1', 'terminal:1', 'pty-9')
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalRead: () => ok({ text: 'old\n' }),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.writes).toEqual(['old\n'])
    })
  })

  it('reopens a fresh PTY when the seat points at a dead session', async () => {
    setTerminalSeat('s1', 'terminal:1', 'pty-9')
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalRead: () => fail('internal', 'unknown PTY session pty-9'),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-new', motd: 'fresh\n', status: { kind: 'running' as const },
      })),
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.writes).toEqual(['fresh\n'])
    })
    expect(host.terminalOpen).toHaveBeenCalledWith(
      { sessionId: 's1', name: 'terminal:1', cols: 80, rows: 24 },
      undefined,
    )
    expect(host.terminalWrite).not.toHaveBeenCalled()
  })

  it('shows a write error from onData', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-1', motd: '', status: { kind: 'running' as const },
      }),
      terminalWrite: () => fail('internal', 'busy'),
      terminalResize: () => ok({ resized: true as const }),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.onData).toBeTypeOf('function')
    })
    act(() => { termState.onData?.('x') })
    await waitFor(() => {
      expect(screen.getByText('busy')).toBeTruthy()
    })
  })

  it('shows a generic error when open throws something else', async () => {
    mount({
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => Promise.reject(new Error('boom')),
    })
    await waitFor(() => {
      expect(screen.getByTestId('xmart-workbench-terminal').textContent).toContain('boom')
    })
  })

  it('disposes the terminal on unmount', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-1', motd: '', status: { kind: 'running' as const },
      }),
      terminalResize: () => ok({ resized: true as const }),
    }
    const { unmount } = mount(host)
    await waitFor(() => {
      expect(termState.focusCount).toBeGreaterThan(0)
    })
    unmount()
    expect(termState.disposeCount).toBe(1)
  })

  it('keeps the live PTY when only the conversation session id changes', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: vi.fn(() => ok({
        id: 'pty-keep', motd: 'ready\n', status: { kind: 'running' as const },
      })),
      terminalWrite: vi.fn(() => ok({ written: true as const })),
      terminalResize: vi.fn(() => ok({ resized: true as const })),
    }
    const remote = { $on: () => () => {} }
    const view = render(
      <TerminalTab
        tab={{ id: 'terminal:1', type: 'terminal', title: '终端 1' }}
        visible
        sessionId="s1"
        scopeId="/ws"
        t={t}
        host={host}
        remote={remote}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('xmart-terminal-xterm')).toBeTruthy()
    })
    const opened = host.terminalOpen as ReturnType<typeof vi.fn>
    expect(opened).toHaveBeenCalledOnce()
    const disposed = termState.disposeCount
    view.rerender(
      <TerminalTab
        tab={{ id: 'terminal:1', type: 'terminal', title: '终端 1' }}
        visible
        sessionId="s2"
        scopeId="/ws"
        t={t}
        host={host}
        remote={remote}
      />,
    )
    expect(termState.disposeCount).toBe(disposed)
    expect(opened).toHaveBeenCalledOnce()
    act(() => { termState.onData?.('ls\r') })
    await waitFor(() => {
      expect(host.terminalWrite).toHaveBeenCalledWith(
        { sessionId: 's1', id: 'pty-keep', data: 'ls\r' },
        undefined,
      )
    })
  })

  it('opens with the light xterm palette when Appearance is light', async () => {
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-light', motd: '', status: { kind: 'running' as const },
      }),
      terminalResize: () => ok({ resized: true as const }),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.theme).toEqual(XTERM_THEME_LIGHT)
    })
  })

  it('opens with the dark xterm palette and follows Appearance changes', async () => {
    document.body.setAttribute('data-ds-dark-theme', '')
    const host: HostTerminalMethods = {
      terminalList: () => ok({ available: true, sessions: [] }),
      terminalOpen: () => ok({
        id: 'pty-dark', motd: '', status: { kind: 'running' as const },
      }),
      terminalResize: () => ok({ resized: true as const }),
    }
    mount(host)
    await waitFor(() => {
      expect(termState.theme).toEqual(XTERM_THEME_DARK)
    })
    act(() => { document.body.removeAttribute('data-ds-dark-theme') })
    await waitFor(() => {
      expect(termState.options?.theme).toEqual(XTERM_THEME_LIGHT)
    })
  })
})
