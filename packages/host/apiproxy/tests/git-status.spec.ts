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
        { path: 'src/a.ts', status: 'modified', area: 'worktree' },
        { path: 'src/b.ts', status: 'added', area: 'index' },
        { path: 'src/c.ts', status: 'deleted', area: 'index' },
        { path: 'new.md', status: 'untracked', area: 'worktree' },
        { path: 'renamed.ts', status: 'renamed', area: 'index' },
        { path: 'conflict.ts', status: 'conflict', area: 'worktree' },
      ],
    })
  })

  it('emits both index and worktree rows for MM and skips empty paths', () => {
    const status = parseGitPorcelain('/repo', [
      '## main',
      'MM both.ts',
      ' C copied.ts',
      'M  ',
      'xx',
    ].join('\n'))
    expect(status.changes).toEqual([
      { path: 'both.ts', status: 'modified', area: 'index' },
      { path: 'both.ts', status: 'modified', area: 'worktree' },
      { path: 'copied.ts', status: 'renamed', area: 'worktree' },
    ])
  })

  it('marks a detached HEAD', () => {
    const status = parseGitPorcelain('/repo', '## HEAD (no branch)\n')
    expect(status.detached).toBe(true)
    expect(status.branch).toBe('HEAD')
    expect(status.changes).toEqual([])
  })
})
