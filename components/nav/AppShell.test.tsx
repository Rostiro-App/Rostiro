// Packet 3.5-4B — AppShell capability-gating regression tests.
//
// The recurring production 404 came from AppShell mounting <SimulationPanel/>
// for EVERYONE; the panel probed GET /api/admin/simulate on mount to discover
// whether it was allowed, and non-admins got a 404 on every dashboard load.
// The fix gates the mount on a server-derived `enableSimulation` boolean, so a
// non-admin never mounts the panel and never makes that request.
//
// Real boundary: the REAL AppShell and REAL SimulationPanel render here. Only
// next/navigation (router context, not the behavior under test) and the fetch
// transport are mocked; the fetch mock FAILS the test if /api/admin/simulate
// is ever requested while simulation is disabled.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/pulse',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}))

import AppShell from './AppShell'

const simulateCalls: string[] = []

function installFetch(simStatusOk = true) {
  simulateCalls.length = 0
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/api/admin/simulate') {
      simulateCalls.push(`${init?.method ?? 'GET'} ${url}`)
      if (!simStatusOk) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ isActive: false, simTimestamp: null, forcedState: null, activeScenario: null, currentPlan: 'pro', promoStartsAt: null, promoEndsAt: null }) })
    }
    // Everything else AppShell's children fetch (system/status, settings,
    // interrupts, adp/movers, …) — permissive shape so child .length reads
    // don't throw noise while we assert only on the /api/admin/simulate calls.
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ mode: null, leagues: [], liveScores: [], matchups: [], results: [], items: [], movers: [], top: [], scoresGated: false, playoffTier: 'none' }) })
  }) as never
}

// This jsdom env ships without localStorage; AppShell's readMode() reads it
// (bare) during render, so provide a minimal in-memory Storage.
function makeStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  } as Storage
}

beforeEach(() => {
  const ls = makeStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: ls })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: ls })
  installFetch()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AppShell — SimulationPanel capability gating (P3.5-4B)', () => {
  it('PROOF: enableSimulation=false never mounts SimulationPanel and makes ZERO /api/admin/simulate requests', async () => {
    render(<AppShell enableSimulation={false}>content</AppShell>)
    // Let all mount effects flush.
    await waitFor(() => expect(screen.getByText('content')).toBeTruthy())
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.queryByText('SIM')).toBeNull()
    expect(screen.queryByText('⚡ SIM ACTIVE')).toBeNull()
    expect(simulateCalls).toEqual([])
  })

  it('enableSimulation=true mounts SimulationPanel, which performs the status GET', async () => {
    render(<AppShell enableSimulation={true}>content</AppShell>)
    // The panel is mounted (admin), so it probes its real status. (That the
    // panel then renders after a successful status is proven at the real
    // SimulationPanel boundary in components/admin/SimulationPanel.test.tsx —
    // asserted there rather than through AppShell's much noisier full tree.)
    await waitFor(() => expect(simulateCalls).toContain('GET /api/admin/simulate'))
  })
})
