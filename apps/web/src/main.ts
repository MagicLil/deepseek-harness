/**
 * Web application entry: thin bootstrap over the shell library. Everything —
 * loader holding, module-table seeding, AppRoot gate, plugin assembly — lives
 * in @deepseek-ai/dsh-client-web; this file only finds the mount point.
 *
 * When the desktop preload installs `window.__DSH_IPC__`, plugin bundles load
 * through IPC instead of `<script src="/plugins/...">`.
 */
import { AppWebEntry } from '@deepseek-ai/dsh-client-web'

interface DshIpcWindow {
  __DSH_IPC__?: { loadBundle(url: string): Promise<void> }
}

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')

const ipc = (globalThis as DshIpcWindow).__DSH_IPC__
void new AppWebEntry(
  el,
  ipc !== undefined ? { loadBundle: url => ipc.loadBundle(url) } : undefined,
).run()
