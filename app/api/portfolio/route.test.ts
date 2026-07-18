import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/portfolio — P3-6B production cross-platform exposure route', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } }) }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({ computeUserCrossPlatformPortfolio: vi.fn() }))
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('PROOF: returns coverage metadata distinguishing included/stale/unavailable/unsupported/approval_pending/failed', async () => {
    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) } }) }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({
      computeUserCrossPlatformPortfolio: vi.fn(() =>
        Promise.resolve({
          exposure: { resolved: [{ canonicalPlayerId: 'c1', displayName: 'X', exposureCount: 2, starterCount: 1, benchCount: 1, leagues: [] }], unresolved: [] },
          health: [
            { connectedLeagueId: 'cl-1', leagueName: 'L1', platform: 'sleeper', result: { health: { score: 90, status: 'healthy', factors: [], topFlag: null }, factorCoverage: { available: 3, total: 5 }, adpSource: 'sleeper', playersWithAdp: 1, playersTotal: 1 } },
          ],
          coverage: [
            { connectedLeagueId: 'cl-1', leagueName: 'L1', platform: 'sleeper', status: 'included_fresh', reason: null },
            { connectedLeagueId: 'cl-2', leagueName: 'L2', platform: 'sleeper', status: 'included_stale', reason: null },
            { connectedLeagueId: 'cl-3', leagueName: 'L3', platform: 'espn', status: 'unavailable', reason: 'No successful roster snapshot has been captured yet' },
            { connectedLeagueId: 'cl-4', leagueName: 'L4', platform: 'yahoo', status: 'approval_pending', reason: null },
            { connectedLeagueId: 'cl-5', leagueName: 'L5', platform: 'sleeper', status: 'failed', reason: 'DB error' },
          ],
        })
      ),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.exposure.resolved[0].canonicalPlayerId).toBe('c1')
    expect(body.health[0]).toMatchObject({ adpSource: 'sleeper', factorCoverage: { available: 3, total: 5 } })
    const statuses = body.coverage.map((c: { status: string }) => c.status).sort()
    expect(statuses).toEqual(['approval_pending', 'failed', 'included_fresh', 'included_stale', 'unavailable'])
  })
})
