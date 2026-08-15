/**
 * Gate for commit subjects: conventional type tokens stay English; the rest of
 * the first line must be Chinese. Lefthook `commit-msg` passes the message file
 * as `{1}`.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Conventional types this repository accepts. Scope may stay English. */
export const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'release',
  'revert',
] as const

const SUBJECT_LINE =
  /^(?<type>[a-z]+)(?:\((?<scope>[^()\s]+)\))?(?<breaking>!)?: (?<subject>.+)$/
const SKIP_SUBJECT = /^(Merge\b|Revert "|fixup! |squash! )/
const HAN = /[\u3400-\u9FFF]/

/** Return every subject-line violation; an empty list means the message is accepted. */
export function commitMessageErrors(raw: string): string[] {
  const subjectLine = (raw.split(/\r?\n/, 1)[0] ?? '').trimEnd()
  if (subjectLine === '') return ['提交说明不能为空']
  if (SKIP_SUBJECT.test(subjectLine)) return []

  const match = SUBJECT_LINE.exec(subjectLine)
  if (match?.groups === undefined) {
    return [
      '第一行须为 type(scope)?: 中文说明，例如 feat(desktop): 加上托盘',
    ]
  }

  const type = match.groups.type
  if (!COMMIT_TYPES.includes(type as (typeof COMMIT_TYPES)[number])) {
    return [`type 须为 ${COMMIT_TYPES.join('|')} 之一，收到 ${type}`]
  }

  const subject = match.groups.subject.trim()
  if (subject === '') return ['冒号后面要有说明']
  if (!HAN.test(subject)) {
    return ['说明须使用中文（feat、fix 等类型词和 scope 可用英文）']
  }
  return []
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const file = process.argv[2]
  if (file === undefined) {
    process.stderr.write('verify-commit-message: pass the commit message file path (lefthook {1})\n')
    process.exit(2)
  }

  const errors = commitMessageErrors(readFileSync(file, 'utf8'))
  if (errors.length > 0) {
    process.stderr.write('verify-commit-message: 提交说明不符合约定\n')
    for (const error of errors) process.stderr.write(`  ${error}\n`)
    process.exit(1)
  }
}
