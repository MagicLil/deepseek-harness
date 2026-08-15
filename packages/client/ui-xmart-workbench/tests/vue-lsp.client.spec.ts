import { describe, expect, it, vi } from 'vitest'
import { bindVueLsp, isVuePath, type VueLspRemote } from '../src/client/vue-lsp.ts'

describe('isVuePath', () => {
  it('matches a final .vue extension', () => {
    expect(isVuePath('/a/App.vue')).toBe(true)
    expect(isVuePath('C:\\a\\App.VUE')).toBe(true)
    expect(isVuePath('/a/App.ts')).toBe(false)
    expect(isVuePath('/a/.vue')).toBe(false)
    expect(isVuePath('App.vue')).toBe(true)
    expect(isVuePath('vue')).toBe(false)
  })
})

describe('bindVueLsp', () => {
  it('unwraps successful remotes and throws on a wire error', async () => {
    const remote: VueLspRemote = {
      open: vi.fn(async () => ({ ok: true as const, value: undefined })),
      change: vi.fn(async () => ({ ok: true as const, value: undefined })),
      close: vi.fn(async () => ({ ok: true as const, value: undefined })),
      complete: vi.fn(async () => ({ ok: true as const, value: { items: [{ label: 'a' }] } })),
      diagnostics: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
      definition: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
      hover: vi.fn(async () => ({ ok: true as const, value: {} })),
      references: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    }
    const client = bindVueLsp(remote, '/ws')
    await client.open('/ws/A.vue', '<template />')
    await client.change('/ws/A.vue', '<p />')
    await client.close('/ws/A.vue')
    expect(await client.complete('/ws/A.vue', 0, 1)).toEqual([{ label: 'a' }])
    expect(await client.diagnostics('/ws/A.vue')).toEqual([])
    remote.open = vi.fn(async () => ({ ok: false as const, error: { code: 'x', message: 'no' } }))
    await expect(client.open('/ws/A.vue', 'x')).rejects.toThrow(/vueLsp.open failed/)
  })
})
