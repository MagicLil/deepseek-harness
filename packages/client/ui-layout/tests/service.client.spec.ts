/**
 * LayoutController behavior: the cross-plugin panel-action face. Geometry
 * lives in the entry store (layout-store.spec.ts) — here we assert the
 * delegation contract: attachPanels wiring, the actions forwarding, the
 * unwired fail-loud, and re-attach overwriting a stale action set.
 */
import { describe, expect, it, vi } from 'vitest'
import { LayoutController } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'
import type { PanelActions } from '@deepseek-ai/dsh-client-ui-layout/src/client/service.ts'

function fakePanels(): PanelActions {
  return {
    setSidebar: vi.fn(),
    setDetails: vi.fn(),
    setWorkbench: vi.fn(),
    setConversation: vi.fn(),
    setBottom: vi.fn(),
    toggleSidebar: vi.fn(),
    setNarrow: vi.fn(),
    setFrameWidth: vi.fn(),
    openDetails: vi.fn(),
    closeDetails: vi.fn(),
    openWorkbench: vi.fn(),
    closeWorkbench: vi.fn(),
    toggleWorkbench: vi.fn(),
    openBottom: vi.fn(),
    closeBottom: vi.fn(),
    toggleBottom: vi.fn(),
  }
}

describe('LayoutController', () => {
  it('forwards the panel actions to the attached set', () => {
    const service = new LayoutController()
    const panels = fakePanels()
    service.attachPanels(panels)

    service.toggleSidebar()
    service.openDetails()
    service.closeDetails()
    service.openWorkbench()
    service.closeWorkbench()
    service.toggleWorkbench()
    service.setWorkbench(480)
    service.setPrimarySidebar(300)
    service.openBottom()
    service.closeBottom()
    service.toggleBottom()
    service.setBottomHeight(180)

    expect(panels.toggleSidebar).toHaveBeenCalledTimes(1)
    expect(panels.openDetails).toHaveBeenCalledTimes(1)
    expect(panels.closeDetails).toHaveBeenCalledTimes(1)
    expect(panels.openWorkbench).toHaveBeenCalledTimes(1)
    expect(panels.closeWorkbench).toHaveBeenCalledTimes(1)
    expect(panels.toggleWorkbench).toHaveBeenCalledTimes(1)
    expect(panels.setWorkbench).toHaveBeenCalledWith(480)
    expect(panels.setWorkbench).toHaveBeenCalledWith(300)
    expect(panels.openBottom).toHaveBeenCalledTimes(1)
    expect(panels.closeBottom).toHaveBeenCalledTimes(1)
    expect(panels.toggleBottom).toHaveBeenCalledTimes(1)
    expect(panels.setBottom).toHaveBeenCalledWith(180)
    expect(panels.setSidebar).not.toHaveBeenCalled()
    expect(panels.setDetails).not.toHaveBeenCalled()
  })

  it('fails loud before the root entry wired its actions', () => {
    const service = new LayoutController()
    expect(() => { service.toggleSidebar() }).toThrow(/panel actions not wired/)
    expect(() => { service.openDetails() }).toThrow(/panel actions not wired/)
    expect(() => { service.closeDetails() }).toThrow(/panel actions not wired/)
    expect(() => { service.openWorkbench() }).toThrow(/panel actions not wired/)
    expect(() => { service.closeWorkbench() }).toThrow(/panel actions not wired/)
    expect(() => { service.toggleWorkbench() }).toThrow(/panel actions not wired/)
    expect(() => { service.setWorkbench(400) }).toThrow(/panel actions not wired/)
    expect(() => { service.setPrimarySidebar(400) }).toThrow(/panel actions not wired/)
    expect(() => { service.openBottom() }).toThrow(/panel actions not wired/)
    expect(() => { service.closeBottom() }).toThrow(/panel actions not wired/)
    expect(() => { service.toggleBottom() }).toThrow(/panel actions not wired/)
    expect(() => { service.setBottomHeight(200) }).toThrow(/panel actions not wired/)
  })

  it('re-attach overwrites the stale action set (entry re-register)', () => {
    const service = new LayoutController()
    const stale = fakePanels()
    const fresh = fakePanels()
    service.attachPanels(stale)
    service.attachPanels(fresh)

    service.toggleSidebar()

    expect(stale.toggleSidebar).not.toHaveBeenCalled()
    expect(fresh.toggleSidebar).toHaveBeenCalledTimes(1)
  })
})
