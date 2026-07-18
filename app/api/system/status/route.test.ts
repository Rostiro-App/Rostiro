import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 'user-1' }

function chainReturning(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.not = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }))
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data, error })
  return chain
}

function mockSupabase(opts: { leagues: unknown[] }) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
    from: vi.fn((table: string) => {
      if (table === 'users') return chainReturning({ plan: 'free' })
      if (table === 'connected_leagues') return chainReturning(opts.leagues)
      if (table === 'players_cache') return chainReturning([])
      if (table === 'nfl_schedule') return chainReturning([])
      return chainReturning(null)
    }),
  }
}

describe('GET /api/system/status — P3-6B: real ESPN health without disturbing Sleeper', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: a user with one Sleeper league and one ESPN league gets REAL health for both in the response', async () => {
    const leagues = [
      { id: 'cl-sleeper', platform: 'sleeper', league_id: 'sl-1', league_name: 'Sleeper League', team_id: 'team-1', waiver_cutoff_day: null, waiver_cutoff_hour: null },
      { id: 'cl-espn', platform: 'espn', league_id: 'es-1', league_name: 'ESPN League', team_id: 'team-1', waiver_cutoff_day: null, waiver_cutoff_hour: null },
    ]

    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve(mockSupabase({ leagues })) }))
    vi.doMock('@/lib/sleeper', () => ({
      getSleeperDrafts: vi.fn(() => Promise.resolve([])),
      getSleeperRosters: vi.fn(() => Promise.resolve([{ roster_id: 'team-1', players: ['s1'], starters: ['s1'] }])),
      getSleeperLeague: vi.fn(() => Promise.resolve(null)),
      getSleeperWinnersBracket: vi.fn(() => Promise.resolve([])),
    }))
    vi.doMock('@/lib/playoffStatus', () => ({ computePlayoffTier: vi.fn(() => 'none') }))
    vi.doMock('@/lib/rostiroState', () => ({ getRostiroState: vi.fn(() => Promise.resolve('standard')) }))
    vi.doMock('@/lib/liveWindow', () => ({ computeLiveWindow: vi.fn(() => Promise.resolve({ isOpen: false, windowEndsAt: null, nextKickoff: null })) }))
    vi.doMock('@/lib/liveScores', () => ({ toNflverseTeamCode: vi.fn((t: string) => t) }))
    vi.doMock('@/lib/featureFlags', () => ({ isFeatureEnabled: vi.fn(() => Promise.resolve(false)) }))
    vi.doMock('@/lib/usageLimits', () => ({ isFreePlan: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/simTime', () => ({ simNow: vi.fn(() => Promise.resolve(new Date('2026-07-17T12:00:00Z'))) }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({
      computeUserCrossPlatformPortfolio: vi.fn(() =>
        Promise.resolve({
          exposure: { resolved: [], unresolved: [] },
          health: [
            {
              connectedLeagueId: 'cl-espn',
              leagueName: 'ESPN League',
              platform: 'espn',
              result: {
                health: { score: 75, status: 'monitor', factors: [{ key: 'injury', label: 'x', weight: 30, score: 90, note: null }], topFlag: null },
                factorCoverage: { available: 1, total: 5 },
                adpSource: 'espn',
                playersWithAdp: 1,
                playersTotal: 1,
              },
            },
          ],
          coverage: [],
        })
      ),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    const sleeperLeague = body.leagues.find((l: { id: string }) => l.id === 'cl-sleeper')
    const espnLeague = body.leagues.find((l: { id: string }) => l.id === 'cl-espn')

    // Sleeper's real, working health computation is untouched.
    expect(sleeperLeague.health.status).not.toBe('unknown')
    expect(sleeperLeague.health.adpSource).toBe('sleeper')
    expect(sleeperLeague.health.factorCoverage).toBeDefined()

    // ESPN now gets REAL health (not the old unconditional UNKNOWN_HEALTH).
    expect(espnLeague.health.score).toBe(75)
    expect(espnLeague.health.status).toBe('monitor')
    expect(espnLeague.health.adpSource).toBe('espn')
    expect(espnLeague.health.factorCoverage).toEqual({ available: 1, total: 5 })
  })

  it('PROOF: the cross-platform computation failing entirely does not blank the Sleeper league\'s real health', async () => {
    const leagues = [
      { id: 'cl-sleeper', platform: 'sleeper', league_id: 'sl-1', league_name: 'Sleeper League', team_id: 'team-1', waiver_cutoff_day: null, waiver_cutoff_hour: null },
      { id: 'cl-espn', platform: 'espn', league_id: 'es-1', league_name: 'ESPN League', team_id: 'team-1', waiver_cutoff_day: null, waiver_cutoff_hour: null },
    ]

    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve(mockSupabase({ leagues })) }))
    vi.doMock('@/lib/sleeper', () => ({
      getSleeperDrafts: vi.fn(() => Promise.resolve([])),
      getSleeperRosters: vi.fn(() => Promise.resolve([{ roster_id: 'team-1', players: ['s1'], starters: ['s1'] }])),
      getSleeperLeague: vi.fn(() => Promise.resolve(null)),
      getSleeperWinnersBracket: vi.fn(() => Promise.resolve([])),
    }))
    vi.doMock('@/lib/playoffStatus', () => ({ computePlayoffTier: vi.fn(() => 'none') }))
    vi.doMock('@/lib/rostiroState', () => ({ getRostiroState: vi.fn(() => Promise.resolve('standard')) }))
    vi.doMock('@/lib/liveWindow', () => ({ computeLiveWindow: vi.fn(() => Promise.resolve({ isOpen: false, windowEndsAt: null, nextKickoff: null })) }))
    vi.doMock('@/lib/liveScores', () => ({ toNflverseTeamCode: vi.fn((t: string) => t) }))
    vi.doMock('@/lib/featureFlags', () => ({ isFeatureEnabled: vi.fn(() => Promise.resolve(false)) }))
    vi.doMock('@/lib/usageLimits', () => ({ isFreePlan: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/simTime', () => ({ simNow: vi.fn(() => Promise.resolve(new Date('2026-07-17T12:00:00Z'))) }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({
      computeUserCrossPlatformPortfolio: vi.fn(() => Promise.reject(new Error('total failure'))),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    const sleeperLeague = body.leagues.find((l: { id: string }) => l.id === 'cl-sleeper')
    const espnLeague = body.leagues.find((l: { id: string }) => l.id === 'cl-espn')

    expect(sleeperLeague.health.status).not.toBe('unknown')
    expect(espnLeague.health.status).toBe('unknown') // honest fallback, not a crash
  })
})
