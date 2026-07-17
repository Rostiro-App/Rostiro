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
    leagueStatus: 'active',
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
}) {
  const {
    getValidYahooAccessToken = () => Promise.resolve('valid-token'),
    getYahooLeagues = () => Promise.resolve({}),
    leagueKeys = ['449.l.12345'],
    existingLookup = { data: null },
    upsertResult = { data: { id: 'row-1' }, error: null },
    canConnectResult = { allowed: true },
  } = opts

  vi.doMock('@/lib/supabase', () => ({
    createSSRClient: vi.fn(() => Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
    })),
    createAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'connected_leagues') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(existingLookup)) })),
                  })),
                })),
              })),
            })),
            upsert: vi.fn(() => makeUpsertChain(upsertResult)),
            update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })) })),
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })),
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

  const league = mockLeague()
  vi.doMock('@/lib/normalize', () => ({
    normalizeYahooLeague: vi.fn(() => ({ ...league })),
    extractYahooLeagueKeys: vi.fn(() => leagueKeys),
    extractYahooOwnedTeam: vi.fn(() => ({ teamKey: league.myTeamId, teamName: league.myTeamName })),
    extractYahooSettings: vi.fn(() => ({})),
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
            return {
              select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null })) })) })) })) })) })),
              upsert: vi.fn(() => makeUpsertChain({ data: { id: 'row-ok' }, error: null })),
              update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) })) })),
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
})
