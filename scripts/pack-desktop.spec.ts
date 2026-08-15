import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DESKTOP_DIST,
  PACK_REQUIRED_PACKAGES,
  hoistDeclaredWorkspaceDependencies,
  hoistMissingWorkspacePackages,
  missingPackPackages,
  pinVisibleWorkspaceDependencies,
  stripStarDependencies,
  syncScopedWorkspacePackages,
  parsePackDesktopArgs,
  removeDir,
  resolveElectronBuilderCli,
  resolveElectronDist,
  rewritePackManifest,
  unresolvedWorkspaceImports,
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

describe('electron-builder.yml', () => {
  it('names the installer and unpacked binary xmart.exe', () => {
    const yml = readFileSync(join(import.meta.dirname, '../apps/desktop/electron-builder.yml'), 'utf8')
    expect(yml).toContain('productName: xmart')
    expect(yml).toContain('shortcutName: xmart')
    expect(yml).toContain('artifactName: xmart.${version}.${ext}')
    expect(yml).toContain('artifactName: xmart.${version}-portable.${ext}')
    expect(yml).not.toContain('DeepSeek-Harness')
    expect(yml).not.toContain('万物智汇')
    expect(yml).toContain('afterPack: ./after-pack.cjs')
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
      productName: 'xmart',
      version: '0.1.0-rc.5',
      main: 'lib/electron-main.js',
      type: 'module',
      description: 'xmart desktop',
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
    expect(PACK_REQUIRED_PACKAGES).toContain('@deepseek-ai/cordis-plugin-group')
  })

  it('keeps the boot-hard Group import in the CLI production graph', () => {
    const cli = JSON.parse(
      readFileSync(join(import.meta.dirname, '../apps/cli/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }
    expect(cli.dependencies?.['@deepseek-ai/cordis-plugin-group']).toBe('workspace:^')
  })
})

describe('unresolvedWorkspaceImports', () => {
  it('names a hard import that the pack tree cannot resolve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-unresolved-'))
    const agentLib = join(dir, 'node_modules', '@deepseek-ai', 'dsh-agent', 'lib')
    mkdirSync(agentLib, { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', '@deepseek-ai', 'dsh-agent', 'package.json'),
      '{"name":"@deepseek-ai/dsh-agent","type":"module"}\n',
    )
    writeFileSync(join(agentLib, 'index.js'), "import { createScope } from '@deepseek-ai/dsh-scope'\n")
    expect(unresolvedWorkspaceImports(dir)).toEqual(['@deepseek-ai/dsh-scope'])
  })
})

describe('hoistDeclaredWorkspaceDependencies', () => {
  it('copies a declared workspace dependency that is not in the pack tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-declared-'))
    mkdirSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-desktop-app'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{"dependencies":{"@deepseek-ai/dsh-desktop-app":"workspace:^"}}\n')
    writeFileSync(
      join(dir, 'node_modules', '@deepseek-ai', 'dsh-desktop-app', 'package.json'),
      '{"name":"@deepseek-ai/dsh-desktop-app","dependencies":{"@deepseek-ai/dsh-scope":"workspace:^"}}\n',
    )
    const hoisted = hoistDeclaredWorkspaceDependencies(dir, join(import.meta.dirname, '..'))
    expect(hoisted).toContain('@deepseek-ai/dsh-scope')
    expect(existsSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-scope', 'package.json'))).toBe(true)
  })
})

describe('hoistMissingWorkspacePackages', () => {
  it('copies peer-only workspace packages to the pack root so ESM can resolve them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-hoist-'))
    const agentLib = join(dir, 'node_modules', '@deepseek-ai', 'dsh-agent', 'lib')
    mkdirSync(agentLib, { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', '@deepseek-ai', 'dsh-agent', 'package.json'),
      '{"name":"@deepseek-ai/dsh-agent","type":"module"}\n',
    )
    writeFileSync(join(agentLib, 'index.js'), "import { createScope } from '@deepseek-ai/dsh-scope'\n")
    const repoRoot = join(import.meta.dirname, '..')
    const hoisted = hoistMissingWorkspacePackages(dir, repoRoot)
    expect(hoisted).toContain('@deepseek-ai/dsh-scope')
    expect(existsSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-scope', 'package.json'))).toBe(true)
    expect(unresolvedWorkspaceImports(dir)).not.toContain('@deepseek-ai/dsh-scope')
  })
})

describe('pinVisibleWorkspaceDependencies', () => {
  it('adds hoisted @deepseek-ai packages to the pack manifest so electron-builder keeps them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-pin-'))
    mkdirSync(join(dir, 'node_modules', '@deepseek-ai', 'dsh-scope'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({
      name: 'deepseek-harness',
      dependencies: { '@deepseek-ai/dsh': 'workspace:^' },
    }, undefined, 2)}\n`)
    writeFileSync(
      join(dir, 'node_modules', '@deepseek-ai', 'dsh-scope', 'package.json'),
      '{"name":"@deepseek-ai/dsh-scope"}\n',
    )
    expect(pinVisibleWorkspaceDependencies(dir)).toEqual(['@deepseek-ai/dsh-scope'])
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(manifest.dependencies['@deepseek-ai/dsh-scope']).toBe('*')
    expect(manifest.dependencies['@deepseek-ai/dsh']).toBe('workspace:^')
  })
})

describe('stripStarDependencies', () => {
  it('removes only star-pinned entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-pack-strip-'))
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({
      dependencies: {
        '@deepseek-ai/dsh': 'workspace:^',
        '@deepseek-ai/dsh-scope': '*',
      },
    }, undefined, 2)}\n`)
    expect(stripStarDependencies(dir)).toEqual(['@deepseek-ai/dsh-scope'])
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(manifest.dependencies).toEqual({ '@deepseek-ai/dsh': 'workspace:^' })
  })
})

describe('syncScopedWorkspacePackages', () => {
  it('copies packages that the unpacked app is missing', () => {
    const source = mkdtempSync(join(tmpdir(), 'dsh-pack-sync-src-'))
    const dest = mkdtempSync(join(tmpdir(), 'dsh-pack-sync-dst-'))
    mkdirSync(join(source, 'node_modules', '@deepseek-ai', 'dsh-scope'), { recursive: true })
    mkdirSync(join(dest, 'node_modules', '@deepseek-ai', 'dsh-agent'), { recursive: true })
    writeFileSync(join(source, 'node_modules', '@deepseek-ai', 'dsh-scope', 'package.json'), '{"name":"@deepseek-ai/dsh-scope"}\n')
    writeFileSync(join(dest, 'node_modules', '@deepseek-ai', 'dsh-agent', 'package.json'), '{"name":"@deepseek-ai/dsh-agent"}\n')
    expect(syncScopedWorkspacePackages(source, dest)).toEqual(['@deepseek-ai/dsh-scope'])
    expect(existsSync(join(dest, 'node_modules', '@deepseek-ai', 'dsh-scope', 'package.json'))).toBe(true)
  })
})

describe('resolveElectronDist', () => {
  it('points at the workspace electron/dist folder', () => {
    const dist = resolveElectronDist(join(import.meta.dirname, '../apps/desktop/package.json'))
    expect(dist.replaceAll('\\', '/')).toMatch(/\/electron\/dist$/)
    expect(existsSync(dist)).toBe(true)
  })
})

describe('resolveElectronBuilderCli', () => {
  it('points at electron-builder/cli.js', () => {
    const cli = resolveElectronBuilderCli(join(import.meta.dirname, '../apps/desktop/package.json'))
    expect(cli.replaceAll('\\', '/')).toMatch(/\/electron-builder\/cli\.js$/)
    expect(existsSync(cli)).toBe(true)
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
