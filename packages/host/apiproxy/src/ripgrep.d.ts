/**
 * Minimal type surface for the `@vscode/ripgrep` package: an ESM module that
 * resolves the platform ripgrep binary (`@vscode/ripgrep-<platform>-<arch>`
 * optional dependency) and exports its absolute path as the named export
 * `rgPath` (no bundled type declarations). Mirrors the declaration the grep
 * tool package carries for the same dependency.
 * @module @deepseek-ai/dsh-host-apiproxy/ripgrep-types
 */

declare module '@vscode/ripgrep' {
  /** Absolute path to the packaged ripgrep executable for the current platform. */
  export const rgPath: string
}
