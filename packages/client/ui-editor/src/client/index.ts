/**
 * Browser editor plugin contributing one entry to the conversation view slot:
 * a workspace file tree beside a CodeMirror editor over the host file RPCs
 * (`ctx.workspaces.listEntries/readFile/writeFile`).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.view' SlotMap row (declared by the slot's
// owning package) must be in the program for the register calls to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { createEditorViewStore } from './editor-store.ts'
import { en, NS, zh } from './locales.ts'
import { CodeEditorView, type EditorViewInjected } from './CodeEditorView.tsx'

/** Required services: the slot registry, workspace file actions, session roster, and the locale service. */
export const inject = ['slots', 'workspaces', 'sessions', 'locale']

/**
 * Client plugin body: register the editor view tab. The registration rides
 * the slot service's effect wrapper, so plugin unload removes the tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-editor: dictionaries')
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  const store = createEditorViewStore()
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'editor',
    order: 20,
    locale: NS,
    label: () => t('view.editor'),
    store,
    inject: (_sessionId: SessionId): EditorViewInjected => ({
      listEntries: (path, signal) => ctx.workspaces.listEntries(path, signal),
      readFile: (path, signal) => ctx.workspaces.readFile(path, signal),
      writeFile: (path, content) => ctx.workspaces.writeFile(path, content),
      gitStatus: (path, signal) => ctx.workspaces.gitStatus(path, signal),
    }),
  }, CodeEditorView))
}
