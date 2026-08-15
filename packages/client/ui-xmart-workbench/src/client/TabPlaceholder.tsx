/**
 * Placeholder shown when an open tab's type is not in the registry
 * (plugin unloaded, or a persisted type from a later session).
 */
import type { WorkbenchKey } from './locales.ts'
import css from './WorkbenchColumn.module.css'

/**
 * Unregistered-type card.
 * @param props.type - persisted tab type id.
 * @param props.t - workbench dictionary.
 */
export function TabPlaceholder({ type, t }: { type: string; t: (key: WorkbenchKey) => string }) {
  return (
    <div data-testid="xmart-workbench-placeholder">
      <div className={css.placeholderTitle}>{t('tab.placeholder')}</div>
      <p className={css.placeholderBody}>{t('tab.placeholder.body')}</p>
      <code className={css.placeholderType}>{type}</code>
    </div>
  )
}
