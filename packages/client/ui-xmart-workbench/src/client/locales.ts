/** `workbench` namespace dictionaries (column, tabs, settings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'workbench'

/** The workbench dictionary key set (the source of truth for both locales). */
export type WorkbenchKey =
  | 'column.title'
  | 'column.close'
  | 'column.empty'
  | 'column.crashed'
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
  | 'git.branch'
  | 'git.sync'
  | 'git.syncing'
  | 'git.newBranch'
  | 'git.createBranch'
  | 'git.badBranch'
  | 'git.clean'
  | 'git.detached'
  | 'git.commit'
  | 'git.commitPlaceholder'
  | 'git.generate'
  | 'git.generating'
  | 'git.checkoutCommit'
  | 'git.openCommit'
  | 'git.stage'
  | 'git.unstage'
  | 'git.stageAll'
  | 'git.unstageAll'
  | 'git.discardAll'
  | 'git.staged'
  | 'git.changes'
  | 'git.history'
  | 'git.graph'
  | 'git.discard'
  | 'git.diffWorktree'
  | 'git.diffStaged'
  | 'git.open'
  | 'diff.noPath'
  | 'diff.loading'
  | 'diff.error'
  | 'diff.empty'
  | 'diff.files'
  | 'tasks.jobs'
  | 'tasks.subagents'
  | 'tasks.turn'
  | 'tasks.turnRunning'
  | 'tasks.statusRunning'
  | 'tasks.noJobs'
  | 'tasks.noSubagents'
  | 'tasks.stop'
  | 'terminal.unavailable'
  | 'terminal.empty'
  | 'terminal.prompt'
  | 'terminal.busy'
  | 'terminal.exited'
  | 'terminal.starting'
  | 'terminal.crash'
  | 'menu.file'
  | 'menu.file.newSession'
  | 'menu.file.openWorkspace'
  | 'menu.file.save'
  | 'menu.file.closeEditor'
  | 'menu.file.settings'
  | 'menu.edit'
  | 'menu.edit.undo'
  | 'menu.edit.redo'
  | 'menu.edit.cut'
  | 'menu.edit.copy'
  | 'menu.edit.paste'
  | 'menu.edit.selectAll'
  | 'menu.view'
  | 'menu.view.primary'
  | 'menu.view.sessions'
  | 'menu.terminal'
  | 'menu.terminal.new'
  | 'menu.terminal.toggle'
  | 'menu.help'
  | 'menu.help.about'
  | 'menu.help.aboutTitle'
  | 'menu.help.aboutDetail'
  | 'activity.explorer'
  | 'activity.git'
  | 'activity.tasks'
  | 'activity.terminal'
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
  'column.crashed': '这个文件打不开。关掉标签再点一次，或换一个文件。',
  'toggle.open': '打开工作台',
  'activity.explorer': '资源管理器',
  'activity.git': '源代码管理',
  'activity.tasks': '任务',
  'activity.terminal': '终端',
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
  'explorer.noWorkspace': '还没有可显示的工作区目录。请在最右列添加工作区。',
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
  'git.branch': '分支',
  'git.sync': '同步',
  'git.syncing': '同步中',
  'git.newBranch': '新分支名',
  'git.createBranch': '创建分支',
  'git.badBranch': '分支名不合法。',
  'git.clean': '工作区是干净的。',
  'git.detached': '分离 HEAD',
  'git.commit': '提交',
  'git.commitPlaceholder': '提交说明（Ctrl+Enter）',
  'git.generate': '生成提交说明',
  'git.generating': '正在生成…',
  'git.checkoutCommit': '检出此提交',
  'git.openCommit': '查看此提交',
  'git.stage': '暂存',
  'git.unstage': '取消暂存',
  'git.stageAll': '全部暂存',
  'git.unstageAll': '全部取消暂存',
  'git.discardAll': '全部还原',
  'git.staged': '暂存的更改',
  'git.changes': '更改',
  'git.history': '历史',
  'git.graph': '图表',
  'git.discard': '还原',
  'git.diffWorktree': '查看工作区差异',
  'git.diffStaged': '查看暂存差异',
  'git.open': '打开文件',
  'diff.noPath': '这个差异标签没有路径。',
  'diff.loading': '正在读取差异…',
  'diff.error': '差异读取失败。',
  'diff.empty': '这一侧没有差异。',
  'diff.files': '文件',
  'tasks.jobs': '后台任务',
  'tasks.subagents': '子代理',
  'tasks.turn': '当前回合',
  'tasks.turnRunning': '智能体正在工作',
  'tasks.statusRunning': '进行中',
  'tasks.noJobs': '这个会话现在没有正在执行的任务。',
  'tasks.noSubagents': '没有子代理。',
  'tasks.stop': '停止',
  'terminal.unavailable': '这个环境还没有挂上主机终端通道，所以这里不能开壳。',
  'terminal.empty': '用菜单「终端 → 新建终端」开一个壳。',
  'terminal.prompt': '输入命令，回车发送。Ctrl+C 中断。',
  'terminal.busy': '正在等待命令结束…',
  'terminal.exited': '壳已退出。',
  'terminal.starting': '正在启动终端…',
  'terminal.crash': '终端面板出错',
  'menu.file': '文件',
  'menu.file.newSession': '新会话',
  'menu.file.openWorkspace': '打开工作区…',
  'menu.file.save': '保存',
  'menu.file.closeEditor': '关闭编辑器',
  'menu.file.settings': '设置',
  'menu.edit': '编辑',
  'menu.edit.undo': '撤销',
  'menu.edit.redo': '重做',
  'menu.edit.cut': '剪切',
  'menu.edit.copy': '复制',
  'menu.edit.paste': '粘贴',
  'menu.edit.selectAll': '全选',
  'menu.view': '视图',
  'menu.view.primary': '切换左侧边栏',
  'menu.view.sessions': '切换会话列表',
  'menu.terminal': '终端',
  'menu.terminal.new': '新建终端',
  'menu.terminal.toggle': '切换终端',
  'menu.help': '帮助',
  'menu.help.about': '关于万物智汇',
  'menu.help.aboutTitle': '万物智汇',
  'menu.help.aboutDetail': '桌面 / Web AI Agent 工作台。',
}

/** English dictionary (same keys as `zh`). */
export const en: Record<WorkbenchKey, string> = {
  'column.title': 'Workbench',
  'column.close': 'Close workbench',
  'column.empty': 'Files you open from Explorer land here.',
  'column.crashed': 'This file failed to render. Close the tab and open it again.',
  'toggle.open': 'Open workbench',
  'activity.explorer': 'Explorer',
  'activity.git': 'Source Control',
  'activity.tasks': 'Tasks',
  'activity.terminal': 'Terminal',
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
  'explorer.noWorkspace': 'No workspace folders to show. Add one from the far-right rail.',
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
  'git.branch': 'Branch',
  'git.sync': 'Sync',
  'git.syncing': 'Syncing',
  'git.newBranch': 'New branch name',
  'git.createBranch': 'Create branch',
  'git.badBranch': 'That branch name is not allowed.',
  'git.clean': 'The working tree is clean.',
  'git.detached': 'Detached HEAD',
  'git.commit': 'Commit',
  'git.commitPlaceholder': 'Commit message (Ctrl+Enter)',
  'git.generate': 'Generate commit message',
  'git.generating': 'Generating…',
  'git.checkoutCommit': 'Check out this commit',
  'git.openCommit': 'Open this commit',
  'git.stage': 'Stage',
  'git.unstage': 'Unstage',
  'git.stageAll': 'Stage All',
  'git.unstageAll': 'Unstage All',
  'git.discardAll': 'Discard All',
  'git.staged': 'Staged Changes',
  'git.changes': 'Changes',
  'git.history': 'History',
  'git.graph': 'Graph',
  'git.discard': 'Discard',
  'git.diffWorktree': 'Diff worktree',
  'git.diffStaged': 'Diff staged',
  'git.open': 'Open file',
  'diff.noPath': 'This diff tab has no path.',
  'diff.loading': 'Reading the diff…',
  'diff.error': 'Could not read the diff.',
  'diff.empty': 'This side has no diff.',
  'diff.files': 'files',
  'tasks.jobs': 'Background jobs',
  'tasks.subagents': 'Subagents',
  'tasks.turn': 'Current turn',
  'tasks.turnRunning': 'Agent is working',
  'tasks.statusRunning': 'Running',
  'tasks.noJobs': 'This session has no running work.',
  'tasks.noSubagents': 'No subagents.',
  'tasks.stop': 'Stop',
  'terminal.unavailable': 'This surface has no host terminal bridge, so a shell cannot start here.',
  'terminal.empty': 'Use Terminal → New Terminal from the menu to open a shell.',
  'terminal.prompt': 'Type a command and press Enter. Ctrl+C interrupts.',
  'terminal.busy': 'Waiting for the command to finish…',
  'terminal.exited': 'The shell exited.',
  'terminal.starting': 'Starting terminal…',
  'terminal.crash': 'Terminal panel crashed',
  'menu.file': 'File',
  'menu.file.newSession': 'New Session',
  'menu.file.openWorkspace': 'Open Workspace…',
  'menu.file.save': 'Save',
  'menu.file.closeEditor': 'Close Editor',
  'menu.file.settings': 'Settings',
  'menu.edit': 'Edit',
  'menu.edit.undo': 'Undo',
  'menu.edit.redo': 'Redo',
  'menu.edit.cut': 'Cut',
  'menu.edit.copy': 'Copy',
  'menu.edit.paste': 'Paste',
  'menu.edit.selectAll': 'Select All',
  'menu.view': 'View',
  'menu.view.primary': 'Toggle Primary Sidebar',
  'menu.view.sessions': 'Toggle Session List',
  'menu.terminal': 'Terminal',
  'menu.terminal.new': 'New Terminal',
  'menu.terminal.toggle': 'Toggle Terminal',
  'menu.help': 'Help',
  'menu.help.about': 'About Xmart',
  'menu.help.aboutTitle': 'Xmart',
  'menu.help.aboutDetail': 'Desktop / web AI agent workbench.',
}
