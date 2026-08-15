// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { EditorLspSync } from '../src/client/EditorLspSync.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import type { WorkbenchTab } from '../src/client/types.ts'

afterEach(() => {
  vi.useRealTimers()
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
  }
}

function tab(path: string, type = 'editor'): WorkbenchTab {
  return { id: path, type, title: path, path }
}

describe('EditorLspSync', () => {
  it('opens every supported tab and closes a tab that goes away', async () => {
    const javaLsp = remote()
    const tsLsp = remote()
    const files = createWorkbenchFilesStore()
    files.setDraft('/A.java', 'class A {}')
    const remotes = { javaLsp, tsLsp }
    function App({ tabs }: { tabs: WorkbenchTab[] }) {
      return (
        <EditorLspSync
          tabs={tabs}
          getRemotes={() => remotes}
          getWorkspaceRoot={() => '/ws'}
          readFile={async () => 'disk'}
          files={files}
        />
      )
    }
    const { rerender } = render(<App tabs={[tab('/A.java'), tab('/b.ts'), tab('/readme.md')]} />)
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.open).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/A.java', text: 'class A {}' })
    expect(tsLsp.open).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/b.ts', text: 'disk' })
    rerender(<App tabs={[tab('/A.java')]} />)
    await act(async () => { await Promise.resolve() })
    expect(tsLsp.close).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/b.ts' })
  })

  it('retries when the Remote appears late and ignores a throwing root', async () => {
    vi.useFakeTimers()
    const javaLsp = remote()
    let remotes: { javaLsp?: ReturnType<typeof remote> } = {}
    const listeners = new Set<() => void>()
    render(
      <EditorLspSync
        tabs={[tab('/Foo.java')]}
        getRemotes={() => remotes}
        getWorkspaceRoot={() => '/ws'}
        watchWorkspace={(fn) => {
          listeners.add(fn)
          return () => { listeners.delete(fn) }
        }}
        readFile={async () => { throw new Error('read') }}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.open).not.toHaveBeenCalled()
    remotes = { javaLsp }
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(javaLsp.open).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/Foo.java', text: '' })
    act(() => { for (const fn of listeners) fn() })
    cleanup()
    render(
      <EditorLspSync
        tabs={[tab('/Bar.java')]}
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => { throw new Error('cwd') }}
        readFile={async () => 'x'}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.open).not.toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/Bar.java', text: 'x' })
    remotes = {}
    cleanup()
    render(
      <EditorLspSync
        tabs={[tab('/Foo.java')]}
        getRemotes={() => remotes}
        getWorkspaceRoot={() => '/ws'}
      />,
    )
    await act(async () => { vi.advanceTimersByTime(20_000) })
  })

  it('is a no-op without remotes and closes on unmount', async () => {
    const javaLsp = remote()
    const { unmount } = render(
      <EditorLspSync
        tabs={[tab('/Foo.java'), tab('/x', 'demo')]}
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        readFile={async () => 'class Foo {}'}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.open).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/Foo.java', text: 'class Foo {}' })
    javaLsp.close.mockRejectedValueOnce(new Error('gone'))
    unmount()
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.close).toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/Foo.java' })
    render(<EditorLspSync tabs={[tab('/Foo.java')]} />)
    await act(async () => { await Promise.resolve() })
    expect(javaLsp.open).toHaveBeenCalledTimes(1)
  })

  it('drops an in-flight open and swallows a failed open', async () => {
    const javaLsp = remote()
    javaLsp.open.mockRejectedValueOnce(new Error('jdt'))
    let finishRead: ((text: string) => void) | undefined
    const { rerender, unmount } = render(
      <EditorLspSync
        tabs={[tab('/Slow.java'), tab('/Fail.java')]}
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        readFile={path => path === '/Slow.java'
          ? new Promise<string>((resolve) => { finishRead = resolve })
          : Promise.resolve('class Fail {}')}
      />,
    )
    await act(async () => { await Promise.resolve() })
    rerender(
      <EditorLspSync
        tabs={[tab('/Fail.java')]}
        getRemotes={() => ({ javaLsp })}
        getWorkspaceRoot={() => '/ws'}
        readFile={async () => 'class Fail {}'}
      />,
    )
    await act(async () => { finishRead?.('late'); await Promise.resolve() })
    expect(javaLsp.open).not.toHaveBeenCalledWith({ workspaceRoot: '/ws', path: '/Slow.java', text: 'late' })
    unmount()
  })
})
