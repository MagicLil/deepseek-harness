/**
 * Hidden image / binary tab bodies. Image bytes need a host RPC (later);
 * both offer "open in the system app" as the fallback.
 */
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './EditorTab.module.css'

/** Locale thunk. */
type Translate = (key: WorkbenchKey) => string

/** Media tab callbacks. */
export type MediaTabProps = TabBodyProps & {
  t: Translate
  openSystem: (path: string) => Promise<void>
}

/** Image placeholder (no host bytes RPC yet). */
export function ImageTab({ tab, t, openSystem }: MediaTabProps) {
  return <MediaBody kind="image" tab={tab} t={t} openSystem={openSystem} />
}

/** Binary placeholder (NUL / file-binary). */
export function BinaryTab({ tab, t, openSystem }: MediaTabProps) {
  return <MediaBody kind="binary" tab={tab} t={t} openSystem={openSystem} />
}

function MediaBody({
  kind, tab, t, openSystem,
}: {
  kind: 'image' | 'binary'
  tab: TabBodyProps['tab']
  t: Translate
  openSystem: (path: string) => Promise<void>
}) {
  const path = tab.path
  return (
    <div className={css.note} data-testid={kind === 'image' ? 'xmart-workbench-image' : 'xmart-workbench-binary'}>
      <p>{t(kind === 'image' ? 'viewer.image.body' : 'viewer.binary.body')}</p>
      {path !== undefined && <code>{path}</code>}
      {path !== undefined && (
        <p>
          <button type="button" className={css.tool} onClick={() => { void openSystem(path) }}>
            {t('explorer.openSystem')}
          </button>
        </p>
      )}
    </div>
  )
}
