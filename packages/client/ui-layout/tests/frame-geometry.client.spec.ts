// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_WIDTH, CONVERSATION_DEFAULT, SIDEBAR_DEFAULT, WORKBENCH_DEFAULT,
} from '../src/client/columns.ts'
import { applyFrameGeometry, solveFramePaint } from '../src/client/frame-geometry.ts'

describe('solveFramePaint', () => {
  it('solves open tracks and a closed bottom', () => {
    const paint = solveFramePaint({
      viewport: { width: 1920, height: 1080 },
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      workbench: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      bottom: 0,
      workbenchPanels: true,
      detailsOn: false,
      menuBarPx: 28,
    })
    expect(paint.cols.activity).toBe(ACTIVITY_WIDTH)
    expect(paint.cols.primary).toBe(WORKBENCH_DEFAULT)
    expect(paint.cols.conversation).toBe(CONVERSATION_DEFAULT)
    expect(paint.bottom).toBe(0)
  })

  it('drops workbench and bottom when panels are off', () => {
    const paint = solveFramePaint({
      viewport: { width: 1920, height: 1080 },
      sidebar: SIDEBAR_DEFAULT,
      details: 360,
      workbench: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      bottom: 200,
      workbenchPanels: false,
      detailsOn: true,
      menuBarPx: 0,
    })
    expect(paint.cols.primary).toBe(0)
    expect(paint.cols.details).toBe(360)
    expect(paint.bottom).toBe(0)
  })
})

describe('applyFrameGeometry', () => {
  it('writes grid tracks and sash positions, skipping missing handles', () => {
    const el = document.createElement('div')
    const conversation = document.createElement('div')
    conversation.setAttribute('data-side', 'conversation')
    const bottomHandle = document.createElement('div')
    bottomHandle.setAttribute('data-side', 'bottom')
    el.append(conversation, bottomHandle)
    const paint = solveFramePaint({
      viewport: { width: 1920, height: 1080 },
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      workbench: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      bottom: 200,
      workbenchPanels: true,
      detailsOn: false,
      menuBarPx: 28,
    })
    applyFrameGeometry(el, paint, { width: 1920, height: 1080 }, 28)
    expect(el.style.gridTemplateColumns).toContain('minmax(0, 1fr)')
    expect(el.style.gridTemplateRows).toBe('28px minmax(0, 1fr) 200px')
    expect(conversation.style.left).toBe(`${ACTIVITY_WIDTH + WORKBENCH_DEFAULT + paint.cols.editor}px`)
    expect(bottomHandle.style.top).toBe(`${1080 - 200}px`)
    expect(bottomHandle.style.width).toBe(`${paint.cols.editor}px`)
  })
})
