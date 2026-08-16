import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_WIDTH, BOTTOM_DEFAULT, BOTTOM_MIN, chromeMenuBarVisible, chromeTitleBarVisible, clampWidth, computeBottom, computeColumns,
  CONVERSATION_DEFAULT, CONVERSATION_MIN, conversationMax, conversationToggleLabel, DETAILS_DEFAULT,
  EDITOR_MIN, EDITOR_MIN_HEIGHT, planPrimaryReveal, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  WORKBENCH_DEFAULT, WORKBENCH_MAX, WORKBENCH_MIN, workbenchMax,
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

  it('primary shrinks before conversation so a wide chat can keep its preference', () => {
    // 48+280+260+380+400 = 1368; at 1320 primary concedes to 1320-48-280-380-400 = 212.
    const cols = computeColumns(
      1320, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 212,
      editor: EDITOR_MIN,
      conversation: CONVERSATION_DEFAULT,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('primary auto-closes when its minimum still starves a preferred conversation', () => {
    // 48+280+200+380+400 = 1308 > 1280 → primary 0; editor = 1280-48-280-380 = 572.
    const cols = computeColumns(
      1280, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: 1280 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - CONVERSATION_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('clamps a dragged conversation to two-thirds of the frame', () => {
    const cols = computeColumns(
      1920, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(2000),
    )
    expect(cols.conversation).toBe(conversationMax(1920))
    expect(cols.conversation).toBe(1280)
  })

  it('keeps a two-thirds primary after conversation has closed', () => {
    const want = workbenchMax(1920)
    const cols = computeColumns(
      1920, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(want), closed(CONVERSATION_DEFAULT),
    )
    expect(cols.primary).toBe(want)
    expect(cols.conversation).toBe(0)
    expect(cols.editor).toBe(1920 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - want)
  })

  it('primary keeps its preference after conversation has auto-closed when it still fits', () => {
    const leftover = 100
    const cols = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_DEFAULT + WORKBENCH_DEFAULT + leftover,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      closed(CONVERSATION_DEFAULT),
    )
    expect(cols).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: WORKBENCH_DEFAULT,
      editor: leftover,
      conversation: 0,
      details: 0,
      sidebar: SIDEBAR_DEFAULT,
    })
  })

  it('primary closes when it cannot fit beside the session sidebar', () => {
    const starved = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_DEFAULT + WORKBENCH_MIN - 1,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      closed(CONVERSATION_DEFAULT),
    )
    expect(starved).toEqual({
      activity: ACTIVITY_WIDTH,
      primary: 0,
      editor: WORKBENCH_MIN - 1,
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
    expect(squeezed.primary).toBe(0)
    expect(squeezed.conversation).toBe(CONVERSATION_DEFAULT)
    const restored = computeColumns(
      1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT), open(CONVERSATION_DEFAULT),
    )
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.conversation).toBe(CONVERSATION_DEFAULT)
    expect(restored.primary).toBe(WORKBENCH_DEFAULT)
  })

  it('a preferred primary drag to two-thirds shrinks conversation', () => {
    const want = workbenchMax(1920)
    const cols = computeColumns(
      1920, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(want), open(CONVERSATION_DEFAULT),
      'primary',
    )
    expect(want).toBe(Math.floor(1920 * 2 / 3))
    expect(cols.primary).toBeGreaterThan(WORKBENCH_DEFAULT)
    expect(cols.primary).toBeLessThanOrEqual(want)
    expect(cols.conversation).toBeLessThan(CONVERSATION_DEFAULT)
  })

  it('primary hits its floor before conversation leaves its preference', () => {
    expect(CONVERSATION_MIN).toBe(320)
    const cols = computeColumns(
      ACTIVITY_WIDTH + SIDEBAR_COLLAPSED + WORKBENCH_MIN + CONVERSATION_DEFAULT + EDITOR_MIN,
      closed(300),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
      open(CONVERSATION_DEFAULT),
    )
    expect(cols.conversation).toBe(CONVERSATION_DEFAULT)
    expect(cols.primary).toBe(WORKBENCH_MIN)
    expect(cols.editor).toBe(EDITOR_MIN)
  })
})

describe('planPrimaryReveal', () => {
  it('falls back to the contract default when the frame is unmeasured', () => {
    expect(planPrimaryReveal(0, SIDEBAR_DEFAULT, 0, 1280)).toEqual({
      primary: WORKBENCH_DEFAULT,
      conversation: 1280,
    })
    expect(planPrimaryReveal(-1, 0, 0, 0)).toEqual({
      primary: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
    })
  })

  it('keeps conversation and opens the default primary when leftover is generous', () => {
    expect(planPrimaryReveal(1920, SIDEBAR_DEFAULT, 0, CONVERSATION_DEFAULT)).toEqual({
      primary: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
    })
    expect(planPrimaryReveal(1920, SIDEBAR_DEFAULT, DETAILS_DEFAULT, CONVERSATION_DEFAULT)).toEqual({
      primary: WORKBENCH_DEFAULT,
      conversation: CONVERSATION_DEFAULT,
    })
  })

  it('splits leftover 50/50 when the chat still fits beside a minimum workspace', () => {
    // available = 1920-48-280 = 1592; leftover 620 ∈ [600, 660).
    const plan = planPrimaryReveal(1920, SIDEBAR_DEFAULT, 0, 972)
    expect(plan.conversation).toBe(972)
    expect(plan.primary).toBe(310)
    expect(plan.primary).toBeGreaterThanOrEqual(WORKBENCH_MIN)
    expect(plan.primary).toBeLessThanOrEqual(WORKBENCH_MAX)
  })

  it('shrinks a 2/3 conversation so explorer and editor can split 400/400', () => {
    const plan = planPrimaryReveal(1920, SIDEBAR_DEFAULT, 0, 1280)
    expect(plan.primary).toBe(EDITOR_MIN)
    expect(plan.conversation).toBe(1920 - ACTIVITY_WIDTH - SIDEBAR_DEFAULT - 2 * EDITOR_MIN)
    const cols = computeColumns(1920, SIDEBAR_DEFAULT, 0, plan.primary, plan.conversation)
    expect(cols.primary).toBe(EDITOR_MIN)
    expect(cols.editor).toBe(EDITOR_MIN)
  })

  it('clamps a closed session sidebar to the rail and a closed conversation to the default', () => {
    const plan = planPrimaryReveal(1920, 0, 0, 0)
    expect(plan.primary).toBe(WORKBENCH_DEFAULT)
    expect(plan.conversation).toBe(CONVERSATION_DEFAULT)
  })

  it('falls back to conversation min when the frame cannot host a 400/400 split', () => {
    const viewport = ACTIVITY_WIDTH + SIDEBAR_DEFAULT + CONVERSATION_MIN + WORKBENCH_MIN + EDITOR_MIN
    const plan = planPrimaryReveal(viewport, SIDEBAR_DEFAULT, 0, 900)
    expect(plan.conversation).toBe(CONVERSATION_MIN)
    expect(plan.primary).toBeGreaterThanOrEqual(WORKBENCH_MIN)
    expect(computeColumns(viewport, SIDEBAR_DEFAULT, 0, plan.primary, plan.conversation).primary)
      .toBeGreaterThan(0)
  })

  it('still emits floors when the frame is narrower than a minimum workspace', () => {
    const plan = planPrimaryReveal(800, SIDEBAR_DEFAULT, 0, 600)
    expect(plan.conversation).toBe(CONVERSATION_MIN)
    expect(plan.primary).toBeGreaterThanOrEqual(WORKBENCH_MIN)
  })
})

describe('chromeTitleBarVisible', () => {
  it('is desktop-only unless Electron preload is present', () => {
    expect(chromeTitleBarVisible('dsh:', false)).toBe(true)
    expect(chromeTitleBarVisible('http:', false)).toBe(false)
    expect(chromeTitleBarVisible('https:', false)).toBe(false)
    expect(chromeTitleBarVisible('', false)).toBe(false)
    expect(chromeTitleBarVisible('http:', true)).toBe(true)
  })
})

describe('conversationToggleLabel', () => {
  it('names collapse and open in the document language', () => {
    expect(conversationToggleLabel(true, 'zh')).toBe('收起对话')
    expect(conversationToggleLabel(false, 'zh-CN')).toBe('打开对话')
    expect(conversationToggleLabel(true, 'en-US')).toBe('Collapse chat')
    expect(conversationToggleLabel(false, 'en')).toBe('Open chat')
    expect(conversationToggleLabel(true)).toMatch(/收起对话|Collapse chat/)
  })
})

describe('chromeMenuBarVisible', () => {
  it('hides the HTML strip on the desktop renderer', () => {
    expect(chromeMenuBarVisible('dsh:', false)).toBe(false)
    expect(chromeMenuBarVisible('http:', false)).toBe(true)
    expect(chromeMenuBarVisible('https:', false)).toBe(true)
    expect(chromeMenuBarVisible('', false)).toBe(true)
    expect(chromeMenuBarVisible('http:', true)).toBe(false)
  })
})

describe('computeBottom', () => {
  it('closed preference stays zero', () => {
    expect(computeBottom(1080, 0)).toBe(0)
  })

  it('open preference fits at the default', () => {
    expect(computeBottom(1080, BOTTOM_DEFAULT)).toBe(BOTTOM_DEFAULT)
  })

  it('allows a tall preference up to the editor floor', () => {
    expect(computeBottom(1080, 800)).toBe(800)
    expect(computeBottom(1080, 9999)).toBe(1080 - EDITOR_MIN_HEIGHT)
  })

  it('shrinks toward the minimum then auto-closes', () => {
    expect(computeBottom(EDITOR_MIN_HEIGHT + BOTTOM_MIN, BOTTOM_DEFAULT)).toBe(BOTTOM_MIN)
    expect(computeBottom(EDITOR_MIN_HEIGHT + BOTTOM_MIN - 1, BOTTOM_DEFAULT)).toBe(0)
  })
})
