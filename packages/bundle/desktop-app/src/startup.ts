/**
 * The desktop app's command-line provider: parses `dsh --profile desktop`
 * flags and provides {@link DESKTOP_STARTUP_SERVICE}.
 * @module @deepseek-ai/dsh-desktop-app/startup
 */

import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@deepseek-ai/dsh-cmdline'

/** Stable Cordis plugin name. */
export const name = 'desktop-startup'

/** Services required before the flags can be resolved. */
export const inject = ['cmdlineArgs']

/** Service provided by this ordinary plugin. */
export const DESKTOP_STARTUP_SERVICE = 'desktopStartup'

/** What desktop rows read from {@link DESKTOP_STARTUP_SERVICE}. */
export interface DesktopStartupValues {
  /** Reserved for future desktop flags; currently always empty. */
  readonly ready: true
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    desktopStartup: DesktopStartupValues
  }
}

/**
 * This app's command: its flags, its description, and its help text.
 * @returns a fresh program, so one process can parse more than once (tests).
 */
function desktopCommand(): Command {
  return new Command()
    .name('dsh --profile desktop')
    .description('Open the DeepSeek Harness desktop UI (Electron + IPC).')
    .helpOption('-h, --help', 'show this help')
    .addHelpText('after', `
Examples:
  dsh --profile desktop                      open the desktop window
  dsh desktop                                same as --profile desktop
`)
}

/**
 * Parse and provide the desktop invocation as an ordinary Cordis service.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const program = desktopCommand()
  program.action(() => {
    ctx.provide(DESKTOP_STARTUP_SERVICE, { ready: true } satisfies DesktopStartupValues)
  })
  parseCmdline(ctx, program)
}
