/** Codex profile frame for concise, execution-oriented Tool timelines. */
import type { ReactNode } from 'react'
import css from './CodexToolTimeline.module.css'

/** Wrap logged Tool calls in the Codex profile's compact visual rhythm. */
export function CodexToolTimeline({ children }: { children: ReactNode }) {
  return <div className={css.root} data-codex-tool-timeline>{children}</div>
}
