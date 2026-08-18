/** Package-owned invariant companion for the Codex experience client plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-codex-experience'

/** Cordis companion plugin name. */
export const name = 'client-ui-codex-experience-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** The profile owns presentation only; ui-tool owns session and call invariants. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. @param ctx - invariant service context. @returns disposal callback. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
