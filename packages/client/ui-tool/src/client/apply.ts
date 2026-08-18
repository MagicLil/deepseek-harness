/** Register the Tool call tree, details renderer, and built-in atomic views. */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import type { ToolTreeProps } from './contract/slots.ts'
import { ToolCallTree } from './tool/ToolCallTree.tsx'
import { ToolTimelinePresentations, type IToolTimelinePresentations } from './tool/timeline-presentations.ts'
import { ToolDetails } from './tool/ToolDetails.tsx'
import { createToolErrorViewStore } from './tool/tool-error-view-store.ts'
import { CONVERSATION_NS as NS } from './locale.ts'
import { askQuestionToolview } from './tool/toolviews/ask-question-row.tsx'
import { bashToolviewSample } from './tool/toolviews/bash-sample.tsx'
import { fileMutationToolview } from './tool/toolviews/file-mutation-row.tsx'
import { readToolview } from './tool/toolviews/read-row.tsx'
import { searchToolview } from './tool/toolviews/search-row.tsx'
import { todoToolview } from './tool/toolviews/todo-row.tsx'
import { webToolview } from './tool/toolviews/web-row.tsx'

/** Required service: the slot registry that owns both Tool render seats. */
export const inject = ['slots', 'agentPresetExperience']

declare module '@deepseek-ai/cordis' {
  interface Context {
    toolTimelinePresentations: IToolTimelinePresentations
  }
}

/**
 * Mount the whole-Tool renderers and built-in atomic Tool registrations.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const errorViewStore = createToolErrorViewStore()
  const presentations = new ToolTimelinePresentations()
  ctx.effect(() => ctx.reflect.provide('toolTimelinePresentations', presentations), 'ui-tool: profile timeline presentations')
  const ProfiledToolCallTree = (props: ToolTreeProps) => {
    const experienceProfile = ctx.agentPresetExperience.profile(props.sessionId)
    const Frame = presentations.resolve(experienceProfile)?.Frame
    const tree = createElement(ToolCallTree, props)
    return createElement(
      'div',
      { 'data-agent-experience': experienceProfile },
      Frame === undefined ? tree : createElement(Frame, undefined, tree),
    )
  }

  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'tool-call',
    locale: NS,
    store: errorViewStore,
    children: {
      'tool.call.toolview': { kind: 'keyed', scope: 'session' },
    },
  }, ProfiledToolCallTree))

  ctx.slots.inject('conversation.details.tool', () => ctx.slots.register({
    name: 'conversation.details.tool',
    locale: NS,
    store: errorViewStore,
  }, ToolDetails))

  ctx.plugin(bashToolviewSample)
  ctx.plugin(readToolview)
  ctx.plugin(fileMutationToolview)
  ctx.plugin(searchToolview)
  ctx.plugin(webToolview)
  ctx.plugin(todoToolview)
  ctx.plugin(askQuestionToolview)
}
