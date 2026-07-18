import { describe, it, expect, vi, beforeEach } from 'vitest'

function mockAdmin(opts: { connectedLeagueUserIds: string[]; upsertHealthError?: { code: string } | null; upsertExposureError?: { code: string } | null }) {
  const healthUpsert = vi.fn(() => Promise.resolve({ error: opts.upsertHealthError ?? null }))
  const exposureUpsert = vi.fn(() => Promise.resolve({ error: opts.upsertExposureError ?? null }))
  return {
    admin: {
      from: vi.fn((table: string) => {
        if (table === 'connected_leagues') {
          return { select: vi.fn(() => Promise.resolve({ data: opts.connectedLeagueUserIds.map((user_id) => ({ user_id })), error: null })) }
        }
        if (table === 'portfolio_health_snapshots') return { upsert: healthUpsert }
        if (table === 'portfolio_exposure_snapshots') return { upsert: exposureUpsert }
        return {}
      }),
    },
    healthUpsert,
    exposureUpsert,
  }
}

describe('GET /api/cron/pulse — P3-6B: cross-platform Portfolio wiring', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: the connected_leagues user query has no Sleeper-only filter — an ESPN-only user is included', async () => {
    const { admin } = mockAdmin({ connectedLeagueUserIds: ['espn-only-user'] })
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => admin) }))
    vi.doMock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: vi.fn(() => true) }))
    vi.doMock('@/lib/cronHeartbeat', () => ({ recordCronRun: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/pulse', () => ({ buildPulseItemsForUser: vi.fn(() => Promise.resolve({ items: [] })), syncPulseItems: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/portfolio', () => ({ currentWeekStart: vi.fn(() => '2026-07-14') }))
    const computeSpy = vi.fn(() => Promise.resolve({ health: [], exposure: { resolved: [], unresolved: [] }, coverage: [] }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({ computeUserCrossPlatformPortfolio: computeSpy }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never)
    expect(res.status).toBe(200)
    // The admin.from('connected_leagues').select(...) call was never
    // filtered by platform — confirmed by the mock itself returning the
    // ESPN-only user, and by computeSpy having been called for them.
    expect(computeSpy).toHaveBeenCalledWith('espn-only-user')
  })

  it('PROOF: uses computeUserCrossPlatformPortfolio, writes resolved exposure with schema_version 2 / canonical', async () => {
    const { admin, healthUpsert, exposureUpsert } = mockAdmin({ connectedLeagueUserIds: ['user-1'] })
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => admin) }))
    vi.doMock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: vi.fn(() => true) }))
    vi.doMock('@/lib/cronHeartbeat', () => ({ recordCronRun: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/pulse', () => ({ buildPulseItemsForUser: vi.fn(() => Promise.resolve({ items: [] })), syncPulseItems: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/portfolio', () => ({ currentWeekStart: vi.fn(() => '2026-07-14') }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({
      computeUserCrossPlatformPortfolio: vi.fn(() =>
        Promise.resolve({
          health: [{ connectedLeagueId: 'cl-1', leagueName: 'L', platform: 'sleeper', result: { health: { score: 80, status: 'healthy', factors: [], topFlag: null }, factorCoverage: { available: 3, total: 5 }, adpSource: 'sleeper', playersWithAdp: 1, playersTotal: 1 } }],
          exposure: { resolved: [{ canonicalPlayerId: 'canon-1', displayName: 'X', exposureCount: 2, starterCount: 1, benchCount: 1, leagues: [] }], unresolved: [] },
          coverage: [],
        })
      ),
    }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.portfolioSnapshotted).toBe(1)
    expect(healthUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ league_id: 'cl-1', health_score: 80, schema_version: 2 })],
      { onConflict: 'week_start,user_id,league_id' }
    )
    expect(exposureUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ player_id: 'canon-1', league_count: 2, schema_version: 2, player_id_space: 'canonical' })],
      { onConflict: 'week_start,user_id,player_id' }
    )
  })

  it('PROOF: a Pulse failure for one user does not prevent that user\'s own Portfolio snapshot from running', async () => {
    const { admin } = mockAdmin({ connectedLeagueUserIds: ['user-1'] })
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => admin) }))
    vi.doMock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: vi.fn(() => true) }))
    vi.doMock('@/lib/cronHeartbeat', () => ({ recordCronRun: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/pulse', () => ({ buildPulseItemsForUser: vi.fn(() => Promise.reject(new Error('sleeper down'))), syncPulseItems: vi.fn() }))
    vi.doMock('@/lib/portfolio', () => ({ currentWeekStart: vi.fn(() => '2026-07-14') }))
    const computeSpy = vi.fn(() => Promise.resolve({ health: [], exposure: { resolved: [], unresolved: [] }, coverage: [] }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({ computeUserCrossPlatformPortfolio: computeSpy }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never)
    expect(res.status).toBe(200)
    expect(computeSpy).toHaveBeenCalledWith('user-1')
  })

  it('PROOF: honestly reports (never silently swallows) when schema_version/player_id_space columns are missing', async () => {
    const { admin } = mockAdmin({ connectedLeagueUserIds: ['user-1'], upsertHealthError: { code: 'PGRST204' } })
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => admin) }))
    vi.doMock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: vi.fn(() => true) }))
    vi.doMock('@/lib/cronHeartbeat', () => ({ recordCronRun: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/pulse', () => ({ buildPulseItemsForUser: vi.fn(() => Promise.resolve({ items: [] })), syncPulseItems: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/portfolio', () => ({ currentWeekStart: vi.fn(() => '2026-07-14') }))
    vi.doMock('@/lib/crossPlatformPortfolioSync', () => ({
      computeUserCrossPlatformPortfolio: vi.fn(() =>
        Promise.resolve({
          health: [{ connectedLeagueId: 'cl-1', leagueName: 'L', platform: 'sleeper', result: { health: { score: 80, status: 'healthy', factors: [], topFlag: null }, factorCoverage: { available: 3, total: 5 }, adpSource: 'sleeper', playersWithAdp: 1, playersTotal: 1 } }],
          exposure: { resolved: [], unresolved: [] },
          coverage: [],
        })
      ),
    }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never)
    const body = await res.json()
    expect(body.portfolioSchemaVersionColumnsMissing).toBe(true)
  })
})
