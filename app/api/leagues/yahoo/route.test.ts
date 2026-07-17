import { describe, it, expect, vi, beforeEach } from 'vitest'

// Route-level orchestration tests only — these mock lib/yahoo.ts and
// lib/normalize.ts at the function boundary, never a raw Yahoo JSON shape.
// They prove the route's auth/error-isolation/upsert/idempotency logic;
// they do NOT substitute for the real-fixture normalizer verification this
// packet reports as blocked (Yahoo hasn't approved read access yet).

const mockUser = { id: 'user-1' }

function mockLeague(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '',
    platform: 'yahoo',
    leagueId: '449.l.12345',
    leagueName: 'Test League',
    season: 2026,
    teamCount: 10,
    myTeamId: '449.l.12345.t.1',
    myTeamName: 'My Team',
    record: { wins: 0, losses: 0, ties: 0 },
    scoringSettings: {},
    rosterSlots: [],
    currentMatchup: null,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'ok',
    ...overrides,
  }
}

function mockNormalized(league: ReturnType<typeof mockLeague>) {
  return {
    ...league,
    leagueStatus: 'unknown',
    draft: { status: 'not_started', scheduledAt: null },
    waiver: { type: 'unknown', faabBudget: null, waiverDay: null, waiverHour: null },
    capabilities: {
      leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true,
      lineupWrite: false, waiverWrite: false, tradeWrite: false,
    },
    warnings: [],
  }
}

function makeUpsertChain(result: { data: unknown; error: unknown }) {
  return { select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve(result)) })) }
}

async function loadRouteWithMocks(opts: {
  getValidYahooAccessToken?: () => Promise<string>
  getYahooLeagues?: () => Promise<unknown>
  leagueKeys?: string[]
  existingLookup?: { data: unknown }
  upsertResult?: { data: unknown; error: unknown }
  canConnectResult?: { allowed: boolean }
  leagueOverrides?: Partial<Record<string, unknown>>
  ownedTeam?: { teamKey: string; teamName: string } | null
}) {
  const {
    getValidYahooAccessToken = () => Promise.resolve('valid-token'),
    getYahooLeagues = () => Promise.resolve({}),
    leagueKeys = ['449.l.12345'],
    existingLookup = { data: null },
    upsertResult = { data: { id: 'row-1' }, error: null },
    canConnectResult = { allowed: true },
    leagueOverrides = {},
    ownedTeam,
  } = opts

  vi.doMock('@/lib/supabase', () => ({
    createSSRClient: vi.fn(() => Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
    })),
    createAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'connected_leagues') {
          // Arity-agnostic chain — persistLeagueFailure's existence check
          // (3 .eq()s) and the success path's (4 .eq()s, incl. season)
          // both hit this same select().
          const selectChain: Record<string, unknown> = {}
          selectChain.eq = vi.fn(() => selectChain)
          selectChain.maybeSingle = vi.fn(() => Promise.resolve(existingLookup))
          return {
            select: vi.fn(() => selectChain),
            upsert: vi.fn(() => makeUpsertChain(upsertResult)),
            update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
            delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          }
        }
        if (table === 'yahoo_tokens') {
          return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }
        }
        return {}
      }),
    })),
  }))

  vi.doMock('@/lib/yahoo', () => ({
    getValidYahooAccessToken,
    getYahooLeagues,
    getYahooLeague: vi.fn(() => Promise.resolve({})),
    getYahooLeagueTeams: vi.fn(() => Promise.resolve({})),
  }))

  const league = mockLeague(leagueOverrides)
  vi.doMock('@/lib/normalize', () => ({
    normalizeYahooLeague: vi.fn(() => ({ ...league })),
    extractYahooLeagueKeys: vi.fn(() => leagueKeys),
    extractYahooOwnedTeam: vi.fn(() => ownedTeam !== undefined ? ownedTeam : { teamKey: league.myTeamId, teamName: league.myTeamName }),
    extractYahooSettings: vi.fn(() => ({})),
    SEASON: 2026,
  }))

  vi.doMock('@/lib/platforms/yahoo', () => ({
    toNormalizedYahooLeague: vi.fn((l: typeof league) => mockNormalized(l)),
  }))

  vi.doMock('@/lib/usageLimits', () => ({
    canConnectNewLeague: vi.fn(() => Promise.resolve(canConnectResult)),
  }))

  return import('./route')
}

describe('POST /api/leagues/yahoo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/supabase')
    vi.doUnmock('@/lib/yahoo')
    vi.doUnmock('@/lib/normalize')
    vi.doUnmock('@/lib/platforms/yahoo')
    vi.doUnmock('@/lib/usageLimits')
  })

  it('rejects an unauthenticated request', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } })),
      createAdminClient: vi.fn(() => ({})),
    }))
    const { POST } = await import('./route')
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('returns 404 when no Yahoo account is connected', async () => {
    // Dynamically imported AFTER beforeEach's resetModules, so this is the
    // same module-registry generation route.ts's own `instanceof
    // YahooAPIError` check will use — a top-level static import here would
    // be a stale reference from before the reset, and instanceof would
    // silently fail across the two module instances.
    const { YahooAPIError } = await import('@/types')
    const { POST } = await loadRouteWithMocks({
      getValidYahooAccessToken: () => Promise.reject(new YahooAPIError('No Yahoo account connected', 'YAHOO_NOT_CONNECTED', 404)),
    })
    const res = await POST()
    expect(res.status).toBe(404)
  })

  it('returns 409 with a reconnect code when the token is unrecoverably dead', async () => {
    const { YahooAPIError } = await import('@/types')
    const { POST } = await loadRouteWithMocks({
      getValidYahooAccessToken: () => Promise.reject(new YahooAPIError('dead', 'YAHOO_RECONNECT_REQUIRED', 502)),
    })
    const res = await POST()
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe('YAHOO_RECONNECT_REQUIRED')
  })

  it('imports one league completely', async () => {
    const { POST } = await loadRouteWithMocks({})
    const res = await POST()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    expect(body.updated).toBe(0)
    expect(body.failed).toBe(0)
    expect(body.leagues).toHaveLength(1)
  })

  it('imports several leagues in one call', async () => {
    const { POST } = await loadRouteWithMocks({ leagueKeys: ['449.l.1', '449.l.2', '449.l.3'] })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(3)
  })

  it('resyncs an existing league as an update, not a duplicate import', async () => {
    const { POST } = await loadRouteWithMocks({ existingLookup: { data: { id: 'existing-row' } } })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.updated).toBe(1)
  })

  it('reports no leagues found without erroring', async () => {
    const { POST } = await loadRouteWithMocks({ leagueKeys: [] })
    const res = await POST()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.imported).toBe(0)
    expect(body.leagues).toEqual([])
  })

  it('skips a league over the free-plan cap and reports it separately from failures', async () => {
    const { POST } = await loadRouteWithMocks({ canConnectResult: { allowed: false } })
    const res = await POST()
    const body = await res.json()
    expect(body.skippedForPlan).toBe(1)
    expect(body.imported).toBe(0)
    expect(body.failed).toBe(0)
  })

  it('one league failing does not roll back or block any other league succeeding', async () => {
    vi.resetModules()
    const { YahooAPIError } = await import('@/types')
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
      })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'connected_leagues') {
            // Chainable mock supporting any number of .eq() calls before a
            // terminal .maybeSingle() — persistLeagueFailure's existence
            // check (3 .eq()s) and the success path's existence check (4
            // .eq()s, including season) both hit this same select().
            const selectChain: Record<string, unknown> = {}
            selectChain.eq = vi.fn(() => selectChain)
            selectChain.maybeSingle = vi.fn(() => Promise.resolve({ data: null }))
            return {
              select: vi.fn(() => selectChain),
              upsert: vi.fn(() => makeUpsertChain({ data: { id: 'row-ok' }, error: null })),
              update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
            }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/usageLimits', () => ({ canConnectNewLeague: vi.fn(() => Promise.resolve({ allowed: true })) }))
    vi.doMock('@/lib/normalize', () => {
      const league = mockLeague()
      return {
        normalizeYahooLeague: vi.fn(() => ({ ...league })),
        extractYahooLeagueKeys: vi.fn(() => ['449.l.good', '449.l.bad']),
        extractYahooOwnedTeam: vi.fn(() => ({ teamKey: league.myTeamId, teamName: league.myTeamName })),
        extractYahooSettings: vi.fn(() => ({})),
    SEASON: 2026,
      }
    })
    vi.doMock('@/lib/platforms/yahoo', () => ({ toNormalizedYahooLeague: vi.fn((l: ReturnType<typeof mockLeague>) => mockNormalized(l)) }))
    vi.doMock('@/lib/yahoo', () => ({
      getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')),
      getYahooLeagues: vi.fn(() => Promise.resolve({})),
      getYahooLeague: vi.fn((leagueKey: string) => {
        if (leagueKey === '449.l.bad') return Promise.reject(new YahooAPIError('Yahoo API error 500', 'YAHOO_HTTP_ERROR', 500))
        return Promise.resolve({})
      }),
      getYahooLeagueTeams: vi.fn(() => Promise.resolve({})),
    }))

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json()

    expect(body.imported).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.failures[0].leagueKey).toBe('449.l.bad')
    // The failure message is YahooAPIError's own sanitized text, never a
    // raw response body or credential.
    expect(body.failures[0].error).not.toContain('token')
  })

  it('preserves a first-time sync failure by inserting a placeholder row (no prior row existed), so it survives a reload', async () => {
    const { YahooAPIError } = await import('@/types')
    let upsertCalled = false
    let upsertPayload: Record<string, unknown> | null = null
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => {
          const selectChain: Record<string, unknown> = {}
          selectChain.eq = vi.fn(() => selectChain)
          // No existing row for this league — the first-time-failure case.
          selectChain.maybeSingle = vi.fn(() => Promise.resolve({ data: null }))
          return {
            select: vi.fn(() => selectChain),
            upsert: vi.fn((payload: Record<string, unknown>) => {
              upsertCalled = true
              upsertPayload = payload
              return makeUpsertChain({ data: { id: 'row' }, error: null })
            }),
            update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          }
        }),
      })),
    }))
    vi.doMock('@/lib/usageLimits', () => ({ canConnectNewLeague: vi.fn(() => Promise.resolve({ allowed: true })) }))
    vi.doMock('@/lib/normalize', () => ({
      normalizeYahooLeague: vi.fn(() => mockLeague()),
      extractYahooLeagueKeys: vi.fn(() => ['449.l.bad']),
      extractYahooOwnedTeam: vi.fn(() => ({ teamKey: 't', teamName: 'T' })),
      extractYahooSettings: vi.fn(() => ({})),
      SEASON: 2026,
    }))
    vi.doMock('@/lib/platforms/yahoo', () => ({ toNormalizedYahooLeague: vi.fn((l: ReturnType<typeof mockLeague>) => mockNormalized(l)) }))
    vi.doMock('@/lib/yahoo', () => ({
      getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')),
      getYahooLeagues: vi.fn(() => Promise.resolve({})),
      getYahooLeague: vi.fn(() => Promise.reject(new YahooAPIError('boom', 'YAHOO_HTTP_ERROR', 500))),
      getYahooLeagueTeams: vi.fn(() => Promise.resolve({})),
    }))

    const { POST } = await import('./route')
    await POST()

    expect(upsertCalled).toBe(true)
    expect(upsertPayload).toMatchObject({ league_id: '449.l.bad', sync_status: 'error', platform: 'yahoo' })
  })

  it('preserves a repeat sync failure by updating the existing row, never clobbering its real data with a placeholder', async () => {
    const { YahooAPIError } = await import('@/types')
    let updateCalled = false
    let updatePayload: Record<string, unknown> | null = null
    let upsertCalled = false
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => {
          const selectChain: Record<string, unknown> = {}
          selectChain.eq = vi.fn(() => selectChain)
          // An existing row for this league already — a repeat failure.
          selectChain.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'existing-row-id' } }))
          return {
            select: vi.fn(() => selectChain),
            upsert: vi.fn(() => {
              upsertCalled = true
              return makeUpsertChain({ data: { id: 'row' }, error: null })
            }),
            update: vi.fn((payload: Record<string, unknown>) => {
              updateCalled = true
              updatePayload = payload
              return { eq: vi.fn(() => Promise.resolve({ error: null })) }
            }),
          }
        }),
      })),
    }))
    vi.doMock('@/lib/usageLimits', () => ({ canConnectNewLeague: vi.fn(() => Promise.resolve({ allowed: true })) }))
    vi.doMock('@/lib/normalize', () => ({
      normalizeYahooLeague: vi.fn(() => mockLeague()),
      extractYahooLeagueKeys: vi.fn(() => ['449.l.bad']),
      extractYahooOwnedTeam: vi.fn(() => ({ teamKey: 't', teamName: 'T' })),
      extractYahooSettings: vi.fn(() => ({})),
      SEASON: 2026,
    }))
    vi.doMock('@/lib/platforms/yahoo', () => ({ toNormalizedYahooLeague: vi.fn((l: ReturnType<typeof mockLeague>) => mockNormalized(l)) }))
    vi.doMock('@/lib/yahoo', () => ({
      getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')),
      getYahooLeagues: vi.fn(() => Promise.resolve({})),
      getYahooLeague: vi.fn(() => Promise.reject(new YahooAPIError('boom again', 'YAHOO_HTTP_ERROR', 500))),
      getYahooLeagueTeams: vi.fn(() => Promise.resolve({})),
    }))

    const { POST } = await import('./route')
    await POST()

    expect(updateCalled).toBe(true)
    expect(upsertCalled).toBe(false)
    expect(updatePayload).toMatchObject({ sync_status: 'error' })
    // Never sent a placeholder league_name that would clobber real data.
    expect(updatePayload).not.toHaveProperty('league_name')
  })

  it('fails a league with an empty normalized league key, never importing it', async () => {
    const { POST } = await loadRouteWithMocks({ leagueOverrides: { leagueId: '' } })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.failures[0].error).toContain('league key')
  })

  it('fails a league with an unusable (blank) league name, never importing it', async () => {
    const { POST } = await loadRouteWithMocks({ leagueOverrides: { leagueName: '   ' } })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.failures[0].error).toContain('league name')
  })

  it('fails a league when extractYahooOwnedTeam cannot confidently identify the owned team, never falling back to any default team', async () => {
    const { POST } = await loadRouteWithMocks({ ownedTeam: null })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.leagues).toHaveLength(0)
    expect(body.failures[0].error).toContain('team you own')
  })

  it('fails a league when extractYahooOwnedTeam returns an empty team key', async () => {
    const { POST } = await loadRouteWithMocks({ ownedTeam: { teamKey: '', teamName: 'Somebody' } })
    const res = await POST()
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.failed).toBe(1)
  })

})

describe('GET /api/leagues/yahoo — connection status', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/supabase')
    vi.doUnmock('@/lib/yahoo')
  })

  function mockSupabaseWithLeagues(leagueRows: Array<Record<string, unknown>>) {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
      })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: leagueRows })) })),
          })),
        })),
      })),
    }))
  }

  it('rejects an unauthenticated request', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } })),
      createAdminClient: vi.fn(() => ({})),
    }))
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('reports not connected when no Yahoo token exists', async () => {
    const { YahooAPIError } = await import('@/types')
    mockSupabaseWithLeagues([])
    vi.doMock('@/lib/yahoo', () => ({
      getValidYahooAccessToken: vi.fn(() => Promise.reject(new YahooAPIError('none', 'YAHOO_NOT_CONNECTED', 404))),
    }))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.connected).toBe(false)
    expect(body.needsReconnect).toBe(false)
  })

  it('reports needsReconnect when the token is unrecoverably dead', async () => {
    const { YahooAPIError } = await import('@/types')
    mockSupabaseWithLeagues([])
    vi.doMock('@/lib/yahoo', () => ({
      getValidYahooAccessToken: vi.fn(() => Promise.reject(new YahooAPIError('dead', 'YAHOO_RECONNECT_REQUIRED', 502))),
    }))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.needsReconnect).toBe(true)
  })

  it('reports connected with league and failure counts when everything is healthy-ish', async () => {
    mockSupabaseWithLeagues([
      { id: '1', league_name: 'A', sync_status: 'ok' },
      { id: '2', league_name: 'B', sync_status: 'ok' },
      { id: '3', league_name: 'C', sync_status: 'error', sync_error: 'Yahoo API error 500' },
    ])
    vi.doMock('@/lib/yahoo', () => ({ getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')) }))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.connected).toBe(true)
    expect(body.needsReconnect).toBe(false)
    expect(body.leagueCount).toBe(3)
    expect(body.failedCount).toBe(1)
  })

  it('reports the most recent last_synced_at across all leagues, ignoring failed (null) leagues', async () => {
    mockSupabaseWithLeagues([
      { id: '1', league_name: 'A', sync_status: 'ok', last_synced_at: '2026-07-15T10:00:00.000Z' },
      { id: '2', league_name: 'B', sync_status: 'ok', last_synced_at: '2026-07-17T10:00:00.000Z' },
      { id: '3', league_name: 'C', sync_status: 'error', sync_error: 'boom', last_synced_at: null },
    ])
    vi.doMock('@/lib/yahoo', () => ({ getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')) }))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.lastSyncedAt).toBe('2026-07-17T10:00:00.000Z')
  })

  it('reports lastSyncedAt as null when no league has ever synced successfully', async () => {
    mockSupabaseWithLeagues([{ id: '1', league_name: 'A', sync_status: 'error', last_synced_at: null }])
    vi.doMock('@/lib/yahoo', () => ({ getValidYahooAccessToken: vi.fn(() => Promise.resolve('token')) }))
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    expect(body.lastSyncedAt).toBeNull()
  })

  it('reports a transient check failure as 502, not as not-connected or needing reconnect', async () => {
    mockSupabaseWithLeagues([])
    vi.doMock('@/lib/yahoo', () => ({ getValidYahooAccessToken: vi.fn(() => Promise.reject(new Error('network blip'))) }))
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(502)
  })
})

describe('DELETE /api/leagues/yahoo', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/supabase')
  })

  it('rejects an unauthenticated request', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } })),
      createAdminClient: vi.fn(() => ({})),
    }))
    const { DELETE } = await import('./route')
    const res = await DELETE()
    expect(res.status).toBe(401)
  })

  it('deletes only yahoo_tokens and yahoo-platform connected_leagues rows, never other platforms', async () => {
    const deleteCalls: string[] = []
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({
        auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
      })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          deleteCalls.push(table)
          if (table === 'connected_leagues') {
            const eqCalls: string[] = []
            return {
              delete: vi.fn(() => ({
                eq: vi.fn((col: string, val: string) => {
                  eqCalls.push(`${col}=${val}`)
                  return {
                    eq: vi.fn((col2: string, val2: string) => {
                      eqCalls.push(`${col2}=${val2}`)
                      expect(eqCalls).toContain('platform=yahoo')
                      return Promise.resolve({ error: null })
                    }),
                  }
                }),
              })),
            }
          }
          return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }
        }),
      })),
    }))
    const { DELETE } = await import('./route')
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(deleteCalls).toContain('connected_leagues')
    expect(deleteCalls).toContain('yahoo_tokens')
  })

  it('deletes the token before the leagues, not in parallel — order matters for the failure modes', async () => {
    const deleteOrder: string[] = []
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          deleteOrder.push(table)
          return { delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })) }
        }),
      })),
    }))
    const { DELETE } = await import('./route')
    await DELETE()
    expect(deleteOrder[0]).toBe('yahoo_tokens')
    expect(deleteOrder[1]).toBe('connected_leagues')
  })

  it('reports a clear error and never attempts the leagues delete when the token delete fails', async () => {
    let leaguesDeleteAttempted = false
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'yahoo_tokens') {
            return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'db down' } })) })) }
          }
          leaguesDeleteAttempted = true
          return { delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })) }
        }),
      })),
    }))
    const { DELETE } = await import('./route')
    const res = await DELETE()
    expect(res.status).toBe(500)
    expect(leaguesDeleteAttempted).toBe(false)
  })

  it('reports an error (not a silent 200) if the token delete succeeds but the leagues delete fails', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: vi.fn(() => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } })),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'yahoo_tokens') {
            return { delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }
          }
          return { delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'db down' } })) })) })) }
        }),
      })),
    }))
    const { DELETE } = await import('./route')
    const res = await DELETE()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
