/**
 * Local conventional-commit draft (type token English, subject Chinese).
 * The sparkle button can still replace this with a host LLM suggestion.
 */
import type { GitChange } from '@deepseek-ai/dsh-client-runtime/client'

const COMMIT_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore',
  'release', 'revert',
]

/**
 * Infer a conventional type from staged paths.
 * @param paths - repository-relative staged paths.
 */
export function inferCommitType(paths: readonly string[]): string {
  if (paths.length === 0) return 'chore'
  const all = paths.map(path => path.replace(/\\/g, '/'))
  if (all.every(path => /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path) || /\/tests?\//.test(path))) {
    return 'test'
  }
  if (all.every(path => /\.(?:md|mdx)$/i.test(path) || path.startsWith('docs/'))) return 'docs'
  if (all.every(path => /(^|\/)(?:\.github|lefthook|\.husky)\//.test(path) || /(?:^|\/)ci(?:\/|$)/.test(path))) {
    return 'ci'
  }
  if (all.every(path => /(?:^|\/)(?:package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/.test(path))) {
    return 'chore'
  }
  if (all.every(path => /\.css$/i.test(path))) return 'style'
  return 'feat'
}

/**
 * Build `type: 中文说明` from staged changes. Empty staged set → chore draft.
 * @param changes - porcelain rows; only `area === 'index'` count.
 */
export function draftCommitMessage(changes: readonly GitChange[]): string {
  const staged = changes.filter(change => change.area === 'index')
  const paths = staged.map(change => change.path)
  const type = inferCommitType(paths)
  const names = paths.map((path) => {
    const base = path.split(/[/\\]/).filter(part => part.length > 0).pop()
    return base === undefined ? path : base
  })
  const subject = names.length === 0
    ? '更新工作区'
    : names.length === 1
      ? `更新 ${names[0]}`
      : names.length === 2
        ? `更新 ${names[0]}、${names[1]}`
        : `更新 ${String(names.length)} 个文件`
  return `${type}: ${subject}`
}

/**
 * Lightweight check that a subject looks like conventional + Chinese.
 * @param message - full commit message.
 */
export function commitMessageLooksValid(message: string): boolean {
  const subject = message.replace(/\r?\n[\s\S]*$/, '').trim()
  const match = /^(?<type>[a-z]+)(?:\([^)]+\))?!?: (?<rest>.+)$/.exec(subject)
  const type = match?.groups?.type
  const rest = match?.groups?.rest
  if (type === undefined || rest === undefined) return false
  if (!COMMIT_TYPES.includes(type)) return false
  return /[\u3400-\u9FFF]/.test(rest)
}
