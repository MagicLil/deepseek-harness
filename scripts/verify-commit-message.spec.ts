import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMMIT_TYPES, commitMessageErrors } from './verify-commit-message.ts'

const root = resolve(import.meta.dirname, '..')

describe('commit message gate', () => {
  it('accepts a conventional type with a Chinese subject', () => {
    expect(commitMessageErrors('feat(desktop): 加上安装包、托盘和自动更新')).toEqual([])
    expect(commitMessageErrors('fix: 修复托盘退出后窗口无法再打开')).toEqual([])
    expect(commitMessageErrors('chore!: 提交说明除类型词外改用中文')).toEqual([])
  })

  it('rejects an English-only subject and an unknown type', () => {
    expect(commitMessageErrors('feat(desktop): persist window state')).toEqual([
      '说明须使用中文（feat、fix 等类型词和 scope 可用英文）',
    ])
    expect(commitMessageErrors('wip: 先记一笔')).toEqual([
      `type 须为 ${COMMIT_TYPES.join('|')} 之一，收到 wip`,
    ])
    expect(commitMessageErrors('加上托盘')).toEqual([
      '第一行须为 type(scope)?: 中文说明，例如 feat(desktop): 加上托盘',
    ])
    expect(commitMessageErrors('')).toEqual(['提交说明不能为空'])
  })

  it('skips merge, revert, fixup, and squash subjects', () => {
    expect(commitMessageErrors('Merge branch \'master\' into loean7')).toEqual([])
    expect(commitMessageErrors('Revert "feat(desktop): persist window state"')).toEqual([])
    expect(commitMessageErrors('fixup! feat(desktop): persist window state')).toEqual([])
    expect(commitMessageErrors('squash! feat(desktop): persist window state')).toEqual([])
  })

  it('is wired as the lefthook commit-msg job', () => {
    const lefthook = readFileSync(resolve(root, 'lefthook.yml'), 'utf8')
    expect(lefthook).toContain('commit-msg:')
    expect(lefthook).toContain('scripts/verify-commit-message.ts {1}')
  })
})
