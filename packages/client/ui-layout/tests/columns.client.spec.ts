import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_WIDTH, BOTTOM_DEFAULT, BOTTOM_MIN, clampWidth, computeBottom, computeColumns,
  CONVERSATION_DEFAULT, CONVERSATION_MIN, DETAILS_DEFAULT, EDITOR_MIN,
  EDITOR_MIN_HEIGHT, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  WORKBENCH_DEFAULT, WORKBENCH_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

const open = (width: number) => width
const closed = (_width: number) => 0

describe('clampWidth', () => {
  it('clamps into the range and rounds', () => {
    expect(clampWidth(250.4, 240, 420)).toBe(250)
    expect(clampWidth(100, 240, 420)).toBe(240)
    expect(clampWidth(9999, 240, 420)).toBe(420)
  })
})

describe('computeColumns', () => {
  it('step 1: everything fits at preferred widths', () => {
    const cols = computeColumns(
      1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: 1920 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - DETAILS_DEFAULT - CONVERSATION_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      details: DETAILS_DEFAULT,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('closed sidebar keeps its compact rail while closed details contribute zero width', () => {
    expect(computeColumns(1920, closed(300), closed(360), closed(WORKBENCH_DEFAULT), closed(CONVERSATION_DEFAULT)))
      .toEqual({
        activity: ACTIVITY_WIDTH,
        primary: 0,
        editor: 1920 - ACTIVITY_WIDTH - SIDEBAR_COLLAPSED,
        conversation: 0,
        details: 0,
        sidebar: SIDEBAR_COLLAPSED,
      })
  })

  it('preferences beyond the clamp range are clamped before solving', () => {
    const cols = computeColumns(1920, open(9999), open(1), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT))
    expect(cols.sidebar).toBe(420)
    expect(cols.details).toBe(300)
    expect(computeColumns(1920, open(1), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT)).sidebar)
      .toBe(SIDEBAR_MIN)
  })

  it('step 2: details shrinks first, editor pinned at min', () => {
    // 48+280+0+380+360+400 = 1468 > 1450; details concedes to 1450-48-280-380-400 = 342.
    const cols = computeColumns(
      1450, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: EDITOR_MIN,
      conversation: CONVERSATION_DEFAULT,
      details: 342,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('step 3: details auto-closes when its min still starves the editor', () => {
    // 48+280+0+380+300+400 = 1408 > 1400 → details 0; editor = 1400-48-280-380 = 692.
    const cols = computeColumns(
      1400, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: 1400 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - CONVERSATION_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('the session sidebar never concedes: editor absorbs the deficit below EDITOR_MIN', () => {
    const cols = computeColumns(
      500, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), closed(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: Math.max(0, 500 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT),
      conversation: 0,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('recovery is pure: re-widening restores preferred widths untouched', () => {
    const squeezed = computeColumns(
      1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(squeezed.details).toBe(0)
    const restored = computeColumns(
      1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.sidebar).toBe(SIDEBAR_DEFAULT)
  })
})

describe('computeColumns — conversation and primary concession', () => {
  it('step 1: primary and conversation both fit at preferred widths', () => {
    const cols = computeColumns(
      1920, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: WORKBENCH_DEFAULT,
      editor: 1920 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - WORKBENCH_DEFAULT - CONVERSATION_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('conversation shrinks after details has auto-closed', () => {
    // 48+280+260+380+400 = 1368; at 1320 conversation concedes to 1320-48-280-260-400 = 332.
    const cols = computeColumns(
      1320, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: WORKBENCH_DEFAULT,
      editor: EDITOR_MIN,
      conversation: 332,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('conversation auto-closes when its minimum still starves the editor', () => {
    // 48+280+260+320+400 = 1308 > 1280 → conversation 0; editor = 1280-48-280-260 = 692.
    const cols = computeColumns(
      1280, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: WORKBENCH_DEFAULT,
      editor: 1280 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - WORKBENCH_DEFAULT,
      conversation: 0,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('primary shrinks after conversation has auto-closed', () => {
    const fits = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_DEFAULT + WORKBENCH_MIN + EDITOR_MIN,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      closed(CONVERSATION_DEFAULT),
    )
    expect(fits).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: WORKBENCH_MIN,
      editor: EDITOR_MIN,
      conversation: 0,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
    const starved = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_DEFAULT + WORKBENCH_MIN + EDITOR_MIN - 1,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      closed(CONVERSATION_DEFAULT),
    )
    expect(starved).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: WORKBENCH_MIN + EDITOR_MIN - 1,
      conversation: 0,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('recovery restores conversation and primary preferences', () => {
    const squeezed = computeColumns(
      900, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(squeezed.details).toBe(0)
    expect(squeezed.conversation).toBe(0)
    const restored = computeColumns(
      1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.conversation).toBe(CONVERSATION_DEFAULT)
    expect(restored.primary).toBe(WORKBENCH_DEFAULT)
  })

  it('conversation min is respected when shrinking', () => {
    expect(CONVERSATION_MIN).toBe(320)
    const cols = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_COLLAPSED + WORKBENCH_DEFAULT + CONVERSATION_MIN + EDITOR_MIN,
      closed(300),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      open(CONVERSATION_DEFAULT),
    )
    expect(cols.conversation).toBe(CONVERSATION_MIN)
    expect(cols.editor).toBe(EDITOR_MIN)
  })
})

describe('computeBottom', () => {
  it('closed preference stays zero', () => {
    expect(computeBottom(1080, 0)).toBe(0)
  })

  it('open preference fits at the default', () => {
    expect(computeBottom(1080, BOTTOM_DEFAULT)).toBe(BOTTOM_DEFAULT)
  })

  it('shrinks toward the minimum then auto-closes', () => {
    expect(computeBottom(EDITOR_MIN_HEIGHT + BOTTOM_MIN, BOTTOM_DEFAULT)).toBe(BOTTOM_MIN)
    expect(computeBottom(EDITOR_MIN_HEIGHT + BOTTOM_MIN - 1, BOTTOM_DEFAULT)).toBe(0)
  })
})
