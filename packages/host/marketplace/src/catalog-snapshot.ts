/** Offline fallback for the awesome-dsh-plugin catalog. */

/** One catalog row (subset of awesome-dsh-plugin.com/plugins.json). */
export interface CatalogPluginRow {
  readonly name: string
  readonly owner: string
  readonly url: string
  readonly category: string
  readonly description: { readonly en: string; readonly zh: string }
  readonly install: string
  readonly stars: number
}

/** Bundled snapshot used when the live catalog cannot be fetched. */
export const CATALOG_SNAPSHOT: { readonly plugins: readonly CatalogPluginRow[] } = {
  plugins: [
    {
      name: 'dsh-find-plugin',
      owner: 'awesome-dsh-plugin',
      url: 'https://github.com/awesome-dsh-plugin/dsh-find-plugin',
      category: 'market',
      description: {
        en: 'Find plugins from the curated registry by keyword.',
        zh: '按关键字从精选目录查找插件。',
      },
      install: 'dsh plugin --profile web add github:awesome-dsh-plugin/dsh-find-plugin',
      stars: 12,
    },
    {
      name: 'DSH-better-sidebar',
      owner: 'omdsh-dev',
      url: 'https://github.com/omdsh-dev/DSH-better-sidebar',
      category: 'ui',
      description: {
        en: 'Web-profile sidebar workbench that uses HTTP routes and a terminal WebSocket.',
        zh: 'Web profile 侧栏工作台，依赖 HTTP 路由和终端 WebSocket。',
      },
      install: 'dsh plugin --profile web add github:omdsh-dev/DSH-better-sidebar',
      stars: 80,
    },
  ],
}
