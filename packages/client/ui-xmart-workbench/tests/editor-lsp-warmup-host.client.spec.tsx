// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import type { FileListing } from '@deepseek-ai/dsh-client-runtime/client'
import { EditorLspWarmup } from '../src/client/EditorLspWarmup.tsx'
import {
  isLanguageWarmed,
  isLanguageWarming,
  resetLanguageWarmth,
} from '../src/client/editor-lsp.ts'

afterEach(() => {
  vi.useRealTimers()
  resetLanguageWarmth()
  cleanup()
})

function remote() {
  return {
    open: vi.fn(async () => ({ ok: true as const, value: undefined })),
    change: vi.fn(async () => ({ ok: true as const, value: undefined })),
    close: vi.fn(async () => ({ ok: true as const, value: undefined })),
    complete: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    diagnostics: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    definition: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    hover: vi.fn(async () => ({ ok: true as const, value: {} })),
    references: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    implementation: vi.fn(async () => ({ ok: true as const, value: { items: [] } })),
    warmup: vi.fn(async () => ({ ok: true as const, value: undefined })),
  }
}

function listing(names: readonly string[]): FileListing {
  return {
    path: '/ws',
    truncated: false,
    entries: names.map(name => ({
      name,
      path: `/ws/${name}`,
      kind: 'file' as const,
      hidden: false,
    })),
  }
}

describe('EditorLspWarmup', () => {
  it('warms Java when the project folder has a pom', async () => {
    const javaLsp = remote()
    render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        getRoots={() => [{ path: '/ws', title: 'ws' }, { path: '/lib', title: 'lib' }]}
        listEntries={async path => path === '/ws' ? listing(['pom.xml', 'src']) : listing(['readme.md'])}
      />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(javaLsp.warmup).toHaveBeenCalledWith({ workspaceRoot: '/ws' })
    expect(isLanguageWarmed('/Foo.java')).toBe(true)
  })

  it('clears warming for a language the folder does not need', async () => {
    const javaLsp = remote()
    const vueLsp = remote()
    render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp, vueLsp })}
        getWorkspaceRoot={() => '/ws'}
        listEntries={async path => path === '/ws' ? listing(['pom.xml']) : listing(['readme.md'])}
      />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(isLanguageWarmed('/Foo.java')).toBe(true)
    expect(isLanguageWarming('/App.vue')).toBe(false)
  })

  it('retries when the Remote appears late and ignores a throwing root', async () => {
    vi.useFakeTimers()
    const javaLsp = remote()
    let remotes: { javaLsp?: ReturnType<typeof remote> } = {}
    const listeners = new Set<() => void>()
    render(
      <EditorLspWarmup
        getRemotes={() => remotes}
        getWorkspaceRoot={() => '/ws'}
        watchWorkspace={(fn) => {
          listeners.add(fn)
          return () => { listeners.delete(fn) }
        }}
        listEntries={async () => listing(['pom.xml'])}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.warmup).not.toHaveBeenCalled()
    remotes = { javaLsp }
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(javaLsp.warmup).toHaveBeenCalledWith({ workspaceRoot: '/ws' })
    await act(async () => {
      for (const fn of listeners) fn()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(javaLsp.warmup).toHaveBeenCalledTimes(1)
    cleanup()
    render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => { throw new Error('cwd') }}
        getRoots={() => { throw new Error('roots') }}
        listEntries={async () => listing(['readme.md'])}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(javaLsp.warmup).toHaveBeenCalledTimes(1)
    remotes = {}
    cleanup()
    render(
      <EditorLspWarmup
        getRemotes={() => remotes}
        getWorkspaceRoot={() => '/ws'}
        listEntries={async () => listing(['pom.xml'])}
      />,
    )
    await act(async () => { vi.advanceTimersByTime(20_000) })
  })

  it('skips a remote without warmup and clears warmth on failure', async () => {
    const javaLsp = remote()
    javaLsp.warmup.mockResolvedValueOnce({ ok: false as const, error: { code: 'x', message: 'no' } })
    const tsLsp = remote()
    delete (tsLsp as { warmup?: unknown }).warmup
    render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp, tsLsp })}
        getWorkspaceRoot={() => '/ws'}
        listEntries={async () => listing(['pom.xml', 'package.json'])}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(isLanguageWarming('/Foo.java')).toBe(false)
    expect(isLanguageWarmed('/Foo.java')).toBe(false)
    javaLsp.warmup.mockRejectedValueOnce(new Error('boom'))
    cleanup()
    resetLanguageWarmth()
    render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        listEntries={async () => listing(['pom.xml'])}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(isLanguageWarmed('/Foo.java')).toBe(false)
  })

  it('is a no-op without remotes and drops an in-flight detect', async () => {
    let finish: ((value: FileListing) => void) | undefined
    const javaLsp = remote()
    const { unmount } = render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        listEntries={() => new Promise<FileListing>((resolve) => { finish = resolve })}
      />,
    )
    await act(async () => { await Promise.resolve() })
    unmount()
    await act(async () => { finish?.(listing(['pom.xml'])); await Promise.resolve(); await Promise.resolve() })
    expect(javaLsp.warmup).not.toHaveBeenCalled()
    render(<EditorLspWarmup />)
    await act(async () => { await Promise.resolve() })
  })

  it('does not mark a language warm after unmount mid-seed', async () => {
    const javaLsp = remote()
    let finishRead: ((text: string) => void) | undefined
    const { unmount } = render(
      <EditorLspWarmup
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        listEntries={async () => listing(['pom.xml', 'Foo.java'])}
        readFile={() => new Promise<string>((resolve) => { finishRead = resolve })}
      />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(javaLsp.warmup).toHaveBeenCalled()
    unmount()
    await act(async () => { finishRead?.('class Foo {}'); await Promise.resolve(); await Promise.resolve() })
    expect(isLanguageWarmed('/Foo.java')).toBe(false)
  })
})
