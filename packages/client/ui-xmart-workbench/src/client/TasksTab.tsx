/**
 * Tasks tab: the live agent turn, session jobs, and subagent catalog
 * (no ui-jobs / ui-subagent imports).
 */
import { useEffect, useState } from 'react'
import type { JobView } from '@deepseek-ai/dsh-client-runtime/client'
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './ExplorerTab.module.css'

type Translate = (key: WorkbenchKey) => string

export type TaskJob = Pick<JobView, 'id' | 'kind' | 'label' | 'status' | 'detail'>
export type TaskSubagent = { id: string; label?: string; activity: 'running' | 'inactive' }
export type TaskCall = { id: string; name: string }
export type TaskTurn = { running: boolean; calls: readonly TaskCall[] }

/**
 * Merge the list-row running bit with the live session snapshot.
 * @param listRunning - `SessionSummary.running` for this session.
 * @param snap - bound session snapshot, when the conversation is open.
 */
export function readTaskTurn(
  listRunning: boolean | undefined,
  snap: { running?: boolean; runningCalls?: readonly { callId: string; name: string }[] } | undefined,
): TaskTurn {
  const running = snap?.running === true || listRunning === true
  if (!running) return { running: false, calls: [] }
  const calls = (snap?.runningCalls ?? []).map(call => ({ id: call.callId, name: call.name }))
  return { running: true, calls }
}

export type TasksTabProps = TabBodyProps & {
  t: Translate
  watchSessions: (fn: () => void) => () => void
  listTurn: (sessionId: string) => TaskTurn
  listJobs: (sessionId: string) => readonly TaskJob[]
  listSubagents: (sessionId: string) => readonly TaskSubagent[]
  cancelTurn: () => void
  cancelSubagent: (id: string) => void
  openSubagent: (id: string) => void
}

/** Live turn + jobs + subagent tree. */
export function TasksTab({
  sessionId, t, watchSessions, listTurn, listJobs, listSubagents,
  cancelTurn, cancelSubagent, openSubagent,
}: TasksTabProps) {
  const [turn, setTurn] = useState(() => listTurn(sessionId))
  const [jobs, setJobs] = useState(() => listJobs(sessionId))
  const [subs, setSubs] = useState(() => listSubagents(sessionId))
  useEffect(() => watchSessions(() => {
    setTurn(listTurn(sessionId))
    setJobs(listJobs(sessionId))
    setSubs(listSubagents(sessionId))
  }), [listTurn, listJobs, listSubagents, sessionId, watchSessions])

  const idle = !turn.running && jobs.length === 0
  return (
    <div className={css.root} data-testid="xmart-workbench-tasks">
      {turn.running && (
        <>
          <div className={css.section}>{t('tasks.turn')}</div>
          <div className={css.row} data-testid="xmart-workbench-turn">
            <span>{t('tasks.turnRunning')} · {t('tasks.statusRunning')}</span>
            <button type="button" className={css.tool} onClick={() => { cancelTurn() }}>
              {t('tasks.stop')}
            </button>
          </div>
          {turn.calls.map(call => (
            <div key={call.id} className={css.row} data-testid={`xmart-workbench-call-${call.id}`}>
              {call.name}
            </div>
          ))}
        </>
      )}
      {jobs.length > 0 && (
        <>
          <div className={css.section}>{t('tasks.jobs')}</div>
          {jobs.map(job => (
            <div key={job.id} className={css.row}>
              {job.label} · {job.status}{job.detail === undefined ? '' : ` · ${job.detail}`}
            </div>
          ))}
        </>
      )}
      {idle && <div className={css.note}>{t('tasks.noJobs')}</div>}
      <div className={css.section}>{t('tasks.subagents')}</div>
      {subs.length === 0
        ? <div className={css.note}>{t('tasks.noSubagents')}</div>
        : subs.map(row => (
          <div key={row.id} className={css.row}>
            <button type="button" className={css.tool} onClick={() => { openSubagent(row.id) }}>
              {row.label ?? row.id} · {row.activity}
            </button>
            {row.activity === 'running' && (
              <button type="button" className={css.tool} onClick={() => { cancelSubagent(row.id) }}>
                {t('tasks.stop')}
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
