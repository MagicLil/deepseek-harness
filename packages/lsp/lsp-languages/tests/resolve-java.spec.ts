import { afterEach, describe, expect, it, vi } from 'vitest'
import { join, resolve } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import {
  downloadJdtls,
  ensureJdtls,
  inspectJdtls,
  javaServerArgv,
  javaSessionLaunch,
  jdtlsConfigName,
  jdtlsDataDir,
  jdtlsHome,
  JDTLS_TARBALL,
  JDTLS_URL,
  resolveJavaCommand,
} from '../src/resolve-java.ts'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawnSync: vi.fn(() => ({ status: 0, stderr: '', stdout: '' })) }
})

const temps: string[] = []

afterEach(() => {
  vi.unstubAllGlobals()
  for (const root of temps.splice(0)) rmSync(root, { recursive: true, force: true })
})

function temp(): string {
  const root = mkdtempSync(join(tmpdir(), 'lsp-lang-java-'))
  temps.push(root)
  return root
}

function fakeProduct(home: string, platform: NodeJS.Platform = 'win32'): void {
  mkdirSync(join(home, 'plugins'), { recursive: true })
  writeFileSync(join(home, 'plugins', 'org.eclipse.equinox.launcher_1.0.jar'), '')
  mkdirSync(join(home, jdtlsConfigName(platform)), { recursive: true })
}

describe('resolveJavaCommand', () => {
  it('prefers JAVA_HOME/bin when the binary exists', () => {
    const home = temp()
    mkdirSync(join(home, 'bin'), { recursive: true })
    const exe = process.platform === 'win32' ? 'java.exe' : 'java'
    writeFileSync(join(home, 'bin', exe), '')
    expect(resolveJavaCommand({ JAVA_HOME: home }, process.platform)).toBe(join(home, 'bin', exe))
  })

  it('falls back to PATH when JAVA_HOME is empty or missing the binary', () => {
    expect(resolveJavaCommand({ JAVA_HOME: '' }, 'linux')).toBe('java')
    expect(resolveJavaCommand({ JAVA_HOME: join(temp(), 'missing') }, 'darwin')).toBe('java')
    expect(resolveJavaCommand({}, 'win32')).toBe('java.exe')
  })
})

describe('jdtlsHome / config / data', () => {
  it('prefers DSH_JDTLS_HOME then ~/.dsh/language-servers/jdtls', () => {
    expect(jdtlsHome({ DSH_JDTLS_HOME: 'D:\\jdtls' })).toBe('D:\\jdtls')
    const home = temp()
    expect(jdtlsHome({ DSH_JDTLS_HOME: '', DSH_HOME: home })).toBe(join(resolve(home), 'language-servers', 'jdtls'))
  })

  it('names the platform config folder', () => {
    expect(jdtlsConfigName('win32')).toBe('config_win')
    expect(jdtlsConfigName('darwin')).toBe('config_mac')
    expect(jdtlsConfigName('linux')).toBe('config_linux')
    expect(['config_win', 'config_mac', 'config_linux']).toContain(jdtlsConfigName())
  })

  it('hashes the workspace into a data directory', () => {
    const home = temp()
    const a = jdtlsDataDir('/ws/a', { DSH_HOME: home })
    const b = jdtlsDataDir('/ws/b', { DSH_HOME: home })
    expect(a).not.toBe(b)
    expect(a.startsWith(join(home, 'jdtls-data'))).toBe(true)
  })
})

describe('inspectJdtls', () => {
  it('reads the Equinox launcher and platform config', () => {
    const home = temp()
    fakeProduct(home, 'linux')
    const runtime = inspectJdtls(home, '/bin/java', {}, 'linux')
    expect(runtime.java).toBe('/bin/java')
    expect(runtime.launcher).toBe(join(home, 'plugins', 'org.eclipse.equinox.launcher_1.0.jar'))
    expect(runtime.configuration).toBe(join(home, 'config_linux'))
  })

  it('throws when plugins, launcher, or config is missing', () => {
    const home = temp()
    expect(() => inspectJdtls(home, 'java')).toThrow(/plugins directory missing/)
    mkdirSync(join(home, 'plugins'), { recursive: true })
    expect(() => inspectJdtls(home, 'java')).toThrow(/launcher jar missing/)
    writeFileSync(join(home, 'plugins', 'org.eclipse.equinox.launcher_1.0.jar'), '')
    expect(() => inspectJdtls(home, 'java', {}, 'linux')).toThrow(/config_linux missing/)
  })
})

describe('downloadJdtls / ensureJdtls / javaSessionLaunch', () => {
  it('writes the tarball and extracts through injectable io', async () => {
    const home = temp()
    const writes: string[] = []
    await downloadJdtls(home, {
      mkdir: () => {},
      writeFile: (path, bytes) => { writes.push(path); expect(bytes.equals(Buffer.from('tar'))).toBe(true) },
      fetchBuffer: async (url) => {
        expect(url).toBe(JDTLS_URL)
        return Buffer.from('tar')
      },
      extract: (tarball, dest) => {
        expect(tarball).toBe(join(home, JDTLS_TARBALL))
        expect(dest).toBe(home)
      },
    })
    expect(writes).toHaveLength(1)
  })

  it('downloads via fetch + tar when io is omitted', async () => {
    const home = temp()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })))
    await downloadJdtls(home)
    expect(spawnSync).toHaveBeenCalled()
  })

  it('ensureJdtls reads process defaults when options are omitted', async () => {
    const home = temp()
    fakeProduct(home, process.platform)
    const prev = process.env.DSH_JDTLS_HOME
    process.env.DSH_JDTLS_HOME = home
    try {
      const runtime = await ensureJdtls()
      expect(runtime.launcher.includes('org.eclipse.equinox.launcher_')).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.DSH_JDTLS_HOME
      else process.env.DSH_JDTLS_HOME = prev
    }
  })

  it('ensureJdtls inspects an existing tree and refuses a missing tree when download is off', async () => {
    const home = temp()
    const env = { DSH_JDTLS_HOME: home, JAVA_HOME: '' }
    await expect(ensureJdtls({ env, download: false, platform: 'linux' })).rejects.toThrow(/not installed/)
    fakeProduct(home, 'linux')
    const runtime = await ensureJdtls({ env, download: false, platform: 'linux' })
    expect(runtime.launcher.includes('org.eclipse.equinox.launcher_')).toBe(true)
  })

  it('ensureJdtls downloads when plugins are absent', async () => {
    const home = temp()
    const env = { DSH_JDTLS_HOME: home }
    let extracted = false
    const runtime = await ensureJdtls({
      env,
      platform: 'linux',
      io: {
        exists: path => extracted && (path.includes('plugins') || path.includes('config_linux')),
        list: () => ['org.eclipse.equinox.launcher_1.0.jar'],
        mkdir: () => {},
        writeFile: () => {},
        fetchBuffer: async () => Buffer.from('x'),
        extract: () => { extracted = true },
      },
    })
    expect(runtime.launcher.endsWith('org.eclipse.equinox.launcher_1.0.jar')).toBe(true)
  })

  it('javaSessionLaunch creates the data dir and returns argv', async () => {
    const home = temp()
    fakeProduct(home, 'linux')
    const dirs: string[] = []
    const launch = await javaSessionLaunch('/ws', {
      env: { DSH_JDTLS_HOME: home, DSH_HOME: home },
      platform: 'linux',
      download: false,
      io: {
        mkdir: (path) => { dirs.push(path) },
      },
    })
    expect(launch.command).toBe('java')
    expect(launch.args).toContain('-jar')
    expect(launch.args).toContain('-data')
    expect(dirs.some(path => path.includes('jdtls-data'))).toBe(true)
    const realDir = await javaSessionLaunch('/ws/real', {
      env: { DSH_JDTLS_HOME: home, DSH_HOME: home },
      platform: 'linux',
      download: false,
    })
    expect(realDir.args).toContain('-data')
  })

  it('javaServerArgv pins Equinox flags', () => {
    const argv = javaServerArgv({
      java: '/bin/java',
      launcher: '/p/launcher.jar',
      configuration: '/p/config_linux',
    }, '/data')
    expect(argv.command).toBe('/bin/java')
    expect(argv.args.includes('-jar')).toBe(true)
    expect(argv.args.includes('/p/launcher.jar')).toBe(true)
    expect(argv.args.includes('-configuration')).toBe(true)
    expect(argv.args.includes('/p/config_linux')).toBe(true)
    expect(argv.args.includes('-data')).toBe(true)
    expect(argv.args.includes('/data')).toBe(true)
  })
})
