import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPS_ALL_READ = { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false }

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    connectedLeagueId: 'cl-1',
    platform: 'sleeper',
    externalLeagueId: 'league-1',
    externalTeamId: 'team-1',
    capturedAt: '2026-07-17T12:00:00Z',
    providerUpdatedAt: null,
    players: [
      { canonicalPlayerId: 'c1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', displayName: 'Josh Allen', nflTeam: 'BUF', position: 'QB', lineupStatus: 'starting', slot: null, identityConfidence: 'exact', identityReason: 'x' },
    ],
    warnings: [],
    ...overrides,
  }
}

function mockAdmin(opts: {
  leagues: Array<{ id: string; platform: string; league_id: string; league_name: string; team_id: string | null }>
  snapshotsByLeagueId: Record<string, { snapshot_json: unknown; snapped_at: string } | null>
  playersCacheRows?: Array<Record<string, unknown>>
  throwOnLeagueId?: string
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'connected_leagues') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: opts.leagues })) })) }
      }
      if (table === 'roster_snapshots') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, leagueId: string) => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() => {
                      if (opts.throwOnLeagueId && leagueId === opts.throwOnLeagueId) throw new Error('DB connection lost')
                      return Promise.resolve({ data: opts.snapshotsByLeagueId[leagueId] ?? null })
                    }),
                  })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'players_cache') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: opts.playersCacheRows ?? [] })) })) })) }
      }
      return {}
    }),
  }
}

describe('computeUserCrossPlatformPortfolio — unavailable leagues excluded but reported in coverage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('a league with no snapshot yet is excluded from exposure/health and marked unavailable in coverage', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() =>
        mockAdmin({
          leagues: [{ id: 'cl-1', platform: 'sleeper', league_id: 'league-1', league_name: 'My League', team_id: 'team-1' }],
          snapshotsByLeagueId: { 'cl-1': null },
        })
      ),
    }))
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_ALL_READ, readOwnedRoster: vi.fn() })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({
      computeSnapshotFreshness: vi.fn(() => 'unavailable'),
    }))

    const { computeUserCrossPlatformPortfolio } = await import('./crossPlatformPortfolioSync')
    const result = await computeUserCrossPlatformPortfolio('user-1')

    expect(result.exposure.resolved).toHaveLength(0)
    expect(result.health).toHaveLength(0)
    expect(result.coverage).toEqual([
      { connectedLeagueId: 'cl-1', leagueName: 'My League', platform: 'sleeper', status: 'unavailable', reason: 'No successful roster snapshot has been captured yet' },
    ])
  })

  it('a league with no team_id yet is unavailable, never crashes the whole computation', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => mockAdmin({ leagues: [{ id: 'cl-1', platform: 'sleeper', league_id: 'league-1', league_name: 'My League', team_id: null }], snapshotsByLeagueId: {} })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))

    const { computeUserCrossPlatformPortfolio } = await import('./crossPlatformPortfolioSync')
    const result = await computeUserCrossPlatformPortfolio('user-1')
    expect(result.coverage[0].status).toBe('unavailable')
  })

  it('yahoo (no adapter) is reported as approval_pending, not unsupported', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => mockAdmin({ leagues: [{ id: 'cl-1', platform: 'yahoo', league_id: 'league-1', league_name: 'Yahoo League', team_id: 'team-1' }], snapshotsByLeagueId: {} })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))

    const { computeUserCrossPlatformPortfolio } = await import('./crossPlatformPortfolioSync')
    const result = await computeUserCrossPlatformPortfolio('user-1')
    expect(result.coverage[0]).toMatchObject({ status: 'approval_pending' })
  })
})

describe('computeUserCrossPlatformPortfolio — PROOF: platform/league failure isolation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('one league throwing does not remove another healthy league\'s exposure/health results', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() =>
        mockAdmin({
          leagues: [
            { id: 'cl-broken', platform: 'espn', league_id: 'espn-league', league_name: 'Broken ESPN League', team_id: 'team-1' },
            { id: 'cl-healthy', platform: 'sleeper', league_id: 'sleeper-league', league_name: 'Healthy Sleeper League', team_id: 'team-1' },
          ],
          snapshotsByLeagueId: {
            'cl-healthy': { snapshot_json: baseSnapshot({ connectedLeagueId: 'cl-healthy' }), snapped_at: new Date().toISOString() },
          },
          throwOnLeagueId: 'cl-broken',
        })
      ),
    }))
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_ALL_READ, readOwnedRoster: vi.fn(), readAvailablePlayers: undefined })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({
      computeSnapshotFreshness: vi.fn(({ lastSnapshotAt }: { lastSnapshotAt: string | null }) => (lastSnapshotAt ? 'fresh' : 'unavailable')),
    }))

    const { computeUserCrossPlatformPortfolio } = await import('./crossPlatformPortfolioSync')
    const result = await computeUserCrossPlatformPortfolio('user-1')

    // The broken league is isolated as a 'failed' coverage entry...
    const broken = result.coverage.find((c) => c.connectedLeagueId === 'cl-broken')
    expect(broken?.status).toBe('failed')
    expect(broken?.reason).toMatch(/DB connection lost/)

    // ...while the healthy league's real results survive completely intact.
    const healthy = result.coverage.find((c) => c.connectedLeagueId === 'cl-healthy')
    expect(healthy?.status).toBe('included_fresh')
    expect(result.exposure.resolved).toHaveLength(1)
    expect(result.exposure.resolved[0].canonicalPlayerId).toBe('c1')
    expect(result.health).toHaveLength(1)
    expect(result.health[0].connectedLeagueId).toBe('cl-healthy')
  })
})
