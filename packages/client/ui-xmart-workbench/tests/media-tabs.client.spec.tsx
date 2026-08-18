// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { BinaryTab, ImageTab } from '../src/client/MediaTabs.tsx'
import { createWorkbenchFilesStore } from '../src/client/files-store.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

describe('media tabs', () => {
  it('loads image bytes into a preview and still offers system open', async () => {
    const openSystem = vi.fn(async () => {})
    const readFileBytes = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
    }))
    const createObjectURL = vi.fn(() => 'blob:preview')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const files = createWorkbenchFilesStore()
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png', path: '/a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
        readFileBytes={readFileBytes}
        files={files}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('xmart-workbench-image-preview').getAttribute('src')).toBe('blob:preview')
    })
    fireEvent.click(screen.getByText('用系统应用打开'))
    expect(openSystem).toHaveBeenCalledWith('/a.png')
    cleanup()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('shows an error when bytes fail and an empty note when there is no path', async () => {
    const openSystem = vi.fn(async () => {})
    const files = createWorkbenchFilesStore()
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png', path: '/a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
        readFileBytes={async () => { throw new Error('no') }}
        files={files}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('无法加载图片。可改用系统应用打开。')).toBeTruthy()
    })
    cleanup()
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
        readFileBytes={async () => ({ bytes: new Uint8Array(), mimeType: 'image/png' })}
        files={files}
      />,
    )
    expect(screen.getByText('没有可预览的路径。')).toBeTruthy()
    expect(screen.getByTestId('xmart-workbench-image').querySelector('code')).toBeNull()
  })

  it('reloads when the files store bumps the path token and ignores a late abort', async () => {
    const files = createWorkbenchFilesStore()
    let settle: (value: { bytes: Uint8Array; mimeType: string }) => void = () => {}
    const readFileBytes = vi.fn(() => new Promise<{ bytes: Uint8Array; mimeType: string }>((resolve) => {
      settle = resolve
    }))
    Object.assign(URL, { createObjectURL: () => 'blob:late', revokeObjectURL: vi.fn() })
    const view = render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png', path: '/a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={async () => {}}
        readFileBytes={readFileBytes}
        files={files}
      />,
    )
    expect(screen.getByText('正在加载图片…')).toBeTruthy()
    view.unmount()
    await act(async () => {
      settle({ bytes: new Uint8Array([1]), mimeType: 'image/png' })
      await Promise.resolve()
    })
    cleanup()
    let calls = 0
    const reloading = vi.fn(async () => {
      calls += 1
      return { bytes: new Uint8Array([calls]), mimeType: 'image/png' }
    })
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png', path: '/a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={async () => {}}
        readFileBytes={reloading}
        files={files}
      />,
    )
    await waitFor(() => { expect(reloading).toHaveBeenCalledTimes(1) })
    act(() => { files.markReload(['/a.png']) })
    await waitFor(() => { expect(reloading).toHaveBeenCalledTimes(2) })
  })

  it('renders binary placeholders and opens the system app', () => {
    const openSystem = vi.fn(async () => {})
    render(
      <BinaryTab
        tab={{ id: 'b', type: 'binary', title: 'a.bin' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
      />,
    )
    expect(screen.getByTestId('xmart-workbench-binary').querySelector('code')).toBeNull()
    cleanup()
    render(
      <BinaryTab
        tab={{ id: 'b', type: 'binary', title: 'a.bin', path: '/a.bin' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
      />,
    )
    fireEvent.click(screen.getByText('用系统应用打开'))
    expect(openSystem).toHaveBeenCalledWith('/a.bin')
  })
})
