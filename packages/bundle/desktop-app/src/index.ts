/**
 * @deepseek-ai/dsh-desktop-app — desktop-surface runtime glue: resolve the
 * built web frontend dist, open the Electron shell over `dsh://` + IPC, and
 * register the desktop surface prompt section.
 * @module @deepseek-ai/dsh-desktop-app
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { addHarnessSourceSection } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-host-apiproxy'
import type {} from '@deepseek-ai/dsh-client-modules'

/** Stable Cordis plugin name. */
export const name = 'desktop-app'

/** This dsh installation's root, from either this package's source or built entry. */
const SOURCE_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

/** Services required before the desktop runtime can mount. */
export const inject = ['apiProxy', 'clientModules', 'desktopStartup', 'connection']

/** Plugin config. */
export interface Config {
  /** Register the model-visible desktop surface prompt section. */
  surfaceContext: boolean
}

export const Config: z<Config> = z.object({
  surfaceContext: z.boolean().default(true),
})

/** Dist location is workspace knowledge of this bundle. */
function resolveDistIndex(): string {
  const require = createRequire(import.meta.url)
  try {
    return require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')
  } catch {
    throw new Error('desktop-app: frontend dist not built; run pnpm run build from the repository root first')
  }
}

/** Test hook: hosts without a built frontend dist substitute the resolver. */
export const internals: { resolveDistIndex: () => string } = { resolveDistIndex }

/** Model-visible orientation for sessions created through `dsh desktop`. */
function desktopSurfacePrompt(): string {
  return 'You are X-Mart (万物智汇), an industrial-software coding assistant. '
    + 'You are talking with the user in the X-Mart desktop app, which is built on DeepSeek Harness (dsh). '
    + 'When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this desktop window. '
    + 'The desktop shell loads the same web UI over a local IPC bridge (not a browser URL). '
    + 'Do not start a replacement server unless the user asks.'
}

/**
 * Mount the desktop runtime: open the Electron window after the Loader settles.
 * @param ctx - plugin context.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  if (process.versions.electron === undefined) {
    throw new Error('desktop-app: must run inside Electron main (use `dsh desktop` / `dsh --profile desktop`)')
  }
  if (config.surfaceContext) {
    ctx.inject(['systemPrompt'], (promptCtx) => {
      addHarnessSourceSection(promptCtx, SOURCE_ROOT)
      promptCtx.systemPrompt.section({
        name: 'app:desktop-surface',
        order: -101,
        text: () => desktopSurfacePrompt(),
      })
    })
  }

  let disposeShell: (() => Promise<void>) | undefined
  const start = async (): Promise<void> => {
    // Dynamic import keeps the Electron shell out of the host tsc graph.
    const shellSpec = '@deepseek-ai/dsh-desktop/shell'
    const { openDesktopShell, resolvePreloadPath } = await import(shellSpec) as {
      openDesktopShell: (options: {
        distIndex: string
        ctx: Context
        preloadPath: string
      }) => Promise<{ dispose(): Promise<void>; closed: Promise<void> }>
      resolvePreloadPath: () => string
    }
    const shell = await openDesktopShell({
      distIndex: internals.resolveDistIndex(),
      ctx,
      preloadPath: resolvePreloadPath(),
    })
    disposeShell = () => shell.dispose()
    console.log('dsh desktop: window open')
    void shell.closed.then(() => {
      ctx.get('appExit')?.(0)
    })
  }

  const settled = ctx.get('loader')?.await()
  if (settled === undefined) {
    void start().catch((error: unknown) => {
      ctx.logger.error(error)
      throw error
    })
  } else {
    void settled.then(() => start(), () => {}).catch((error: unknown) => {
      ctx.logger.error(error)
    })
  }

  ctx.effect(() => () => {
    void disposeShell?.()
  }, 'desktop-app: close window')
}
