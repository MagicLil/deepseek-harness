// @vitest-environment jsdom
/**
 * BottomPanel: reserved terminal body under the editor track.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { BottomPanel } from '../src/client/BottomPanel.tsx'
import type { BottomPanelProps } from '../src/client/contract.ts'
import type { TabBodyProps } from '../src/client/types.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never

function Stub({ tab }: TabBodyProps) {
  return <div data-testid="xmart-bottom-body">{tab.title}</div>
}

function mount(height: number, resolveBody: BottomPanelProps['resolveBody'] = () => Stub) {
  const props = {
    height,
    sessionId: 's1' as SessionId,
    useSession: (() => null) as never,
    useSessions: (() => null) as never,
    useWorkspaces: (() => null) as never,
    resolveBody,
    t,
  } as BottomPanelProps
  render(<BottomPanel {...props} />)
}

describe('BottomPanel', () => {
  it('renders nothing while closed', () => {
    mount(0)
    expect(screen.queryByTestId('xmart-bottom-panel')).toBeNull()
  })

  it('renders the terminal body when open', () => {
    mount(200)
    expect(screen.getByTestId('xmart-bottom-panel')).toBeTruthy()
    expect(screen.getByTestId('xmart-bottom-body').textContent).toBe('终端')
  })

  it('renders an empty panel when the terminal type is unregistered', () => {
    mount(200, () => undefined)
    expect(screen.getByTestId('xmart-bottom-panel')).toBeTruthy()
    expect(screen.queryByTestId('xmart-bottom-body')).toBeNull()
  })
})
