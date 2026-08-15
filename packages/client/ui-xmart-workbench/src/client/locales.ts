/** `workbench` namespace dictionaries (column, tabs, settings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'workbench'

/** The workbench dictionary key set (the source of truth for both locales). */
export type WorkbenchKey =
  | 'column.title'
  | 'column.close'
  | 'column.empty'
  | 'toggle.open'
  | 'tab.demo'
  | 'tab.demo.body'
  | 'tab.file'
  | 'tab.file.body'
  | 'tab.explorer'
  | 'tab.editor'
  | 'tab.image'
  | 'tab.binary'
  | 'tab.close'
  | 'tab.add'
  | 'tab.placeholder'
  | 'tab.placeholder.body'
  | 'settings.nav'
  | 'settings.title'
  | 'settings.intro'
  | 'settings.tabs'
  | 'settings.viewers'
  | 'settings.empty.viewers'
  | 'settings.enable'
  | 'settings.disable'
  | 'viewer.code'
  | 'viewer.markdown'
  | 'viewer.image'
  | 'viewer.binary'
  | 'viewer.image.body'
  | 'viewer.binary.body'
  | 'explorer.noWorkspace'
  | 'explorer.refresh'
  | 'explorer.newFile'
  | 'explorer.newFolder'
  | 'explorer.fileName'
  | 'explorer.folderName'
  | 'explorer.create'
  | 'explorer.cancel'
  | 'explorer.loading'
  | 'explorer.empty'
  | 'explorer.error'
  | 'explorer.retry'
  | 'explorer.truncated'
  | 'explorer.copyRel'
  | 'explorer.copyAbs'
  | 'explorer.mention'
  | 'explorer.openSystem'
  | 'explorer.renameUnavailable'
  | 'explorer.deleteUnavailable'
  | 'editor.noPath'
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
  | 'editor.modeEdit'
  | 'editor.modePreview'
  | 'editor.modeSplit'
  | 'editor.reloadPrompt'
  | 'editor.reload'
  | 'editor.dismiss'
  | 'tab.git'
  | 'tab.diff'
  | 'tab.tasks'
  | 'tab.terminal'
  | 'git.noWorkspace'
  | 'git.loading'
  | 'git.missing'
  | 'git.error'
  | 'git.repo'
  | 'git.clean'
  | 'git.detached'
  | 'git.commit'
  | 'git.commitPlaceholder'
  | 'git.stage'
  | 'git.unstage'
  | 'git.discard'
  | 'git.diffWorktree'
  | 'git.diffStaged'
  | 'git.open'
  | 'diff.noPath'
  | 'diff.loading'
  | 'diff.error'
  | 'diff.empty'
  | 'tasks.jobs'
  | 'tasks.subagents'
  | 'tasks.turn'
  | 'tasks.turnRunning'
  | 'tasks.statusRunning'
  | 'tasks.noJobs'
  | 'tasks.noSubagents'
  | 'tasks.stop'
  | 'terminal.unavailable'
  | 'activity.explorer'
  | 'activity.git'
  | 'activity.tasks'
  | 'activity.terminal'
  | 'activity.settings'
  | 'sidebar.missing'
  | 'sidebar.crashed'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workbench column, tab chrome, and the Workbench settings page. */
    'workbench': WorkbenchKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<WorkbenchKey, string> = {
  'column.title': '工作台',
  'column.close': '关闭工作台',
  'column.empty': '从资源管理器打开文件后，会显示在这里。',
  'toggle.open': '打开工作台',
  'activity.explorer': '资源管理器',
  'activity.git': 'Git',
  'activity.tasks': '任务',
  'activity.terminal': '终端',
  'activity.settings': '设置',
  'tab.demo': '演示',
  'tab.demo.body': '演示标签仍可用。用左侧活动栏打开资源管理器，浏览工作区文件。',
  'tab.file': '文件',
  'tab.file.body': '这是旧版文件占位。新打开的文件会进入编辑器标签。',
  'tab.explorer': '资源管理器',
  'tab.editor': '编辑器',
  'tab.image': '图片',
  'tab.binary': '二进制',
  'tab.close': '关闭标签',
  'tab.add': '打开标签',
  'tab.placeholder': '未知标签类型',
  'tab.placeholder.body': '注册该类型的插件尚未加载。插件回来后，这个标签会恢复内容。',
  'settings.nav': '工作台',
  'settings.title': '工作台',
  'settings.intro': '关闭后，“+”菜单不再列出该类型，新的打开会被拒绝；已经打开的标签保留。',
  'settings.tabs': '标签类型',
  'settings.viewers': '文件预览',
  'settings.empty.viewers': '还没有注册文件预览器。',
  'settings.enable': '启用',
  'settings.disable': '禁用',
  'viewer.code': '代码',
  'viewer.markdown': 'Markdown',
  'viewer.image': '图片',
  'viewer.binary': '二进制下载',
  'viewer.image.body': '图片预览还需要主机字节通道，当前请用系统应用打开。',
  'viewer.binary.body': '这是二进制文件，编辑器不能打开。可用系统应用打开。',
  'explorer.noWorkspace': '当前会话没有工作区目录。',
  'explorer.refresh': '刷新',
  'explorer.newFile': '新建文件',
  'explorer.newFolder': '新建文件夹',
  'explorer.fileName': '文件名',
  'explorer.folderName': '文件夹名',
  'explorer.create': '创建',
  'explorer.cancel': '取消',
  'explorer.loading': '加载中…',
  'explorer.empty': '空目录',
  'explorer.error': '目录读取失败',
  'explorer.retry': '重试',
  'explorer.truncated': '目录项过多，已截断',
  'explorer.copyRel': '复制相对路径',
  'explorer.copyAbs': '复制绝对路径',
  'explorer.mention': '@ 到输入框',
  'explorer.openSystem': '用系统应用打开',
  'explorer.renameUnavailable': '重命名（待主机接口）',
  'explorer.deleteUnavailable': '删除（待主机接口）',
  'editor.noPath': '这个标签没有文件路径。',
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
  'editor.modeEdit': '编辑',
  'editor.modePreview': '预览',
  'editor.modeSplit': '分栏',
  'editor.reloadPrompt': 'Agent 改过这个文件。要重新加载吗？未保存的修改会丢失。',
  'editor.reload': '重新加载',
  'editor.dismiss': '忽略',
  'tab.git': 'Git',
  'tab.diff': '差异',
  'tab.tasks': '任务',
  'tab.terminal': '终端',
  'sidebar.missing': '这个面板还没挂上。',
  'sidebar.crashed': '这个面板渲染失败，请切换一次活动栏图标再试。',
  'git.noWorkspace': '当前会话没有工作区。请先在对话里选一个工作区，或用最右列添加。',
  'git.loading': '正在读取 Git 状态…',
  'git.missing': '当前打开的文件夹不是 Git 仓库。如果仓库在子目录里，把那个子目录加为工作区。本机也需要已安装 git。',
  'git.error': 'Git 状态读取失败。',
  'git.repo': '仓库',
  'git.clean': '工作区是干净的。',
  'git.detached': '分离 HEAD',
  'git.commit': '提交',
  'git.commitPlaceholder': '提交说明（Ctrl+Enter）',
  'git.stage': '暂存',
  'git.unstage': '取消暂存',
  'git.discard': '还原',
  'git.diffWorktree': '查看工作区差异',
  'git.diffStaged': '查看暂存差异',
  'git.open': '打开文件',
  'diff.noPath': '这个差异标签没有路径。',
  'diff.loading': '正在读取差异…',
  'diff.error': '差异读取失败。',
  'diff.empty': '这一侧没有差异。',
  'tasks.jobs': '后台任务',
  'tasks.subagents': '子代理',
  'tasks.turn': '当前回合',
  'tasks.turnRunning': '智能体正在工作',
  'tasks.statusRunning': '进行中',
  'tasks.noJobs': '这个会话现在没有正在执行的任务。',
  'tasks.noSubagents': '没有子代理。',
  'tasks.stop': '停止',
  'terminal.unavailable': '真终端需要主机 PTY 通道，默认桌面包还没挂 ctx.terminals。标签已预留。',
}

/** English dictionary (same keys as `zh`). */
export const en: Record<WorkbenchKey, string> = {
  'column.title': 'Workbench',
  'column.close': 'Close workbench',
  'column.empty': 'Files you open from Explorer land here.',
  'toggle.open': 'Open workbench',
  'activity.explorer': 'Explorer',
  'activity.git': 'Git',
  'activity.tasks': 'Tasks',
  'activity.terminal': 'Terminal',
  'activity.settings': 'Settings',
  'tab.demo': 'Demo',
  'tab.demo.body': 'The demo tab is still here. Open Explorer from the activity bar to browse the workspace.',
  'tab.file': 'File',
  'tab.file.body': 'This is a leftover file stub. Newly opened files land in an editor tab.',
  'tab.explorer': 'Explorer',
  'tab.editor': 'Editor',
  'tab.image': 'Image',
  'tab.binary': 'Binary',
  'tab.close': 'Close tab',
  'tab.add': 'Open tab',
  'tab.placeholder': 'Unknown tab type',
  'tab.placeholder.body': 'The plugin that owns this type is not loaded. The tab will show its contents again when that plugin returns.',
  'settings.nav': 'Workbench',
  'settings.title': 'Workbench',
  'settings.intro': 'Turning a type off hides it from the + menu and refuses new opens. Tabs that are already open stay.',
  'settings.tabs': 'Tab types',
  'settings.viewers': 'File viewers',
  'settings.empty.viewers': 'No file viewers are registered yet.',
  'settings.enable': 'Enable',
  'settings.disable': 'Disable',
  'viewer.code': 'Code',
  'viewer.markdown': 'Markdown',
  'viewer.image': 'Image',
  'viewer.binary': 'Binary download',
  'viewer.image.body': 'Image preview still needs a host bytes channel. Open the file in the system app for now.',
  'viewer.binary.body': 'This is a binary file. The editor cannot open it. Use the system app instead.',
  'explorer.noWorkspace': 'This session has no workspace directory.',
  'explorer.refresh': 'Refresh',
  'explorer.newFile': 'New file',
  'explorer.newFolder': 'New folder',
  'explorer.fileName': 'File name',
  'explorer.folderName': 'Folder name',
  'explorer.create': 'Create',
  'explorer.cancel': 'Cancel',
  'explorer.loading': 'Loading…',
  'explorer.empty': 'Empty folder',
  'explorer.error': 'Could not read this folder',
  'explorer.retry': 'Retry',
  'explorer.truncated': 'Too many entries; the list was truncated',
  'explorer.copyRel': 'Copy relative path',
  'explorer.copyAbs': 'Copy absolute path',
  'explorer.mention': '@ into composer',
  'explorer.openSystem': 'Open in system app',
  'explorer.renameUnavailable': 'Rename (needs host API)',
  'explorer.deleteUnavailable': 'Delete (needs host API)',
  'editor.noPath': 'This tab has no file path.',
  'editor.loading': 'Opening…',
  'editor.engineLoading': 'Loading the editor engine…',
  'editor.engineError': 'The editor engine failed to load. Rebuild the frontend and retry.',
  'editor.save': 'Save',
  'editor.saving': 'Saving…',
  'editor.saved': 'Saved',
  'editor.dirty': 'Unsaved',
  'editor.readError': 'Could not read this file',
  'editor.binary': 'Binary files cannot be opened in the editor',
  'editor.tooLarge': 'This file is too large to open in the editor',
  'editor.saveError': 'Save failed',
  'editor.modeEdit': 'Edit',
  'editor.modePreview': 'Preview',
  'editor.modeSplit': 'Split',
  'editor.reloadPrompt': 'The agent changed this file. Reload? Unsaved edits will be lost.',
  'editor.reload': 'Reload',
  'editor.dismiss': 'Dismiss',
  'tab.git': 'Git',
  'tab.diff': 'Diff',
  'tab.tasks': 'Tasks',
  'tab.terminal': 'Terminal',
  'sidebar.missing': 'This panel is not registered.',
  'sidebar.crashed': 'This panel crashed. Switch the activity-bar icon and try again.',
  'git.noWorkspace': 'This session has no workspace. Pick one in the conversation, or add one from the far-right rail.',
  'git.loading': 'Reading git status…',
  'git.missing': 'This folder is not a git repository. If the repo is in a subdirectory, add that folder as the workspace. Git must also be installed.',
  'git.error': 'Could not read git status.',
  'git.repo': 'Repository',
  'git.clean': 'The working tree is clean.',
  'git.detached': 'Detached HEAD',
  'git.commit': 'Commit',
  'git.commitPlaceholder': 'Commit message (Ctrl+Enter)',
  'git.stage': 'Stage',
  'git.unstage': 'Unstage',
  'git.discard': 'Discard',
  'git.diffWorktree': 'Diff worktree',
  'git.diffStaged': 'Diff staged',
  'git.open': 'Open file',
  'diff.noPath': 'This diff tab has no path.',
  'diff.loading': 'Reading the diff…',
  'diff.error': 'Could not read the diff.',
  'diff.empty': 'This side has no diff.',
  'tasks.jobs': 'Background jobs',
  'tasks.subagents': 'Subagents',
  'tasks.turn': 'Current turn',
  'tasks.turnRunning': 'Agent is working',
  'tasks.statusRunning': 'Running',
  'tasks.noJobs': 'This session has no running work.',
  'tasks.noSubagents': 'No subagents.',
  'tasks.stop': 'Stop',
  'terminal.unavailable': 'A real PTY needs a host terminal bridge. The default desktop bundle does not mount ctx.terminals yet. This tab is reserved.',
}
