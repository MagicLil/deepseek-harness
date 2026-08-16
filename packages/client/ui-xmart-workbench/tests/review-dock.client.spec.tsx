// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReviewDock } from '../src/client/ReviewDock.tsx'
import { zh } from '../src/client/locales.ts'
import type { AgentReviewRemote } from '../src/client/review-client.ts'
import { shellDismissKey } from '../src/client/review-client.ts'
import {
  encodeAgentReviewPath, parseAgentReviewPath,
} from '../src/client/agent-review-path.ts'

afterEach(() => {
  cleanup()
  localStorage.removeItem(shellDismissKey('s1', 9))
  localStorage.removeItem(shellDismissKey('s2', 4))
})

describe('agent-review-path', () => {
  it('round-trips turn and path', () => {
    const encoded = encodeAgentReviewPath(3, 'D:\\a\\b.ts')
    expect(parseAgentReviewPath(encoded)).toEqual({ turn: 3, path: 'D:\\a\\b.ts' })
  })
})

describe('ReviewDock', () => {
  function remoteWithPending(): AgentReviewRemote {
    return {
      get: vi.fn(async () => ({
        ok: true,
        value: {
          sessionId: 's1',
          turns: [{
            turn: 1,
            shellMaybeMutated: false,
            files: [{
              path: '/tmp/a.ts',
              kind: 'create',
              status: 'pending',
              shadowKey: '',
              beforeHash: null,
              afterHash: 'x',
            }],
          }],
        },
      })),
      accept: vi.fn(async () => ({
        ok: true,
        value: {
          ok: true,
          review: { sessionId: 's1', turns: [] },
        },
      })),
      acceptAll: vi.fn(),
      revert: vi.fn(async () => ({
        ok: true,
        value: {
          ok: true,
          review: { sessionId: 's1', turns: [] },
        },
      })),
      revertAll: vi.fn(),
      dismissShell: vi.fn(),
      diff: vi.fn(async () => ({
        ok: true,
        value: { path: '/tmp/a.ts', before: '', after: 'hi\n', ok: true },
      })),
    }
  }

  it('Review opens the first pending file via openReviewDiff', async () => {
    const review = remoteWithPending()
    const openReviewDiff = vi.fn()
    render(
      <ReviewDock
        sessionId="s1"
        t={key => zh[key]}
        review={review}
        openReviewDiff={openReviewDiff}
      />,
    )
    expect(await screen.findByTestId('review-dock')).toBeTruthy()
    fireEvent.click(screen.getByTestId('review-dock-review'))
    expect(openReviewDiff).toHaveBeenCalledWith('/tmp/a.ts', 1)
  })

  it('Keep calls accept for the file', async () => {
    const review = remoteWithPending()
    render(
      <ReviewDock
        sessionId="s1"
        t={key => zh[key]}
        review={review}
        openReviewDiff={vi.fn()}
      />,
    )
    expect(await screen.findByTestId('review-dock-keep')).toBeTruthy()
    fireEvent.click(screen.getByTestId('review-dock-keep'))
    await waitFor(() => {
      expect(review.accept).toHaveBeenCalledWith({
        sessionId: 's1', turn: 1, path: '/tmp/a.ts',
      })
    })
  })

  it('shows a dismissible shell-only warning when there are no pending files', async () => {
    const review: AgentReviewRemote = {
      get: vi.fn(async () => ({
        ok: true,
        value: {
          sessionId: 's1',
          turns: [{ turn: 9, shellMaybeMutated: true, files: [] }],
        },
      })),
      accept: vi.fn(),
      acceptAll: vi.fn(),
      revert: vi.fn(),
      revertAll: vi.fn(),
      dismissShell: vi.fn(async () => ({
        ok: true,
        value: {
          ok: true,
          review: {
            sessionId: 's1',
            turns: [{ turn: 9, shellMaybeMutated: false, files: [] }],
          },
        },
      })),
      diff: vi.fn(),
    }
    render(
      <ReviewDock
        sessionId="s1"
        t={key => zh[key]}
        review={review}
        openReviewDiff={vi.fn()}
      />,
    )
    expect(await screen.findByTestId('review-shell-warn')).toBeTruthy()
    fireEvent.click(screen.getByTestId('review-shell-dismiss'))
    await waitFor(() => {
      expect(review.dismissShell).toHaveBeenCalledWith({ sessionId: 's1', turn: 9 })
      expect(localStorage.getItem(shellDismissKey('s1', 9))).toBe('1')
      expect(screen.queryByTestId('review-dock')).toBeNull()
    })
  })

  it('hides the shell warning even when the mounted remote lacks dismissShell', async () => {
    const review: AgentReviewRemote = {
      get: vi.fn(async () => ({
        ok: true,
        value: {
          sessionId: 's2',
          turns: [{ turn: 4, shellMaybeMutated: true, files: [] }],
        },
      })),
      accept: vi.fn(),
      acceptAll: vi.fn(),
      revert: vi.fn(),
      revertAll: vi.fn(),
      diff: vi.fn(),
    }
    render(
      <ReviewDock
        sessionId="s2"
        t={key => zh[key]}
        review={review}
        openReviewDiff={vi.fn()}
      />,
    )
    expect(await screen.findByTestId('review-shell-warn')).toBeTruthy()
    fireEvent.click(screen.getByTestId('review-shell-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('review-dock')).toBeNull()
    })
  })
})
