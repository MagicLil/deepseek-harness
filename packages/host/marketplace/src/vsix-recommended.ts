/**
 * Offline recommended Open VSX cards (Vue Official plus known-unsupported ids).
 */
import type { OpenVsxHit } from './openvsx.ts'

/** Curated hits shown when the search box is empty. */
export const VSIX_RECOMMENDED: readonly OpenVsxHit[] = [
  {
    namespace: 'Vue',
    name: 'volar',
    displayName: 'Vue - Official',
    description: 'Language support for Vue 3',
    verified: true,
    version: '3.0.0',
    files: { download: 'https://open-vsx.org/api/Vue/volar/latest/file/Vue.volar-latest.vsix' },
  },
  {
    namespace: 'ms-vscode-remote',
    name: 'remote-ssh',
    displayName: 'Remote - SSH',
    description: 'Open any folder on a remote machine using SSH.',
    verified: true,
    version: '0.0.0',
  },
  {
    namespace: 'ms-ceintl',
    name: 'vscode-language-pack-zh-hans',
    displayName: 'Chinese (Simplified) Language Pack',
    description: 'Language pack for VS Code UI. This product already ships bilingual chrome.',
    verified: true,
    version: '0.0.0',
  },
]
