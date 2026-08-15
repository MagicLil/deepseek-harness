import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN, clampWidth, computeColumns,
  DETAILS_DEFAULT, DETAILS_MIN, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  WORKBENCH_DEFAULT, WORKBENCH_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

// Numeric preference form (0 = closed); helpers keep the scenario names readable.
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
    const cols = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 1920 - 280 - 360, details: 360, workbench: 0 })
  })

  it('closed sidebar keeps its compact rail while closed details contribute zero width', () => {
    expect(computeColumns(1920, closed(300), closed(360), closed(WORKBENCH_DEFAULT)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 1920 - SIDEBAR_COLLAPSED, details: 0, workbench: 0 })
  })

  it('preferences beyond the clamp range are clamped before solving', () => {
    const cols = computeColumns(1920, open(9999), open(1), closed(WORKBENCH_DEFAULT))
    expect(cols.sidebar).toBe(420)
    expect(cols.details).toBe(300)
    expect(computeColumns(1920, open(1), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT)).sidebar).toBe(SIDEBAR_MIN)
  })

  it('step 2: details shrinks first, center pinned at min', () => {
    // 280 + 360 + 640 = 1280 > 1250; details concedes to 1250-280-640 = 330.
    const cols = computeColumns(1250, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, details: 330, workbench: 0 })
  })

  it('boundary: exactly at the step-1/step-2 seam', () => {
    const cols = computeColumns(300 + 360 + CENTER_MIN, open(300), open(360), closed(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 300, center: CENTER_MIN, details: 360, workbench: 0 })
    const one = computeColumns(300 + 360 + CENTER_MIN - 1, open(300), open(360), closed(WORKBENCH_DEFAULT))
    expect(one).toEqual({ sidebar: 300, center: CENTER_MIN, details: 359, workbench: 0 })
  })

  it('step 3: details auto-closes when its min still starves center — sidebar holds its preference', () => {
    // 280 + 300 + 640 = 1220 > 1210 → details 0; sidebar untouched: center = 1210-280 = 930.
    const cols = computeColumns(1210, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 930, details: 0, workbench: 0 })
  })

  it('the sidebar never concedes: center absorbs the deficit below CENTER_MIN', () => {
    // 700 < 280+640: sidebar keeps 280, center takes 420 < CENTER_MIN.
    const cols = computeColumns(700, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: 420, details: 0, workbench: 0 })
  })

  it('sidebar-closed narrow window: details concedes then auto-closes', () => {
    const fits = computeColumns(
      SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN,
      closed(300),
      open(DETAILS_DEFAULT),
      closed(WORKBENCH_DEFAULT),
    )
    expect(fits).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: CENTER_MIN, details: DETAILS_MIN, workbench: 0 })
    const starved = computeColumns(
      SIDEBAR_COLLAPSED + DETAILS_MIN + CENTER_MIN - 1,
      closed(300),
      open(DETAILS_DEFAULT),
      closed(WORKBENCH_DEFAULT),
    )
    expect(starved).toEqual({
      sidebar: SIDEBAR_COLLAPSED,
      center: DETAILS_MIN + CENTER_MIN - 1,
      details: 0,
      workbench: 0,
    })
  })

  it('tiny viewport: details closes, sidebar holds, center takes the remainder', () => {
    const cols = computeColumns(400, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(cols.details).toBe(0)
    expect(cols.sidebar).toBe(SIDEBAR_DEFAULT)
    expect(cols.center).toBe(Math.max(0, 400 - SIDEBAR_DEFAULT))
    expect(cols.workbench).toBe(0)
  })

  it('recovery is pure: re-widening restores preferred widths untouched', () => {
    const squeezed = computeColumns(1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(squeezed.details).toBe(0)
    const restored = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT))
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.sidebar).toBe(SIDEBAR_DEFAULT)
  })
})

describe('computeColumns — degenerate viewports', () => {
  it('sidebar closed and viewport below CENTER_MIN: details auto-closes, center takes the rest', () => {
    // Reaches step 3's auto-close with the compact rail sidebar.
    expect(computeColumns(500, closed(300), open(DETAILS_DEFAULT), closed(WORKBENCH_DEFAULT)))
      .toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 500 - SIDEBAR_COLLAPSED, details: 0, workbench: 0 })
  })
})

describe('computeColumns — workbench concession', () => {
  it('step 1: details and workbench both fit at preferred widths', () => {
    const cols = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(cols).toEqual({
      sidebar: 280,
      center: 1920 - 280 - 360 - 400,
      details: 360,
      workbench: 400,
    })
  })

  it('details shrinks before workbench when both are open', () => {
    // 280 + 360 + 400 + 640 = 1680 > 1600; details concedes to 1600-280-400-640 = 280,
    // but DETAILS_MIN is 300, so details cannot stay open at 280 → auto-close details.
    // After details closes: 280 + 400 + 640 = 1320 <= 1600, workbench keeps 400.
    const cols = computeColumns(1600, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 1600 - 280 - 400, details: 0, workbench: 400 })
  })

  it('details shrinks to its minimum while workbench keeps its preference', () => {
    // 280 + 360 + 400 + 640 = 1680; at 1650 details can shrink to 330 (>= 300).
    const cols = computeColumns(1650, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, details: 330, workbench: 400 })
  })

  it('workbench shrinks after details has auto-closed', () => {
    // After details closes: 280 + 400 + 640 = 1320 > 1280; workbench concedes to 1280-280-640 = 360.
    const cols = computeColumns(1280, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: CENTER_MIN, details: 0, workbench: 360 })
  })

  it('workbench auto-closes when its minimum still starves center', () => {
    // 280 + 320 + 640 = 1240 > 1230 → workbench 0; center = 1230-280 = 950.
    const cols = computeColumns(1230, open(SIDEBAR_DEFAULT), closed(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(cols).toEqual({ sidebar: 280, center: 950, details: 0, workbench: 0 })
  })

  it('workbench-only open follows the same shrink-then-close chain', () => {
    const fits = computeColumns(
      SIDEBAR_DEFAULT + WORKBENCH_MIN + CENTER_MIN,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
    )
    expect(fits).toEqual({ sidebar: SIDEBAR_DEFAULT, center: CENTER_MIN, details: 0, workbench: WORKBENCH_MIN })
    const starved = computeColumns(
      SIDEBAR_DEFAULT + WORKBENCH_MIN + CENTER_MIN - 1,
      open(SIDEBAR_DEFAULT),
      closed(DETAILS_DEFAULT),
      open(WORKBENCH_DEFAULT),
    )
    expect(starved).toEqual({
      sidebar: SIDEBAR_DEFAULT,
      center: WORKBENCH_MIN + CENTER_MIN - 1,
      details: 0,
      workbench: 0,
    })
  })

  it('recovery restores both details and workbench preferences', () => {
    const squeezed = computeColumns(1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(squeezed.details).toBe(0)
    expect(squeezed.workbench).toBe(0)
    const restored = computeColumns(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(WORKBENCH_DEFAULT))
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.workbench).toBe(WORKBENCH_DEFAULT)
  })
})
