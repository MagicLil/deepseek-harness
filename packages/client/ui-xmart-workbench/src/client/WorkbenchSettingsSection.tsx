/**
 * Settings → Workbench: one enable switch per registered tab type and
 * file viewer. Disabling hides the type from + and refuses new opens;
 * already-open tabs stay.
 */
import type { WorkbenchSettingsProps } from './contract.ts'
import type { WorkbenchRegistryRow } from './types.ts'
import css from './WorkbenchSettingsSection.module.css'

/** Workbench settings page (see module doc). */
export function WorkbenchSettingsSection({
  t, useWorkbenchRegistry, setTabEnabled, setViewerEnabled,
}: WorkbenchSettingsProps) {
  const registry = useWorkbenchRegistry(s => s)
  return (
    <div className={css.section} data-testid="xmart-workbench-settings">
      <h2 className={css.heading}>{t('settings.title')}</h2>
      <p className={css.intro}>{t('settings.intro')}</p>
      <section className={css.group}>
        <h3 className={css.groupHead}>{t('settings.tabs')}</h3>
        <ul className={css.list}>
          {registry.tabs.map(row => (
            <EnableRow
              key={row.id}
              row={row}
              t={t}
              onChange={(enabled) => { setTabEnabled(row.id, enabled) }}
            />
          ))}
        </ul>
      </section>
      <section className={css.group}>
        <h3 className={css.groupHead}>{t('settings.viewers')}</h3>
        {registry.viewers.length === 0
          ? <p className={css.empty}>{t('settings.empty.viewers')}</p>
          : (
            <ul className={css.list}>
              {registry.viewers.map(row => (
                <EnableRow
                  key={row.id}
                  row={row}
                  t={t}
                  onChange={(enabled) => { setViewerEnabled(row.id, enabled) }}
                />
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}

function EnableRow({
  row, t, onChange,
}: {
  row: WorkbenchRegistryRow
  t: WorkbenchSettingsProps['t']
  onChange: (enabled: boolean) => void
}) {
  return (
    <li className={css.row}>
      <div className={css.rowText}>
        <div className={css.rowTitle}>{row.title}</div>
        <div className={css.rowId}>{row.id}</div>
      </div>
      <button
        type="button"
        role="switch"
        className={css.switch}
        aria-checked={row.enabled}
        aria-label={row.enabled ? t('settings.disable') : t('settings.enable')}
        data-testid={`xmart-workbench-enable-${row.id}`}
        onClick={() => { onChange(!row.enabled) }}
      />
    </li>
  )
}
