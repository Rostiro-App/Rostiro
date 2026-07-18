import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPS_READ_ONLY = { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false }
const REAL_USER_ID = 'real-user-abc-123'

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

function mockAdmin(opts: {
  snapshot?: { snapshot_json: unknown; snapped_at: string } | null
  snapshotError?: { message: string } | null
  playersCacheRows?: Array<Record<string, unknown>>
  playersCacheError?: { message: string } | null
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'roster_snapshots') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: opts.snapshot ?? null, error: opts.snapshotError ?? null })) })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'players_cache') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: opts.playersCacheRows ?? [], error: opts.playersCacheError ?? null })) })) })) }
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

    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    const grade = items.find((i) => i.type === 'roster_grade')
    expect(grade).toBeDefined()
    expect(grade?.affectedLeagues[0]).toMatchObject({ platform: 'espn', freshness: 'fresh', actionCapability: 'none' })
  })

  it('PROOF (P3-11 correction): a stale league gets a coverage entry but ZERO Pulse recommendation items — an actionable suggestion is never built on possibly-outdated data', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'stale') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: '2026-07-01T00:00:00Z' }, playersCacheRows: [{ player_id: 'e1', adp_consensus: 10, adp_espn: 12, injury_status: null }] }) as never

    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    expect(items).toHaveLength(0)
    expect(coverage.status).toBe('included_stale')
  })

  it('PROOF (P3-8B): unavailable snapshots contribute zero items but STILL get a real coverage entry, never blanking anything else', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'unavailable') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: null }) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    expect(items).toHaveLength(0)
    expect(coverage).toMatchObject({ connectedLeagueId: 'cl-1', status: 'unavailable' })
    expect(coverage.reason).not.toBeNull()
  })

  it('PROOF (P3-11 correction): a roster_snapshots query error is reported as "failed" coverage, never conflated with "no snapshot yet"', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshotError: { message: 'connection reset' } }) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    expect(items).toHaveLength(0)
    expect(coverage.status).toBe('failed')
    expect(coverage.reason).toMatch(/connection reset/)
  })

  it('PROOF (P3-11 correction): a players_cache (ADP lookup) query error is reported as "failed" coverage, never computed with a silently-empty lookup', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() }, playersCacheError: { message: 'players_cache unreachable' } }) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    expect(items).toHaveLength(0)
    expect(coverage.status).toBe('failed')
    expect(coverage.reason).toMatch(/players_cache unreachable/)
  })

  it('a Yahoo league (no adapter) produces zero items and an approval_pending coverage entry — never represented as live intelligence', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const yahooLeague = { ...league, platform: 'yahoo' as const }
    const admin = mockAdmin({}) as never
    const { items, coverage } = await buildCrossPlatformPulseItemsForLeague(admin, yahooLeague, REAL_USER_ID)
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
    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
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
    const { items } = await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    const waiver = items.find((i) => i.type === 'waiver_alert')
    expect(waiver?.affectedLeagues[0]).toMatchObject({ canonicalPlayerId: 'c9', providerPlayerId: 'e9', status: 'free_agent', platform: 'espn' })
  })

  it('PROOF (P3-11 correction): the real authenticated user ID reaches the adapter context, never an empty string', async () => {
    let receivedUserId: string | undefined
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'espn',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn((context: { userId: string }) => {
          receivedUserId = context.userId
          return Promise.resolve({ status: 'ok', data: [] })
        }),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() }, playersCacheRows: [] }) as never
    await buildCrossPlatformPulseItemsForLeague(admin, league, REAL_USER_ID)
    expect(receivedUserId).toBe(REAL_USER_ID)
    expect(receivedUserId).not.toBe('')
  })
})

describe('buildCrossPlatformPulseItemsForUser — failure isolation + userId threading', () => {
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
                      error: null,
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
                          return Promise.resolve({ data: { snapshot_json: snapshotWithPlayers({ connectedLeagueId: 'cl-healthy' }), snapped_at: new Date().toISOString() }, error: null })
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            }
          }
          if (table === 'players_cache') {
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))

    const { buildCrossPlatformPulseItemsForUser } = await import('./crossPlatformPulse')
    const result = await buildCrossPlatformPulseItemsForUser(REAL_USER_ID)
    expect(result.items.some((i) => i.fingerprint === 'roster_grade:cl-healthy')).toBe(true)
    expect(result.leagueCount).toBe(2)
  })

  it('PROOF (P3-11 correction): a connected_leagues query error throws rather than silently reporting zero leagues', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'db down' } })) })) })) })),
      })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { buildCrossPlatformPulseItemsForUser } = await import('./crossPlatformPulse')
    await expect(buildCrossPlatformPulseItemsForUser(REAL_USER_ID)).rejects.toThrow(/db down/)
  })

  it('PROOF (P3-11 correction): the real user ID passed to buildCrossPlatformPulseItemsForUser reaches every league\'s adapter context', async () => {
    const receivedUserIds: string[] = []
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'connected_leagues') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  neq: vi.fn(() => Promise.resolve({ data: [{ id: 'cl-1', platform: 'espn', league_id: 'l1', league_name: 'L', team_id: 'team-1' }], error: null })),
                })),
              })),
            }
          }
          if (table === 'roster_snapshots') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { snapshot_json: snapshotWithPlayers(), snapped_at: new Date().toISOString() }, error: null })) })),
                    })),
                  })),
                })),
              })),
            }
          }
          if (table === 'players_cache') {
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'espn',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn((context: { userId: string }) => {
          receivedUserIds.push(context.userId)
          return Promise.resolve({ status: 'ok', data: [] })
        }),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))

    const { buildCrossPlatformPulseItemsForUser } = await import('./crossPlatformPulse')
    await buildCrossPlatformPulseItemsForUser(REAL_USER_ID)
    expect(receivedUserIds).toEqual([REAL_USER_ID])
  })
})
