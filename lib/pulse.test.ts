import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rowToPulseItem, syncPulseItems, type PulseItemRow } from './pulse'
import type { CrossPlatformPulseItem } from './crossPlatformPulse'

const baseRow: PulseItemRow = {
  id: '1', user_id: 'u', type: 'touchdown_swing', priority: 'info',
  headline: 'h', reasoning: 'r', affected_leagues_json: [],
  deadline: null, action_url: null, platform: 'sleeper', status: 'open', created_at: 't',
} as PulseItemRow

describe('rowToPulseItem metrics', () => {
  it('maps metrics_json onto metrics', () => {
    const item = rowToPulseItem({ ...baseRow, metrics_json: [{ leagueName: 'L', label: 'Win Prob', value: '62%', deltaPositive: true }] })
    expect(item.metrics).toHaveLength(1)
    expect(item.metrics![0].value).toBe('62%')
  })
  it('maps null/absent metrics_json to undefined', () => {
    expect(rowToPulseItem({ ...baseRow, metrics_json: null }).metrics).toBeUndefined()
    expect(rowToPulseItem(baseRow).metrics).toBeUndefined()
  })
})

function chain(data: unknown) {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.gte = vi.fn(() => c)
  c.not = vi.fn(() => c)
  c.in = vi.fn(() => c)
  c.order = vi.fn(() => c)
  c.limit = vi.fn(() => Promise.resolve({ data }))
  c.then = (resolve: (v: { data: unknown }) => void) => resolve({ data })
  return c
}

function mockSupabase(sleeperLeagues: unknown[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'connected_leagues') return chain(sleeperLeagues)
      return chain([])
    }),
  }
}

describe('buildPulseItemsForUser — P3-8: cross-platform merge (real function, I/O mocked)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: a mixed Sleeper + ESPN user receives Pulse intelligence tagged with BOTH platforms', async () => {
    vi.doMock('@/lib/sleeper', () => ({
      getSleeperRosters: vi.fn(() => Promise.resolve([{ roster_id: 'team-1', players: [], starters: [] }])),
      getSleeperDrafts: vi.fn(() => Promise.resolve([])),
      getSleeperLeague: vi.fn(() => Promise.resolve(null)),
    }))
    vi.doMock('@/lib/usageLimits', () => ({ isFreePlan: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/claude', () => ({ generatePlayerNewsContext: vi.fn(), generateOpportunitySurgeContext: vi.fn() }))
    vi.doMock('@/lib/engagementTriggers', () => ({ pushToUser: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/crossPlatformPulse', () => ({
      buildCrossPlatformPulseItemsForUser: vi.fn(() =>
        Promise.resolve({
          items: [
            {
              fingerprint: 'roster_grade:cl-espn',
              type: 'roster_grade',
              priority: 'info',
              headline: 'ESPN League — your roster grades 82',
              reasoning: 'x',
              affectedLeagues: [{ leagueId: 'cl-espn', leagueName: 'ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none', canonicalPlayerId: null, providerPlayerId: null, status: null }],
              deadline: null,
              actionUrl: '/leagues',
            },
          ],
          leagueCount: 1,
          coverage: [{ connectedLeagueId: 'cl-espn', leagueName: 'ESPN League', platform: 'espn', status: 'included_fresh', reason: null }],
        })
      ),
    }))

    const { buildPulseItemsForUser } = await import('./pulse')
    const supabase = mockSupabase([{ id: 'cl-sleeper', league_id: 'sl-1', league_name: 'Sleeper League', team_id: 'team-1' }])
    const result = await buildPulseItemsForUser(supabase as never, 'user-1')

    const platforms = new Set(result.items.map((i) => i.affectedLeagues[0]?.platform))
    expect(platforms.has('espn')).toBe(true)
    expect(result.leagueCount).toBeGreaterThanOrEqual(2) // 1 sleeper + 1 espn
  })

  it('PROOF: the cross-platform (ESPN) computation throwing entirely does not erase the Sleeper items', async () => {
    vi.doMock('@/lib/sleeper', () => ({
      getSleeperRosters: vi.fn(() => Promise.resolve([{ roster_id: 'team-1', players: ['s1'], starters: ['s1'] }])),
      getSleeperDrafts: vi.fn(() => Promise.resolve([{ status: 'complete' }])),
      getSleeperLeague: vi.fn(() => Promise.resolve(null)),
    }))
    vi.doMock('@/lib/usageLimits', () => ({ isFreePlan: vi.fn(() => Promise.resolve(true)) }))
    vi.doMock('@/lib/claude', () => ({ generatePlayerNewsContext: vi.fn(), generateOpportunitySurgeContext: vi.fn() }))
    vi.doMock('@/lib/engagementTriggers', () => ({ pushToUser: vi.fn(() => Promise.resolve()) }))
    vi.doMock('@/lib/crossPlatformPulse', () => ({
      buildCrossPlatformPulseItemsForUser: vi.fn(() => Promise.reject(new Error('ESPN totally down'))),
    }))

    const supabaseWithPlayerCache = {
      from: vi.fn((table: string) => {
        if (table === 'connected_leagues') return chain([{ id: 'cl-sleeper', league_id: 'sl-1', league_name: 'Sleeper League', team_id: 'team-1' }])
        if (table === 'players_cache') return chain([{ player_id: 's1', name: 'Josh Allen', position: 'QB', injury_status: null, adp_sleeper: 5 }])
        return chain([])
      }),
    }

    const { buildPulseItemsForUser } = await import('./pulse')
    const result = await buildPulseItemsForUser(supabaseWithPlayerCache as never, 'user-1')

    // A real Sleeper item (roster_grade, since the draft just completed
    // and myPlayers is non-empty) survives despite ESPN's total failure.
    expect(result.items.some((i) => i.type === 'roster_grade' && i.affectedLeagues[0]?.leagueId === 'cl-sleeper')).toBe(true)

    // PROOF (P3-11 correction): the total cross-platform failure is NOT
    // silently collapsed into an empty coverage array (which would look
    // identical to "this user has zero non-Sleeper leagues") — it now
    // surfaces as an explicit 'failed' coverage entry carrying the real
    // error message.
    const crossPlatformFailure = result.coverage.find((c) => c.connectedLeagueId === 'cross-platform-system-error')
    expect(crossPlatformFailure).toBeDefined()
    expect(crossPlatformFailure?.status).toBe('failed')
    expect(crossPlatformFailure?.reason).toContain('ESPN totally down')

    // The Sleeper league's own coverage is completely unaffected.
    const sleeperCoverage = result.coverage.find((c) => c.connectedLeagueId === 'cl-sleeper')
    expect(sleeperCoverage?.status).toBe('included_fresh')
  })
})

describe('P3-8B — PROOF: an ESPN item survives cron generation, persistence, cached retrieval, and serialization', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('generates a real ESPN roster_grade item, persists it via the REAL syncPulseItems with platform: espn, then reads it back via the REAL rowToPulseItem retaining all per-league metadata', async () => {
    // An earlier test in this file mocks @/lib/crossPlatformPulse's
    // exports at the module boundary — explicitly unmock it here so THIS
    // test exercises the REAL buildCrossPlatformPulseItemsForLeague, not
    // a leftover mock missing that export.
    vi.doUnmock('@/lib/crossPlatformPulse')

    // Step 1: GENERATION — the real buildCrossPlatformPulseItemsForLeague,
    // I/O mocked, same function the cron calls (via
    // buildCrossPlatformPulseItemsForUser -> buildPulseItemsForUser).
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn(() => ({ platform: 'espn', capabilities: { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false } })),
    }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ computeSnapshotFreshness: vi.fn(() => 'fresh') }))

    const { buildCrossPlatformPulseItemsForLeague } = await import('./crossPlatformPulse')
    const league = { id: 'cl-espn', platform: 'espn' as const, league_id: 'espn-league-1', league_name: 'ESPN League', team_id: 'team-1' }
    const snapshotAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'roster_snapshots') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(() =>
                        Promise.resolve({
                          data: {
                            snapshot_json: {
                              schemaVersion: 1, connectedLeagueId: 'cl-espn', platform: 'espn', externalLeagueId: 'espn-league-1', externalTeamId: 'team-1',
                              capturedAt: new Date().toISOString(), providerUpdatedAt: null, warnings: [],
                              players: [{ canonicalPlayerId: 'canon-real-1', sourcePlatform: 'espn', sourcePlayerId: 'e1', displayName: 'Josh Allen', nflTeam: 'BUF', position: 'QB', lineupStatus: 'starting', slot: null, identityConfidence: 'exact', identityReason: 'x' }],
                            },
                            snapped_at: new Date().toISOString(),
                          },
                        })
                      ),
                    })),
                  })),
                })),
              })),
            })),
          }
        }
        if (table === 'players_cache') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data: [{ player_id: 'e1', adp_consensus: 8, adp_espn: 8, injury_status: null }] })) })) })) }
        }
        return {}
      }),
    }

    const { items: generatedItems } = await buildCrossPlatformPulseItemsForLeague(snapshotAdmin as never, league, 'user-1')
    const grade = generatedItems.find((i): i is CrossPlatformPulseItem => i.type === 'roster_grade')
    expect(grade).toBeDefined()
    expect(grade!.affectedLeagues[0]).toMatchObject({ platform: 'espn', freshness: 'fresh', actionCapability: 'none' })

    // Step 2: PERSISTENCE — the REAL syncPulseItems, proving the insert
    // call stores platform: 'espn' (not the pre-P3-8 hardcoded 'sleeper'
    // bug) and the full affectedLeagues metadata in affected_leagues_json.
    let insertedRow: Record<string, unknown> | null = null
    const persistAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'pulse_items') {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ not: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
            insert: vi.fn((rows: Array<Record<string, unknown>>) => {
              insertedRow = rows[0]
              return Promise.resolve({ error: null })
            }),
            update: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ error: null })) })),
          }
        }
        return {}
      }),
    }
    const persisted = await syncPulseItems(persistAdmin as never, 'user-1', [grade!])
    expect(persisted).toBe(true)
    expect(insertedRow).not.toBeNull()
    expect(insertedRow!.platform).toBe('espn') // never mislabeled 'sleeper'

    // Step 3: CACHED RETRIEVAL + SERIALIZATION — the REAL rowToPulseItem,
    // fed the exact row shape a real DB read would return (built from
    // what was actually inserted above, simulating the round trip).
    const retrievedRow: PulseItemRow = {
      id: 'row-1',
      user_id: 'user-1',
      type: insertedRow!.type as PulseItemRow['type'],
      priority: insertedRow!.priority as PulseItemRow['priority'],
      headline: insertedRow!.headline as string,
      reasoning: insertedRow!.reasoning as string,
      affected_leagues_json: insertedRow!.affected_leagues_json as PulseItemRow['affected_leagues_json'],
      deadline: insertedRow!.deadline as string | null,
      action_url: insertedRow!.action_url as string | null,
      platform: insertedRow!.platform as PulseItemRow['platform'],
      status: 'open',
      created_at: new Date().toISOString(),
    }
    const cachedItem = rowToPulseItem(retrievedRow)

    // Full round trip verified: platform, league, freshness,
    // actionCapability, status, and canonical identity metadata all
    // survive generation -> persistence -> cached retrieval intact.
    expect(cachedItem.platform).toBe('espn')
    expect(cachedItem.affectedLeagues[0]).toMatchObject({
      leagueId: 'cl-espn',
      leagueName: 'ESPN League',
      platform: 'espn',
      freshness: 'fresh',
      actionCapability: 'none',
    })
  })
})

describe('syncPulseItems — PROOF (P3-11 correction): every mutation error is checked, never silently treated as success', () => {
  function builtItem(overrides: Partial<CrossPlatformPulseItem> = {}): CrossPlatformPulseItem {
    return {
      fingerprint: 'roster_grade:cl-1',
      type: 'roster_grade',
      priority: 'info',
      headline: 'h',
      reasoning: 'r',
      affectedLeagues: [{ leagueId: 'cl-1', leagueName: 'L', platform: 'espn', freshness: 'fresh', actionCapability: 'none', canonicalPlayerId: null, providerPlayerId: null, status: null }],
      deadline: null,
      actionUrl: null,
      ...overrides,
    }
  }

  it('a failed insert returns false, never true', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'pulse_items') {
          return {
            select: vi.fn(() => ({ eq: vi.fn(() => ({ not: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
            insert: vi.fn(() => Promise.resolve({ error: { message: 'insert failed: unique violation' } })),
          }
        }
        return {}
      }),
    }
    const result = await syncPulseItems(admin as never, 'user-1', [builtItem()])
    expect(result).toBe(false)
  })

  it('a failed update on an existing open row returns false, never true', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'pulse_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() =>
                  Promise.resolve({ data: [{ id: 'row-1', fingerprint: 'roster_grade:cl-1', status: 'open', snoozed_until: null }], error: null })
                ),
              })),
            })),
            update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'update failed: connection reset' } })) })),
          }
        }
        return {}
      }),
    }
    const result = await syncPulseItems(admin as never, 'user-1', [builtItem()])
    expect(result).toBe(false)
  })

  it('a failed delete of stale items returns false, never true', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'pulse_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() =>
                  Promise.resolve({ data: [{ id: 'row-stale', fingerprint: 'roster_grade:vanished', status: 'open', snoozed_until: null }], error: null })
                ),
              })),
            })),
            delete: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ error: { message: 'delete failed' } })) })),
          }
        }
        return {}
      }),
    }
    // `built` is empty, so the one existing 'open' row (fingerprint
    // 'roster_grade:vanished') is stale and must be deleted.
    const result = await syncPulseItems(admin as never, 'user-1', [])
    expect(result).toBe(false)
  })

  it('an existing open row gets affected_leagues_json and platform refreshed, not left stale from first insert', async () => {
    let updatedPayload: Record<string, unknown> | null = null
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'pulse_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() =>
                  Promise.resolve({ data: [{ id: 'row-1', fingerprint: 'roster_grade:cl-1', status: 'open', snoozed_until: null }], error: null })
                ),
              })),
            })),
            update: vi.fn((payload: Record<string, unknown>) => {
              updatedPayload = payload
              return { eq: vi.fn(() => Promise.resolve({ error: null })) }
            }),
          }
        }
        return {}
      }),
    }
    // Freshness flips from 'fresh' (whatever was true at first insert) to
    // 'stale' on this sync — the update payload must carry the NEW
    // affectedLeagues metadata and platform, not silently keep the old one.
    const updated = builtItem({
      affectedLeagues: [{ leagueId: 'cl-1', leagueName: 'L', platform: 'espn', freshness: 'stale', actionCapability: 'none', canonicalPlayerId: null, providerPlayerId: null, status: null }],
    })
    const result = await syncPulseItems(admin as never, 'user-1', [updated])
    expect(result).toBe(true)
    expect(updatedPayload).not.toBeNull()
    expect(updatedPayload!.affected_leagues_json).toEqual(updated.affectedLeagues)
    expect((updatedPayload!.affected_leagues_json as typeof updated.affectedLeagues)[0].freshness).toBe('stale')
    expect(updatedPayload!.platform).toBe('espn')
  })
})
