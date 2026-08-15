/** `editor` namespace dictionaries (view tab label + editor surface strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'editor'

/** The editor dictionary key set (the source of truth for both locales). */
export type EditorKey =
  | 'view.editor'
  | 'tree.title'
  | 'tree.refresh'
  | 'tree.loading'
  | 'tree.empty'
  | 'tree.error'
  | 'tree.retry'
  | 'tree.truncated'
  | 'editor.empty'
  | 'editor.loading'
  | 'editor.engineLoading'
  | 'editor.engineError'
  | 'editor.save'
  | 'editor.saving'
  | 'editor.saved'
  | 'editor.dirty'
  | 'editor.readError'
  | 'editor.binary'
  | 'editor.tooLarge'
  | 'editor.saveError'
  | 'editor.noWorkspace'
  | 'editor.retry'
  | 'preview.edit'
  | 'preview.preview'
  | 'preview.split'
  | 'git.title'
  | 'git.loading'
  | 'git.empty'
  | 'git.missing'
  | 'git.error'
  | 'git.detached'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The editor view tab label and editor surface strings. */
    'editor': EditorKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<EditorKey, string> = {
  'view.editor': '编辑器',
  'tree.title': '文件',
  'tree.refresh': '刷新',
  'tree.loading': '加载中…',
  'tree.empty': '空目录',
  'tree.error': '目录读取失败',
  'tree.retry': '重试',
  'tree.truncated': '目录项过多，已截断',
  'editor.empty': '从左侧选择一个文件开始编辑',
  'editor.loading': '正在打开…',
  'editor.engineLoading': '正在加载编辑器内核…',
  'editor.engineError': '编辑器内核加载失败，请重新构建前端后重试',
  'editor.save': '保存',
  'editor.saving': '保存中…',
  'editor.saved': '已保存',
  'editor.dirty': '未保存',
  'editor.readError': '文件读取失败',
  'editor.binary': '二进制文件不支持在编辑器中打开',
  'editor.tooLarge': '文件过大，无法在编辑器中打开',
  'editor.saveError': '保存失败',
  'editor.noWorkspace': '当前会话没有工作区目录',
  'editor.retry': '重试',
  'preview.edit': '编辑',
  'preview.preview': '预览',
  'preview.split': '分栏',
  'git.title': 'Git',
  'git.loading': '正在读取 Git 状态…',
  'git.empty': '工作区是干净的',
  'git.missing': '当前目录不是 Git 仓库',
  'git.error': 'Git 状态读取失败',
  'git.detached': '分离 HEAD',
}

/** English dictionary. */
export const en: Record<EditorKey, string> = {
  'view.editor': 'Editor',
  'tree.title': 'Files',
  'tree.refresh': 'Refresh',
  'tree.loading': 'Loading…',
  'tree.empty': 'Empty directory',
  'tree.error': 'Failed to list directory',
  'tree.retry': 'Retry',
  'tree.truncated': 'Listing truncated',
  'editor.empty': 'Select a file on the left to start editing',
  'editor.loading': 'Opening…',
  'editor.engineLoading': 'Loading the editor engine…',
  'editor.engineError': 'Failed to load the editor engine; rebuild the frontend and retry',
  'editor.save': 'Save',
  'editor.saving': 'Saving…',
  'editor.saved': 'Saved',
  'editor.dirty': 'Unsaved changes',
  'editor.readError': 'Failed to read file',
  'editor.binary': 'Binary files cannot be opened in the editor',
  'editor.tooLarge': 'File is too large to open in the editor',
  'editor.saveError': 'Save failed',
  'editor.noWorkspace': 'This session has no workspace directory',
  'editor.retry': 'Retry',
  'preview.edit': 'Edit',
  'preview.preview': 'Preview',
  'preview.split': 'Split',
  'git.title': 'Git',
  'git.loading': 'Reading git status…',
  'git.empty': 'Working tree clean',
  'git.missing': 'Not a git repository',
  'git.error': 'Failed to read git status',
  'git.detached': 'Detached HEAD',
}
