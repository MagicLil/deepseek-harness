/**
 * Put a `dsh` executable on PATH for Host children (community markets spawn
 * `dsh plugin`). After Electron relaunch, argv[1] is electron-main.js so
 * those plugins fall back to a PATH lookup that otherwise fails on Windows.
 * @module @deepseek-ai/dsh-desktop/cli-shim
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

/** Inputs for a shim that re-invokes the Node CLI that launched desktop. */
export interface CliShimSpec {
  /** Real Node binary (`DSH_NODE_EXEC_PATH`), not Electron. */
  readonly node: string
  /** Node execArgv (`--import tsx/esm`, …). */
  readonly execArgv: readonly string[]
  /** Absolute CLI entry (`…/bin.ts` or `…/bin.js`). */
  readonly entry: string
}

/**
 * Quote one Windows cmd.exe argument.
 * @param value - path or flag.
 */
export function quoteCmd(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

/**
 * Quote one POSIX sh argument.
 * @param value - path or flag.
 */
export function quoteSh(value: string): string {
  return `'${value.replace(/'/g, '\'\\\'\'')}'`
}

/**
 * Windows `dsh.cmd` body.
 * @param spec - Node + CLI entry.
 */
export function windowsShimSource(spec: CliShimSpec): string {
  const args = [...spec.execArgv, spec.entry].map(quoteCmd).join(' ')
  return `@echo off\r\n${quoteCmd(spec.node)} ${args} %*\r\n`
}

/**
 * POSIX `dsh` body.
 * @param spec - Node + CLI entry.
 */
export function posixShimSource(spec: CliShimSpec): string {
  const args = [spec.node, ...spec.execArgv, spec.entry].map(quoteSh).join(' ')
  return `#!/bin/sh\nexec ${args} "$@"\n`
}

/**
 * Write the shim into a temp directory and return that directory.
 * @param spec - Node + CLI entry.
 * @param dir - destination directory (tests pass a temp folder).
 */
export function writeCliShim(spec: CliShimSpec, dir = join(tmpdir(), 'dsh-desktop-cli')): string {
  mkdirSync(dir, { recursive: true })
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'dsh.cmd'), windowsShimSource(spec), 'utf8')
  }
  else {
    writeFileSync(join(dir, 'dsh'), posixShimSource(spec), { encoding: 'utf8', mode: 0o755 })
  }
  return dir
}

/**
 * Prepend `dir` to PATH on a copied env object.
 * @param env - process env to mutate.
 * @param dir - shim directory.
 */
export function prependPath(env: NodeJS.ProcessEnv, dir: string): void {
  const current = env.PATH ?? env.Path ?? ''
  env.PATH = current === '' ? dir : `${dir}${delimiter}${current}`
  if (process.platform === 'win32') env.Path = env.PATH
}
