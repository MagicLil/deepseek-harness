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
import { getTerminalSeat, setTerminalSeat } from './terminal-seats.ts'
import { ensureXtermCss } from './ensure-xterm-css.ts'
import css from './TerminalTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type TerminalTabProps = TabBodyProps & {
  t: Translate
  host: HostTerminalMethods
  remote: unknown
  /** Absolute directory to spawn in (explorer root). */
  cwd?: string
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

function TerminalTabInner({ tab, sessionId, t, host, remote, cwd }: TerminalTabProps) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ptyId, setPtyId] = useState<string | undefined>(() => getTerminalSeat(sessionId, tab.id))
  const hostRef = useRef(ptyId)
  hostRef.current = ptyId
  const mountRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    let cancelled = false
    let offOutput = (): void => {}
    let resizeObserver: ResizeObserver | undefined
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
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
          },
        })
        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(mountRef.current)
        fit.fit()
        termRef.current = term

        offOutput = subscribeTerminalOutput(remote, (payload) => {
          if (payload.sessionId !== sessionId || payload.ptyId !== hostRef.current) return
          term.write(payload.delta)
        })

        dataDisposable = term.onData((data) => {
          const id = hostRef.current
          if (id === undefined) return
          void writeTerminal(host, sessionId, id, data).catch((err: unknown) => {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'write failed')
            }
          })
        })

        const listed = await listTerminals(host, sessionId)
        if (cancelled) return
        if (!listed.available) {
          setAvailable(false)
          return
        }

        let id = hostRef.current
        if (id === undefined) {
          const opened = await openTerminal(host, sessionId, {
            name: tab.id,
            ...cwd === undefined || cwd === '' ? {} : { cwd },
            cols: term.cols,
            rows: term.rows,
          })
          if (cancelled) return
          id = opened.id
          hostRef.current = id
          setPtyId(id)
          setTerminalSeat(sessionId, tab.id, id)
          if (opened.motd !== '') term.write(opened.motd)
        } else {
          const text = await readTerminal(host, sessionId, id)
          if (cancelled) return
          if (text !== '') term.write(text)
        }

        const pushSize = (): void => {
          const live = hostRef.current
          if (live === undefined) return
          fit.fit()
          void resizeTerminal(host, sessionId, live, term.cols, term.rows).catch(() => {})
        }
        pushSize()
        resizeObserver = new ResizeObserver(() => { pushSize() })
        if (mountRef.current !== null) resizeObserver.observe(mountRef.current)
        openDisposable = term.onResize(({ cols, rows }) => {
          const live = hostRef.current
          if (live === undefined) return
          void resizeTerminal(host, sessionId, live, cols, rows).catch(() => {})
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
      resizeObserver?.disconnect()
      dataDisposable?.dispose()
      openDisposable?.dispose()
      termRef.current?.dispose()
      termRef.current = null
    }
  }, [host, remote, sessionId, tab.id, cwd])

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
      {cwd !== undefined && cwd !== ''
        ? <div className={css.cwd} data-testid="xmart-terminal-cwd">{cwd}</div>
        : null}
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
