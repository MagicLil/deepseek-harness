// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { darkTheme, MonacoHost } from '../src/client/MonacoHost.tsx'

const { contentFns, existing, editor, monaco, loadImpl } = vi.hoisted(() => {
  const contentFns: Array<() => void> = []
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
  const editor = { dispose: vi.fn(), addCommand: vi.fn(), focus: vi.fn() }
  const monaco = {
    Uri: { file: (path: string) => ({ path }) },
    editor: {
      getModel: vi.fn(() => null as typeof existing | null),
      createModel: vi.fn(() => model),
      setModelLanguage: vi.fn(),
      create: vi.fn(() => editor),
      setTheme: vi.fn(),
      setModelMarkers: vi.fn(),
    },
    languages: {
      CompletionItemKind: { Text: 1 },
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 2 },
  }
  return {
    contentFns, existing, model, editor, monaco,
    loadImpl: { current: () => Promise.resolve(monaco) },
  }
})

vi.mock('../src/client/monaco-loader.ts', () => ({
  loadMonaco: () => loadImpl.current(),
}))

afterEach(() => {
  cleanup()
  contentFns.length = 0
  document.body.removeAttribute('data-ds-dark-theme')
  monaco.editor.getModel.mockReturnValue(null)
  monaco.editor.create.mockReset()
  monaco.editor.create.mockImplementation(() => editor)
  loadImpl.current = () => Promise.resolve(monaco)
})

describe('darkTheme', () => {
  it('reads the body attribute', () => {
    expect(darkTheme()).toBe(false)
    document.body.setAttribute('data-ds-dark-theme', '')
    expect(darkTheme()).toBe(true)
  })
})

describe('MonacoHost', () => {
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
    await act(async () => { await Promise.resolve() })
    expect(monaco.editor.create).toHaveBeenCalled()
    contentFns[0]?.()
    expect(onChange).toHaveBeenCalledWith('next')
    const save = editor.addCommand.mock.calls[0]?.[1] as (() => void) | undefined
    save?.()
    expect(onSave).toHaveBeenCalled()
    document.body.removeAttribute('data-ds-dark-theme')
    await act(async () => { await Promise.resolve() })
    document.body.setAttribute('data-ds-dark-theme', '')
    await act(async () => { await Promise.resolve() })
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
    await act(async () => { await Promise.resolve() })
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
    await act(async () => { await Promise.resolve() })
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
    await act(async () => { await Promise.resolve() })
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
    await act(async () => { settle(monaco); await Promise.resolve() })
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
    await act(async () => { await Promise.resolve() })
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
        labels={{ loading: '加载内核', error: '内核失败' }}
        onChange={() => {}}
        onSave={() => {}}
        languageClient={languageClient}
      />,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(languageClient.open).toHaveBeenCalledWith('/a.vue', 'next')
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalled()
    await act(async () => { await Promise.resolve() })
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
    await act(async () => { vi.advanceTimersByTime(1500); await Promise.resolve() })
    cleanup()
    expect(languageClient.close).toHaveBeenCalledWith('/a.vue')
    vi.useRealTimers()
  })
})
