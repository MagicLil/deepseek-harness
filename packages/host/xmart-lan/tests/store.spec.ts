import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultPersist, loadPersist, persistPath, savePersist } from '../src/store.ts'

describe('store', () => {
  it('mints defaults, persists, and recovers corrupt JSON', async () => {
    const home = await mkdtemp(join(tmpdir(), 'xmart-lan-'))
    try {
      const first = await loadPersist(home)
      expect(first.enabled).toBe(false)
      expect(first.port).toBe(3080)
      expect(first.token.length).toBeGreaterThan(20)
      expect(persistPath(home)).toContain('xmart-lan.json')
      const minted = defaultPersist()
      expect(minted.enabled).toBe(false)
      await savePersist({ enabled: true, port: 99, token: 'abc' }, home)
      await expect(loadPersist(home)).resolves.toEqual({ enabled: true, port: 99, token: 'abc' })
      await writeFile(persistPath(home), '{', 'utf8')
      const recovered = await loadPersist(home)
      expect(recovered.enabled).toBe(false)
      expect(recovered.port).toBe(3080)
      await savePersist({ enabled: false, port: 0, token: '' }, home)
      const clamped = await loadPersist(home)
      expect(clamped.port).toBe(3080)
      expect(clamped.token.length).toBeGreaterThan(20)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
