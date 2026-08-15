/**
 * One-per-page Monaco boot over the AMD build the frontend dist ships at
 * /monaco/vs (see apps/web's copyMonacoAssets). The classic integration from
 * microsoft/monaco-editor's Electron samples: inject `vs/loader.js`, point
 * the AMD `vs` path at the served base, require `vs/editor/editor.main`, and
 * read the `window.monaco` namespace it publishes. Origin-relative URLs keep
 * one code path for both surfaces (http://… on web, dsh://app on desktop);
 * language workers resolve same-origin from the same base, and where a
 * platform refuses the Worker, Monaco falls back to main-thread services.
 */
import type * as MonacoNs from 'monaco-editor'

/** The Monaco namespace as the AMD bundle publishes it on `window.monaco`. */
export type Monaco = typeof MonacoNs

/** Dist-absolute base of the Monaco AMD assets. */
const VS_BASE_PATH = '/monaco/vs'

/** The AMD loader face `vs/loader.js` installs on `window.require`. */
interface AmdRequire {
  config(options: { paths: Record<string, string> }): void
  (modules: string[], onLoad: () => void, onError?: (error: unknown) => void): void
}

let pending: Promise<Monaco> | undefined

/**
 * Load the Monaco namespace, booting the AMD bundle on first use.
 * Concurrent callers share one boot; a failed boot resets so a later mount
 * retries (e.g. after the missing dist assets are rebuilt).
 * @returns the `window.monaco` namespace.
 */
export function loadMonaco(): Promise<Monaco> {
  if (pending === undefined) {
    pending = bootMonaco()
    pending.catch(() => { pending = undefined })
  }
  return pending
}

function bootMonaco(): Promise<Monaco> {
  const already = (window as unknown as { monaco?: Monaco }).monaco
  if (already !== undefined) return Promise.resolve(already)
  return new Promise<Monaco>((settle, reject) => {
    const base = new URL(VS_BASE_PATH, window.location.origin).toString()
    const script = document.createElement('script')
    script.src = `${base}/loader.js`
    script.onload = () => {
      const amdRequire = (window as unknown as { require?: AmdRequire }).require
      if (amdRequire === undefined) {
        reject(new Error('monaco vs/loader.js did not install an AMD require'))
        return
      }
      amdRequire.config({ paths: { vs: base } })
      amdRequire(
        ['vs/editor/editor.main'],
        () => {
          const loaded = (window as unknown as { monaco?: Monaco }).monaco
          if (loaded === undefined) reject(new Error('vs/editor/editor.main did not publish window.monaco'))
          else settle(loaded)
        },
        (error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)))
        },
      )
    }
    script.onerror = () => { reject(new Error(`monaco loader fetch failed: ${script.src}`)) }
    document.head.appendChild(script)
  })
}
