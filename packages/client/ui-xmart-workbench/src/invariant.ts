/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-xmart-workbench`.
 * @module @deepseek-ai/dsh-client-ui-xmart-workbench/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-xmart-workbench'

/** Cordis companion plugin name. */
export const name = 'client-ui-xmart-workbench-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the workbench registry and tab lists live in the
 * browser (in-memory plus localStorage). They are not an authoritative
 * host event stream or a cross-plugin data relationship this companion
 * can assert.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
