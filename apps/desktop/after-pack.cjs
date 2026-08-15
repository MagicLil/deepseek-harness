'use strict'

const { cpSync, existsSync, mkdirSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

/**
 * Copy peer-only workspace packages into the unpacked app before NSIS runs.
 * `DSH_DESKTOP_PACK_ROOT` is the `pnpm deploy` tree (see pack-desktop.ts).
 * @param {import('app-builder-lib').AfterPackContext} context
 */
module.exports = async function afterPack(context) {
  const packRoot = process.env.DSH_DESKTOP_PACK_ROOT
  if (packRoot === undefined || packRoot === '') return
  const source = join(packRoot, 'node_modules', '@deepseek-ai')
  const dest = join(context.appOutDir, 'resources', 'app', 'node_modules', '@deepseek-ai')
  if (!existsSync(source)) return
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue
    const from = join(source, name)
    const to = join(dest, name)
    if (!existsSync(join(from, 'package.json'))) continue
    if (existsSync(join(to, 'package.json'))) continue
    cpSync(from, to, { recursive: true, dereference: true })
  }
}
