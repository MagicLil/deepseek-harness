// @vitest-environment jsdom
/**
 * createWorkbenchStore: init, remember open/closed, and session-scoped persist.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkbenchStore, WORKBENCH_PERSIST_DEFAULT } from '../src/client/stores.ts'

beforeEach(() => { localStorage.clear() })

describe('createWorkbenchStore', () => {
  it('starts open at the contract default width', () => {
    const { store } = createWorkbenchStore().create('s1')
    expect(store.getSnapshot()).toEqual({ open: true, width: WORKBENCH_PERSIST_DEFAULT })
  })

  it('rememberOpen records the width; rememberClosed keeps it', () => {
    const { store, actions } = createWorkbenchStore().create('s1')
    actions.rememberOpen(300)
    expect(store.getSnapshot()).toEqual({ open: true, width: 300 })
    actions.rememberClosed()
    expect(store.getSnapshot()).toEqual({ open: false, width: 300 })
  })

  it('persists per session scope key', () => {
    const first = createWorkbenchStore().create('s-a')
    first.actions.rememberOpen(280)
    const revived = createWorkbenchStore().create('s-a')
    expect(revived.store.getSnapshot()).toEqual({ open: true, width: 280 })
    const other = createWorkbenchStore().create('s-b')
    expect(other.store.getSnapshot()).toEqual({ open: true, width: WORKBENCH_PERSIST_DEFAULT })
  })
})
