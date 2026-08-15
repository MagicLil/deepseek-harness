import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundleDirectory,
  findSkillFiles,
  isProjectOverride,
  isWritableSkillPath,
  originFromPath,
  originRank,
} from '../src/scan.ts'

describe('project skill scan', () => {
  it('classifies origins, ranks, and writable paths', () => {
    expect(originFromPath('C:/p/.dsh/skills/a/SKILL.md')).toBe('project')
    expect(originFromPath('/p/.dsh/skills')).toBe('project')
    expect(originFromPath('/p/.agents/skills/a/SKILL.md')).toBe('agents')
    expect(originFromPath('/p/.agents/skills')).toBe('agents')
    expect(originFromPath('/p/.claude/skills/a/SKILL.md')).toBe('claude')
    expect(originFromPath('/p/.claude/skills')).toBe('claude')
    expect(originFromPath('/p/.cursor/skills/a/SKILL.md')).toBe('cursor')
    expect(originFromPath('/p/.cursor/skills')).toBe('cursor')
    expect(originFromPath('/p/.codex/skills/a/SKILL.md')).toBe('codex')
    expect(originFromPath('/p/.codex/skills')).toBe('codex')
    expect(originFromPath('/p/docs/skills/a/SKILL.md')).toBe('other')
    expect(originRank('project')).toBe(5)
    expect(originRank('agents')).toBe(4)
    expect(originRank('other')).toBe(3)
    expect(originRank('cursor')).toBe(2)
    expect(originRank('personal')).toBe(0)
    expect(originRank('claude')).toBe(1)
    expect(isProjectOverride('project')).toBe(true)
    expect(isProjectOverride('agents')).toBe(true)
    expect(isProjectOverride('other')).toBe(true)
    expect(isProjectOverride('claude')).toBe(false)
    expect(isWritableSkillPath('/p/.dsh/skills/a/SKILL.md')).toBe(true)
    expect(isWritableSkillPath('/p/.agents/skills/a/SKILL.md')).toBe(true)
    expect(isWritableSkillPath('/p/.claude/skills/a/SKILL.md')).toBe(false)
    expect(bundleDirectory('/p/.dsh/skills/a/SKILL.md').replace(/\\/g, '/')).toMatch(/\/a$/)
  })

  it('walks nested agent folders and skips vendor trees', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-scan-'))
    await mkdir(join(root, 'app', '.agents', 'skills', 'nested-note'), { recursive: true })
    await mkdir(join(root, 'node_modules', '.agents', 'skills', 'hidden-note'), { recursive: true })
    await mkdir(join(root, '.git', 'skills', 'git-note'), { recursive: true })
    await mkdir(join(root, '.cursor', 'skills'), { recursive: true })
    await writeFile(join(root, 'app', '.agents', 'skills', 'nested-note', 'SKILL.md'), [
      '---',
      'name: nested-note',
      'description: Nested',
      '---',
      'N',
    ].join('\n'), 'utf8')
    await writeFile(join(root, 'node_modules', '.agents', 'skills', 'hidden-note', 'SKILL.md'), [
      '---',
      'name: hidden-note',
      'description: Hidden',
      '---',
      'H',
    ].join('\n'), 'utf8')
    await mkdir(join(root, '.cursor', 'skills', 'loean7-codingJournal'), { recursive: true })
    await writeFile(join(root, '.cursor', 'skills', 'flat-tip.md'), [
      '---',
      'name: flat-tip',
      'description: Flat',
      '---',
      'F',
    ].join('\n'), 'utf8')
    await writeFile(join(root, '.cursor', 'skills', 'loean7-codingJournal', 'SKILL.md'), [
      '---',
      'name: loean7-codingJournal',
      'description: Dev diary',
      '---',
      'J',
    ].join('\n'), 'utf8')
    await writeFile(join(root, '.cursor', 'skills', 'notes.txt'), 'ignore', 'utf8')
    await writeFile(join(root, 'README.md'), 'not a skill', 'utf8')
    await mkdir(join(root, '.secret', 'skills', 'hidden-note'), { recursive: true })
    await writeFile(join(root, '.secret', 'skills', 'hidden-note', 'SKILL.md'), [
      '---',
      'name: hidden-note',
      'description: Hidden dot dir',
      '---',
      'S',
    ].join('\n'), 'utf8')
    const found = await findSkillFiles(root)
    expect(found.map(item => item.name).sort()).toEqual(['flat-tip', 'loean7-codingJournal', 'nested-note'])
    expect(await findSkillFiles(join(root, 'missing'))).toEqual([])
  })

  it('stops walking past the depth limit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-deep-'))
    let current = root
    for (const name of ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'too-deep']) {
      current = join(current, name)
    }
    await mkdir(current, { recursive: true })
    await writeFile(join(current, 'SKILL.md'), [
      '---',
      'name: too-deep',
      'description: Too deep',
      '---',
      'X',
    ].join('\n'), 'utf8')
    expect(await findSkillFiles(root)).toEqual([])
  })

  it('follows junctions and skips broken or invalid names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-skill-link-'))
    const real = join(root, 'real-link-skill')
    await mkdir(real, { recursive: true })
    await mkdir(join(root, '.agents', 'skills'), { recursive: true })
    await mkdir(join(root, '.cursor', 'skills'), { recursive: true })
    await mkdir(join(root, 'Bad_Name'), { recursive: true })
    await writeFile(join(real, 'SKILL.md'), [
      '---',
      'name: link-skill',
      'description: Linked',
      '---',
      'L',
    ].join('\n'), 'utf8')
    await writeFile(join(root, 'Bad_Name', 'SKILL.md'), [
      '---',
      'name: bad-name',
      'description: Bad folder',
      '---',
      'B',
    ].join('\n'), 'utf8')
    await writeFile(join(root, '.cursor', 'skills', 'Bad_Name.md'), [
      '---',
      'name: bad-name',
      'description: Bad file',
      '---',
      'B',
    ].join('\n'), 'utf8')
    await symlink(
      real,
      join(root, '.agents', 'skills', 'link-skill'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await symlink(
      join(root, 'missing-target'),
      join(root, '.cursor', 'skills', 'broken-link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    try {
      await symlink(
        join(real, 'SKILL.md'),
        join(root, '.cursor', 'skills', 'link-flat.md'),
        'file',
      )
    } catch {
      await writeFile(join(root, '.cursor', 'skills', 'link-flat.md'), [
        '---',
        'name: link-flat',
        'description: Copy when symlink is denied',
        '---',
        'F',
      ].join('\n'), 'utf8')
    }
    const names = (await findSkillFiles(root)).map(item => item.name).sort()
    expect(names).toContain('link-skill')
    expect(names).toContain('link-flat')
    expect(names).not.toContain('bad-name')
  })
})
