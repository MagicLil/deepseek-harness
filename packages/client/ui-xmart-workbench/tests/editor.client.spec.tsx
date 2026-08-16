// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FileAccessError } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { EditorTab } from '../src/client/EditorTab.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { zh } from '../src/client/locales.ts'

const lastHost = vi.hoisted(() => ({
  languageClient: undefined as unknown,
  throwOnRender: false,
}))

vi.mock('../src/client/MonacoHost.tsx', () => ({
  MonacoHost: ({ onChange, onSave, languageClient }: {
    onChange: (text: string) => void
    onSave: () => void
    languageClient?: unknown
  }) => {
    if (lastHost.throwOnRender) throw new Error('monaco render')
    lastHost.languageClient = languageClient
    return (
      <div>
        <button type="button" onClick={() => { onChange('edited') }}>edit-buffer</button>
        <button type="button" onClick={() => { onChange('hello') }}>reset-buffer</button>
        <button type="button" onClick={() => { onSave() }}>save-hotkey</button>
      </div>
    )
  },
}))

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  localStorage.clear()
  lastHost.languageClient = undefined
  lastHost.throwOnRender = false
  vi.useRealTimers()
  cleanup()
})

const t = makeTranslate(zh, commonZh)

function rpc(code: string) {
  return new FileAccessError({ code, message: code } as never)
}

function mount(opts?: {
  path?: string
  readFile?: (path: string) => Promise<string>
  writeFile?: (path: string, content: string) => Promise<void>
  files?: ReturnType<typeof createWorkbenchFilesStore>
}) {
  const files = opts?.files ?? createWorkbenchFilesStore()
  const readFile = opts?.readFile ?? vi.fn(async () => 'hello')
  const writeFile = opts?.writeFile ?? vi.fn(async () => {})
  const path = opts?.path
  render(
    <EditorTab
      tab={{ id: 'ed', type: 'editor', title: 'a.ts', ...(path === undefined ? {} : { path }) }}
      visible
      sessionId="s1"
      t={t}
      readFile={readFile}
      writeFile={writeFile}
      files={files}
    />,
  )
  return { files, readFile, writeFile }
}

describe('EditorTab', () => {
  it('shows the no-path copy', () => {
    mount()
    expect(screen.getByText('这个标签没有文件路径。')).toBeTruthy()
    cleanup()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'empty' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => ''}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        getRemotes={() => ({})}
      />,
    )
    expect(screen.getByText('这个标签没有文件路径。')).toBeTruthy()
  })

  it('loads, marks dirty, saves, and restores a draft', async () => {
    const files = createWorkbenchFilesStore()
    files.setDraft('/a.ts', 'draft')
    const writeFile = vi.fn(async () => {})
    mount({ path: '/a.ts', files, writeFile })
    expect(screen.getByText('正在打开…')).toBeTruthy()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('未保存')).toBeTruthy()
    fireEvent.click(screen.getByText('保存'))
    await act(async () => { await Promise.resolve() })
    expect(writeFile).toHaveBeenCalledWith('/a.ts', 'draft')
    expect(screen.getByText('已保存')).toBeTruthy()
    cleanup()
    const live = createWorkbenchFilesStore()
    const write = vi.fn(async () => {})
    mount({ path: '/a.ts', files: live, writeFile: write, readFile: async () => 'hello' })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('保存'))
    fireEvent.click(screen.getByText('edit-buffer'))
    expect(screen.getByText('未保存')).toBeTruthy()
    fireEvent.click(screen.getByText('save-hotkey'))
    await act(async () => { await Promise.resolve() })
    expect(write).toHaveBeenCalledWith('/a.ts', 'edited')
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 520) }) })
    expect(live.draftOf('/a.ts')).toBeUndefined()
  })

  it('saves from the application-menu event', async () => {
    const writeFile = vi.fn(async () => {})
    mount({ path: '/a.ts', writeFile })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('edit-buffer'))
    act(() => { window.dispatchEvent(new Event('dsh:workbench-save')) })
    await act(async () => { await Promise.resolve() })
    expect(writeFile).toHaveBeenCalledWith('/a.ts', 'edited')
  })

  it('maps read errors and save errors', async () => {
    mount({ path: '/a.bin', readFile: async () => { throw rpc('file-binary') } })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('二进制文件不支持在编辑器中打开')).toBeTruthy()
    cleanup()
    mount({ path: '/big.ts', readFile: async () => { throw rpc('file-too-large') } })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('文件过大，无法在编辑器中打开')).toBeTruthy()
    cleanup()
    mount({ path: '/a.ts', readFile: async () => { throw rpc('file-missing') } })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('文件读取失败')).toBeTruthy()
    cleanup()
    mount({ path: '/a.ts', readFile: async () => { throw new Error('plain') } })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('文件读取失败')).toBeTruthy()
    cleanup()
    const writeFile = vi.fn(async () => { throw new Error('no') })
    const files = createWorkbenchFilesStore()
    files.setDraft('/a.ts', 'x')
    mount({ path: '/a.ts', files, writeFile, readFile: async () => 'hello' })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('保存'))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('保存失败')).toBeTruthy()
  })

  it('closes markdown split when the split button is clicked again', async () => {
    mount({ path: '/a.md', readFile: async () => '# hi' })
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-md-preview')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-plain')).toBeTruthy()
    fireEvent.click(screen.getByText('分栏'))
    expect(screen.queryByTestId('xmart-workbench-md-preview')).toBeNull()
    expect(screen.getByTestId('xmart-workbench-plain')).toBeTruthy()
    fireEvent.click(screen.getByText('分栏'))
    expect(screen.getByTestId('xmart-workbench-md-preview')).toBeTruthy()
  })

  it('toggles markdown preview modes and the reload banner', async () => {
    const files = createWorkbenchFilesStore()
    mount({ path: '/a.md', files, readFile: async () => '# hi' })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('编辑'))
    fireEvent.click(screen.getByText('预览'))
    expect(screen.getByTestId('xmart-workbench-md-preview')).toBeTruthy()
    fireEvent.click(screen.getByText('分栏'))
    act(() => { files.markReload(['/a.md']) })
    expect(screen.getByTestId('xmart-workbench-reload')).toBeTruthy()
    fireEvent.click(screen.getByText('忽略'))
    expect(screen.queryByTestId('xmart-workbench-reload')).toBeNull()
    act(() => { files.markReload(['/a.md']) })
    fireEvent.click(screen.getByText('重新加载'))
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByTestId('xmart-workbench-reload')).toBeNull()
    cleanup()
    const failing = vi.fn()
      .mockResolvedValueOnce('# hi')
      .mockRejectedValueOnce(new Error('gone'))
    const files2 = createWorkbenchFilesStore()
    mount({ path: '/b.md', files: files2, readFile: failing })
    await act(async () => { await Promise.resolve() })
    act(() => { files2.markReload(['/b.md']) })
    fireEvent.click(screen.getByText('重新加载'))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('文件读取失败')).toBeTruthy()
  })

  it('flushes a dirty draft on unmount', async () => {
    const files = createWorkbenchFilesStore()
    files.setDraft('/a.ts', 'keep')
    const view = render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'hello'}
        writeFile={async () => {}}
        files={files}
      />,
    )
    await act(async () => { await Promise.resolve() })
    view.unmount()
    expect(files.draftOf('/a.ts')).toBe('keep')
    cleanup()
    const timed = createWorkbenchFilesStore()
    const editing = render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'hello'}
        writeFile={async () => {}}
        files={timed}
      />,
    )
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('edit-buffer'))
    editing.unmount()
    expect(timed.draftOf('/a.ts')).toBe('edited')
  })

  it('aborts an in-flight read, stores a draft, and ignores reloads without a path', async () => {
    const files = createWorkbenchFilesStore()
    let settle: (value: string) => void = () => {}
    const pending = render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={() => new Promise((resolve) => { settle = resolve })}
        writeFile={async () => {}}
        files={files}
      />,
    )
    pending.unmount()
    await act(async () => { settle('late'); await Promise.resolve() })
    cleanup()
    let fail: (reason: unknown) => void = () => {}
    const dying = render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={() => new Promise((_, reject) => { fail = reject })}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
    mount({ path: '/a.ts', files, readFile: async () => 'hello' })
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByText('edit-buffer'))
    fireEvent.click(screen.getByText('edit-buffer'))
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 520) }) })
    expect(files.draftOf('/a.ts')).toBe('edited')
    fireEvent.click(screen.getByText('reset-buffer'))
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 520) }) })
    expect(files.draftOf('/a.ts')).toBeUndefined()
    cleanup()
    const idle = createWorkbenchFilesStore()
    mount({ files: idle })
    act(() => { idle.markReload(['/nope']) })
    expect(screen.getByText('这个标签没有文件路径。')).toBeTruthy()
  })

  it('binds a language client for the Remote that owns the extension', async () => {
    const vueLsp = {
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
    const tsLsp = { ...vueLsp }
    const javaLsp = { ...vueLsp }
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'A.vue', path: '/A.vue' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => '<template />'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        vueLsp={vueLsp}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(lastHost.languageClient).toBeDefined()
    cleanup()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'x'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        vueLsp={vueLsp}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(lastHost.languageClient).toBeUndefined()
    cleanup()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.ts', path: '/a.ts' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'x'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        tsLsp={tsLsp}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(lastHost.languageClient).toBeDefined()
    cleanup()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'Foo.java', path: '/Foo.java' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'class Foo {}'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        javaLsp={javaLsp}
        openFile={() => {}}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(lastHost.languageClient).toBeDefined()
  })

  it('picks up a late Remote and a late workspace root', async () => {
    vi.useFakeTimers()
    const javaLsp = {
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
    let remotes: { javaLsp?: typeof javaLsp } = {}
    const late = { root: undefined as string | undefined }
    const listeners = new Set<() => void>()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'Foo.java', path: '/Foo.java' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'class Foo {}'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        getWorkspaceRoot={() => late.root}
        watchWorkspace={(fn) => {
          listeners.add(fn)
          return () => { listeners.delete(fn) }
        }}
        getRemotes={() => remotes}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('语言服务还没对上工作区。侧栏能看见文件夹时，点一下文件或等会话 cwd 就绪')).toBeTruthy()
    expect(lastHost.languageClient).toBeUndefined()
    remotes = { javaLsp }
    late.root = '/ws'
    act(() => { for (const fn of listeners) fn() })
    await act(async () => { await Promise.resolve() })
    expect(lastHost.languageClient).toBeDefined()
    cleanup()
    remotes = {}
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'Foo.java', path: '/Foo.java' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'class Foo {}'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        getRemotes={() => remotes}
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('语言服务通道还没连上，请稍等几秒；一直这样就重启桌面端')).toBeTruthy()
    remotes = { javaLsp }
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(lastHost.languageClient).toBeDefined()
    cleanup()
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'a.md', path: '/a.md' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => '# hi'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
      />,
    )
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('这个文件类型还没有语言服务（目前支持 Java / TS / JS / Vue）')).toBeTruthy()
    cleanup()
    remotes = {}
    render(
      <EditorTab
        tab={{ id: 'ed', type: 'editor', title: 'Foo.java', path: '/Foo.java' }}
        visible
        sessionId="s1"
        t={t}
        readFile={async () => 'class Foo {}'}
        writeFile={async () => {}}
        files={createWorkbenchFilesStore()}
        workspaceRoot="/ws"
        getRemotes={() => remotes}
      />,
    )
    await act(async () => { vi.advanceTimersByTime(20_000) })
    vi.useRealTimers()
  })

  it('keeps the file text when Monaco throws on render', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    lastHost.throwOnRender = true
    const writeFile = vi.fn(async () => {})
    mount({ path: '/UserController.java', writeFile, readFile: async () => 'class User {}' })
    await act(async () => { await Promise.resolve() })
    const plain = screen.getByTestId('xmart-workbench-plain') as HTMLTextAreaElement
    expect(plain.value).toBe('class User {}')
    fireEvent.change(plain, { target: { value: 'class User { }' } })
    expect(screen.getByText('未保存')).toBeTruthy()
    fireEvent.click(screen.getByText('保存'))
    await act(async () => { await Promise.resolve() })
    expect(writeFile).toHaveBeenCalledWith('/UserController.java', 'class User { }')
    spy.mockRestore()
  })

  it('opens an empty buffer when the host does not return text', async () => {
    mount({ path: '/a.ts', readFile: async () => ({ raw: true } as unknown as string) })
    await act(async () => { await Promise.resolve() })
    expect((screen.getByTestId('xmart-workbench-plain') as HTMLTextAreaElement).value).toBe('')
  })

  it('opens the file when reloadToken throws', async () => {
    const files = createWorkbenchFilesStore()
    vi.spyOn(files, 'reloadToken').mockImplementation(() => { throw new Error('token') })
    mount({ path: '/a.ts', files, readFile: async () => 'hello' })
    await act(async () => { await Promise.resolve() })
    expect((screen.getByTestId('xmart-workbench-plain') as HTMLTextAreaElement).value).toBe('hello')
    act(() => { files.markReload(['/a.ts']) })
    expect(screen.queryByTestId('xmart-workbench-reload')).toBeNull()
  })
})
