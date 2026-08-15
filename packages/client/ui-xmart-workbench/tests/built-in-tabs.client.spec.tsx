// @vitest-environment jsdom
/**
 * Built-in demo and file-stub bodies.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { DemoTab, FileStubTab } from '../src/client/built-in-tabs.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh)

describe('built-in tab bodies', () => {
  it('renders the demo copy', () => {
    render(<DemoTab tab={{ id: 'd', type: 'demo', title: '演示' }} visible sessionId="s1" t={t} />)
    expect(screen.getByTestId('xmart-workbench-demo').textContent).toBe(
      '演示标签仍可用。用左侧活动栏打开资源管理器，浏览工作区文件。',
    )
  })

  it('renders the file stub with and without a path', () => {
    render(<FileStubTab tab={{ id: 'f', type: 'file', title: 'a.ts' }} visible sessionId="s1" t={t} />)
    expect(screen.getByTestId('xmart-workbench-file-stub').querySelector('code')).toBeNull()
    cleanup()
    render(
      <FileStubTab
        tab={{ id: 'f', type: 'file', title: 'a.ts', path: '/p/a.ts' }}
        visible
        sessionId="s1"
        t={t}
      />,
    )
    expect(screen.getByText('/p/a.ts')).toBeTruthy()
  })
})
