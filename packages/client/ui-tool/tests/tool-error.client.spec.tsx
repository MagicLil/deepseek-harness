// @vitest-environment jsdom
/** Tool-error presentation: sanitized summaries and developer-mode reveal. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import type { ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { friendlyToolErrorSummary, toolErrorKind } from '../src/client/tool/models/tool-error.ts'
import { GenericToolCard, type GenericToolCardProps } from '../src/client/tool/toolviews/GenericToolCard.tsx'

afterEach(cleanup)

const t: GenericToolCardProps['t'] = makeTranslate(zh, commonZh)

const RAW_ERROR = 'Error: cannot write "D:\\work\\notes.txt": ReplaceFileW EIO (Win32 32): D:\\work\\notes.txt -- secret=abc123 -- command=rm -rf /'

function failed(over?: Partial<ToolResultNode>): ToolResultNode {
  return {
    kind: 'tool-result', seq: 10, time: 2_000, callId: 'c1',
    call: { name: 'edit', argsRaw: '{"file_path":"notes.txt"}' },
    callTime: 1_000,
    content: [{ type: 'text', text: RAW_ERROR }],
    isError: true,
    error: { name: 'FsError', code: 'FS_IO_ERROR' },
    callView: null, resultView: null, subCalls: [],
    ...over,
  }
}

function props(block: ToolResultNode, developerMode = false): GenericToolCardProps {
  return {
    callId: 'c1', toolName: 'edit', block, openFile: vi.fn(), t,
    developerMode, setDeveloperMode: vi.fn(),
  }
}

describe('toolErrorKind', () => {
  it('classifies structured fs codes into sanitized categories', () => {
    expect(toolErrorKind('FS_IO_ERROR')).toBe('file-busy')
    expect(toolErrorKind('FS_PERMISSION_DENIED')).toBe('permission-denied')
    expect(toolErrorKind('FS_SANDBOX_DENIED')).toBe('permission-denied')
    expect(toolErrorKind('FS_NOT_FOUND')).toBe('not-found')
    expect(toolErrorKind('FS_EDIT_NOT_FOUND')).toBe('not-found')
    expect(toolErrorKind('FS_STALE_VERSION')).toBe('stale')
  })

  it('defaults unknown and absent codes', () => {
    expect(toolErrorKind('UNKNOWN_TOOL')).toBe('default')
    expect(toolErrorKind(undefined)).toBe('default')
  })
})

describe('friendlyToolErrorSummary', () => {
  it('renders the generic message for the default kind', () => {
    expect(friendlyToolErrorSummary('default', t)).toBe('操作未完成，请稍后重试。')
  })

  it('renders the file-busy supplement for an IO error', () => {
    expect(friendlyToolErrorSummary('file-busy', t)).toBe('操作未完成，请稍后重试。目标文件可能正在被其他程序占用。')
  })
})

describe('tool error presentation', () => {
  it('a final failure shows only the sanitized message, never the raw text', () => {
    const view = render(<GenericToolCard {...props(failed())} />)
    expect(view.getByText('操作未完成，请稍后重试。目标文件可能正在被其他程序占用。')).toBeTruthy()
    // Raw error internals never reach the normal conversation.
    expect(view.queryByText(/ReplaceFileW/)).toBeNull()
    expect(view.queryByText(/Win32 32/)).toBeNull()
    expect(view.queryByText(/secret=abc123/)).toBeNull()
    expect(view.queryByText(/D:\\work/)).toBeNull()
  })

  it('developer mode reveals the raw failure inside the collapsible debug panel', () => {
    const view = render(<GenericToolCard {...props(failed(), true)} />)
    fireEvent.click(view.container.querySelector('[data-expandable]')!)
    expect(view.getByText(/ReplaceFileW/)).toBeTruthy()
    expect(view.getByText(/Win32 32/)).toBeTruthy()
  })

  it('sanitizes paths, commands, and secrets out of the normal-mode DOM', () => {
    const view = render(<GenericToolCard {...props(failed())} />)
    fireEvent.click(view.container.querySelector('[data-expandable]')!)
    const text = view.container.textContent ?? ''
    expect(text).not.toContain('ReplaceFileW')
    expect(text).not.toContain('Win32 32')
    expect(text).not.toContain('secret=abc123')
    expect(text).not.toContain('rm -rf')
    expect(text).not.toContain('D:\\work\\notes.txt')
  })
})
