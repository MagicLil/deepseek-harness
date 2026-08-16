/**
 * Windows batch argv wrapping for workspace checks.
 */
import { describe, expect, it } from 'vitest'
import {
  WINDOWS_CHECK_EXECUTABLE_ENV,
  wrapResolvedCheckArgv,
} from '../src/resolve-argv.ts'

describe('wrapResolvedCheckArgv', () => {
  it('passes POSIX / exe paths through', () => {
    expect(wrapResolvedCheckArgv('/usr/bin/pnpm', ['run', 'lint'], 'linux')).toEqual({
      argv: ['/usr/bin/pnpm', 'run', 'lint'],
    })
    expect(wrapResolvedCheckArgv(String.raw`C:\tools\pnpm.exe`, ['--version'], 'win32')).toEqual({
      argv: [String.raw`C:\tools\pnpm.exe`, '--version'],
    })
  })

  it('wraps Windows .cmd/.bat under cmd.exe with a quoted env path', () => {
    const cmd = String.raw`C:\tools\pnpm.cmd`
    expect(wrapResolvedCheckArgv(cmd, ['run', 'typecheck'], 'win32')).toEqual({
      argv: [
        'cmd.exe',
        '/d',
        '/v:off',
        '/s',
        '/c',
        `%${WINDOWS_CHECK_EXECUTABLE_ENV}%`,
        'run',
        'typecheck',
      ],
      env: { [WINDOWS_CHECK_EXECUTABLE_ENV]: `"${cmd}"` },
    })
    expect(wrapResolvedCheckArgv(String.raw`D:\npm\npm.bat`, ['run', 'test'], 'win32').argv[0])
      .toBe('cmd.exe')
  })

  it('wraps bare Windows names under cmd.exe for PATH lookup', () => {
    expect(wrapResolvedCheckArgv('pnpm', ['run', 'lint'], 'win32')).toEqual({
      argv: ['cmd.exe', '/d', '/v:off', '/s', '/c', 'pnpm', 'run', 'lint'],
    })
  })
})
