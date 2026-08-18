// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { darkTheme, lspFailNote, MonacoHost } from '../src/client/MonacoHost.tsx'
import {
  WORKBENCH_EDITOR_ACTION_EVENT, WORKBENCH_FIND_EVENT, WORKBENCH_REPLACE_EVENT,
} from '../src/client/app-menu-dispatch.ts'
import { requestReveal } from '../src/client/editor-nav.ts'
import { markLanguageWarmingKey, resetLanguageWarmth } from '../src/client/editor-lsp.ts'

const { contentFns, mouseFns, existing, editor, monaco, loadImpl } = vi.hoisted(() => {
  const contentFns: Array<() => void> = []
  const mouseFns: Array<(event: {
    event: { leftButton: boolean; ctrlKey: boolean; metaKey: boolean }
  }) => void> = []
  const existing = {
    getValue: () => 'old',
    setValue: vi.fn(),
    dispose: vi.fn(),
    onDidChangeContent: (fn: () => void) => {
      contentFns.push(fn)
      return { dispose: vi.fn() }
    },
  }
  const model = {
    dispose: vi.fn(),
    onDidChangeContent: (fn: () => void) => {
      contentFns.push(fn)
      return { dispose: vi.fn() }
    },
    getValue: () => 'next',
  }
  const editor = {
    dispose: vi.fn(),
    addCommand: vi.fn(),
    focus: vi.fn(),
    layout: vi.fn(),
    setPosition: vi.fn(),
    setSelection: vi.fn(),
    revealPositionInCenter: vi.fn(),
    revealRangeInCenter: vi.fn(),
    getAction: vi.fn((_id?: string): { run: ReturnType<typeof vi.fn> } | undefined => ({ run: vi.fn() })),
    onMouseDown: vi.fn((fn: (event: {
      event: { leftButton: boolean; ctrlKey: boolean; metaKey: boolean }
    }) => void) => {
      mouseFns.push(fn)
      return { dispose: vi.fn() }
    }),
  }
  const monaco = {
    Uri: { file: (path: string) => ({ path, toString: () => `file://${path}` }) },
    editor: {
      getModel: vi.fn(() => null as typeof existing | null),
      createModel: vi.fn(() => model),
      setModelLanguage: vi.fn(),
      create: vi.fn(() => editor),
      setTheme: vi.fn(),
      setModelMarkers: vi.fn(),
      registerEditorOpener: vi.fn(() => ({ dispose: vi.fn() })),
    },
    languages: {
      CompletionItemKind: { Text: 1 },
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerDefinitionProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerReferenceProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerImplementationProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2, F12: 12 },
  }
  return {
    contentFns, mouseFns, existing, model, editor, monaco,
    loadImpl: { current: () => Promise.resolve(monaco) },
  }
})

vi.mock('../src/client/monaco-loader.ts', () => ({
  loadMonaco: () => loadImpl.current(),
}))

vi.mock('../src/client/monaco-highlight.ts', () => ({
  EDITOR_DARK_THEME: 'one-dark-pro',
  EDITOR_LIGHT_THEME: 'min-light',
  prepareMonacoHighlight: async () => 'typescript',
}))

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  resetLanguageWarmth()
  cleanup()
  contentFns.length = 0
  mouseFns.length = 0
  document.body.removeAttribute('data-ds-dark-theme')
  monaco.editor.getModel.mockReturnValue(null)
  monaco.editor.create.mockReset()
  monaco.editor.create.mockImplementation(() => editor)
  monaco.editor.registerEditorOpener.mockClear()
  monaco.languages.registerCompletionItemProvider.mockClear()
  monaco.languages.registerDefinitionProvider.mockClear()
  monaco.languages.registerHoverProvider.mockClear()
  monaco.languages.registerReferenceProvider.mockClear()
  monaco.languages.registerImplementationProvider.mockClear()
  editor.getAction.mockClear()
  editor.layout.mockClear()
  editor.setPosition.mockClear()
  editor.setSelection.mockClear()
  editor.revealPositionInCenter.mockClear()
  editor.revealRangeInCenter.mockClear()
  loadImpl.current = () => Promise.resolve(monaco)
  vi.unstubAllGlobals()
})

describe('darkTheme', () => {
  it('reads the body attribute', () => {
    expect(darkTheme()).toBe(false)
    document.body.setAttribute('data-ds-dark-theme', '')
    expect(darkTheme()).toBe(true)
  })
})

describe('MonacoHost', () => {
  it('keeps the generic LSP failure note and appends the host error', () => {
    expect(lspFailNote(undefined, new Error('x'))).toBeNull()
    expect(lspFailNote('', new Error('x'))).toBeNull()
    expect(lspFailNote('失败', new Error(''))).toBe('失败')
    expect(lspFailNote('失败', 'boom')).toBe('失败（boom）')
    expect(lspFailNote('失败', 1)).toBe('失败')
  })

  it('boots, reports edits and save, and follows the theme', async () => {
    document.body.setAttribute('data-ds-dark-theme', '')
    const onChange = vi.fn()
    const onSave = vi.fn()
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/a.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={onChange}
        onSave={onSave}
      />,
    )
    expect(screen.getByText('加载内核')).toBeTruthy()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(monaco.editor.create).toHaveBeenCalled()
    const createArgs = monaco.editor.create.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
    expect(createArgs[1]).toMatchObject({
      theme: 'one-dark-pro',
      automaticLayout: false,
      fixedOverflowWidgets: true,
      links: false,
    })
    contentFns[0]?.()
    expect(onChange).toHaveBeenCalledWith('next')
    const save = editor.addCommand.mock.calls[0]?.[1] as (() => void) | undefined
    save?.()
    expect(onSave).toHaveBeenCalled()
    document.body.removeAttribute('data-ds-dark-theme')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    document.body.setAttribute('data-ds-dark-theme', '')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(monaco.editor.setTheme).toHaveBeenCalled()
  })

  it('reuses an existing model, skips equal values, and surfaces a boot error', async () => {
    monaco.editor.getModel.mockReturnValue(existing)
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/a.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(existing.setValue).toHaveBeenCalledWith('hello')
    cleanup()
    existing.getValue = () => 'hello'
    monaco.editor.getModel.mockReturnValue(existing)
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/b.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    cleanup()
    loadImpl.current = () => Promise.reject(new Error('boot'))
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/c.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('内核失败')).toBeTruthy()
    cleanup()
    let settle: (value: typeof monaco) => void = () => {}
    loadImpl.current = () => new Promise((resolve) => { settle = resolve })
    const pending = render(
      <MonacoHost
        initialValue="hello"
        filePath="/d.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    pending.unmount()
    await act(async () => { settle(monaco); await Promise.resolve(); await Promise.resolve() })
    cleanup()
    let fail: (error: Error) => void = () => {}
    loadImpl.current = () => new Promise((_, reject) => { fail = reject })
    const dying = render(
      <MonacoHost
        initialValue="hello"
        filePath="/e.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    dying.unmount()
    await act(async () => { fail(new Error('late')); await Promise.resolve() })
  })

  it('stays off the ready face when editor.create throws', async () => {
    monaco.editor.create.mockImplementationOnce(() => {
      throw new Error('create')
    })
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/f.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-monaco').getAttribute('data-ready')).toBeNull()
    expect(screen.getByText('内核失败')).toBeTruthy()
  })

  it('opens a Vue buffer, paints diagnostics, and completes', async () => {
    vi.useFakeTimers()
    const languageClient = {
      open: vi.fn(async () => {}),
      change: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      complete: vi.fn(async () => [{ label: 'div', detail: 'tag' }, { label: 'span', insertText: 'span', kind: 1 }]),
      definition: vi.fn(async () => [
        { uri: 'file:///ws/Other.vue', startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 4 },
        { uri: 'jdt://contents/Foo.class', startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
      ]),
      hover: vi.fn(async (): Promise<{
        contents: string
        startLine?: number
        startCharacter?: number
        endLine?: number
        endCharacter?: number
      } | undefined> => ({ contents: 'doc', startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 3 })),
      references: vi.fn(async () => [
        { uri: 'file:///ws/Other.vue', startLine: 4, startCharacter: 1, endLine: 4, endCharacter: 5 },
      ]),
      implementation: vi.fn(async () => [
        { uri: 'file:///ws/Impl.vue', startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 4 },
      ]),
      diagnostics: vi.fn(async () => [{
        message: 'oops',
        severity: 1,
        source: 'vue',
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 3,
      }, {
        message: 'warn',
        severity: 2,
        startLine: 1,
        startCharacter: 0,
        endLine: 1,
        endCharacter: 1,
      }, {
        message: 'info',
        severity: 3,
        startLine: 2,
        startCharacter: 0,
        endLine: 2,
        endCharacter: 1,
      }, {
        message: 'hint',
        severity: 4,
        startLine: 3,
        startCharacter: 0,
        endLine: 3,
        endCharacter: 1,
      }]),
    }
    render(
      <MonacoHost
        initialValue="<template />"
        filePath="/a.vue"
        labels={{ loading: '加载内核', error: '内核失败', noSource: '没有源码' }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(languageClient.open).toHaveBeenCalledWith('/a.vue', 'next')
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalled()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(monaco.editor.setModelMarkers).toHaveBeenCalled()
    languageClient.diagnostics.mockRejectedValueOnce(new Error('diag'))
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve(); await Promise.resolve() })
    contentFns[1]?.()
    contentFns[1]?.()
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); await Promise.resolve() })
    expect(languageClient.change).toHaveBeenCalled()
    const firstCall = monaco.languages.registerCompletionItemProvider.mock.calls[0] as unknown as [
      string,
      { provideCompletionItems: (model: unknown, position: { lineNumber: number; column: number }) => Promise<{ suggestions: unknown[] }> },
    ]
    const provide = firstCall[1]
    const suggestions = await provide.provideCompletionItems({}, { lineNumber: 1, column: 2 })
    expect(suggestions.suggestions).toHaveLength(2)
    languageClient.complete.mockRejectedValueOnce(new Error('nope'))
    expect(await provide.provideCompletionItems({}, { lineNumber: 1, column: 2 })).toEqual({ suggestions: [] })
    const definitionCall = monaco.languages.registerDefinitionProvider.mock.calls[0] as unknown as [
      string,
      { provideDefinition: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown[]> },
    ]
    const definition = definitionCall[1]
    const defs = await definition.provideDefinition({}, { lineNumber: 1, column: 2 })
    expect(defs).toHaveLength(1)
    languageClient.definition.mockResolvedValueOnce([
      { uri: 'jdt://contents/Foo.class', startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
    ])
    await act(async () => {
      await definition.provideDefinition({}, { lineNumber: 1, column: 2 })
    })
    expect(screen.getByTestId('xmart-workbench-nav-note').textContent).toBe('没有源码')
    languageClient.definition.mockRejectedValueOnce(new Error('nope'))
    expect(await definition.provideDefinition({}, { lineNumber: 1, column: 2 })).toEqual([])
    const hoverCall = monaco.languages.registerHoverProvider.mock.calls[0] as unknown as [
      string,
      { provideHover: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown> },
    ]
    const hover = hoverCall[1]
    expect(await hover.provideHover({}, { lineNumber: 1, column: 2 })).toMatchObject({
      contents: [{ value: 'doc' }],
    })
    languageClient.hover.mockResolvedValueOnce(undefined)
    expect(await hover.provideHover({}, { lineNumber: 1, column: 3 })).toBeNull()
    languageClient.hover.mockResolvedValueOnce({ contents: 'plain' })
    expect(await hover.provideHover({}, { lineNumber: 1, column: 4 })).toEqual({
      contents: [{ value: 'plain' }],
    })
    languageClient.hover.mockRejectedValueOnce(new Error('nope'))
    expect(await hover.provideHover({}, { lineNumber: 1, column: 5 })).toBeNull()
    const refsCall = monaco.languages.registerReferenceProvider.mock.calls[0] as unknown as [
      string,
      { provideReferences: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown[]> },
    ]
    const refs = refsCall[1]
    expect(await refs.provideReferences({}, { lineNumber: 1, column: 2 })).toHaveLength(1)
    languageClient.references.mockRejectedValueOnce(new Error('nope'))
    expect(await refs.provideReferences({}, { lineNumber: 1, column: 2 })).toEqual([])
    const implCall = monaco.languages.registerImplementationProvider.mock.calls[0] as unknown as [
      string,
      { provideImplementation: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown[]> },
    ]
    const impl = implCall[1]
    expect(await impl.provideImplementation({}, { lineNumber: 1, column: 2 })).toHaveLength(1)
    languageClient.implementation.mockRejectedValueOnce(new Error('nope'))
    expect(await impl.provideImplementation({}, { lineNumber: 1, column: 2 })).toEqual([])
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve() })
    cleanup()
    expect(languageClient.close).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shows language-server start and failure notes', async () => {
    let settleOpen: (() => void) | undefined
    const languageClient = {
      open: vi.fn(() => new Promise<void>((resolve) => { settleOpen = resolve })),
      change: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      complete: vi.fn(async () => []),
      definition: vi.fn(async () => []),
      hover: vi.fn(async () => undefined),
      references: vi.fn(async () => []),
      implementation: vi.fn(async () => []),
      diagnostics: vi.fn(async () => []),
    }
    render(
      <MonacoHost
        initialValue="class Foo {}"
        filePath="/Foo.java"
        labels={{
          loading: '加载内核',
          error: '内核失败',
          lspStarting: '正在启动语言服务',
          lspFailed: '语言服务没起来',
        }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-nav-note').textContent).toBe('正在启动语言服务')
    await act(async () => { settleOpen?.(); await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-workbench-nav-note')).toBeNull()
    cleanup()
    languageClient.open.mockImplementation(async () => {})
    render(
      <MonacoHost
        initialValue="class Bar {}"
        filePath="/Other.java"
        labels={{
          loading: '加载内核',
          error: '内核失败',
          lspStarting: '正在启动语言服务',
          lspFailed: '语言服务没起来',
        }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-workbench-nav-note')).toBeNull()
    cleanup()
    languageClient.open.mockRejectedValueOnce(new Error('jdt'))
    render(
      <MonacoHost
        initialValue="class Foo {}"
        filePath="/Bar.java"
        labels={{
          loading: '加载内核',
          error: '内核失败',
          lspStarting: '',
          lspFailed: '语言服务没起来',
        }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTestId('xmart-workbench-nav-note').textContent).toBe('语言服务没起来（jdt）')
    cleanup()
    languageClient.open.mockRejectedValueOnce(new Error('jdt'))
    render(
      <MonacoHost
        initialValue="class Foo {}"
        filePath="/Baz.java"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-workbench-nav-note')).toBeNull()
  })

  it('hides the starting note while a project warmup is in flight', async () => {
    markLanguageWarmingKey('java')
    const languageClient = {
      open: vi.fn(() => new Promise<void>(() => {})),
      change: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      complete: vi.fn(async () => []),
      definition: vi.fn(async () => []),
      hover: vi.fn(async () => undefined),
      references: vi.fn(async () => []),
      implementation: vi.fn(async () => []),
      diagnostics: vi.fn(async () => []),
    }
    render(
      <MonacoHost
        initialValue="class Foo {}"
        filePath="/Warm.java"
        labels={{
          loading: '加载内核',
          error: '内核失败',
          lspStarting: '正在启动语言服务',
        }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('xmart-workbench-nav-note')).toBeNull()
  })

  it('reveals a pending location, runs find/replace, and opens another file', async () => {
    requestReveal('/a.ts', { line: 9, character: 2, end: 6 })
    const onOpenFile = vi.fn()
    const findRun = vi.fn()
    editor.getAction.mockImplementation((_id?: string) => ({
      run: _id === 'actions.find' ? findRun : vi.fn(),
    }))
    const languageClient = {
      open: vi.fn(async () => {}),
      change: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      complete: vi.fn(async () => []),
      definition: vi.fn(async (): Promise<Array<{
        uri: string
        startLine: number
        startCharacter: number
        endLine: number
        endCharacter: number
      }>> => []),
      hover: vi.fn(async (): Promise<{ contents: string } | undefined> => undefined),
      references: vi.fn(async () => []),
      implementation: vi.fn(async () => []),
      diagnostics: vi.fn(async () => []),
    }
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/a.ts"
        labels={{ loading: '加载内核', error: '内核失败', noSource: '没有源码' }}
        onChange={() => {}}
        onSave={() => {}}
        onOpenFile={onOpenFile}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(editor.setSelection).toHaveBeenCalledWith({
      startLineNumber: 10, startColumn: 3, endLineNumber: 10, endColumn: 7,
    })
    expect(editor.revealRangeInCenter).toHaveBeenCalled()
    requestReveal('/a.ts', { line: 1, character: 0 })
    await act(async () => { await Promise.resolve() })
    expect(editor.setSelection).toHaveBeenCalledWith({
      startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1,
    })
    const gotoRun = vi.fn()
    editor.getAction.mockImplementation((_id?: string) => ({
      run: _id === 'actions.find' ? findRun : _id === 'editor.action.gotoLine' ? gotoRun : vi.fn(),
    }))
    await act(async () => {
      window.dispatchEvent(new Event(WORKBENCH_FIND_EVENT))
      window.dispatchEvent(new Event(WORKBENCH_REPLACE_EVENT))
      window.dispatchEvent(new CustomEvent(WORKBENCH_EDITOR_ACTION_EVENT, { detail: 'editor.action.gotoLine' }))
      window.dispatchEvent(new Event(WORKBENCH_EDITOR_ACTION_EVENT))
      window.dispatchEvent(new CustomEvent(WORKBENCH_EDITOR_ACTION_EVENT, { detail: 1 }))
      window.dispatchEvent(new CustomEvent(WORKBENCH_EDITOR_ACTION_EVENT, { detail: '' }))
    })
    expect(findRun).toHaveBeenCalled()
    expect(gotoRun).toHaveBeenCalled()
    mouseFns[0]?.({ event: { leftButton: false, ctrlKey: true, metaKey: false } })
    mouseFns[0]?.({ event: { leftButton: true, ctrlKey: false, metaKey: false } })
    const revealRun = vi.fn()
    editor.getAction.mockImplementation((_id?: string) => ({
      run: _id === 'editor.action.revealDefinition' ? revealRun : vi.fn(),
    }))
    mouseFns[0]?.({ event: { leftButton: true, ctrlKey: true, metaKey: false } })
    mouseFns[0]?.({ event: { leftButton: true, ctrlKey: false, metaKey: true } })
    expect(revealRun).toHaveBeenCalledTimes(2)
    const implCmd = editor.addCommand.mock.calls.find(call => call[0] === (monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12))
    const implRun = vi.fn()
    editor.getAction.mockImplementation((_id?: string) => ({
      run: _id === 'editor.action.goToImplementation' ? implRun : vi.fn(),
    }))
    ;(implCmd?.[1] as (() => void) | undefined)?.()
    expect(implRun).toHaveBeenCalled()
    const openerCall = monaco.editor.registerEditorOpener.mock.calls[0] as unknown as [{
      openCodeEditor: (
        source: unknown,
        resource: { toString?: () => string; path?: string },
        selection?: { startLineNumber: number; startColumn: number } | { lineNumber: number; column: number },
      ) => boolean
    }]
    const opener = openerCall[0]
    expect(opener.openCodeEditor({}, { toString: () => 'file:///ws/b.ts' }, { startLineNumber: 4, startColumn: 2 })).toBe(true)
    expect(onOpenFile).toHaveBeenCalledWith('/ws/b.ts')
    expect(opener.openCodeEditor({}, { toString: () => 'file:///ws/d.ts' }, { lineNumber: 8, column: 5 })).toBe(true)
    expect(onOpenFile).toHaveBeenCalledWith('/ws/d.ts')
    expect(opener.openCodeEditor({}, { toString: () => 'file:///a.ts' })).toBe(false)
    expect(opener.openCodeEditor({}, { toString: () => 'jdt://x' })).toBe(true)
    expect(opener.openCodeEditor({}, { path: '/D:/work/Foo.java' })).toBe(true)
    expect(onOpenFile).toHaveBeenCalledWith('D:\\work\\Foo.java')
    expect(opener.openCodeEditor({}, { path: '/ws/c.ts' })).toBe(true)
    expect(opener.openCodeEditor({}, Object.create(null) as { toString?: () => string })).toBe(true)
    expect(opener.openCodeEditor({}, { toString: () => 1 as unknown as string })).toBe(true)
    editor.getAction.mockReturnValue(undefined)
    await act(async () => { window.dispatchEvent(new Event(WORKBENCH_FIND_EVENT)) })
    cleanup()
    monaco.languages.registerDefinitionProvider.mockClear()
    languageClient.definition.mockResolvedValueOnce([
      { uri: 'jdt://contents/Foo.class', startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1 },
    ])
    render(
      <MonacoHost
        initialValue="hello"
        filePath="/b.ts"
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    const laterDefinition = monaco.languages.registerDefinitionProvider.mock.calls[0] as unknown as [
      string,
      { provideDefinition: (model: unknown, position: { lineNumber: number; column: number }) => Promise<unknown[]> },
    ]
    const definition = laterDefinition[1]
    await act(async () => {
      await definition.provideDefinition({}, { lineNumber: 1, column: 1 })
    })
    expect(screen.queryByTestId('xmart-workbench-nav-note')).toBeNull()
  })
})
