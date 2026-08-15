/**
 * Built-in Phase 1 tab bodies: the demo tab (visible in +) and the hidden
 * file stub used by `openFile`.
 */
import type { TabBodyProps } from './types.ts'
import type { WorkbenchKey } from './locales.ts'

/** Locale thunk passed through from the column (workbench dictionary). */
type Translate = (key: WorkbenchKey) => string

/** Demo tab body. */
export function DemoTab({ t }: TabBodyProps & { t: Translate }) {
  return <div data-testid="xmart-workbench-demo" style={{ padding: '12px 16px' }}>{t('tab.demo.body')}</div>
}

/** Hidden file-stub body: remembers the path until a later phase opens it. */
export function FileStubTab({ tab, t }: TabBodyProps & { t: Translate }) {
  return (
    <div data-testid="xmart-workbench-file-stub">
      <p>{t('tab.file.body')}</p>
      {tab.path !== undefined && <code>{tab.path}</code>}
    </div>
  )
}
