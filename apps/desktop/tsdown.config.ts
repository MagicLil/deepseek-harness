import { defineConfig } from 'tsdown'

/**
 * Electron main, relaunch helper, and the Cordis-facing shell API.
 *
 * Keep `@deepseek-ai/dsh/*` and other workspace packages external so
 * `profile-boot`'s `INSTALL_ANCHOR` stays `apps/cli/package.json` (bundling
 * would rewrite `import.meta.url` to this package and break bundle resolution).
 * Preload stays the checked-in plain `preload.mjs` Electron loads via
 * `webPreferences.preload` — do not prefer a bundled preload here.
 */
export default defineConfig({
  entry: [
    'lib/types/electron-main.js',
    'lib/types/relaunch.js',
    'lib/types/shell.js',
  ],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      'electron',
      /^@deepseek-ai\//,
    ],
  },
})
