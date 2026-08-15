import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESKTOP_DIST,
  PACK_REQUIRED_PACKAGES,
  missingPackPackages,
  parsePackDesktopArgs,
  removeDir,
  resolveElectronDist,
  rewritePackManifest,
} from './pack-desktop.ts'

describe('parsePackDesktopArgs', () => {
  it('defaults to a local build that does not publish', () => {
    expect(parsePackDesktopArgs([])).toEqual({
      skipBuild: false,
      skipDeploy: false,
      publish: false,
      out: DEFAULT_DESKTOP_DIST,
    })
    expect(parsePackDesktopArgs(['--skip-build', '--skip-deploy', '--publish', '--out', 'out/win'])).toEqual({
      skipBuild: true,
      skipDeploy: true,
      publish: true,
      out: 'out/win',
    })
  })
})

describe('rewritePackManifest', () => {
  it('renames the app, pins main, and drops the electron dependency', () => {
    expect(rewritePackManifest({
      name: '@deepseek-ai/dsh-desktop',
      version: '0.0.0',
      main: 'lib/electron-main.js',
      type: 'module',
      dependencies: {
        electron: '^37.2.0',
        '@deepseek-ai/dsh': 'workspace:^',
      },
    }, '0.1.0-rc.5')).toEqual({
      name: 'deepseek-harness',
      productName: '万物智汇',
      version: '0.1.0-rc.5',
      main: 'lib/electron-main.js',
      type: 'module',
      description: '万物智汇 desktop',
      author: 'xmart',
      dependencies: {
        '@deepseek-ai/dsh': 'workspace:^',
      },
    })
  })
})

describe('missingPackPackages', () => {
  it('lists every required package when the directory is empty', () => {
    const missing = missingPackPackages('C:/definitely-not-a-pack')
    expect(missing).toEqual([
      'lib/electron-main.js',
      'preload.mjs',
      '@deepseek-ai/dsh',
    ])
    expect(PACK_REQUIRED_PACKAGES).toContain('@deepseek-ai/dsh')
  })
})

describe('resolveElectronDist', () => {
  it('points at the workspace electron/dist folder', () => {
    const dist = resolveElectronDist(join(import.meta.dirname, '../apps/desktop/package.json'))
    expect(dist.replaceAll('\\', '/')).toMatch(/\/electron\/dist$/)
    expect(existsSync(dist)).toBe(true)
  })
})

describe('removeDir', () => {
  it('deletes a nested tree and ignores a missing path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-rm-'))
    mkdirSync(join(dir, 'nested'), { recursive: true })
    writeFileSync(join(dir, 'nested', 'f.txt'), 'x')
    removeDir(dir)
    expect(existsSync(dir)).toBe(false)
    expect(() => { removeDir(dir) }).not.toThrow()
  })
})
