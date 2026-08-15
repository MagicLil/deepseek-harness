import { describe, expect, it } from 'vitest'
import { resolveUpdateFeed } from '../src/update-feed.ts'

describe('resolveUpdateFeed', () => {
  it('uses a generic feed URL when DSH_UPDATE_FEED_URL is set', () => {
    expect(resolveUpdateFeed({ DSH_UPDATE_FEED_URL: 'https://updates.example/dsh' })).toEqual({
      provider: 'generic',
      url: 'https://updates.example/dsh',
    })
  })

  it('uses a GitHub repository when DSH_UPDATE_GITHUB is owner/repo', () => {
    expect(resolveUpdateFeed({ DSH_UPDATE_GITHUB: 'MagicLil/deepseek-harness' })).toEqual({
      provider: 'github',
      owner: 'MagicLil',
      repo: 'deepseek-harness',
    })
  })

  it('prefers the generic URL and ignores an empty or malformed GitHub value', () => {
    expect(resolveUpdateFeed({
      DSH_UPDATE_FEED_URL: 'https://updates.example/dsh',
      DSH_UPDATE_GITHUB: 'MagicLil/deepseek-harness',
    })).toEqual({
      provider: 'generic',
      url: 'https://updates.example/dsh',
    })
    expect(resolveUpdateFeed({})).toBeUndefined()
    expect(resolveUpdateFeed({ DSH_UPDATE_FEED_URL: '  ' })).toBeUndefined()
    expect(resolveUpdateFeed({ DSH_UPDATE_GITHUB: 'not-a-pair' })).toBeUndefined()
  })
})
