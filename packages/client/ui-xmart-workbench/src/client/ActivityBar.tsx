/**
 * Far-left activity bar: registered activities switch the primary sidebar;
 * clicking the active icon again collapses it. The Terminal menu lives on
 * the top bar. Components never see ctx.
 */
import {
  IconBranchOutline16, IconFolderOpenOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ActivityBarProps, ActivityIcon } from './contract.ts'
import { gitBadgeLabel, gitBadgeTotal } from './git-badge.ts'
import { PRIMARY_ACTIVITIES } from './types.ts'
import css from './ActivityBar.module.css'

const FALLBACK_ICONS: Record<string, ActivityIcon> = {
  explorer: IconFolderOpenOutline16,
  git: IconBranchOutline16,
}

const FALLBACK_LABEL = {
  explorer: 'activity.explorer',
  git: 'activity.git',
} as const satisfies Record<(typeof PRIMARY_ACTIVITIES)[number], 'activity.explorer' | 'activity.git'>

/** Activity-bar icon rail (see module doc). */
export function ActivityBar({
  primaryOpen,
  setActivity,
  resolveIcon,
  openPrimary,
  closePrimary,
  useWorkbenchSession,
  useWorkbenchRegistry,
  useGitBadge,
  t,
}: ActivityBarProps) {
  const activity = useWorkbenchSession(s => s.activity)
  const registered = useWorkbenchRegistry(s => s.activities)
  const gitLabel = gitBadgeLabel(gitBadgeTotal(useGitBadge(s => s)))
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
              <span className={css.glyph}><Icon size={18} /></span>
              {row.id === 'git' && gitLabel !== undefined
                ? (
                  <span className={css.badge} data-testid="xmart-activity-git-badge">
                    {gitLabel}
                  </span>
                )
                : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
