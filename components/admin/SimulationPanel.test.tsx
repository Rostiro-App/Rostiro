// Packet 3.5-4B — SimulationPanel status-fetch + defense-in-depth render gate.
//
// The panel is only ever MOUNTED for an admin (AppShell gates that via the
// server-resolved enableSimulation boolean — see AppShell.test.tsx). Once
// mounted, it fetches its real status from GET /api/admin/simulate and renders
// only after a successful response; a failed status must not throw or expose
// the panel. These render the real SimulationPanel; only the fetch transport
// is mocked (OneSignal-style), never the render/gate behavior under test.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import SimulationPanel from './SimulationPanel'

function mockFetch(ok: boolean) {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/api/admin/simulate') {
      if (!ok) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ isActive: false, simTimestamp: null, forcedState: null, activeScenario: null, currentPlan: 'pro', promoStartsAt: null, promoEndsAt: null }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as never
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SimulationPanel — status fetch + render gate (P3.5-4B)', () => {
  it('performs the status GET on mount and renders only after a successful response', async () => {
    mockFetch(true)
    render(<SimulationPanel />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/simulate'))
    await waitFor(() => expect(screen.getByText('SIM')).toBeTruthy())
  })

  it('a failed (404) status GET does not throw and does not expose the panel', async () => {
    mockFetch(false)
    render(<SimulationPanel />)
    // The GET is attempted…
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/simulate'))
    // let the rejected .then / .catch settle
    await new Promise((r) => setTimeout(r, 0))
    // …but the panel stays hidden (fails closed), with no uncaught error.
    expect(screen.queryByText('SIM')).toBeNull()
    expect(screen.queryByText('⚡ SIM ACTIVE')).toBeNull()
  })
})
