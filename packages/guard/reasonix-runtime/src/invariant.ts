/** Package-owned invariant companion for `@deepseek-ai/dsh-reasonix-runtime`. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-reasonix-runtime'

/** Cordis companion plugin name. */
export const name = 'reasonix-runtime-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

// No runtime invariant: the guard keeps only weak in-memory failure chains and
// owns no durable event relation that can be reconstructed after reload.
const install: InvariantInstaller = () => {}

/** Register the stateless package invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
