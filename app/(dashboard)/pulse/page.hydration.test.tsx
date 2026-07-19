// Packet 3.5-3 — React hydration (#418) regression coverage for /pulse.
//
// Reproduces the exact server-vs-first-client-render mismatch by SSR-rendering
// the REAL PulsePage at one wall-clock time and hydrating it at another — the
// real-world split where the server (Vercel, UTC) and the client (the user's
// local timezone) compute a different time-of-day greeting for the same
// instant. This renders the actual page boundary (not a helper in isolation),
// so it catches ANY initial-render mismatch, not only the greeting.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { act } from '@testing-library/react'
import PulsePage from './page'

function installFetch() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/api/system/status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ rostiroState: 'standard', liveScores: [], scoresGated: false, playoffTier: 'none' }) })
    }
    if (url === '/api/pulse') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [], leagueCount: 0, doneToday: 0, estMinutes: 0, firstName: null, persistent: false, coverage: [] }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as never
}

// Renders PulsePage to HTML at `serverInstant`, then hydrates it at
// `clientInstant`, capturing every hydration-mismatch signal React emits
// (both the console.error diff and onRecoverableError).
function ssrThenHydrate(serverInstant: string, clientInstant: string) {
  installFetch()
  vi.useFakeTimers()

  vi.setSystemTime(new Date(serverInstant))
  const serverHTML = renderToString(<PulsePage />)

  const container = document.createElement('div')
  container.innerHTML = serverHTML
  document.body.appendChild(container)

  vi.setSystemTime(new Date(clientInstant))
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const recoverable: string[] = []
  let root: Root
  act(() => {
    root = hydrateRoot(container, <PulsePage />, { onRecoverableError: (e) => recoverable.push(String(e)) })
  })

  const hydrationConsoleErrors = errorSpy.mock.calls
    .map((c) => String(c[0]))
    .filter((m) => /hydrat|did not match|server rendered HTML|server-rendered/i.test(m))
  const hydrationRecoverable = recoverable.filter((m) => /hydrat|did not match|server/i.test(m))

  // Captured AFTER hydration commits — useSyncExternalStore swaps getSnapshot
  // (the client time-of-day greeting) in on the post-hydration re-render.
  const postHydrationText = container.textContent ?? ''

  errorSpy.mockRestore()
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()

  return { serverHTML, hydrationConsoleErrors, hydrationRecoverable, postHydrationText }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PulsePage — hydration determinism (P3.5-3, #418)', () => {
  it('PROOF: server and first client render match even when the server and client clocks disagree', () => {
    // 08:00Z is "morning" everywhere reasonable; 23:00Z is "evening" everywhere
    // reasonable — so whatever the test TZ, these two land in different
    // greeting buckets, exactly like a UTC server vs an evening-local client.
    const { hydrationConsoleErrors, hydrationRecoverable } = ssrThenHydrate(
      '2026-07-19T08:00:00Z',
      '2026-07-19T23:00:00Z'
    )
    expect(hydrationConsoleErrors).toEqual([])
    expect(hydrationRecoverable).toEqual([])
  })

  it('server render is deterministic across morning and evening server clocks (no time-of-day leak into SSR HTML)', () => {
    installFetch()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T08:00:00Z'))
    const morning = renderToString(<PulsePage />)
    vi.setSystemTime(new Date('2026-07-19T23:00:00Z'))
    const evening = renderToString(<PulsePage />)
    vi.useRealTimers()
    // The server-rendered HTML must not depend on the server's wall clock.
    expect(morning).toBe(evening)
  })

  it('the initial (server-safe) copy is the deterministic greeting, never a time-of-day word', () => {
    installFetch()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T08:00:00Z'))
    const serverHTML = renderToString(<PulsePage />)
    vi.useRealTimers()
    expect(serverHTML).toContain('Welcome back')
    expect(serverHTML).not.toMatch(/Good (morning|afternoon|evening)/)
  })

  it('after hydration the client greeting reflects local time-of-day (evening)', () => {
    const { postHydrationText } = ssrThenHydrate('2026-07-19T08:00:00Z', '2026-07-19T23:00:00Z')
    // Client applied its local time AFTER hydration — the deterministic
    // server copy is gone, replaced by the real time-of-day greeting.
    expect(postHydrationText).toContain('Good evening')
    expect(postHydrationText).not.toContain('Welcome back')
  })
})
