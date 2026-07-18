import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAPS_READ_ONLY = { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false }

function mockAdmin(opts: {
  mappingLookups?: Record<string, { id: string } | null>
  mappingLookupError?: Record<string, { message: string }>
  snapshot?: { snapshot_json: unknown; snapped_at: string } | null
  snapshotError?: { message: string } | null
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'player_mappings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn(() => {
                const err = opts.mappingLookupError?.[`${col}:${val}`]
                if (err) return Promise.resolve({ data: null, error: err })
                return Promise.resolve({ data: opts.mappingLookups?.[`${col}:${val}`] ?? null, error: null })
              }),
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
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({ data: opts.snapshot ?? null, error: opts.snapshotError ?? null })),
                  })),
                })),
              })),
            })),
          })),
        }
      }
      return {}
    }),
  }
}

describe('resolvePlayerIdentityForRoute — compatibility lookup at the route boundary', () => {
  it('resolves a real canonical player_mappings.id directly', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({ mappingLookups: { 'id:canon-1': { id: 'canon-1' } } }) as never
    const result = await resolvePlayerIdentityForRoute(admin, 'canon-1')
    expect(result).toEqual({ canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null })
  })

  it('PROOF: a legacy raw Sleeper ID resolves via sleeper_id compatibility lookup, not treated as already-canonical', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({ mappingLookups: { 'id:4046': null, 'sleeper_id:4046': { id: 'canon-real' } } }) as never
    const result = await resolvePlayerIdentityForRoute(admin, '4046')
    expect(result.canonicalPlayerId).toBe('canon-real')
  })

  it('resolves a legacy raw ESPN ID via espn_id compatibility lookup', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({ mappingLookups: { 'id:4426515': null, 'sleeper_id:4426515': null, 'espn_id:4426515': { id: 'canon-espn' } } }) as never
    const result = await resolvePlayerIdentityForRoute(admin, '4426515')
    expect(result.canonicalPlayerId).toBe('canon-espn')
  })

  it('falls back to a platform-specific source ID (never a guessed canonical link) when no mapping exists at all', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({ mappingLookups: {} }) as never
    const result = await resolvePlayerIdentityForRoute(admin, 'unmapped-123')
    expect(result).toEqual({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 'unmapped-123' })
  })

  it('PROOF (P3-11 correction): a Supabase error on the first (id) lookup throws, never falls through as if unmapped', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({ mappingLookupError: { 'id:canon-1': { message: 'connection reset' } } }) as never
    await expect(resolvePlayerIdentityForRoute(admin, 'canon-1')).rejects.toThrow(/connection reset/)
  })

  it('PROOF (P3-11 correction): a Supabase error on a later (espn_id) lookup throws, never falls through to the legacy sourcePlayerId guess', async () => {
    const { resolvePlayerIdentityForRoute } = await import('./playerIntelligence')
    const admin = mockAdmin({
      mappingLookups: { 'id:4426515': null, 'sleeper_id:4426515': null },
      mappingLookupError: { 'espn_id:4426515': { message: 'query timeout' } },
    }) as never
    await expect(resolvePlayerIdentityForRoute(admin, '4426515')).rejects.toThrow(/query timeout/)
  })
})

describe('computePlayerStateForLeague — one league, independent state', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  const league = { id: 'cl-1', platform: 'sleeper' as const, league_id: 'league-1', league_name: 'My League', team_id: 'team-1' }
  const identity = { canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null }
  const REAL_USER_ID = 'real-user-abc-123'

  function snapshotWithPlayer(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 1,
      players: [
        { canonicalPlayerId: 'canon-1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', lineupStatus: 'starting', ...overrides },
      ],
    }
  }

  it('PROOF: status is "mine" when the player is on my own roster snapshot', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayer(), snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result).toMatchObject({ status: 'mine', isStarter: true, freshness: 'fresh', actionCapability: 'none' })
  })

  it('PROOF: a stale snapshot is labeled stale, not silently treated as fresh', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'stale') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: snapshotWithPlayer(), snapped_at: '2026-07-01T00:00:00Z' } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.freshness).toBe('stale')
    expect(result.status).toBe('mine')
  })

  it('PROOF: never infers free agency from "absent from my roster" — checks the real provider free-agent pool first', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'sleeper',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn(() =>
          Promise.resolve({ status: 'ok', data: [{ canonicalPlayerId: 'canon-1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', availability: 'free_agent' }] })
        ),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('free_agent')
  })

  it('reports "waivers" distinctly from "free_agent" when the provider says so', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'sleeper',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn(() =>
          Promise.resolve({ status: 'ok', data: [{ canonicalPlayerId: 'canon-1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', availability: 'waivers' }] })
        ),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('waivers')
  })

  it('PROOF (P3-11 correction): a player absent from the BOUNDED available-players pool is "unknown", never "rostered_elsewhere" — absence from a top-N list proves nothing', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'sleeper',
        capabilities: CAPS_READ_ONLY,
        // A real, successful read that simply doesn't happen to include
        // this specific player — e.g. a bounded top-25-by-ADP pool.
        readAvailablePlayers: vi.fn(() => Promise.resolve({ status: 'ok', data: [{ canonicalPlayerId: 'someone-else', sourcePlatform: 'sleeper', sourcePlayerId: 's99', availability: 'free_agent' }] })),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('unknown')
  })

  it('PROOF (P3-11 correction): an EMPTY available-players result also stays "unknown" — never "rostered_elsewhere"', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({
        platform: 'sleeper',
        capabilities: CAPS_READ_ONLY,
        readAvailablePlayers: vi.fn(() => Promise.resolve({ status: 'ok', data: [] })),
      })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('unknown')
    expect(result.status).not.toBe('rostered_elsewhere')
  })

  it('reports "unknown" (never a guess) when the free-agent check itself fails or is unsupported', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('unknown')
  })

  it('PROOF (P3-11 correction): a roster_snapshots query error is surfaced as unknown/unavailable, never treated as "no snapshot yet"', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'unavailable') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: null, snapshotError: { message: 'connection reset' } }) as never
    const result = await computePlayerStateForLeague(admin, league, identity, REAL_USER_ID)
    expect(result.status).toBe('unknown')
    expect(result.freshness).toBe('unavailable')
  })

  it('PROOF (P3-11 correction): the real authenticated user ID is threaded into the ESPN adapter context, never an empty string', async () => {
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
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const admin = mockAdmin({ snapshot: { snapshot_json: { players: [] }, snapped_at: new Date().toISOString() } }) as never
    const espnLeague = { ...league, platform: 'espn' as const }
    await computePlayerStateForLeague(admin, espnLeague, identity, REAL_USER_ID)
    expect(receivedUserId).toBe(REAL_USER_ID)
    expect(receivedUserId).not.toBe('')
  })

  it('PROOF: unresolved players remain source-specific — matched by platform+sourcePlayerId, and flagged as unresolved in this league', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_READ_ONLY })) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const unresolvedSnapshot = { players: [{ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 's1', lineupStatus: 'bench' }] }
    const admin = mockAdmin({ snapshot: { snapshot_json: unresolvedSnapshot, snapped_at: new Date().toISOString() } }) as never
    const unresolvedIdentity = { canonicalPlayerId: null, sourcePlatform: 'sleeper' as const, sourcePlayerId: 's1' }
    const result = await computePlayerStateForLeague(admin, league, unresolvedIdentity, REAL_USER_ID)
    expect(result).toMatchObject({ status: 'mine', unresolvedSourcePlayerId: 's1' })
  })

  it('reports unavailable/approval_pending honestly when no adapter or no team_id exists for this league', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { computePlayerStateForLeague } = await import('./playerIntelligence')
    const yahooLeague = { ...league, platform: 'yahoo' as const }
    const admin = mockAdmin({}) as never
    const result = await computePlayerStateForLeague(admin, yahooLeague, identity, REAL_USER_ID)
    expect(result.freshness).toBe('approval_pending')
    expect(result.status).toBe('unknown')
  })
})

describe('computePlayerIntelligence — every connected league reports independently, failures isolated', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: one league throwing does not remove another league\'s real result', async () => {
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn((platform: string) => {
        if (platform === 'espn') throw new Error('adapter blew up')
        return { platform: 'sleeper', capabilities: CAPS_READ_ONLY }
      }),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))

    const { computePlayerIntelligence } = await import('./playerIntelligence')
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'connected_leagues') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { id: 'cl-sleeper', platform: 'sleeper', league_id: 'l1', league_name: 'Sleeper League', team_id: 'team-1' },
                    { id: 'cl-espn', platform: 'espn', league_id: 'l2', league_name: 'ESPN League', team_id: 'team-1' },
                  ],
                  error: null,
                })
              ),
            })),
          }
        }
        if (table === 'roster_snapshots') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(() => Promise.resolve({ data: { snapshot_json: { players: [{ canonicalPlayerId: 'canon-1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', lineupStatus: 'starting' }] }, snapped_at: new Date().toISOString() }, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    } as never

    const identity = { canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null }
    const result = await computePlayerIntelligence(admin, 'user-1', identity)

    expect(result.leagues).toHaveLength(2)
    const espnState = result.leagues.find((l) => l.connectedLeagueId === 'cl-espn')
    expect(espnState?.status).toBe('unknown')
    const sleeperState = result.leagues.find((l) => l.connectedLeagueId === 'cl-sleeper')
    expect(sleeperState?.status).toBe('mine')
  })

  it('PROOF (P3-11 correction): a connected_leagues query error throws rather than silently reporting zero leagues', async () => {
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn() }))
    const { computePlayerIntelligence } = await import('./playerIntelligence')
    const admin = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'db down' } })) })) })),
    } as never

    const identity = { canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null }
    await expect(computePlayerIntelligence(admin, 'user-1', identity)).rejects.toThrow(/db down/)
  })
})
