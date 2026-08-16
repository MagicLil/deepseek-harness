import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  posixShimSource,
  prependPath,
  quoteCmd,
  quoteSh,
  windowsShimSource,
  writeCliShim,
} from '../src/cli-shim.ts'

const spec = {
  node: 'C:\\Program Files\\nodejs\\node.exe',
  execArgv: ['--import', 'tsx/esm'],
  entry: 'D:\\repo\\apps\\cli\\src\\bin.ts',
}

describe('cli-shim', () => {
  it('quotes cmd and sh arguments', () => {
    expect(quoteCmd('C:\\a b\\node.exe')).toBe('"C:\\a b\\node.exe"')
    expect(quoteCmd('say "hi"')).toBe('"say \\"hi\\""')
    expect(quoteSh('/opt/homebrew/bin/node')).toBe("'/opt/homebrew/bin/node'")
    expect(quoteSh("it's")).toBe("'it'\\''s'")
  })

  it('writes a Windows shim that re-invokes Node plus the CLI entry', () => {
    const body = windowsShimSource(spec)
    expect(body).toContain('@echo off')
    expect(body).toContain('"C:\\Program Files\\nodejs\\node.exe"')
    expect(body).toContain('"--import"')
    expect(body).toContain('"tsx/esm"')
    expect(body).toContain('"D:\\repo\\apps\\cli\\src\\bin.ts"')
    expect(body).toContain('%*')
  })

  it('writes a POSIX shim that execs Node plus the CLI entry', () => {
    const body = posixShimSource({
      node: '/usr/bin/node',
      execArgv: ['--import', 'tsx/esm'],
      entry: '/repo/apps/cli/src/bin.ts',
    })
    expect(body.startsWith('#!/bin/sh\n')).toBe(true)
    expect(body).toContain("exec '/usr/bin/node' '--import' 'tsx/esm' '/repo/apps/cli/src/bin.ts' \"$@\"")
  })

  it('writes the platform shim into the given directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-cli-shim-'))
    expect(writeCliShim(spec, dir)).toBe(dir)
    const name = process.platform === 'win32' ? 'dsh.cmd' : 'dsh'
    const written = readFileSync(join(dir, name), 'utf8')
    expect(written).toContain(spec.entry)
    expect(written).toContain(spec.node)
  })

  it('prepends the shim directory to PATH and Path', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows\\System32' }
    prependPath(env, 'C:\\tmp\\dsh-desktop-cli')
    expect(env.PATH?.startsWith('C:\\tmp\\dsh-desktop-cli')).toBe(true)
    if (process.platform === 'win32') {
      expect(env.Path).toBe(env.PATH)
    }
  })
})
