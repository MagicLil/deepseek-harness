// @vitest-environment jsdom
/**
 * TabBar: + menu opens a type; disabled rows do not fire onOpen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { TabBar } from '../src/client/TabBar.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

describe('TabBar', () => {
  it('opens a type from the + menu and ignores a disabled row', () => {
    const onOpen = vi.fn()
    render(
      <TabBar
        tabs={[]}
        activeTabId={null}
        menu={[
          { id: 'demo', title: '演示', disabled: false },
          { id: 'gated', title: 'Gated', disabled: true },
        ]}
        t={t}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpen={onOpen}
      />,
    )
    act(() => { screen.getByTestId('xmart-workbench-add').click() })
    act(() => { screen.getByRole('menuitem', { name: '演示' }).click() })
    expect(onOpen).toHaveBeenCalledWith('demo')
    act(() => { screen.getByTestId('xmart-workbench-add').click() })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Gated' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('hides the + button when the menu is empty', () => {
    render(
      <TabBar
        tabs={[{ id: 'a', type: 'editor', title: 'A' }]}
        activeTabId="a"
        menu={[]}
        t={t}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('xmart-workbench-add')).toBeNull()
  })

  it('does not close a tab on a primary-button mousedown', () => {
    const onClose = vi.fn()
    render(
      <TabBar
        tabs={[{ id: 'a', type: 'demo', title: 'A' }]}
        activeTabId="a"
        menu={[]}
        t={t}
        onActivate={vi.fn()}
        onClose={onClose}
        onOpen={vi.fn()}
      />,
    )
    fireEvent.mouseDown(screen.getByTestId('xmart-workbench-tab-a'), { button: 0 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes the + menu on Escape', () => {
    render(
      <TabBar
        tabs={[]}
        activeTabId={null}
        menu={[{ id: 'demo', title: '演示', disabled: false }]}
        t={t}
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    )
    act(() => { screen.getByTestId('xmart-workbench-add').click() })
    expect(screen.getByRole('menuitem', { name: '演示' })).toBeTruthy()
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(screen.queryByRole('menuitem', { name: '演示' })).toBeNull()
  })
})
