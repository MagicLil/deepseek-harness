import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GIT_LOG_PAGE_SIZE, appendGitLog, canRequestGitLogPage, gitHistoryObserverTarget,
  gitLogHasMore, mergeGitLogPage, observeGitHistorySentinel, shouldLoadMoreFromScroll,
} from '../src/client/git-log-page.ts'

const row = (hash: string) => ({ hash, subject: hash, author: 'A', timestamp: 1 })

describe('git log paging', () => {
  it('treats a full page as having more history', () => {
    expect(gitLogHasMore(Array.from({ length: GIT_LOG_PAGE_SIZE }, () => 1))).toBe(true)
    expect(gitLogHasMore(Array.from({ length: GIT_LOG_PAGE_SIZE - 1 }, () => 1))).toBe(false)
    expect(gitLogHasMore([], 10)).toBe(false)
    expect(gitLogHasMore([1, 2, 3], 3)).toBe(true)
  })

  it('appends older rows and drops overlapping hashes', () => {
    expect(appendGitLog([], [])).toEqual([])
    expect(appendGitLog([row('a')], [])).toEqual([row('a')])
    expect(appendGitLog([row('a')], [row('a'), row('b')])).toEqual([row('a'), row('b')])
    expect(appendGitLog([row('a')], [row('a')])).toEqual([row('a')])
    expect(appendGitLog([row('a')], [row('b')])).toEqual([row('a'), row('b')])
    expect(mergeGitLogPage([row('a')], [row('b')], 1)).toEqual({
      rows: [row('a'), row('b')], hasMore: true,
    })
    expect(mergeGitLogPage([row('a')], [row('a')], 1)).toEqual({
      rows: [row('a')], hasMore: false,
    })
    expect(mergeGitLogPage([row('a')], [row('b')], 3)).toEqual({
      rows: [row('a'), row('b')], hasMore: false,
    })
  })

  it('starts a page only when the root is known, unlocked, and has more', () => {
    expect(canRequestGitLogPage(undefined, false, true)).toBe(false)
    expect(canRequestGitLogPage('/ws', true, true)).toBe(false)
    expect(canRequestGitLogPage('/ws', false, false)).toBe(false)
    expect(canRequestGitLogPage('/ws', false, true)).toBe(true)
  })

  it('observes the sentinel only while more history exists', () => {
    const node = {} as Element
    expect(gitHistoryObserverTarget(false, node)).toBeNull()
    expect(gitHistoryObserverTarget(true, null)).toBeNull()
    expect(gitHistoryObserverTarget(false, null)).toBeNull()
    expect(gitHistoryObserverTarget(true, node)).toBe(node)
  })

  it('loads more when the scroller is near the bottom', () => {
    expect(shouldLoadMoreFromScroll({ scrollHeight: 400, scrollTop: 300, clientHeight: 100 })).toBe(true)
    expect(shouldLoadMoreFromScroll({ scrollHeight: 400, scrollTop: 0, clientHeight: 100 })).toBe(false)
    expect(shouldLoadMoreFromScroll({ scrollHeight: 0, scrollTop: 0, clientHeight: 0 }, 80)).toBe(true)
    expect(shouldLoadMoreFromScroll({ scrollHeight: 200, scrollTop: 10, clientHeight: 100 }, 20)).toBe(false)
  })
})

describe('observeGitHistorySentinel', () => {
  const original = globalThis.IntersectionObserver

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(globalThis, 'IntersectionObserver')
      return
    }
    globalThis.IntersectionObserver = original
  })

  it('noops when IntersectionObserver is missing', () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    const onVisible = vi.fn()
    const stop = observeGitHistorySentinel({} as Element, null, onVisible)
    stop()
    expect(onVisible).not.toHaveBeenCalled()
  })

  it('notifies when the sentinel intersects and disconnects on stop', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    const callbacks: IntersectionObserverCallback[] = []
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
      }
      observe = observe
      disconnect = disconnect
      unobserve(): void {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
      readonly root = null
      readonly rootMargin = ''
      readonly scrollMargin = ''
      readonly thresholds = []
    } as typeof IntersectionObserver
    const target = {} as Element
    const root = {} as Element
    const onVisible = vi.fn()
    const stop = observeGitHistorySentinel(target, null, onVisible)
    observeGitHistorySentinel(target, root, onVisible)
    expect(observe).toHaveBeenCalledWith(target)
    callbacks[0]?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onVisible).not.toHaveBeenCalled()
    callbacks[0]?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onVisible).toHaveBeenCalledOnce()
    stop()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
