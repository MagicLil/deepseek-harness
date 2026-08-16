/**
 * Build the one-click Agent prompt for failed pre-commit / Checks rows.
 */

/** One failed check as the prompt lists it. */
export type FailedCheckLine = {
  kind: string
  script: string
  command: string
  exitCode: number | null
}

const LOG_CAP = 4000

/**
 * Chinese repair prompt: failed commands, dirty files, clipped log.
 * The Agent is told not to commit or push.
 * @param opts - failed rows, log, and dirty paths.
 */
export function buildAgentFixPrompt(opts: {
  failed: readonly FailedCheckLine[]
  log: string
  dirtyPaths: readonly string[]
}): string {
  const lines = [
    '请修复当前工作区里失败的提交前检查，修完后不要提交、不要 push。',
    '',
    '失败项：',
  ]
  for (const item of opts.failed) {
    const cmd = item.command === '' ? item.script : item.command
    const exit = item.exitCode === null ? '' : ` exit ${String(item.exitCode)}`
    lines.push(`- ${item.kind}（${item.script}）：\`${cmd}\`${exit}`)
  }
  if (opts.dirtyPaths.length > 0) {
    lines.push('', '相关改动文件：')
    for (const path of opts.dirtyPaths.slice(0, 40)) lines.push(`- ${path}`)
  }
  const log = opts.log.trim()
  if (log.length > 0) {
    const clipped = log.length > LOG_CAP ? log.slice(-LOG_CAP) : log
    lines.push('', '最近检查日志：', '```', clipped, '```')
  }
  return lines.join('\n')
}
