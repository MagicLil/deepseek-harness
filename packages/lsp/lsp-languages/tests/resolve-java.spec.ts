import { afterEach, describe, expect, it, vi } from 'vitest'
import { join, resolve } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import {
  detectProjectJavaVersion,
  discoverJdks,
  downloadJdtls,
  ensureJdtls,
  inspectJdtls,
  javaMajorVersion,
  javaServerArgv,
  javaSessionLaunch,
  jdtRuntimeName,
  jdtlsConfigName,
  jdtlsDataDir,
  jdtlsHome,
  JDTLS_TARBALL,
  JDTLS_URL,
  parseJavaMajor,
  parseJavaVersionOutput,
  pickJdtlsJdk,
  resolveJavaCommand,
  resolveJdtlsJavaCommand,
  toJdtRuntimes,
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

function posix(path: string): string {
  return path.replace(/\\/g, '/')
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

  it('skips a Java 8 JAVA_HOME when a sibling Java 21 tree exists', () => {
    const root = temp()
    const oldHome = join(root, 'java8')
    const newHome = join(root, 'java21')
    const exe = process.platform === 'win32' ? 'java.exe' : 'java'
    mkdirSync(join(oldHome, 'bin'), { recursive: true })
    mkdirSync(join(newHome, 'bin'), { recursive: true })
    writeFileSync(join(oldHome, 'bin', exe), '')
    writeFileSync(join(newHome, 'bin', exe), '')
    expect(resolveJavaCommand({ JAVA_HOME: oldHome }, process.platform, {
      exists: path => path.startsWith(root) && existsSync(path),
      list: path => path === root ? ['java8', 'java21'] : [],
      javaMajor: command => command.includes('java8') ? 8 : command.includes('java21') ? 21 : undefined,
    })).toBe(join(newHome, 'bin', exe))
  })
})

describe('java version parsing and JDK discovery', () => {
  it('parses majors from tokens and java -version output', () => {
    expect(parseJavaMajor('')).toBeUndefined()
    expect(parseJavaMajor('nope')).toBeUndefined()
    expect(parseJavaMajor('1.8')).toBe(8)
    expect(parseJavaMajor('17')).toBe(17)
    expect(parseJavaMajor('21-tem')).toBe(21)
    expect(parseJavaMajor('java-17.0.2')).toBe(17)
    expect(parseJavaVersionOutput('openjdk version "1.8.0_392"\n')).toBe(8)
    expect(parseJavaVersionOutput('openjdk version "17.0.12"\n')).toBe(17)
    expect(parseJavaVersionOutput('21.0.2\nextra')).toBe(21)
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0, stderr: 'openjdk version "21.0.2"', stdout: '',
    } as never)
    expect(javaMajorVersion('/bin/java')).toBe(21)
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0, stderr: undefined, stdout: undefined,
    } as never)
    expect(javaMajorVersion('/bin/java')).toBeUndefined()
    expect(jdtRuntimeName(8)).toBe('JavaSE-1.8')
    expect(jdtRuntimeName(7)).toBe('JavaSE-1.8')
    expect(jdtRuntimeName(11)).toBe('JavaSE-11')
    expect(jdtRuntimeName(17)).toBe('JavaSE-17')
  })

  it('discovers JDKs from env, PATH, siblings, and well-known roots', () => {
    const jdk17 = join('/opt', 'java17')
    const jdk21 = join('/opt', 'java21')
    const found = discoverJdks({
      JAVA_HOME: jdk17,
      JDK_HOME: jdk17,
      PATH: `${join(jdk21, 'bin')}:/usr/bin`,
    }, 'linux', {
      exists: (path) => {
        const n = posix(path)
        return n.endsWith('/opt/java17/bin/java')
          || n.endsWith('/opt/java21/bin/java')
          || n.includes('/usr/lib/jvm/temurin-17/bin/java')
          || n.endsWith('/usr/lib/jvm')
      },
      list: (path) => {
        const n = posix(path)
        if (n === '/opt' || n.endsWith('/opt')) return ['java17', 'java21', 'notes']
        if (n.endsWith('/usr/lib/jvm')) return ['temurin-17']
        return []
      },
      javaMajor: command => command.includes('java21') ? 21 : 17,
    })
    expect(found[0]?.major).toBe(21)
    expect(found.some(jdk => posix(jdk.home).endsWith('/usr/lib/jvm/temurin-17'))).toBe(true)
    expect(found.filter(jdk => jdk.home === jdk17)).toHaveLength(1)

    const win = discoverJdks({ USERPROFILE: 'C:\\Users\\dev' }, 'win32', {
      exists: path => path === 'D:\\developTool' || path === join('D:\\developTool', 'java21', 'bin', 'java.exe'),
      list: path => path === 'D:\\developTool' ? ['java21'] : [],
      javaMajor: () => 21,
    })
    expect(win).toEqual([{
      home: join('D:\\developTool', 'java21'),
      java: join('D:\\developTool', 'java21', 'bin', 'java.exe'),
      major: 21,
    }])

    expect(discoverJdks({ JAVA_HOME: '/' }, 'linux', {
      exists: () => false,
      list: () => { throw new Error('must not list filesystem root') },
      javaMajor: () => undefined,
    })).toEqual([])
    expect(discoverJdks({ JAVA_HOME: 'C:' }, 'win32', {
      exists: () => false,
      list: () => { throw new Error('must not list drive root') },
      javaMajor: () => undefined,
    })).toEqual([])
    expect(discoverJdks({ JAVA_HOME: join(temp(), 'missing-parent', 'jdk') }, 'linux')).toEqual([])
    expect(discoverJdks({ Path: join('C:\\jdk21', 'bin') }, 'win32', {
      exists: path => path === join('C:\\jdk21', 'bin', 'java.exe'),
      list: () => [],
      javaMajor: () => 21,
    }).map(jdk => jdk.major)).toEqual([21])
    expect(discoverJdks({
      JAVA_HOME: 'D:\\Java\\jdk-17',
      JDK_HOME: 'D:/Java/jdk-17',
    }, 'win32', {
      exists: path => posix(path).toLowerCase().endsWith('/java/jdk-17/bin/java.exe'),
      list: () => [],
      javaMajor: () => 17,
    })).toHaveLength(1)
  })

  it('picks DSH_JDTLS_JAVA, skips JAVA_HOME 17, then the newest 21+', () => {
    const jdk8 = { home: '/opt/java8', java: '/opt/java8/bin/java', major: 8 }
    const jdk17 = { home: '/opt/java17', java: '/opt/java17/bin/java', major: 17 }
    const jdk21 = { home: '/opt/java21', java: '/opt/java21/bin/java', major: 21 }
    expect(pickJdtlsJdk([jdk8, jdk17, jdk21], { JAVA_HOME: jdk17.home }, 'linux')?.home).toBe(jdk21.home)
    expect(pickJdtlsJdk([jdk8, jdk17, jdk21], { JAVA_HOME: jdk21.home }, 'linux')?.home).toBe(jdk21.home)
    expect(pickJdtlsJdk([jdk8, jdk17, jdk21], {}, 'linux')?.home).toBe(jdk21.home)
    const jdk22 = { home: '/opt/java22', java: '/opt/java22/bin/java', major: 22 }
    expect(pickJdtlsJdk([jdk21, jdk22], {}, 'linux')?.home).toBe(jdk22.home)
    expect(posix(pickJdtlsJdk([], {
      DSH_JDTLS_JAVA: '/opt/forced/bin/java',
    }, 'linux', {
      exists: path => posix(path).endsWith('/opt/forced/bin/java'),
      javaMajor: () => undefined,
    })?.home ?? '')).toBe('/opt/forced')
    expect(pickJdtlsJdk([jdk21], {
      DSH_JDTLS_JAVA: jdk8.home,
    }, 'linux', {
      exists: () => true,
      javaMajor: command => command.includes('java8') ? 8 : 21,
    })?.home).toBe(jdk21.home)
    expect(pickJdtlsJdk([], { DSH_JDTLS_JAVA: '/missing' }, 'linux', {
      exists: () => false,
    })).toBeUndefined()
    expect(pickJdtlsJdk([jdk21], { DSH_JDTLS_JAVA: '/opt/java17' }, 'linux', {
      exists: () => true,
      javaMajor: command => command.includes('java17') ? 17 : 21,
    })?.home).toBe(jdk21.home)
    expect(pickJdtlsJdk([], { DSH_JDTLS_JAVA: '/opt/forced' }, 'linux', {
      exists: path => path === join('/opt/forced', 'bin', 'java'),
      javaMajor: () => 21,
    })?.major).toBe(21)
  })

  it('refuses to launch JDT LS when the machine only has Java 8 or 17', () => {
    const jdk8 = join('/opt', 'java8')
    const jdk17 = join('/opt', 'java17')
    expect(() => resolveJdtlsJavaCommand({ JAVA_HOME: jdk8 }, 'linux', {
      exists: path => path === join(jdk8, 'bin', 'java'),
      list: () => [],
      javaMajor: () => 8,
    })).toThrow(/Java 21\+/)
    expect(() => resolveJdtlsJavaCommand({ JAVA_HOME: jdk17 }, 'linux', {
      exists: path => path === join(jdk17, 'bin', 'java'),
      list: () => [],
      javaMajor: () => 17,
    })).toThrow(/Java 21\+/)
    expect(resolveJdtlsJavaCommand({ JAVA_HOME: '' }, 'linux', {
      exists: () => false,
      list: () => [],
      javaMajor: () => undefined,
    })).toBe('java')
  })

  it('reads the project Java level from markers and walks parents', () => {
    expect(detectProjectJavaVersion('/ws/mod', {
      exists: path => path === join('/ws', 'pom.xml'),
      readText: () => '<project><java.version>21</java.version></project>',
    })).toBe(21)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.java-version'),
      readText: () => '1.8\n',
    })).toBe(8)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'pom.xml'),
      readText: () => '<maven.compiler.release>17</maven.compiler.release>',
    })).toBe(17)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'pom.xml'),
      readText: () => '<maven.compiler.source>1.8</maven.compiler.source>',
    })).toBe(8)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'pom.xml'),
      readText: () => '<maven.compiler.target>11</maven.compiler.target>',
    })).toBe(11)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'build.gradle'),
      readText: () => 'sourceCompatibility = JavaVersion.VERSION_1_8',
    })).toBe(8)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'build.gradle.kts'),
      readText: () => 'sourceCompatibility = JavaVersion.VERSION_17',
    })).toBe(17)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'build.gradle'),
      readText: () => "sourceCompatibility = '21'",
    })).toBe(21)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.sdkmanrc'),
      readText: () => 'java=17.0.12-tem\n',
    })).toBe(17)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.tool-versions'),
      readText: () => 'java 21.0.2\nnodejs 20.0.0\n',
    })).toBe(21)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.java-version') || path === join('/ws', 'pom.xml'),
      readText: (path) => {
        if (path.endsWith('.java-version')) throw new Error('unreadable')
        return '<java.version>17</java.version>'
      },
    })).toBe(17)
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'pom.xml'),
      readText: () => '<maven.compiler.release>nope</maven.compiler.release>',
    })).toBeUndefined()
    expect(detectProjectJavaVersion('/ws', { exists: () => false })).toBeUndefined()
    expect(toJdtRuntimes([
      { home: '/opt/java21', java: '/opt/java21/bin/java', major: 21 },
      { home: '/opt/java17', java: '/opt/java17/bin/java', major: 17 },
      { home: '/opt/java7', java: '/opt/java7/bin/java', major: 7 },
      { home: '/opt/java8', java: '/opt/java8/bin/java', major: 8 },
    ], 8)).toEqual([
      { name: 'JavaSE-21', path: '/opt/java21' },
      { name: 'JavaSE-17', path: '/opt/java17' },
      { name: 'JavaSE-1.8', path: '/opt/java8', default: true },
    ])
    expect(toJdtRuntimes([
      { home: '/opt/java17', java: '/opt/java17/bin/java', major: 17 },
      { home: '/opt/jdk17b', java: '/opt/jdk17b/bin/java', major: 17 },
    ], 8)).toEqual([{ name: 'JavaSE-17', path: '/opt/java17' }])
    expect(detectProjectJavaVersion('/', { exists: () => false })).toBeUndefined()
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', 'build.gradle'),
      readText: () => 'plugins {}',
    })).toBeUndefined()
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.sdkmanrc'),
      readText: () => 'nodejs=20\n',
    })).toBeUndefined()
    expect(detectProjectJavaVersion('/ws', {
      exists: path => path === join('/ws', '.tool-versions'),
      readText: () => 'nodejs 20.0.0\n',
    })).toBeUndefined()
    const onDisk = temp()
    writeFileSync(join(onDisk, '.java-version'), '17\n')
    expect(detectProjectJavaVersion(onDisk)).toBe(17)
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
    const prevHome = process.env.DSH_JDTLS_HOME
    const prevDsh = process.env.DSH_HOME
    process.env.DSH_JDTLS_HOME = home
    process.env.DSH_HOME = home
    fakeProduct(home, process.platform)
    try {
      const defaults = await javaSessionLaunch('/ws/defaults', { download: false })
      expect(defaults.args).toContain('-data')
    } finally {
      if (prevHome === undefined) delete process.env.DSH_JDTLS_HOME
      else process.env.DSH_JDTLS_HOME = prevHome
      if (prevDsh === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prevDsh
    }
  })

  it('javaSessionLaunch starts JDT with Java 21+ and advertises project runtimes', async () => {
    const root = temp()
    const jdk8 = join(root, 'java8')
    const jdk17 = join(root, 'java17')
    const jdk21 = join(root, 'java21')
    const jdtls = join(root, 'jdtls')
    const ws = join(root, 'ws')
    fakeProduct(jdtls, 'linux')
    mkdirSync(join(jdk8, 'bin'), { recursive: true })
    mkdirSync(join(jdk17, 'bin'), { recursive: true })
    mkdirSync(join(jdk21, 'bin'), { recursive: true })
    mkdirSync(ws, { recursive: true })
    writeFileSync(join(jdk8, 'bin', 'java'), '')
    writeFileSync(join(jdk17, 'bin', 'java'), '')
    writeFileSync(join(jdk21, 'bin', 'java'), '')
    writeFileSync(join(ws, 'pom.xml'), '<maven.compiler.source>1.8</maven.compiler.source>')
    const launch = await javaSessionLaunch(ws, {
      env: { DSH_JDTLS_HOME: jdtls, DSH_HOME: root, JAVA_HOME: jdk17 },
      platform: 'linux',
      download: false,
      io: {
        exists: path => path.startsWith(root) && existsSync(path),
        javaMajor: (command) => {
          if (command.includes('java21')) return 21
          if (command.includes('java17')) return 17
          if (command.includes('java8')) return 8
          return undefined
        },
      },
    })
    expect(launch.command).toBe(join(jdk21, 'bin', 'java'))
    const runtimes = (launch.initializationOptions as {
      settings: { java: { configuration: { runtimes: Array<{ name: string; default?: boolean }> } } }
    }).settings.java.configuration.runtimes
    expect(runtimes.some(runtime => runtime.name === 'JavaSE-1.8' && runtime.default === true)).toBe(true)
    expect(runtimes.some(runtime => runtime.name === 'JavaSE-17')).toBe(true)
    expect(runtimes.some(runtime => runtime.name === 'JavaSE-21')).toBe(true)
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
