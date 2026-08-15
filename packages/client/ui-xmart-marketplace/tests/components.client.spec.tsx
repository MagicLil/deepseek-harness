// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExtensionsIcon, PluginsIcon } from '../src/client/icons.tsx'
import { MarketplacePane } from '../src/client/MarketplacePane.tsx'
import type { DshPluginCard, MarketplacePaneProps, VsixCard } from '../src/client/contract.ts'
import { en, type MarketplaceKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: MarketplaceKey): string => en[key]

const plugin: DshPluginCard = {
  id: 'acme/find',
  name: 'dsh-find-plugin',
  owner: 'acme',
  description: 'Find plugins',
  category: 'market',
  installSpec: 'github:acme/find',
  stars: 4,
  installed: false,
  desktopCompatible: true,
}

const blocked: DshPluginCard = {
  ...plugin,
  id: 'omdsh/sidebar',
  name: 'DSH-better-sidebar',
  installSpec: 'github:omdsh-dev/DSH-better-sidebar',
  desktopCompatible: false,
  incompatibilityReason: 'desktop-http',
}

const vue: VsixCard = {
  id: 'Vue.volar',
  displayName: 'Vue - Official',
  publisher: 'Vue',
  description: 'Vue 3',
  verified: true,
  installed: false,
  compatibility: 'needs-node-host',
  downloadUrl: 'https://x/v.vsix',
}

const ssh: VsixCard = {
  id: 'ms-vscode-remote.remote-ssh',
  displayName: 'Remote - SSH',
  publisher: 'ms-vscode-remote',
  description: 'SSH',
  verified: true,
  installed: false,
  compatibility: 'unsupported',
}

function rpc(overrides: Partial<MarketplacePaneProps> = {}): MarketplacePaneProps {
  return {
    tab: { id: 'plugins', type: 'plugins', title: 'plugins' },
    visible: true,
    sessionId: 's1',
    kind: 'plugins',
    t,
    searchPlugins: vi.fn(async () => [plugin, blocked]),
    listInstalledPlugins: vi.fn(async () => []),
    installPlugin: vi.fn(async () => ({ ok: true, logs: 'added', needsRestart: true })),
    uninstallPlugin: vi.fn(async () => ({ ok: true, logs: 'removed', needsRestart: true })),
    searchExtensions: vi.fn(async () => [vue, ssh]),
    listInstalledExtensions: vi.fn(async () => []),
    installExtension: vi.fn(async () => ({ ok: true, logs: 'stored', needsRestart: false })),
    uninstallExtension: vi.fn(async () => ({ ok: true, logs: 'gone', needsRestart: false })),
    ...overrides,
  }
}

describe('marketplace icons', () => {
  it('render at the requested size', () => {
    const view = render(
      <>
        <PluginsIcon size={18} />
        <ExtensionsIcon />
      </>,
    )
    expect(view.container.querySelectorAll('svg')).toHaveLength(2)
  })
})

describe('MarketplacePane plugins', () => {
  it('searches, confirms an install, and shows a restart note', async () => {
    const props = rpc()
    render(<MarketplacePane {...props} />)
    expect(screen.getByText(en.loading)).toBeTruthy()
    await waitFor(() => { expect(screen.getByText('dsh-find-plugin')).toBeTruthy() })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'find' } })
    await waitFor(() => { expect(props.searchPlugins).toHaveBeenCalledWith('find') })
    fireEvent.click(screen.getByTestId('xmart-plugin-cat-acme/find').querySelector('button')!)
    expect(screen.getByTestId('xmart-marketplace-confirm')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en.confirmOk }))
    await waitFor(() => { expect(props.installPlugin).toHaveBeenCalledWith('github:acme/find', true) })
    expect(screen.getByTestId('xmart-marketplace-logs').textContent).toContain(en.needsRestart)
  })

  it('blocks a desktop-incompatible confirm and can cancel', async () => {
    const props = rpc({
      searchPlugins: vi.fn(async () => [blocked]),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getByText(en.unsupported)).toBeTruthy() })
    fireEvent.click(screen.getByTestId('xmart-plugin-cat-omdsh/sidebar').querySelector('button')!)
    expect(screen.getByText(en.confirmDesktop)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.confirmOk })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: en.confirmCancel }))
    expect(screen.queryByTestId('xmart-marketplace-confirm')).toBeNull()
  })

  it('uninstalls an installed plugin and retries after an error', async () => {
    const props = rpc({
      listInstalledPlugins: vi.fn(async () => [{ ...plugin, installed: true }]),
      searchPlugins: vi.fn(async () => [{ ...plugin, installed: true }]),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getAllByText(en.installedTag).length).toBeGreaterThan(0) })
    fireEvent.click(screen.getAllByRole('button', { name: en.uninstall })[0]!)
    await waitFor(() => { expect(props.uninstallPlugin).toHaveBeenCalledWith('dsh-find-plugin') })
  })

  it('shows empty groups, an error retry, and job failures', async () => {
    const props = rpc({
      searchPlugins: vi.fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue([plugin]),
      listInstalledPlugins: vi.fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue([]),
      installPlugin: vi.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ ok: false, logs: 'nope', needsRestart: false }),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getByText(en.error)).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(screen.getByText('dsh-find-plugin')).toBeTruthy() })
    fireEvent.click(screen.getByTestId('xmart-plugin-cat-acme/find').querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: en.confirmOk }))
    await waitFor(() => {
      expect(screen.getByTestId('xmart-marketplace-logs').textContent).toContain('error')
    })
    fireEvent.click(screen.getByTestId('xmart-plugin-cat-acme/find').querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: en.confirmOk }))
    await waitFor(() => {
      expect(screen.getByTestId('xmart-marketplace-logs').textContent).toContain('nope')
    })
  })

  it('renders an empty catalog and a job without an error string', async () => {
    const empty = rpc({
      searchPlugins: vi.fn(async () => []),
      listInstalledPlugins: vi.fn(async () => []),
    })
    const first = render(<MarketplacePane {...empty} />)
    await waitFor(() => { expect(screen.getAllByText(en.empty).length).toBe(2) })
    first.unmount()
    const props = rpc({
      installPlugin: vi.fn(async () => ({ ok: false, logs: '', needsRestart: false })),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getByText('dsh-find-plugin')).toBeTruthy() })
    fireEvent.click(screen.getByTestId('xmart-plugin-cat-acme/find').querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: en.confirmOk }))
    await waitFor(() => {
      expect(screen.getByTestId('xmart-marketplace-logs').textContent).toContain(en.error)
    })
  })
})

describe('MarketplacePane extensions', () => {
  it('installs Vue Official, disables Remote SSH, and uninstalls', async () => {
    const props = rpc({
      kind: 'extensions',
      tab: { id: 'extensions', type: 'extensions', title: 'extensions' },
      listInstalledExtensions: vi.fn(async (): Promise<readonly VsixCard[]> => [
        { ...vue, installed: true, compatibility: 'pending-host' },
      ]),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getAllByText('Vue - Official').length).toBeGreaterThan(0) })
    const sshButton = screen.getAllByRole('button', { name: en.install })
      .find(button => button.closest('[data-testid="xmart-ext-cat-ms-vscode-remote.remote-ssh"]'))
    expect((sshButton as HTMLButtonElement | undefined)?.disabled).toBe(true)
    const vueButton = screen.getAllByRole('button', { name: en.install })
      .find(button => button.closest('[data-testid="xmart-ext-cat-Vue.volar"]'))
    fireEvent.click(vueButton!)
    await waitFor(() => { expect(props.installExtension).toHaveBeenCalledWith('Vue.volar', 'https://x/v.vsix') })
    expect(screen.getByTestId('xmart-marketplace-logs').textContent).toContain(en.notActivated)
    fireEvent.click(screen.getAllByRole('button', { name: en.uninstall })[0]!)
    await waitFor(() => { expect(props.uninstallExtension).toHaveBeenCalledWith('Vue.volar') })
  })

  it('shows verified and empty extension groups', async () => {
    const props = rpc({
      kind: 'extensions',
      searchExtensions: vi.fn(async () => []),
      listInstalledExtensions: vi.fn(async () => []),
    })
    render(<MarketplacePane {...props} />)
    await waitFor(() => { expect(screen.getAllByText(en.empty).length).toBe(2) })
  })

  it('does not fetch while the pane is hidden', async () => {
    const props = rpc({ visible: false, kind: 'extensions' })
    render(<MarketplacePane {...props} />)
    await act(async () => { await Promise.resolve() })
    expect(props.searchExtensions).not.toHaveBeenCalled()
  })

  it('ignores a late catalog result after unmount and shows an installed catalog row', async () => {
    const deferred = Promise.withResolvers<[readonly VsixCard[], readonly VsixCard[]]>()
    const props = rpc({
      kind: 'extensions',
      searchExtensions: vi.fn(() => deferred.promise.then(([found]) => found)),
      listInstalledExtensions: vi.fn(() => deferred.promise.then(([, installed]) => installed)),
    })
    const view = render(<MarketplacePane {...props} />)
    view.unmount()
    await act(async () => {
      deferred.resolve([[{ ...vue, installed: true }], []])
    })
    const rejected = Promise.withResolvers<readonly VsixCard[]>()
    const failing = rpc({
      kind: 'extensions',
      searchExtensions: vi.fn(() => rejected.promise),
      listInstalledExtensions: vi.fn(() => rejected.promise),
    })
    const again = render(<MarketplacePane {...failing} />)
    again.unmount()
    await act(async () => { rejected.reject(new Error('late')) })
    const installedCat = rpc({
      kind: 'extensions',
      searchExtensions: vi.fn(async () => [{ ...vue, installed: true, verified: false }]),
      listInstalledExtensions: vi.fn(async () => []),
    })
    render(<MarketplacePane {...installedCat} />)
    await waitFor(() => { expect(screen.getAllByText(en.installedTag).length).toBeGreaterThan(0) })
  })
})
