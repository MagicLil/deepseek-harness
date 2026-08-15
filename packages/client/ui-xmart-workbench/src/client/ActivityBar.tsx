/**
 * Far-left activity bar: registered activities switch the primary sidebar;
 * clicking the active icon again collapses it. Terminal toggles the bottom
 * panel. Settings clicks the existing `sidebar.settings` trigger.
 * Components never see ctx.
 */
import {
  IconBranchOutline16, IconChecklistOutline14, IconCodeOutline16, IconFolderOpenOutline16,
  IconSettingsOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ActivityBarProps, ActivityIcon } from './contract.ts'
import { PRIMARY_ACTIVITIES } from './types.ts'
import css from './ActivityBar.module.css'

const FALLBACK_ICONS: Record<string, ActivityIcon> = {
  explorer: IconFolderOpenOutline16,
  git: IconBranchOutline16,
  tasks: IconChecklistOutline14,
}

const FALLBACK_LABEL = {
  explorer: 'activity.explorer',
  git: 'activity.git',
  tasks: 'activity.tasks',
} as const satisfies Record<(typeof PRIMARY_ACTIVITIES)[number], 'activity.explorer' | 'activity.git' | 'activity.tasks'>

/** Activity-bar icon rail (see module doc). */
export function ActivityBar({
  primaryOpen,
  bottomOpen,
  setActivity,
  resolveIcon,
  openPrimary,
  closePrimary,
  toggleBottom,
  openSettings,
  useWorkbenchSession,
  useWorkbenchRegistry,
  t,
}: ActivityBarProps) {
  const activity = useWorkbenchSession(s => s.activity)
  const registered = useWorkbenchRegistry(s => s.activities)
  const rows = registered.length > 0
    ? registered
    : PRIMARY_ACTIVITIES.map(id => ({ id, title: t(FALLBACK_LABEL[id]), enabled: true }))

  return (
    <div className={css.root} data-testid="xmart-activity-bar">
      <div className={css.group}>
        {rows.map((row) => {
          const Icon = resolveIcon(row.id) ?? FALLBACK_ICONS[row.id]
          if (Icon === undefined) return null
          const pressed = primaryOpen && activity === row.id
          return (
            <button
              key={row.id}
              type="button"
              className={css.icon}
              aria-label={row.title}
              aria-pressed={pressed}
              data-testid={`xmart-activity-${row.id}`}
              onClick={() => {
                if (pressed) {
                  closePrimary()
                  return
                }
                setActivity(row.id)
                openPrimary()
              }}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>
      <div className={css.group}>
        <button
          type="button"
          className={css.icon}
          aria-label={t('activity.terminal')}
          aria-pressed={bottomOpen}
          data-testid="xmart-activity-terminal"
          onClick={() => { toggleBottom() }}
        >
          <IconCodeOutline16 />
        </button>
        <button
          type="button"
          className={css.icon}
          aria-label={t('activity.settings')}
          data-testid="xmart-activity-settings"
          onClick={() => { openSettings() }}
        >
          <IconSettingsOutline16 />
        </button>
      </div>
    </div>
  )
}
