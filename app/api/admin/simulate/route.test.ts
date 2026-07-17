import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  })),
}))
vi.mock('@/lib/simTime', () => ({ invalidateSimCache: vi.fn() }))
vi.mock('@/lib/simScenarios', () => ({
  runScenario1: vi.fn(), runScenario2: vi.fn(), runScenario3: vi.fn(), runScenario4: vi.fn(),
  clearSimulation: vi.fn(), loadFounderLeagues: vi.fn(), appendRestore: vi.fn(),
}))
vi.mock('@/lib/liveSimScenarios', () => ({
  runLiveUnlockScenario: vi.fn(), runTouchdownScenario: vi.fn(), runBigPlayScenario: vi.fn(),
  runInterceptionScenario: vi.fn(), runLeadChangeScenario: vi.fn(), runNonLiveInjuryScenario: vi.fn(),
  runLineupLockScenario: vi.fn(), runMissionCompleteScenario: vi.fn(),
  runCrossLeagueTouchdownScenario: vi.fn(), runEmptySlotLineupLockScenario: vi.fn(),
}))

import { GET, POST } from './route'
import { requireAdmin } from '@/lib/adminAuth'

function postReq(body: unknown) {
  return new Request('http://localhost/api/admin/simulate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

describe('admin/simulate auth boundary', () => {
  it('GET returns 404 (not 401/403 — deliberately does not announce its own existence) with no session', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('GET returns 200 for the configured admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-id' } as never)
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('POST returns 404 for a non-admin, before any action is processed', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null)
    const res = await POST(postReq({ action: 'set_time', timestamp: new Date().toISOString() }))
    expect(res.status).toBe(404)
  })
})
