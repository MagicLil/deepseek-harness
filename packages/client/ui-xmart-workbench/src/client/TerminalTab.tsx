/**
 * xterm.js terminal body. Keystrokes go to host.terminalWrite; live output
 * arrives on terminals/output; FitAddon drives host.terminalResize.
 *
 * xterm is statically imported so the client ModuleLoader keeps a single
 * lib/client.js (relative chunk requires are not in the module table).
 */
import { Component, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import {
  TerminalAccessError, listTerminals, openTerminal, readTerminal, writeTerminal,
  resizeTerminal, subscribeTerminalOutput, type HostTerminalMethods,
} from './terminal-client.ts'
import { getTerminalSeat, getTerminalSeatOwner, setTerminalSeat } from './terminal-seats.ts'
import { xtermTheme } from './terminal-theme.ts'
import { darkTheme } from './MonacoHost.tsx'
import { ensureXtermCss } from './ensure-xterm-css.ts'
import css from './TerminalTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type TerminalTabProps = TabBodyProps & {
  t: Translate
  host: HostTerminalMethods
  remote: unknown
  /** Absolute directory to spawn in (explorer root). */
  cwd?: string
  /** Project-scoped seat key; defaults to `sessionId`. */
  scopeId?: string
}

/** Keeps the bottom chrome up when the terminal body throws. */
class TerminalBodyErrorBoundary extends Component<
  { t: Translate; children: ReactNode },
  { message: string | null }
> {
  override state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('xmart terminal body crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.message !== null) {
      return (
        <div className={css.note} data-testid="xmart-workbench-terminal">
          {this.props.t('terminal.crash')}
          {': '}
          {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}

/** Terminal seat (see module doc). */
export function TerminalTab(props: TerminalTabProps) {
  return (
    <TerminalBodyErrorBoundary t={props.t}>
      <TerminalTabInner {...props} />
    </TerminalBodyErrorBoundary>
  )
}

function TerminalTabInner({ tab, sessionId, t, host, remote, cwd, scopeId }: TerminalTabProps) {
  const seatScope = scopeId ?? sessionId
  const ownerRef = useRef<string | undefined>(undefined)
  if (ownerRef.current === undefined && sessionId !== '') {
    ownerRef.current = getTerminalSeatOwner(seatScope, tab.id) ?? sessionId
  }
  const owner = ownerRef.current ?? sessionId
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ptyId, setPtyId] = useState<string | undefined>(() => getTerminalSeat(seatScope, tab.id))
  const hostRef = useRef(ptyId)
  hostRef.current = ptyId
  const mountRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    let cancelled = false
    let offOutput = (): void => {}
    let resizeObserver: ResizeObserver | undefined
    let themeObserver: MutationObserver | undefined
    let dataDisposable: { dispose: () => void } | undefined
    let openDisposable: { dispose: () => void } | undefined

    void (async () => {
      try {
        ensureXtermCss()
        if (cancelled || mountRef.current === null) return

        const term = new Terminal({
          convertEol: true,
          cursorBlink: true,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 13,
          theme: xtermTheme(darkTheme()),
        })
        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(mountRef.current)
        fit.fit()
        termRef.current = term
        themeObserver = new MutationObserver(() => {
          term.options.theme = xtermTheme(darkTheme())
        })
        themeObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['data-ds-dark-theme'],
        })

        offOutput = subscribeTerminalOutput(remote, (payload) => {
          if (payload.sessionId !== owner || payload.ptyId !== hostRef.current) return
          term.write(payload.delta)
        })

        dataDisposable = term.onData((data) => {
          const id = hostRef.current
          if (id === undefined) return
          void writeTerminal(host, owner, id, data).catch((err: unknown) => {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'write failed')
            }
          })
        })

        const listed = await listTerminals(host, owner)
        if (cancelled) return
        if (!listed.available) {
          setAvailable(false)
          return
        }

        let id = hostRef.current
        const named = listed.sessions.find(row => row.name === tab.id)
        if (named !== undefined) {
          id = named.id
          hostRef.current = id
          setPtyId(id)
          setTerminalSeat(seatScope, tab.id, id, owner)
          const text = await readTerminal(host, owner, id)
          if (cancelled) return
          if (text !== '') term.write(text)
        } else if (id === undefined) {
          const opened = await openTerminal(host, owner, {
            name: tab.id,
            ...cwd === undefined || cwd === '' ? {} : { cwd },
            cols: Math.max(term.cols, 80),
            rows: Math.max(term.rows, 24),
          })
          if (cancelled) {
            setTerminalSeat(seatScope, tab.id, opened.id, owner)
            return
          }
          id = opened.id
          hostRef.current = id
          setPtyId(id)
          setTerminalSeat(seatScope, tab.id, id, owner)
          // waitReady:false leaves motd empty; the prompt often lands in
          // scrollback before hostRef can accept live terminals/output.
          let text = opened.motd
          try {
            const replay = await readTerminal(host, owner, id)
            if (replay !== '') text = replay
          } catch {
            // Keep motd when the optional read fails.
          }
          if (cancelled) return
          if (text !== '') {
            term.write(text)
          } else {
            let painted = false
            if (host.terminalRead !== undefined) {
              const deadline = Date.now() + 1_500
              while (!cancelled && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 200))
                if (cancelled) return
                try {
                  const replay = await readTerminal(host, owner, id)
                  if (replay !== '') {
                    term.write(replay)
                    painted = true
                    break
                  }
                } catch {
                  break
                }
              }
            }
            // PowerShell often sits until it sees a key. A lone CR is enough
            // to reprint the prompt; live terminals/output then paints it.
            if (!cancelled && !painted) {
              void writeTerminal(host, owner, id, '\r').catch(() => {})
            }
          }
        } else {
          const text = await readTerminal(host, owner, id)
          if (cancelled) return
          if (text !== '') term.write(text)
        }

        const pushSize = (): void => {
          const live = hostRef.current
          if (live === undefined) return
          fit.fit()
          const cols = Math.max(term.cols, 2)
          const rows = Math.max(term.rows, 2)
          void resizeTerminal(host, owner, live, cols, rows).catch(() => {})
        }
        pushSize()
        resizeObserver = new ResizeObserver(() => { pushSize() })
        if (mountRef.current !== null) resizeObserver.observe(mountRef.current)
        openDisposable = term.onResize(({ cols, rows }) => {
          const live = hostRef.current
          if (live === undefined) return
          void resizeTerminal(host, owner, live, Math.max(cols, 2), Math.max(rows, 2)).catch(() => {})
        })

        setAvailable(true)
        term.focus()
      } catch (err) {
        if (cancelled) return
        if (err instanceof TerminalAccessError) {
          setAvailable(false)
          setError(err.message)
          return
        }
        setAvailable(false)
        setError(err instanceof Error ? err.message : 'failed')
      }
    })()

    return () => {
      cancelled = true
      offOutput()
      themeObserver?.disconnect()
      resizeObserver?.disconnect()
      dataDisposable?.dispose()
      openDisposable?.dispose()
      termRef.current?.dispose()
      termRef.current = null
    }
  }, [host, remote, owner, seatScope, tab.id, cwd])

  if (available === false) {
    return (
      <div className={css.note} data-testid="xmart-workbench-terminal">
        {t('terminal.unavailable')}
        {error !== null ? ` (${error})` : ''}
      </div>
    )
  }

  return (
    <div className={css.root} data-testid="xmart-workbench-terminal">
      {available === null
        ? <div className={css.note}>{t('terminal.starting')}</div>
        : null}
      {error !== null ? <div className={css.error}>{error}</div> : null}
      <div
        ref={mountRef}
        className={css.xtermHost}
        data-testid="xmart-terminal-xterm"
        onMouseDown={() => { termRef.current?.focus() }}
      />
    </div>
  )
}
