import { describe, expect, it } from 'vitest'
import {
  gitBodyLines, gitCoAuthors, gitCommitWebUrl, gitExactTime, gitHoverModel,
  gitHoverPosition, gitRelativeLabel, gitRelativeTime, gitRemoteHost, gitShortHash,
  gitStatParts, gitWebLabel,
} from '../src/client/git-hover.ts'
import type { GitGraphNode } from '../src/client/git-graph.ts'

const t = (key: string) => ({
  'git.hoverNow': '刚刚',
  'git.hoverMinutes': '{n} 分钟前',
  'git.hoverHours': '{n} 小时前',
  'git.hoverDays': '{n} 天前',
  'git.hoverMonths': '{n} 个月前',
  'git.hoverYears': '{n} 年前',
  'git.openOnGitHub': '在 GitHub 上打开',
  'git.openOnGitLab': '在 GitLab 上打开',
  'git.openOnGitee': '在 Gitee 上打开',
  'git.openOnRemote': '在远端打开',
}[key] ?? key)

const base: GitGraphNode = {
  hash: '5120bf4aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  subject: 'feat: keep widths',
  author: 'lx',
  timestamp: 1_777_000_000,
  lane: 0,
  railCount: 1,
  rails: [0],
  merges: [],
  refs: [],
}

describe('git hover formatters', () => {
  it('shortens the hash and buckets relative time', () => {
    expect(gitShortHash('5120bf4aaa')).toBe('5120bf4')
    const now = 1_777_000_000 * 1000
    expect(gitRelativeTime(1_777_000_000, now)).toEqual({ unit: 'now', n: 0 })
    expect(gitRelativeTime(1_777_000_000 - 5 * 60, now)).toEqual({ unit: 'minutes', n: 5 })
    expect(gitRelativeTime(1_777_000_000 - 3 * 3600, now)).toEqual({ unit: 'hours', n: 3 })
    expect(gitRelativeTime(1_777_000_000 - 2 * 86400, now)).toEqual({ unit: 'days', n: 2 })
    expect(gitRelativeTime(1_777_000_000 - 60 * 86400, now)).toEqual({ unit: 'months', n: 2 })
    expect(gitRelativeTime(1_777_000_000 - 400 * 86400, now)).toEqual({ unit: 'years', n: 1 })
    expect(gitRelativeLabel({ unit: 'now', n: 0 }, t)).toBe('刚刚')
    expect(gitRelativeLabel({ unit: 'minutes', n: 5 }, t)).toBe('5 分钟前')
    expect(gitRelativeLabel({ unit: 'hours', n: 1 }, t)).toBe('1 小时前')
    expect(gitRelativeLabel({ unit: 'days', n: 2 }, t)).toBe('2 天前')
    expect(gitRelativeLabel({ unit: 'months', n: 3 }, t)).toBe('3 个月前')
    expect(gitRelativeLabel({ unit: 'years', n: 1 }, t)).toBe('1 年前')
    expect(gitExactTime(1_777_000_000, 'zh-CN')).toMatch(/2026/)
  })

  it('splits body, trailers, and shortstat', () => {
    expect(gitCoAuthors('')).toEqual([])
    expect(gitCoAuthors('Co-authored-by: Cursor <c@x>\nSigned-off-by: A')).toEqual(['Cursor <c@x>'])
    expect(gitBodyLines('why\n\nCo-authored-by: Cursor <c@x>\n')).toEqual(['why'])
    expect(gitStatParts(undefined, 1, 1)).toBeUndefined()
    expect(gitStatParts(1, undefined, undefined)).toEqual({ files: '1 file changed' })
    expect(gitStatParts(2, 1, 1)).toEqual({
      files: '2 files changed',
      insertions: '1 insertion(+)',
      deletions: '1 deletion(-)',
    })
    expect(gitStatParts(3, 4, 0)?.insertions).toBe('4 insertions(+)')
    expect(gitStatParts(3, 0, 8)?.deletions).toBe('8 deletions(-)')
  })

  it('builds commit web URLs and host labels', () => {
    expect(gitCommitWebUrl('', 'abc')).toBeUndefined()
    expect(gitCommitWebUrl('not a url', 'abc')).toBeUndefined()
    expect(gitCommitWebUrl('file:///tmp/repo', 'abc')).toBeUndefined()
    expect(gitCommitWebUrl('https://github.com', 'abc')).toBeUndefined()
    expect(gitCommitWebUrl('git@github.com:acme/app.git', '5120bf4')).toBe(
      'https://github.com/acme/app/commit/5120bf4',
    )
    expect(gitCommitWebUrl('https://github.com/acme/app.git', '5120bf4')).toBe(
      'https://github.com/acme/app/commit/5120bf4',
    )
    expect(gitCommitWebUrl('ssh://git@github.com/acme/app.git', '5120bf4')).toBe(
      'https://github.com/acme/app/commit/5120bf4',
    )
    expect(gitCommitWebUrl('https://gitlab.com/acme/app.git', '5120bf4')).toBe(
      'https://gitlab.com/acme/app/-/commit/5120bf4',
    )
    expect(gitRemoteHost('git@github.com:acme/app.git')).toBe('github')
    expect(gitRemoteHost('https://gist.github.com/x')).toBe('github')
    expect(gitRemoteHost('https://gitlab.com/acme/app.git')).toBe('gitlab')
    expect(gitRemoteHost('https://gitlab.example.com/acme/app.git')).toBe('gitlab')
    expect(gitRemoteHost('https://gitee.com/acme/app.git')).toBe('gitee')
    expect(gitRemoteHost('https://git.example.com/acme/app.git')).toBe('remote')
    expect(gitRemoteHost('')).toBe('remote')
    expect(gitRemoteHost('https://code.gitee.com/acme/app.git')).toBe('gitee')
    expect(gitWebLabel('github', t)).toBe('在 GitHub 上打开')
    expect(gitWebLabel('gitlab', t)).toBe('在 GitLab 上打开')
    expect(gitWebLabel('gitee', t)).toBe('在 Gitee 上打开')
    expect(gitWebLabel('remote', t)).toBe('在远端打开')
  })

  it('assembles a hover model and keeps the card on screen', () => {
    const full = gitHoverModel({
      ...base,
      body: 'why\n\nCo-authored-by: Cursor <c@x>',
      files: 16,
      insertions: 442,
      deletions: 8,
      originUrl: 'git@github.com:acme/app.git',
      refs: [
        { kind: 'head', name: 'HEAD' },
        { kind: 'branch', name: 'feat/x' },
      ],
    }, 1_777_000_000 * 1000 + 3_600_000, 'zh-CN')
    expect(full.relative).toEqual({ unit: 'hours', n: 1 })
    expect(full.coAuthors).toEqual(['Cursor <c@x>'])
    expect(full.bodyLines).toEqual(['why'])
    expect(full.stats?.files).toBe('16 files changed')
    expect(full.refs).toEqual([{ kind: 'branch', name: 'feat/x' }])
    expect(full.web?.host).toBe('github')
    expect(gitHoverModel(base, 1_777_000_000 * 1000).web).toBeUndefined()
    expect(gitHoverModel({ ...base, originUrl: 'not-a-url' }, 1_777_000_000 * 1000).web).toBeUndefined()
    expect(gitHoverPosition(
      { left: 10, right: 40, top: 20, bottom: 48 },
      { width: 200, height: 80 },
      { width: 800, height: 600 },
    )).toEqual({ x: 48, y: 20 })
    expect(gitHoverPosition(
      { left: 700, right: 780, top: 540, bottom: 568 },
      { width: 200, height: 80 },
      { width: 800, height: 600 },
    )).toEqual({ x: 492, y: 508 })
    expect(gitHoverPosition(
      { left: 4, right: 10, top: 2, bottom: 20 },
      { width: 400, height: 500 },
      { width: 200, height: 100 },
    )).toEqual({ x: 12, y: 12 })
  })
})
