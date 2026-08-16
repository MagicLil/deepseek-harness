// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanSettingsSection } from '../src/client/LanSettingsSection.tsx'
import type { LanSettingsProps, LanStatus } from '../src/client/contract.ts'
import { en, type LanKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: LanKey): string => en[key]) as LanSettingsProps['t']

const BASE: LanStatus = {
  enabled: false,
  port: 3080,
  loopbackUrl: 'http://127.0.0.1:3080/',
  lanUrl: null,
  token: 'secret-token',
  bindError: null,
}

function props(overrides: Partial<LanSettingsProps> = {}): LanSettingsProps {
  return {
    t,
    close: vi.fn(),
    status: vi.fn(async () => BASE),
    setEnabled: vi.fn(async enabled => ({ ...BASE, enabled, lanUrl: enabled ? 'http://192.168.1.5:3080/' : null })),
    setPort: vi.fn(async port => ({ ...BASE, port })),
    rotateToken: vi.fn(async () => ({ ...BASE, token: 'next-token' })),
    copyText: vi.fn(async () => {}),
    ...overrides,
  } as unknown as LanSettingsProps
}

describe('LanSettingsSection', () => {
  it('loads status and toggles the switch', async () => {
    const p = props()
    render(<LanSettingsSection {...p} />)
    await waitFor(() => { expect(screen.getByText('http://127.0.0.1:3080/')).toBeTruthy() })
    fireEvent.click(screen.getByRole('switch', { name: en.enabled }))
    await waitFor(() => { expect(p.setEnabled).toHaveBeenCalledWith(true) })
    await waitFor(() => { expect(screen.getByText('http://192.168.1.5:3080/')).toBeTruthy() })
  })

  it('commits the port on blur, copies, rotates, and shows a bind error', async () => {
    const p = props({
      status: vi.fn(async () => ({ ...BASE, bindError: 'EADDRINUSE', lanUrl: 'http://10.0.0.2:3080/' })),
    })
    render(<LanSettingsSection {...p} />)
    await waitFor(() => { expect(screen.getByText(/EADDRINUSE/)).toBeTruthy() })
    expect(screen.getByText('http://10.0.0.2:3080/')).toBeTruthy()
    const port = screen.getByRole('spinbutton', { name: en.port })
    fireEvent.change(port, { target: { value: '4090' } })
    fireEvent.blur(port)
    await waitFor(() => { expect(p.setPort).toHaveBeenCalledWith(4090) })
    fireEvent.click(screen.getByRole('button', { name: en.copy }))
    expect(p.copyText).toHaveBeenCalledWith('secret-token')
    fireEvent.click(screen.getByRole('button', { name: en.rotate }))
    await waitFor(() => { expect(p.rotateToken).toHaveBeenCalled() })
    await waitFor(() => { expect(screen.getByText('next-token')).toBeTruthy() })
  })

  it('ignores a late status resolve after unmount', async () => {
    let resolveStatus: (value: LanStatus) => void = () => {}
    const p = props({
      status: vi.fn(() => new Promise<LanStatus>((resolve) => { resolveStatus = resolve })),
    })
    const view = render(<LanSettingsSection {...p} />)
    view.unmount()
    resolveStatus(BASE)
  })
})
