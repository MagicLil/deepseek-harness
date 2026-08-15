/**
 * Resolve a local Eclipse JDT Language Server install and the Java binary.
 * First-use download is injectable so tests never hit the network.
 * JDT LS 1.57+ needs Java 21+ to run (OSGi ee=JavaSE/21). Project compile
 * JDKs (8 / 17 / 21) are discovered separately and advertised as runtimes.
 * @module @deepseek-ai/dsh-lsp-languages/resolve-java
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Pinned JDT LS milestone (Homebrew 1.57.0 tarball name). */
export const JDTLS_MILESTONE = '1.57.0'
/** Tarball file name under the milestone directory. */
export const JDTLS_TARBALL = 'jdt-language-server-1.57.0-202602261110.tar.gz'
/** Official milestone download URL. */
export const JDTLS_URL = `https://download.eclipse.org/jdtls/milestones/${JDTLS_MILESTONE}/${JDTLS_TARBALL}`
/** Minimum major that can launch this JDT LS milestone (bundles require JavaSE 21). */
export const JDTLS_MIN_JAVA = 21

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
  /** Major version of a `java` / `java.exe` binary (`8` / `17` / `21`). */
  readonly javaMajor?: (command: string) => number | undefined
  /** Read a text file (project `pom.xml` / `.java-version`). */
  readonly readText?: (path: string) => string
}

/** One JDK found on disk. */
export interface DiscoveredJdk {
  /** JDK home (`JAVA_HOME` shape). */
  readonly home: string
  /** Absolute `java` / `java.exe`. */
  readonly java: string
  /** Major version (`8` / `17` / `21`). */
  readonly major: number
}

/** One JDT `java.configuration.runtimes` entry. */
export interface JdtRuntime {
  /** Eclipse execution-environment name (`JavaSE-1.8` / `JavaSE-17`). */
  readonly name: string
  /** JDK home. */
  readonly path: string
  /** Whether this runtime is the project default. */
  readonly default?: boolean
}

/**
 * Parse a version token (`17`, `1.8`, `21.0.2`, `21-tem`) into a major.
 * @param raw - version token or first line of `.java-version`.
 */
export function parseJavaMajor(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/^java-?/i, '').replace(/[-_+].*$/, '')
  const match = /^(\d+)(?:\.(\d+))?/.exec(cleaned)
  if (match === null) return undefined
  const first = Number(match[1])
  if (first === 1 && match[2] !== undefined) return Number(match[2])
  return first
}

/**
 * Parse `java -version` stderr/stdout into a major.
 * @param text - combined process output.
 */
export function parseJavaVersionOutput(text: string): number | undefined {
  const quoted = /version\s+"([^"]+)"/.exec(text)?.[1]
  if (quoted !== undefined) return parseJavaMajor(quoted)
  return parseJavaMajor(text)
}

/**
 * Run `java -version` and return the major, or undefined when unreadable.
 * @param command - java executable.
 */
export function javaMajorVersion(command: string): number | undefined {
  try {
    const result = spawnSync(command, ['-version'], { encoding: 'utf8' })
    return parseJavaVersionOutput(`${result.stderr ?? ''}\n${result.stdout ?? ''}`)
  } catch {
    /* v8 ignore next -- spawnSync almost never throws; a missing binary returns status. */
    return undefined
  }
}

/**
 * Eclipse execution-environment name for a JDK major.
 * @param major - `8` / `17` / `21`.
 */
export function jdtRuntimeName(major: number): string {
  if (major <= 8) return 'JavaSE-1.8'
  return `JavaSE-${major}`
}

/**
 * Java executable: a discovered 21+ JDK when present, else `JAVA_HOME/bin` or PATH.
 * JDT LS itself needs 21+; project compile JDKs are advertised separately.
 * @param env - process env.
 * @param platform - `process.platform`.
 * @param io - optional fs / version overrides.
 */
export function resolveJavaCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  io: JdtlsIo = {},
): string {
  const picked = pickJdtlsJdk(discoverJdks(env, platform, io), env, platform, io)
  if (picked !== undefined) return picked.java
  const exe = javaExe(platform)
  const home = env.JAVA_HOME
  if (typeof home === 'string' && home !== '') {
    const candidate = join(home, 'bin', exe)
    if (existsFn(io)(candidate)) return candidate
  }
  return exe
}

/**
 * Java used to launch JDT LS. Throws when the machine only has confirmed Java < 21.
 * @param env - process env.
 * @param platform - `process.platform`.
 * @param io - optional fs / version overrides.
 */
export function resolveJdtlsJavaCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  io: JdtlsIo = {},
): string {
  const jdks = discoverJdks(env, platform, io)
  const picked = pickJdtlsJdk(jdks, env, platform, io)
  if (picked !== undefined) return picked.java
  const old = jdks.filter(jdk => jdk.major < JDTLS_MIN_JAVA)
  if (old.length > 0) {
    throw new Error(
      `lsp-languages: JDT LS ${JDTLS_MILESTONE} needs Java ${JDTLS_MIN_JAVA}+ to run. Found only ${old.map(jdk => `Java ${jdk.major} at ${jdk.home}`).join('; ')}. Install JDK ${JDTLS_MIN_JAVA}+ (e.g. D:\\developTool\\java21) or set DSH_JDTLS_JAVA.`,
    )
  }
  return resolveJavaCommand(env, platform, io)
}

/**
 * Scan env, siblings, PATH, and well-known vendor folders for JDKs.
 * @param env - process env.
 * @param platform - `process.platform`.
 * @param io - optional fs / version overrides.
 */
export function discoverJdks(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  io: JdtlsIo = {},
): DiscoveredJdk[] {
  const exists = existsFn(io)
  const list = listFn(io)
  const majorOf = io.javaMajor ?? javaMajorVersion
  const exe = javaExe(platform)
  const homes = new Set<string>()
  const addHome = (home: string | undefined): void => {
    if (typeof home === 'string' && home !== '') homes.add(home)
  }
  addHome(asHome(env.DSH_JDTLS_JAVA, exe))
  addHome(env.JAVA_HOME)
  addHome(env.JDK_HOME)
  for (const home of [...homes]) addListedChildren(dirname(home), homes, list)
  for (const root of wellKnownJdkRoots(env, platform)) {
    if (exists(root)) addListedChildren(root, homes, list)
  }
  for (const home of homesFromPath(env, platform, exists, exe)) addHome(home)

  const found: DiscoveredJdk[] = []
  const seen = new Set<string>()
  for (const home of homes) {
    const java = join(home, 'bin', exe)
    if (!exists(java)) continue
    const major = majorOf(java)
    if (major === undefined) continue
    const key = normalizePathKey(home, platform)
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ home, java, major })
  }
  return found.sort((a, b) => b.major - a.major || a.home.localeCompare(b.home))
}

/**
 * Pick the JDK that should run JDT LS (21+). `DSH_JDTLS_JAVA` wins, then `JAVA_HOME` if ≥21, else newest 21+.
 * @param jdks - discovered JDKs.
 * @param env - process env.
 * @param platform - `process.platform`.
 * @param io - optional fs / version overrides.
 */
export function pickJdtlsJdk(
  jdks: readonly DiscoveredJdk[],
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  io: JdtlsIo = {},
): DiscoveredJdk | undefined {
  const exists = existsFn(io)
  const majorOf = io.javaMajor ?? javaMajorVersion
  const exe = javaExe(platform)
  const override = asHome(env.DSH_JDTLS_JAVA, exe)
  if (override !== undefined) {
    const java = join(override, 'bin', exe)
    if (exists(java)) {
      const major = majorOf(java)
      if (major === undefined || major >= JDTLS_MIN_JAVA) {
        return { home: override, java, major: major ?? JDTLS_MIN_JAVA }
      }
    }
  }
  const modern = jdks.filter(jdk => jdk.major >= JDTLS_MIN_JAVA).toSorted((a, b) => b.major - a.major)
  const fromHome = modern.find(jdk => samePath(jdk.home, env.JAVA_HOME, platform))
  return fromHome ?? modern[0]
}

/**
 * Read the project's intended Java major from `.java-version` / Maven / Gradle, walking parents.
 * @param workspacePath - canonical workspace (or inferred module root).
 * @param io - optional fs overrides.
 */
export function detectProjectJavaVersion(workspacePath: string, io: JdtlsIo = {}): number | undefined {
  const exists = existsFn(io)
  const readText = io.readText ?? ((path: string) => readFileSync(path, 'utf8'))
  let dir = workspacePath
  for (let i = 0; i < 8; i += 1) {
    const found = projectJavaInDir(dir, exists, readText)
    if (found !== undefined) return found
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/**
 * Map discovered JDKs to JDT `java.configuration.runtimes`, marking the project major as default.
 * @param jdks - discovered JDKs.
 * @param projectMajor - project compile major when known.
 */
export function toJdtRuntimes(jdks: readonly DiscoveredJdk[], projectMajor?: number): JdtRuntime[] {
  const byName = new Map<string, DiscoveredJdk>()
  for (const jdk of jdks) {
    const name = jdtRuntimeName(jdk.major)
    const current = byName.get(name)
    if (current === undefined || (projectMajor === jdk.major && current.major !== projectMajor)) {
      byName.set(name, jdk)
    }
  }
  return [...byName.entries()].map(([name, jdk]) => ({
    name,
    path: jdk.home,
    ...(projectMajor === jdk.major ? { default: true } : {}),
  }))
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
  const java = resolveJdtlsJavaCommand(env, platform, io)
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
 * Ensure JDT LS, create the Equinox data dir, and return the spawn argv plus JDT runtimes.
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
): Promise<{ command: string; args: string[]; initializationOptions?: unknown }> {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const io = options.io ?? {}
  const runtime = await ensureJdtls(options)
  const dataDir = jdtlsDataDir(workspacePath, env)
  const mkdir = io.mkdir ?? ((path: string) => { mkdirSync(path, { recursive: true }) })
  mkdir(dataDir)
  const argv = javaServerArgv(runtime, dataDir)
  const runtimes = toJdtRuntimes(discoverJdks(env, platform, io), detectProjectJavaVersion(workspacePath, io))
  if (runtimes.length === 0) return argv
  return {
    ...argv,
    initializationOptions: {
      settings: { java: { configuration: { runtimes } } },
    },
  }
}

function javaExe(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'java.exe' : 'java'
}

function existsFn(io: JdtlsIo): (path: string) => boolean {
  return io.exists ?? existsSync
}

function listFn(io: JdtlsIo): (path: string) => string[] {
  return io.list ?? ((path: string) => {
    try {
      return readdirSync(path)
    } catch {
      return []
    }
  })
}

function asHome(value: string | undefined, exe: string): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  if (value.endsWith(exe) || value.endsWith('java') || value.endsWith('java.exe')) {
    return dirname(dirname(value))
  }
  return value
}

function wellKnownJdkRoots(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const user = env.USERPROFILE ?? env.HOME ?? ''
  if (platform === 'win32') {
    return [
      'D:\\developTool',
      'C:\\developTool',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Zulu',
      join(user, '.jdks'),
      join(user, '.sdkman', 'candidates', 'java'),
    ]
  }
  return [
    '/usr/lib/jvm',
    '/usr/java',
    '/opt/java',
    '/opt/homebrew/opt/openjdk',
    join(user, '.sdkman', 'candidates', 'java'),
    join(user, '.jdks'),
  ]
}

function addListedChildren(
  parent: string,
  homes: Set<string>,
  list: (path: string) => string[],
): void {
  if (!isSafeToList(parent)) return
  for (const name of list(parent)) {
    if (/java|jdk|jre|temurin|adoptium|zulu|corretto|graal|semeru|liberica/i.test(name)) {
      homes.add(join(parent, name))
    }
  }
}

function isSafeToList(dir: string): boolean {
  const normalized = dir.replace(/[\\/]+$/, '')
  return normalized !== '' && normalized !== '/' && !/^[a-zA-Z]:$/.test(normalized)
}

function homesFromPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
  exe: string,
): string[] {
  const pathEnv = env.PATH ?? env.Path ?? ''
  const sep = platform === 'win32' ? ';' : ':'
  const homes: string[] = []
  for (const dir of pathEnv.split(sep)) {
    if (dir !== '' && exists(join(dir, exe))) homes.push(dirname(dir))
  }
  return homes
}

function normalizePathKey(path: string, platform: NodeJS.Platform): string {
  const normalized = path.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  return platform === 'win32' ? normalized.toLowerCase() : normalized
}

function samePath(a: string, b: string | undefined, platform: NodeJS.Platform): boolean {
  if (typeof b !== 'string' || b === '') return false
  return normalizePathKey(a, platform) === normalizePathKey(b, platform)
}

function projectJavaInDir(
  dir: string,
  exists: (path: string) => boolean,
  readText: (path: string) => string,
): number | undefined {
  const files: Array<{ name: string; parse: (text: string) => number | undefined }> = [
    { name: '.java-version', parse: text => parseJavaMajor(text) },
    { name: '.sdkmanrc', parse: versionFromSdkmanrc },
    { name: '.tool-versions', parse: versionFromToolVersions },
    { name: 'pom.xml', parse: versionFromPom },
    { name: 'build.gradle', parse: versionFromGradle },
    { name: 'build.gradle.kts', parse: versionFromGradle },
  ]
  for (const file of files) {
    const path = join(dir, file.name)
    if (!exists(path)) continue
    try {
      const found = file.parse(readText(path))
      if (found !== undefined) return found
    } catch {
      /* unreadable marker; try the next file / parent. */
    }
  }
  return undefined
}

function versionFromPom(text: string): number | undefined {
  const patterns = [
    /<maven\.compiler\.release>\s*([^<]+)\s*</i,
    /<maven\.compiler\.source>\s*([^<]+)\s*</i,
    /<java\.version>\s*([^<]+)\s*</i,
    /<maven\.compiler\.target>\s*([^<]+)\s*</i,
  ]
  for (const pattern of patterns) {
    const token = pattern.exec(text)?.[1]
    if (token === undefined) continue
    const major = parseJavaMajor(token.trim())
    if (major !== undefined) return major
  }
  return undefined
}

function versionFromGradle(text: string): number | undefined {
  if (/JavaVersion\.VERSION_1_8/.test(text)) return 8
  const named = /JavaVersion\.VERSION_(\d+)/.exec(text)?.[1]
  if (named !== undefined) return Number(named)
  const source = /sourceCompatibility\s*=\s*['"]?(\d+|1\.\d+)/.exec(text)?.[1]
  if (source !== undefined) return parseJavaMajor(source)
  return undefined
}

function versionFromSdkmanrc(text: string): number | undefined {
  const token = /^java\s*=\s*(\S+)/m.exec(text)?.[1]
  return token === undefined ? undefined : parseJavaMajor(token)
}

function versionFromToolVersions(text: string): number | undefined {
  const token = /^java\s+(\S+)/m.exec(text)?.[1]
  return token === undefined ? undefined : parseJavaMajor(token)
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
