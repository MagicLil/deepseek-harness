/** `workbench` namespace dictionaries (column title, empty state, toggle). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'workbench'

/** The workbench dictionary key set (the source of truth for both locales). */
export type WorkbenchKey =
  | 'column.title'
  | 'column.close'
  | 'column.empty'
  | 'toggle.open'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workbench column title, empty-state copy, and reopen control. */
    'workbench': WorkbenchKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<WorkbenchKey, string> = {
  'column.title': '工作台',
  'column.close': '关闭工作台',
  'column.empty': '工作台即将提供文件、编辑、Git 与终端。',
  'toggle.open': '打开工作台',
}

/** English dictionary (same keys as `zh`). */
export const en: Record<WorkbenchKey, string> = {
  'column.title': 'Workbench',
  'column.close': 'Close workbench',
  'column.empty': 'The workbench will host files, editing, Git, and the terminal.',
  'toggle.open': 'Open workbench',
}
