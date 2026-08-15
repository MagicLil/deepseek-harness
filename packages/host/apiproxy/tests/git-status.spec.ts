import { describe, expect, it } from 'vitest'
import { parseGitPorcelain } from '../src/git-status.ts'

describe('parseGitPorcelain', () => {
  it('reads branch tracking and collapsed change letters', () => {
    const status = parseGitPorcelain('/repo', [
      '## main...origin/main [ahead 1, behind 2]',
      ' M src/a.ts',
      'A  src/b.ts',
      'D  src/c.ts',
      '?? new.md',
      'R  old.ts -> renamed.ts',
      'UU conflict.ts',
    ].join('\n'))
    expect(status).toEqual({
      root: '/repo',
      branch: 'main',
      ahead: 1,
      behind: 2,
      detached: false,
      changes: [
        { path: 'src/a.ts', status: 'modified' },
        { path: 'src/b.ts', status: 'added' },
        { path: 'src/c.ts', status: 'deleted' },
        { path: 'new.md', status: 'untracked' },
        { path: 'renamed.ts', status: 'renamed' },
        { path: 'conflict.ts', status: 'conflict' },
      ],
    })
  })

  it('marks a detached HEAD', () => {
    const status = parseGitPorcelain('/repo', '## HEAD (no branch)\n')
    expect(status.detached).toBe(true)
    expect(status.branch).toBe('HEAD')
    expect(status.changes).toEqual([])
  })
})
