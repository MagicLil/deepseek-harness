/** Skills settings copy. */

export type SkillsKey =
  | 'nav'
  | 'title'
  | 'intro'
  | 'tab.personal'
  | 'tab.project'
  | 'search.label'
  | 'search.placeholder'
  | 'empty.personal'
  | 'empty.project'
  | 'empty.workspace'
  | 'empty.search'
  | 'loading'
  | 'error'
  | 'retry'
  | 'enabled'
  | 'disabled'
  | 'origin.personal'
  | 'origin.project'
  | 'origin.agents'
  | 'origin.claude'
  | 'origin.cursor'
  | 'origin.codex'
  | 'origin.other'
  | 'error.invalid-name'
  | 'error.invalid-description'
  | 'error.name-taken'
  | 'error.not-found'
  | 'error.no-project'
  | 'error.invalid-project'
  | 'error.foreign-not-found'

export const zh: Record<SkillsKey, string> = {
  nav: '技能',
  title: '技能',
  intro: '个人技能合并 ~/.dsh/skills、~/.agents/skills、~/.cursor/skills 和 ~/.claude/skills。项目技能会在工作区里深扫所有 SKILL.md，不管是哪个编辑器留下的；已经在个人里的同名项不重复展示，项目自己的副本会覆盖个人。',
  'tab.personal': '个人',
  'tab.project': '项目',
  'search.label': '搜索技能',
  'search.placeholder': '搜索名称或说明',
  'empty.personal': '还没有个人技能。',
  'empty.project': '这个项目里还没有识别到技能。',
  'empty.workspace': '先打开一个工作区，才能查看项目技能。',
  'empty.search': '没有匹配的技能。',
  loading: '正在加载技能…',
  error: '无法加载技能。',
  retry: '重试',
  enabled: '已启用',
  disabled: '已关闭',
  'origin.personal': '本产品个人',
  'origin.project': '本产品项目',
  'origin.agents': '.agents',
  'origin.claude': 'Claude',
  'origin.cursor': 'Cursor',
  'origin.codex': 'Codex',
  'origin.other': '项目内其他目录',
  'error.invalid-name': '名称必须是小写字母、数字和连字符。',
  'error.invalid-description': '说明不能为空。',
  'error.name-taken': '这个名称已经存在。',
  'error.not-found': '找不到这条技能。',
  'error.no-project': '还没有打开工作区。',
  'error.invalid-project': '工作区路径无效。',
  'error.foreign-not-found': '找不到要导入的技能。',
}

export const en: Record<SkillsKey, string> = {
  nav: 'Skills',
  title: 'Skills',
  intro: 'Personal skills merge ~/.dsh/skills, ~/.agents/skills, ~/.cursor/skills, and ~/.claude/skills. Project skills deep-scan every SKILL.md in the workspace. Names already in personal stay off the project tab unless the project has its own copy, which then wins.',
  'tab.personal': 'Personal',
  'tab.project': 'Project',
  'search.label': 'Search skills',
  'search.placeholder': 'Search by name or description',
  'empty.personal': 'No personal skills yet.',
  'empty.project': 'No skills were found in this project.',
  'empty.workspace': 'Open a workspace to view project skills.',
  'empty.search': 'No skills match that search.',
  loading: 'Loading skills…',
  error: 'Could not load skills.',
  retry: 'Retry',
  enabled: 'On',
  disabled: 'Off',
  'origin.personal': 'Personal directory',
  'origin.project': 'This product',
  'origin.agents': '.agents',
  'origin.claude': 'Claude',
  'origin.cursor': 'Cursor',
  'origin.codex': 'Codex',
  'origin.other': 'Other project folder',
  'error.invalid-name': 'The name must be lowercase letters, digits, and hyphens.',
  'error.invalid-description': 'Description cannot be empty.',
  'error.name-taken': 'That name already exists.',
  'error.not-found': 'That skill was not found.',
  'error.no-project': 'No workspace is open.',
  'error.invalid-project': 'The workspace path is not valid.',
  'error.foreign-not-found': 'The skill to import was not found.',
}
