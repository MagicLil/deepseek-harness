import { describe, expect, it } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeShadowKey, sessionDir, writeShadow, readShadow, deleteShadow, loadIndex, saveIndex } from '../src/store.ts'

describe('store', () => {
  it('round-trips shadows and indexes', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-review-store-'))
    expect(sessionDir('a/b', home)).toContain('a_b')
    const key = makeShadowKey(1, '/x/y.ts')
    await writeShadow('sid', key, 'body', home)
    expect(await readShadow('sid', key, home)).toBe('body')
    await deleteShadow('sid', key, home)
    expect(await readShadow('sid', key, home)).toBeNull()
    expect(await readShadow('sid', '', home)).toBe('')
    await saveIndex({ sessionId: 'sid', turns: [{ turn: 1, shellMaybeMutated: false, files: [] }] }, home)
    expect(await loadIndex('sid', home)).toEqual({
      sessionId: 'sid',
      turns: [{ turn: 1, shellMaybeMutated: false, files: [] }],
    })
    expect(await loadIndex('missing', home)).toEqual({ sessionId: 'missing', turns: [] })
  })
})
