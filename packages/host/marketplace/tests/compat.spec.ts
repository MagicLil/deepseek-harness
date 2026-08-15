import { describe, expect, it } from 'vitest'
import { CATALOG_SNAPSHOT } from '../src/catalog-snapshot.ts'
import { desktopCompatibility, patchNeedsWebserver } from '../src/desktop-compat.ts'
import { classifyVsix, installDisabled, vsixId } from '../src/vsix-compat.ts'

describe('desktop-compat', () => {
  it('blocks known HTTP/WebSocket plugins by name, url, copy, or patch', () => {
    const find = CATALOG_SNAPSHOT.plugins[0]!
    const sidebar = CATALOG_SNAPSHOT.plugins[1]!
    expect(desktopCompatibility(find)).toEqual({ ok: true })
    expect(desktopCompatibility(sidebar)).toEqual({ ok: false, reason: 'desktop-http' })
    expect(desktopCompatibility({
      ...find,
      name: 'ok',
      url: 'https://github.com/acme/dsh-market',
    })).toEqual({ ok: false, reason: 'desktop-http' })
    expect(desktopCompatibility({
      ...find,
      description: { en: 'uses a websocket terminal', zh: 'x' },
    })).toEqual({ ok: false, reason: 'desktop-http' })
    expect(desktopCompatibility(find, 'host:\n  webserver: true')).toEqual({ ok: false, reason: 'desktop-http' })
    expect(patchNeedsWebserver('plain')).toBe(false)
    expect(patchNeedsWebserver('/ws/terminal')).toBe(true)
  })
})

describe('vsix-compat', () => {
  it('classifies unsupported, node-host, and pending-host extensions', () => {
    expect(vsixId('Vue', 'volar')).toBe('Vue.volar')
    expect(classifyVsix('ms-vscode-remote.remote-ssh')).toBe('unsupported')
    expect(classifyVsix('anysphere.cursor-always-local')).toBe('unsupported')
    expect(classifyVsix('acme.remote-wsl')).toBe('unsupported')
    expect(classifyVsix('acme.theme', { contributes: { localizations: [] } })).toBe('unsupported')
    expect(classifyVsix('Vue.volar', { main: './dist/extension.js' })).toBe('needs-node-host')
    expect(classifyVsix('acme.theme', { contributes: { themes: [] } })).toBe('pending-host')
    expect(installDisabled('unsupported')).toBe(true)
    expect(installDisabled('pending-host')).toBe(false)
    expect(installDisabled('needs-node-host')).toBe(false)
  })
})
