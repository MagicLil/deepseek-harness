/**
 * Resolve a local Eclipse JDT Language Server install and the Java binary.
 * First-use download is injectable so tests never hit the network.
 * @module @deepseek-ai/dsh-lsp-languages/resolve-java
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Pinned JDT LS milestone (Homebrew 1.57.0 tarball name). */
export const JDTLS_MILESTONE = '1.57.0'
/** Tarball file name under the milestone directory. */
export const JDTLS_TARBALL = 'jdt-language-server-1.57.0-202602261110.tar.gz'
/** Official milestone download URL. */
export const JDTLS_URL = `https://download.eclipse.org/jdtls/milestones/${JDTLS_MILESTONE}/${JDTLS_TARBALL}`

/** A resolved JDT LS product tree. */
export interface JdtlsRuntime {
  /** `java` / `java.exe` used to launch Equinox. */
  readonly java: string
  /** Absolute Equinox launcher jar. */
  readonly launcher: string
  /** Absolute `config_win` / `config_mac` / `config_linux` directory. */
  readonly configuration: string
}

/** Filesystem / network face tests replace. */
export interface JdtlsIo {
  /** Whether a path exists. */
  readonly exists?: (path: string) => boolean
  /** List a directory. */
  readonly list?: (path: string) => string[]
  /** Fetch the tarball. */
  readonly fetchBuffer?: (url: string) => Promise<Buffer>
  /** Extract a `.tar.gz` into `dest`. */
  readonly extract?: (tarball: string, dest: string) => void
  /** Write bytes. */
  readonly writeFile?: (path: string, bytes: Buffer) => void
  /** Create directories. */
  readonly mkdir?: (path: string) => void
}

/**
 * Java executable: `JAVA_HOME/bin/java` when present, otherwise `java` on PATH.
 * @param env - process env.
 * @param platform - `process.platform`.
 */
export function resolveJavaCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const home = env.JAVA_HOME
  if (typeof home === 'string' && home !== '') {
    const exe = platform === 'win32' ? 'java.exe' : 'java'
    const candidate = join(home, 'bin', exe)
    if (existsSync(candidate)) return candidate
  }
  return platform === 'win32' ? 'java.exe' : 'java'
}

/**
 * Directory that should hold an extracted JDT LS tree.
 * @param env - process env (`DSH_JDTLS_HOME` wins, else `~/.dsh/language-servers/jdtls`).
 */
export function jdtlsHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.DSH_JDTLS_HOME
  if (typeof override === 'string' && override !== '') return override
  return join(resolveDshHome(undefined, env), 'language-servers', 'jdtls')
}

/**
 * Platform config folder name shipped inside the JDT LS tarball.
 * @param platform - `process.platform`.
 */
export function jdtlsConfigName(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') return 'config_win'
  if (platform === 'darwin') return 'config_mac'
  return 'config_linux'
}

/**
 * Inspect an extracted JDT LS tree. Throws when the launcher or config is missing.
 * @param home - extracted product root.
 * @param java - java executable.
 * @param io - optional fs overrides.
 * @param platform - `process.platform`.
 */
export function inspectJdtls(
  home: string,
  java: string,
  io: JdtlsIo = {},
  platform: NodeJS.Platform = process.platform,
): JdtlsRuntime {
  const exists = io.exists ?? existsSync
  const list = io.list ?? ((path: string) => readdirSync(path))
  const plugins = join(home, 'plugins')
  if (!exists(plugins)) {
    throw new Error(`lsp-languages: JDT LS plugins directory missing at ${plugins}`)
  }
  const launcher = list(plugins).find(name => name.startsWith('org.eclipse.equinox.launcher_') && name.endsWith('.jar'))
  if (launcher === undefined) {
    throw new Error(`lsp-languages: Equinox launcher jar missing under ${plugins}`)
  }
  const configuration = join(home, jdtlsConfigName(platform))
  if (!exists(configuration)) {
    throw new Error(`lsp-languages: JDT LS ${jdtlsConfigName(platform)} missing at ${configuration}`)
  }
  return { java, launcher: join(plugins, launcher), configuration }
}

/**
 * Per-workspace Equinox `-data` directory under the harness home.
 * @param workspacePath - canonical workspace path.
 * @param env - process env.
 */
export function jdtlsDataDir(workspacePath: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = createHash('sha256').update(workspacePath).digest('hex').slice(0, 16)
  return join(resolveDshHome(undefined, env), 'jdtls-data', key)
}

/**
 * Download and extract the pinned JDT LS milestone into `home`.
 * @param home - destination directory.
 * @param io - network / extract overrides.
 */
export async function downloadJdtls(home: string, io: JdtlsIo = {}): Promise<void> {
  const mkdir = io.mkdir ?? ((path: string) => { mkdirSync(path, { recursive: true }) })
  const writeFile = io.writeFile ?? ((path: string, bytes: Buffer) => { writeFileSync(path, bytes) })
  const fetchBuffer = io.fetchBuffer ?? defaultFetch
  const extract = io.extract ?? defaultExtract
  mkdir(home)
  const tarball = join(home, JDTLS_TARBALL)
  writeFile(tarball, await fetchBuffer(JDTLS_URL))
  extract(tarball, home)
}

/**
 * Return a usable JDT LS runtime, downloading once when the tree is absent.
 * @param options - env / io / skip-download.
 */
export async function ensureJdtls(options: {
  env?: NodeJS.ProcessEnv
  io?: JdtlsIo
  platform?: NodeJS.Platform
  download?: boolean
} = {}): Promise<JdtlsRuntime> {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const io = options.io ?? {}
  const exists = io.exists ?? existsSync
  const java = resolveJavaCommand(env, platform)
  const home = jdtlsHome(env)
  const plugins = join(home, 'plugins')
  if (!exists(plugins)) {
    if (options.download === false) {
      throw new Error(
        `lsp-languages: JDT LS is not installed at ${home}. Set DSH_JDTLS_HOME or allow first-use download from ${JDTLS_URL}`,
      )
    }
    await downloadJdtls(home, io)
  }
  return inspectJdtls(home, java, io, platform)
}

/**
 * Build the no-shell argv for one JDT LS process.
 * @param runtime - resolved java + launcher + config.
 * @param dataDir - Equinox `-data` directory (created by the caller).
 */
export function javaServerArgv(runtime: JdtlsRuntime, dataDir: string): {
  command: string
  args: string[]
} {
  return {
    command: runtime.java,
    args: [
      '-Declipse.application=org.eclipse.jdt.ls.core.id1',
      '-Dosgi.bundles.defaultStartLevel=4',
      '-Declipse.product=org.eclipse.jdt.ls.core.product',
      '-Dlog.level=ERROR',
      '-Xmx1G',
      '--add-modules=ALL-SYSTEM',
      '--add-opens=java.base/java.util=ALL-UNNAMED',
      '--add-opens=java.base/java.lang=ALL-UNNAMED',
      '-jar',
      runtime.launcher,
      '-configuration',
      runtime.configuration,
      '-data',
      dataDir,
    ],
  }
}

/**
 * Ensure JDT LS, create the Equinox data dir, and return the spawn argv.
 * @param workspacePath - canonical workspace path (hashed into `-data`).
 * @param options - env / io / skip-download (same as {@link ensureJdtls}).
 */
export async function javaSessionLaunch(
  workspacePath: string,
  options: {
    env?: NodeJS.ProcessEnv
    io?: JdtlsIo
    platform?: NodeJS.Platform
    download?: boolean
  } = {},
): Promise<{ command: string; args: string[] }> {
  const runtime = await ensureJdtls(options)
  const dataDir = jdtlsDataDir(workspacePath, options.env)
  const mkdir = options.io?.mkdir ?? ((path: string) => { mkdirSync(path, { recursive: true }) })
  mkdir(dataDir)
  return javaServerArgv(runtime, dataDir)
}

async function defaultFetch(url: string): Promise<Buffer> {
  const response = await fetch(url)
  /* v8 ignore next -- a failed CDN fetch is a host error, not a protocol bug. */
  if (!response.ok) throw new Error(`lsp-languages: JDT LS download failed ${response.status} ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

function defaultExtract(tarball: string, dest: string): void {
  const result = spawnSync('tar', ['-xzf', tarball, '-C', dest], { encoding: 'utf8' })
  /* v8 ignore next -- Windows/macOS ship tar; a missing tar is an environment error. */
  if (result.status !== 0) {
    throw new Error(`lsp-languages: tar extract failed: ${result.stderr || result.stdout || result.status}`)
  }
}
