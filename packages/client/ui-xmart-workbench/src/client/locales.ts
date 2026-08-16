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
  | 'editor.noSource'
  | 'editor.lspStarting'
  | 'editor.lspFailed'
  | 'editor.lspOff'
  | 'editor.lspUnsupported'
  | 'editor.lspNoWorkspace'
  | 'editor.lspNoRemote'
  | 'quickOpen.placeholder'
  | 'quickOpen.empty'
  | 'quickOpen.noWorkspace'
  | 'search.placeholder'
  | 'search.caseSensitive'
  | 'search.wholeWord'
  | 'search.regex'
  | 'search.filters'
  | 'search.include'
  | 'search.exclude'
  | 'search.noWorkspace'
  | 'search.searching'
  | 'search.empty'
  | 'search.error'
  | 'search.badPattern'
  | 'search.summary'
  | 'search.truncated'
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
  | 'tab.terminal'
  | 'tab.problems'
  | 'tab.checks'
  | 'git.noWorkspace'
  | 'git.loading'
  | 'git.missing'
  | 'git.error'
  | 'git.repo'
  | 'git.branch'
  | 'git.localBranches'
  | 'git.remoteBranches'
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
  | 'git.hoverNow'
  | 'git.hoverMinutes'
  | 'git.hoverHours'
  | 'git.hoverDays'
  | 'git.hoverMonths'
  | 'git.hoverYears'
  | 'git.copyHash'
  | 'git.copied'
  | 'git.openOnGitHub'
  | 'git.openOnGitLab'
  | 'git.openOnGitee'
  | 'git.openOnRemote'
  | 'git.stage'
  | 'git.unstage'
  | 'git.stageAll'
  | 'git.unstageAll'
  | 'git.discardAll'
  | 'git.staged'
  | 'git.changes'
  | 'git.history'
  | 'git.graph'
  | 'git.loadingMore'
  | 'git.discard'
  | 'git.diffWorktree'
  | 'git.diffStaged'
  | 'git.open'
  | 'diff.noPath'
  | 'diff.loading'
  | 'diff.error'
  | 'diff.empty'
  | 'diff.files'
  | 'terminal.unavailable'
  | 'terminal.empty'
  | 'terminal.prompt'
  | 'terminal.busy'
  | 'terminal.exited'
  | 'terminal.starting'
  | 'terminal.crash'
  | 'problems.count'
  | 'problems.empty'
  | 'problems.filterPlaceholder'
  | 'problems.collapseAll'
  | 'problems.lineCol'
  | 'problems.groupBy'
  | 'problems.group.file'
  | 'problems.group.source'
  | 'problems.group.severity'
  | 'checks.runRelated'
  | 'checks.runAll'
  | 'checks.stop'
  | 'checks.autoRerun'
  | 'checks.noWorkspace'
  | 'checks.none'
  | 'checks.logEmpty'
  | 'checks.packageRoot'
  | 'checks.blurb'
  | 'checks.openProblems'
  | 'checks.status.idle'
  | 'checks.status.running'
  | 'checks.status.passed'
  | 'checks.status.failed'
  | 'checks.status.skipped'
  | 'checks.status.stopped'
  | 'checks.askAgent'
  | 'precommit.summary'
  | 'precommit.gates'
  | 'precommit.runRecommended'
  | 'precommit.runGate'
  | 'precommit.remoteMissing'
  | 'precommit.confirm'
  | 'precommit.noPush'
  | 'precommit.moreFiles'
  | 'precommit.notNeeded'
  | 'precommit.needStaged'
  | 'precommit.needMessage'
  | 'precommit.needGates'
  | 'precommit.needFix'
  | 'precommit.needConfirm'
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
  | 'menu.edit.find'
  | 'menu.edit.replace'
  | 'menu.edit.searchFiles'
  | 'menu.go'
  | 'menu.go.file'
  | 'menu.go.line'
  | 'menu.go.definition'
  | 'menu.go.implementation'
  | 'menu.go.references'
  | 'menu.go.hover'
  | 'menu.view'
  | 'menu.view.primary'
  | 'menu.view.sessions'
  | 'menu.view.conversation'
  | 'menu.view.problems'
  | 'menu.view.checks'
  | 'menu.terminal'
  | 'menu.terminal.new'
  | 'menu.terminal.toggle'
  | 'menu.help'
  | 'menu.help.about'
  | 'menu.help.aboutTitle'
  | 'menu.help.aboutDetail'
  | 'activity.explorer'
  | 'activity.search'
  | 'activity.git'
  | 'activity.terminal'
  | 'sidebar.missing'
  | 'sidebar.crashed'
  | 'review.files'
  | 'review.undoAll'
  | 'review.keepAll'
  | 'review.review'
  | 'review.keep'
  | 'review.undo'
  | 'review.before'
  | 'review.after'
  | 'review.shellWarn'
  | 'review.shellDismiss'
  | 'review.shellTitle'
  | 'review.dirty'
  | 'review.conflict'
  | 'review.conflictForce'
  | 'review.skipped'
  | 'review.notPending'
  | 'review.notFound'
  | 'review.ioError'
  | 'review.status.irreversible'
  | 'review.empty'

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
  'activity.search': '搜索',
  'activity.git': '源代码管理',
  'activity.terminal': '终端',
  'review.files': '{n} 个文件',
  'review.undoAll': '全部撤销',
  'review.keepAll': '全部保留',
  'review.review': '审查',
  'review.keep': '保留',
  'review.undo': '撤销',
  'review.before': '改前',
  'review.after': '改后',
  'review.shellWarn': '本轮跑过壳命令，可能还有未跟踪的改动。',
  'review.shellDismiss': '知道了',
  'review.shellTitle': '壳改动提示',
  'review.empty': '本会话还没有待审查的 Agent 改动。',
  'review.dirty': '先保存或丢弃编辑器里未保存的修改。',
  'review.conflict': '磁盘内容已偏离 Agent 结果，无法安全撤销。',
  'review.conflictForce': '磁盘已被改过。仍要覆盖并恢复到本轮开始前吗？',
  'review.skipped': '跳过了 {n} 个有冲突的文件。',
  'review.notPending': '该文件已不在待审状态。',
  'review.notFound': '找不到该审查条目。',
  'review.ioError': '读写文件失败。',
  'review.status.irreversible': '不可撤销',
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
  'editor.noSource': '没有源码',
  'editor.lspStarting': '正在启动语言服务…',
  'editor.lspFailed': '语言服务没起来，跳转/悬停不可用。JDT 1.57 进程需要 Java 21+（会自动在 D:\\developTool 找；项目可以是 8/17/21）',
  'editor.lspOff': '当前文件没有语言服务（需要已打开工作区，且仅支持 Java / TS / JS / Vue）',
  'editor.lspUnsupported': '这个文件类型还没有语言服务（目前支持 Java / TS / JS / Vue）',
  'editor.lspNoWorkspace': '语言服务还没对上工作区。侧栏能看见文件夹时，点一下文件或等会话 cwd 就绪',
  'editor.lspNoRemote': '语言服务通道还没连上，请稍等几秒；一直这样就重启桌面端',
  'quickOpen.placeholder': '输入文件名…',
  'quickOpen.empty': '没有匹配的文件',
  'quickOpen.noWorkspace': '没有工作区可搜索',
  'search.placeholder': '搜索',
  'search.caseSensitive': '区分大小写',
  'search.wholeWord': '全字匹配',
  'search.regex': '使用正则表达式',
  'search.filters': '筛选文件',
  'search.include': '要包含的文件（如 *.ts）',
  'search.exclude': '要排除的文件',
  'search.noWorkspace': '还没有可搜索的工作区目录。请先在最右列添加工作区。',
  'search.searching': '正在搜索…',
  'search.empty': '没有找到结果。',
  'search.error': '搜索失败。',
  'search.badPattern': '正则表达式不合法。',
  'search.summary': '{n} 个结果，{m} 个文件',
  'search.truncated': '结果太多，只显示前 {n} 条。可以缩小搜索范围。',
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
  'tab.terminal': '终端',
  'tab.problems': '问题',
  'tab.checks': '检查',
  'sidebar.missing': '这个面板还没挂上。',
  'sidebar.crashed': '这个面板渲染失败，请切换一次活动栏图标再试。',
  'git.noWorkspace': '当前会话没有工作区。请先在对话里选一个工作区，或用最右列添加。',
  'git.loading': '正在读取 Git 状态…',
  'git.missing': '当前打开的文件夹不是 Git 仓库。如果仓库在子目录里，把那个子目录加为工作区。本机也需要已安装 git。',
  'git.error': 'Git 状态读取失败。',
  'git.repo': '仓库',
  'git.branch': '分支',
  'git.localBranches': '本地分支',
  'git.remoteBranches': '远程分支',
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
  'git.hoverNow': '刚刚',
  'git.hoverMinutes': '{n} 分钟前',
  'git.hoverHours': '{n} 小时前',
  'git.hoverDays': '{n} 天前',
  'git.hoverMonths': '{n} 个月前',
  'git.hoverYears': '{n} 年前',
  'git.copyHash': '复制提交哈希',
  'git.copied': '已复制',
  'git.openOnGitHub': '在 GitHub 上打开',
  'git.openOnGitLab': '在 GitLab 上打开',
  'git.openOnGitee': '在 Gitee 上打开',
  'git.openOnRemote': '在远端打开',
  'git.stage': '暂存',
  'git.unstage': '取消暂存',
  'git.stageAll': '全部暂存',
  'git.unstageAll': '全部取消暂存',
  'git.discardAll': '全部还原',
  'git.staged': '暂存的更改',
  'git.changes': '更改',
  'git.history': '历史',
  'git.graph': '图表',
  'git.loadingMore': '正在加载更早的提交…',
  'git.discard': '还原',
  'git.diffWorktree': '查看工作区差异',
  'git.diffStaged': '查看暂存差异',
  'git.open': '打开文件',
  'diff.noPath': '这个差异标签没有路径。',
  'diff.loading': '正在读取差异…',
  'diff.error': '差异读取失败。',
  'diff.empty': '这一侧没有差异。',
  'diff.files': '文件',
  'terminal.unavailable': '这个环境还没有挂上主机终端通道，所以这里不能开壳。',
  'terminal.empty': '用菜单「终端 → 新建终端」开一个壳。',
  'terminal.prompt': '输入命令，回车发送。Ctrl+C 中断。',
  'terminal.busy': '正在等待命令结束…',
  'terminal.exited': '壳已退出。',
  'terminal.starting': '正在启动终端…',
  'terminal.crash': '终端面板出错',
  'problems.count': '{n} 个问题（{e} 个错误）',
  'problems.empty': '这里和 Cursor「问题」不是一回事。只汇总：①已打开编辑器的语言诊断；②底栏「检查」跑完后解析出的错误。Cursor 里 Edge Tools / 未打开文件的 TS 报错不会自动出现——请先「全部运行」检查，或打开相关源文件。',
  'problems.filterPlaceholder': '筛选（文本、路径、来源）',
  'problems.collapseAll': '全部折叠',
  'problems.lineCol': '行 {line}, 列 {col}',
  'problems.groupBy': '分组',
  'problems.group.file': '文件',
  'problems.group.source': '工具',
  'problems.group.severity': '严重程度',
  'checks.runRelated': '运行相关检查',
  'checks.runAll': '全部运行',
  'checks.stop': '停止',
  'checks.autoRerun': 'Agent 修完后重跑失败项',
  'checks.noWorkspace': '打开工作区后即可探测 package.json 检查脚本。',
  'checks.none': '附近没有识别到 typecheck / lint / test / build 脚本。',
  'checks.logEmpty': '还没有检查日志。',
  'checks.packageRoot': '检查根目录：{path}',
  'checks.blurb': '在检查根目录执行 package.json 的 typecheck / lint / test / build（和 CI 同类），不是 Cursor 的语言服务扫描。「运行相关」只带上 Git 改动的代码文件；「全部运行」跑完整脚本。',
  'checks.openProblems': '查看问题',
  'checks.status.idle': '待运行',
  'checks.status.running': '运行中',
  'checks.status.passed': '通过',
  'checks.status.failed': '失败',
  'checks.status.skipped': '跳过',
  'checks.status.stopped': '已停止',
  'checks.askAgent': '交给 Agent 修复',
  'precommit.summary': '本轮改动',
  'precommit.gates': '推荐门禁',
  'precommit.runRecommended': '运行推荐门禁',
  'precommit.runGate': '运行这项检查',
  'precommit.remoteMissing': '检查通道还没挂上，稍后再试，或打开底栏「检查」。',
  'precommit.confirm': '我已确认这些改动可以提交',
  'precommit.noPush': '不会自动 push，也不会改 Git 身份或配置。',
  'precommit.moreFiles': '还有 {n} 个文件…',
  'precommit.notNeeded': '与本次改动无关',
  'precommit.needStaged': '先暂存要提交的文件。',
  'precommit.needMessage': '先填写提交说明。',
  'precommit.needGates': '先运行推荐门禁。',
  'precommit.needFix': '推荐门禁失败。交给 Agent 修复后再提交。',
  'precommit.needConfirm': '勾选确认后才能创建提交。',
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
  'menu.edit.find': '查找',
  'menu.edit.replace': '替换',
  'menu.edit.searchFiles': '在文件中查找',
  'menu.go': '转到',
  'menu.go.file': '转到文件',
  'menu.go.line': '转到行',
  'menu.go.definition': '转到定义',
  'menu.go.implementation': '转到实现',
  'menu.go.references': '查找所有引用',
  'menu.go.hover': '显示悬停提示',
  'menu.view': '视图',
  'menu.view.primary': '切换左侧边栏',
  'menu.view.sessions': '切换会话列表',
  'menu.view.conversation': '切换对话',
  'menu.view.problems': '问题',
  'menu.view.checks': '检查',
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
  'activity.search': 'Search',
  'activity.git': 'Source Control',
  'activity.terminal': 'Terminal',
  'review.files': '{n} Files',
  'review.undoAll': 'Undo All',
  'review.keepAll': 'Keep All',
  'review.review': 'Review',
  'review.keep': 'Keep',
  'review.undo': 'Undo',
  'review.before': 'Before',
  'review.after': 'After',
  'review.shellWarn': 'A shell tool ran this turn; some disk changes may be untracked.',
  'review.shellDismiss': 'Dismiss',
  'review.shellTitle': 'Shell changes',
  'review.empty': 'No Agent file changes to review in this session.',
  'review.dirty': 'Save or discard unsaved editor changes first.',
  'review.conflict': 'Disk no longer matches the Agent result; cannot revert safely.',
  'review.conflictForce': 'Disk was modified further. Overwrite and restore to before this turn?',
  'review.skipped': 'Skipped {n} conflicting file(s).',
  'review.notPending': 'That file is no longer pending review.',
  'review.notFound': 'Review entry not found.',
  'review.ioError': 'File I/O failed.',
  'review.status.irreversible': 'Irreversible',
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
  'editor.noSource': 'No source available',
  'editor.lspStarting': 'Starting the language server…',
  'editor.lspFailed': 'Language server failed to start. JDT 1.57 needs Java 21+ (auto-scanned under D:\\developTool; projects may still be 8/17/21)',
  'editor.lspOff': 'No language server for this file (needs a workspace; Java / TS / JS / Vue only)',
  'editor.lspUnsupported': 'No language server for this file type (Java / TS / JS / Vue only)',
  'editor.lspNoWorkspace': 'Language server has no workspace root yet. Re-click the file after the explorer tree appears',
  'editor.lspNoRemote': 'The language-server channel is not connected yet. Wait a few seconds, or relaunch the desktop app',
  'quickOpen.placeholder': 'Type a file name…',
  'quickOpen.empty': 'No matching files',
  'quickOpen.noWorkspace': 'No workspace to search',
  'search.placeholder': 'Search',
  'search.caseSensitive': 'Match case',
  'search.wholeWord': 'Match whole word',
  'search.regex': 'Use regular expression',
  'search.filters': 'Toggle file filters',
  'search.include': 'Files to include (e.g. *.ts)',
  'search.exclude': 'Files to exclude',
  'search.noWorkspace': 'No workspace folder to search. Add one from the far-right rail first.',
  'search.searching': 'Searching…',
  'search.empty': 'No results found.',
  'search.error': 'Search failed.',
  'search.badPattern': 'Invalid regular expression.',
  'search.summary': '{n} results in {m} files',
  'search.truncated': 'Too many results; showing the first {n}. Narrow the search to see the rest.',
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
  'tab.terminal': 'Terminal',
  'tab.problems': 'Problems',
  'tab.checks': 'Checks',
  'sidebar.missing': 'This panel is not registered.',
  'sidebar.crashed': 'This panel crashed. Switch the activity-bar icon and try again.',
  'git.noWorkspace': 'This session has no workspace. Pick one in the conversation, or add one from the far-right rail.',
  'git.loading': 'Reading git status…',
  'git.missing': 'This folder is not a git repository. If the repo is in a subdirectory, add that folder as the workspace. Git must also be installed.',
  'git.error': 'Could not read git status.',
  'git.repo': 'Repository',
  'git.branch': 'Branch',
  'git.localBranches': 'Local branches',
  'git.remoteBranches': 'Remote branches',
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
  'git.hoverNow': 'just now',
  'git.hoverMinutes': '{n} minutes ago',
  'git.hoverHours': '{n} hours ago',
  'git.hoverDays': '{n} days ago',
  'git.hoverMonths': '{n} months ago',
  'git.hoverYears': '{n} years ago',
  'git.copyHash': 'Copy commit hash',
  'git.copied': 'Copied',
  'git.openOnGitHub': 'Open on GitHub',
  'git.openOnGitLab': 'Open on GitLab',
  'git.openOnGitee': 'Open on Gitee',
  'git.openOnRemote': 'Open on remote',
  'git.stage': 'Stage',
  'git.unstage': 'Unstage',
  'git.stageAll': 'Stage All',
  'git.unstageAll': 'Unstage All',
  'git.discardAll': 'Discard All',
  'git.staged': 'Staged Changes',
  'git.changes': 'Changes',
  'git.history': 'History',
  'git.graph': 'Graph',
  'git.loadingMore': 'Loading earlier commits…',
  'git.discard': 'Discard',
  'git.diffWorktree': 'Diff worktree',
  'git.diffStaged': 'Diff staged',
  'git.open': 'Open file',
  'diff.noPath': 'This diff tab has no path.',
  'diff.loading': 'Reading the diff…',
  'diff.error': 'Could not read the diff.',
  'diff.empty': 'This side has no diff.',
  'diff.files': 'files',
  'terminal.unavailable': 'This surface has no host terminal bridge, so a shell cannot start here.',
  'terminal.empty': 'Use Terminal → New Terminal from the menu to open a shell.',
  'terminal.prompt': 'Type a command and press Enter. Ctrl+C interrupts.',
  'terminal.busy': 'Waiting for the command to finish…',
  'terminal.exited': 'The shell exited.',
  'terminal.starting': 'Starting terminal…',
  'terminal.crash': 'Terminal panel crashed',
  'problems.count': '{n} problems ({e} errors)',
  'problems.empty': 'Not the same as Cursor Problems. Only: (1) diagnostics from open editors; (2) errors parsed after Checks. Cursor Edge Tools / closed-file TS issues will not appear — Run All in Checks, or open the source files.',
  'problems.filterPlaceholder': 'Filter (text, path, source)',
  'problems.collapseAll': 'Collapse all',
  'problems.lineCol': 'Ln {line}, Col {col}',
  'problems.groupBy': 'Group by',
  'problems.group.file': 'File',
  'problems.group.source': 'Tool',
  'problems.group.severity': 'Severity',
  'checks.runRelated': 'Run Related',
  'checks.runAll': 'Run All',
  'checks.stop': 'Stop',
  'checks.autoRerun': 'Re-run failed after Agent',
  'checks.noWorkspace': 'Open a workspace to discover package.json check scripts.',
  'checks.none': 'No typecheck / lint / test / build scripts found nearby.',
  'checks.logEmpty': 'No check log yet.',
  'checks.packageRoot': 'Package root: {path}',
  'checks.blurb': 'Runs package.json typecheck / lint / test / build at the package root (CI-style), not Cursor language-service scanning. Related = dirty code files only; Run All = full scripts.',
  'checks.openProblems': 'Open Problems',
  'checks.status.idle': 'Idle',
  'checks.status.running': 'Running',
  'checks.status.passed': 'Passed',
  'checks.status.failed': 'Failed',
  'checks.status.skipped': 'Skipped',
  'checks.status.stopped': 'Stopped',
  'checks.askAgent': 'Ask Agent to fix',
  'precommit.summary': 'This change set',
  'precommit.gates': 'Recommended gates',
  'precommit.runRecommended': 'Run recommended gates',
  'precommit.runGate': 'Run this check',
  'precommit.remoteMissing': 'The checks channel is not mounted yet. Try again, or open the Checks panel.',
  'precommit.confirm': 'I confirm these changes are ready to commit',
  'precommit.noPush': 'This will not push, and it will not change Git identity or config.',
  'precommit.moreFiles': '{n} more files…',
  'precommit.notNeeded': 'Not needed for this change set',
  'precommit.needStaged': 'Stage the files you want to commit first.',
  'precommit.needMessage': 'Write a commit message first.',
  'precommit.needGates': 'Run the recommended gates first.',
  'precommit.needFix': 'A recommended gate failed. Ask the Agent to fix it before committing.',
  'precommit.needConfirm': 'Confirm the change set before creating the commit.',
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
  'menu.edit.find': 'Find',
  'menu.edit.replace': 'Replace',
  'menu.edit.searchFiles': 'Find in Files',
  'menu.go': 'Go',
  'menu.go.file': 'Go to File',
  'menu.go.line': 'Go to Line',
  'menu.go.definition': 'Go to Definition',
  'menu.go.implementation': 'Go to Implementation',
  'menu.go.references': 'Go to References',
  'menu.go.hover': 'Show Hover',
  'menu.view': 'View',
  'menu.view.primary': 'Toggle Primary Sidebar',
  'menu.view.sessions': 'Toggle Session List',
  'menu.view.conversation': 'Toggle Chat',
  'menu.view.problems': 'Problems',
  'menu.view.checks': 'Checks',
  'menu.terminal': 'Terminal',
  'menu.terminal.new': 'New Terminal',
  'menu.terminal.toggle': 'Toggle Terminal',
  'menu.help': 'Help',
  'menu.help.about': 'About Xmart',
  'menu.help.aboutTitle': 'Xmart',
  'menu.help.aboutDetail': 'Desktop / web AI agent workbench.',
}
