/**
 * Consumer-facing PTY output event. The terminal kernel has no UI output
 * event; this declaration lives here so `API_REMOTE_FORWARDED_EVENTS` can
 * name a real cordis `Events` key without patching `@deepseek-ai/dsh-terminal`.
 */

/** One forwarded output frame (JSON-safe). */
export interface TerminalOutputPayload {
  /** Session whose agent owns the PTY. */
  sessionId: string
  /** Host-minted PTY id. */
  ptyId: string
  /** Output produced since the previous frame. */
  delta: string
  /** Whether unread output was dropped by a bound. */
  truncated: boolean
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Incremental PTY output for one UI seat. Forwarded verbatim to
     * `ctx.remote.$on('terminals/output')`.
     */
    'terminals/output'(payload: TerminalOutputPayload): void
  }
}
