/**
 * First-party TypeScript and Java language-server hosts. One plugin mounts
 * both gateways: `tsLsp` and `javaLsp` Remote namespaces plus `ctx.lsp`
 * providers. Does not claim `.vue` (owned by lsp-vue) or `.xml`.
 * @module @deepseek-ai/dsh-lsp-languages
 */

import type { Context } from '@deepseek-ai/cordis'
import { TsLspGateway } from './ts-gateway.ts'
import { JavaLspGateway } from './java-gateway.ts'

export type * from './types.ts'
export { toEditorHover, toEditorLocations } from './types.ts'
export { PersistentLspPool } from './pool.ts'
export type { PersistentLspPoolOptions, SessionLaunch } from './pool.ts'
export { PersistentLspSession } from './session.ts'
export { PersistentLspConnection, defaultServerRequest } from './connection.ts'
export {
  fileUrlFor,
  isTsPath,
  isJavaPath,
  languageIdFor,
  extensionOf,
  normalizeCompletions,
  normalizeDiagnostics,
  TS_EXTENSION_TO_LANGUAGE,
  JAVA_EXTENSION_TO_LANGUAGE,
} from './protocol.ts'
export { nodeLaunch } from './node-launch.ts'
export {
  resolveTypescriptRuntime,
  typescriptServerArgv,
  typescriptSessionLaunch,
} from './resolve-typescript.ts'
export {
  resolveJavaCommand,
  resolveJdtlsJavaCommand,
  discoverJdks,
  pickJdtlsJdk,
  detectProjectJavaVersion,
  toJdtRuntimes,
  jdtRuntimeName,
  parseJavaMajor,
  parseJavaVersionOutput,
  javaMajorVersion,
  jdtlsHome,
  jdtlsConfigName,
  inspectJdtls,
  jdtlsDataDir,
  downloadJdtls,
  ensureJdtls,
  javaServerArgv,
  javaSessionLaunch,
  JDTLS_MILESTONE,
  JDTLS_MIN_JAVA,
  JDTLS_TARBALL,
  JDTLS_URL,
} from './resolve-java.ts'
export { TsLspGateway } from './ts-gateway.ts'
export { JavaLspGateway } from './java-gateway.ts'

/** Cordis plugin name for loader diagnostics. */
export const name = 'lsp-languages'

/**
 * Mount both language-server gateways. Each gateway declares its own inject.
 * @param ctx - host Cordis root that already has `lsp` / `fs` / `subprocess`.
 */
export function apply(ctx: Context): void {
  ctx.plugin(TsLspGateway)
  ctx.plugin(JavaLspGateway)
}

export default apply
