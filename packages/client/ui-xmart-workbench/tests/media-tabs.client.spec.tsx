// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { BinaryTab, ImageTab } from '../src/client/MediaTabs.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

describe('media tabs', () => {
  it('renders placeholders and opens the system app', () => {
    const openSystem = vi.fn(async () => {})
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png', path: '/a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
      />,
    )
    fireEvent.click(screen.getByText('用系统应用打开'))
    expect(openSystem).toHaveBeenCalledWith('/a.png')
    cleanup()
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
    cleanup()
    render(
      <ImageTab
        tab={{ id: 'i', type: 'image', title: 'a.png' }}
        visible
        sessionId="s1"
        t={t}
        openSystem={openSystem}
      />,
    )
    expect(screen.getByTestId('xmart-workbench-image').querySelector('code')).toBeNull()
  })
})
