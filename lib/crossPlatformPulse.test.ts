import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPS_READ_ONLY = { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false }

function snapshotWithPlayers(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    connectedLeagueId: 'cl-1',
    platform: 'espn',
    externalLeagueId: 'league-1',
    externalTeamId: 'team-1',
    capturedAt: new Date().toISOString(),
    providerUpdatedAt: null,
    players: [
      { canonicalPlayerId: 'c1', sourcePlatform: 'espn', sourcePlayerId: 'e1', displayName: 'Josh Allen', nflTeam: 'BUF', position: 'QB', lineupStatus: 'starting', slot: null, identityConfidence: 'exact', identityReason: 'x' },
    ],
    warnings: [],
    ...overrides,
  }
}

function mockAdmin(opts: { snapshot?: { snapshot_json: unknown; snapped_at: string } | null; playersCacheRows?: Array<Record<string, unknown>> }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'roster_snapshots') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: opts.snapshot ?? null })) })),
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

const league = { id: 'cl-1', platform: 'espn' as const, league_id: 'league-1', league_name: 'ESPN League', team_id: 'team-1' }

describe('buildCrossPlatformPulseItemsForLeague', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('produces a roster_grade item with platform/freshness/actionCapability set', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() }, playersCacheRows: [{ player_id: 'e1', adp_consensus: 10, adp_espn: 12, injury_status: null }] }) as never

    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    const grade = items.find((i) => i.type === 'roster_grade')
    expect(grade).toBeDefined()
    expect(grade?.affectedLeagues[0]).toMatchObject({ platform: 'espn', freshness: 'fresh', actionCapability: 'none' })
  })

  it('PROOF: a stale snapshot is labeled stale, not silently treated as fresh', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'stale') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: '2026-07-01T00:00:00Z' }, playersCacheRows: [{ player_id: 'e1', adp_consensus: 10, adp_espn: 12, injury_status: null }] }) as never

    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    expect(items[0].affectedLeagues[0].freshness).toBe('stale')
  })

  it('PROOF (P3-8B): unavailable snapshots contribute zero items but STILL get a real coverage entry, never blanking anything else', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'unavailable') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: null }) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    expect(items).toHaveLength(0)
    expect(coverage).toMatchObject({ connectedLeagueId: 'cl-1', status: 'unavailable' })
    expect(coverage.reason).not.toBeNull()
  })

  it('PROOF (P3-8B): a stale league is included but its coverage status is included_stale, distinguishable from fresh', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'stale') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: '2026-07-01T00:00:00Z' }, playersCacheRows: [{ player_id: 'e1', adp_consensus: 10, adp_espn: 12, injury_status: null }] }) as never
    const { coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    expect(coverage.status).toBe('included_stale')
  })

  it('a Yahoo league (no adapter) produces zero items and an approval_pending coverage entry — never represented as live intelligence', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const yahooLeague = { ...league, platform: 'yahoo' as const }
    const admin = mockAdmin({}) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, yahooLeague)
    expect(items).toHaveLength(0)
    expect(coverage.status).toBe('approval_pending')
  })

  it('PROOF: never infers a waiver_alert from roster absence — only from a successful readAvailablePlayers result', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'espn',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn(() => Promise.resolve({ status: 'failed', data: null, warnings: [] })),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() }, playersCacheRows: [] }) as never
    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    expect(items.some((i) => i.type === 'waiver_alert')).toBe(false)
  })

  it('produces a waiver_alert with canonicalPlayerId/providerPlayerId/status only after a real successful readAvailablePlayers call', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'espn',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn(() =>
          Promise.resolve({ status: 'ok', data: [{ canonicalPlayerId: 'c9', sourcePlatform: 'espn', sourcePlayerId: 'e9', displayName: 'Free Guy', nflTeam: 'DAL', position: 'WR', availability: 'free_agent', identityConfidence: 'exact' }] })
        ),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({
      snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() },
      playersCacheRows: [{ player_id: 'e1', adp_consensus: 10, adp_espn: 12, injury_status: null }, { player_id: 'e9', adp_consensus: 5, adp_espn: 6, injury_status: null }],
    }) as never
    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league)
    const waiver = items.find((i) => i.type === 'waiver_alert')
    expect(waiver?.affectedLeagues[0]).toMatchObject({ canonicalPlayerId: 'c9', providerPlayerId: 'e9', status: 'free_agent', platform: 'espn' })
  })
})

describe('buildCrossPlatformPulseItemsForUser — failure isolation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: one league throwing does not remove another league\'s real items', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'connected_leagues') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        { id: 'cl-broken', platform: 'espn', league_id: 'l1', league_name: 'Broken', team_id: 'team-1' },
                        { id: 'cl-healthy', platform: 'espn', league_id: 'l2', league_name: 'Healthy', team_id: 'team-1' },
                      ],
                    })
                  ),
                })),
              })),
            }
          }
          if (table === 'roster_snapshots') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((_c: string, leagueId: string) => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(() => {
                          if (leagueId === 'cl-broken') throw new Error('boom')
                          return Promise.resolve({ data: { snapshot_json: snapshotWithPlayers({ connectedLeagueId: 'cl-healthy' }), snapped_at: new Date().toISOString() } })
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            }
          }
          if (table === 'players_cache') {
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [] })) })) })) }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))

    const { buildCrossPlatformPulseItemsForUser } = await import('./crossPlatformPulse')
    const result = await buildCrossPlatformPulseItemsForUser('user-1')
    expect(result.items.some((i) => i.fingerprint === 'roster_grade:cl-healthy')).toBe(true)
    expect(result.leagueCount).toBe(2)
  })
})
