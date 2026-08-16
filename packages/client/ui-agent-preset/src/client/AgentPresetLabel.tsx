/**
 * The session header's agent-preset picker.
 *
 * A pick here recomposes THIS session only. The deployment default lives on
 * the General-settings row and the management section; those writes also
 * recompose every listed root session.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconAgentPresetOutline16, IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the header actions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { AgentPresetSettingsState } from './settings-store.ts'
import { presetDisplayText } from './locales.ts'
import css from './AgentPresetLabel.module.css'

/** Registration-side business face for the header picker. */
export interface AgentPresetLabelInjected {
  hooks: {
    /** Roster snapshot bound by the renderer as useAgentPresets. */
    agentPresets: SnapshotStore<AgentPresetSettingsState>
  }
  /** Read the roster, so the picker can show a name rather than an id. */
  load: () => Promise<void>
  /**
   * Recompose this session onto one preset.
   * @param sessionId - the session whose header this picker sits in.
   * @param id - the preset to run.
   * @returns the failure message, or undefined once the host confirmed.
   */
  select: (sessionId: string, id: string) => Promise<string | undefined>
}

/** Full component props. */
export type AgentPresetLabelProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'settings.agentPreset'>
  & InjectFace<AgentPresetLabelInjected>

/**
 * Render this session's agent-preset picker beside its title.
 * @param props - composed slot props.
 * @returns the picker, or null when the session records no preset.
 */
export function AgentPresetLabel({
  sessionId, useSessions, useAgentPresets, load, select, t,
}: AgentPresetLabelProps) {
  const preset = useSessions(state => state.byId[sessionId]?.agentPreset)
  const options = useAgentPresets(state => state.options)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Deployments that compose no presets never label anything, so the roster
    // is only worth a request once a session reports one.
    if (preset !== undefined) void load()
  }, [preset, load])

  if (preset === undefined) return null

  const option = options.find(entry => entry.id === preset)
  const text = option === undefined ? undefined : presetDisplayText(option, t)
  const label = text?.name ?? preset
  const ready = options.length > 0

  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={options.map((entry) => {
        const item = presetDisplayText(entry, t)
        return {
          id: entry.id,
          label: (
            <span className={css.item}>
              <span className={css.itemName}>{item.name}</span>
              <span className={css.itemDesc}>{item.description ?? t('noDescription')}</span>
            </span>
          ),
        }
      })}
      selectedId={preset}
      onSelect={(id) => {
        setOpen(false)
        if (id === preset) return
        setBusy(true)
        setError(null)
        void select(sessionId, id).then((failure) => {
          setBusy(false)
          if (failure !== undefined) setError(failure)
        })
      }}
      align="start"
      portal
      anchor={(
        <button
          type="button"
          className={css.label}
          aria-haspopup="menu"
          aria-expanded={open}
          title={error ?? text?.description ?? t('headerHint')}
          disabled={busy || !ready}
          onClick={() => { setOpen(value => !value) }}
        >
          <IconAgentPresetOutline16 size={14} className={css.icon} />
          {label}
          <IconChevronDownOutline14 className={css.chevron} />
        </button>
      )}
    />
  )
}
