import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 'user-1' }

function mockSSRClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
    from: vi.fn((table: string) => {
      if (table === 'players_cache') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: { player_id: '4046', name: 'Josh Allen', position: 'QB', nfl_team: 'BUF', injury_status: null, adp_sleeper: 5, depth_chart_order: 1, depth_chart_position: 'QB' },
                    error: null,
                  })
                ),
              })),
            })),
          })),
        }
      }
      if (table === 'player_usage_snapshots' || table === 'player_context_cache') {
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.not = vi.fn(() => chain)
        chain.order = vi.fn(() => chain)
        chain.limit = vi.fn(() => chain)
        chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null }))
        return { select: vi.fn(() => chain) }
      }
      return {}
    }),
  }
}

describe('GET /api/players/[playerId]/intelligence — P3-7 backward compatibility', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: a legacy raw Sleeper ID URL still works unchanged — old response fields all present', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient()),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/playerIntelligence', () => ({
      resolvePlayerIdentityForRoute: vi.fn(() => Promise.resolve({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: '4046' })),
      computePlayerIntelligence: vi.fn(() =>
        Promise.resolve({
          identity: { canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: '4046' },
          leagues: [
            { connectedLeagueId: 'cl-1', leagueName: 'My League', platform: 'sleeper', status: 'mine', isStarter: true, freshness: 'fresh', actionCapability: 'none', unresolvedSourcePlayerId: '4046' },
          ],
        })
      ),
    }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never, { params: Promise.resolve({ playerId: '4046' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    // Old fields the existing Card depends on, unchanged in name/shape.
    expect(body.player.playerId).toBe('4046')
    expect(body.availability[0]).toMatchObject({ leagueId: 'cl-1', leagueName: 'My League', status: 'mine', isStarter: true })
    // New fields added additively.
    expect(body.player.canonicalPlayerId).toBeNull()
    expect(body.availability[0]).toMatchObject({ platform: 'sleeper', freshness: 'fresh', actionCapability: 'none' })
  })

  it('a real canonical player_mappings.id resolves via the mapping to the right players_cache platform row', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient()),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'player_mappings') {
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { sleeper_id: '4046', espn_id: null, yahoo_id: null } })) })) })) }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/playerIntelligence', () => ({
      resolvePlayerIdentityForRoute: vi.fn(() => Promise.resolve({ canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null })),
      computePlayerIntelligence: vi.fn(() => Promise.resolve({ identity: { canonicalPlayerId: 'canon-1', sourcePlatform: null, sourcePlayerId: null }, leagues: [] })),
    }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never, { params: Promise.resolve({ playerId: 'canon-1' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.player.canonicalPlayerId).toBe('canon-1')
  })

  it('PROOF (P3-11 P0 hotfix): GET /api/players/4984/intelligence — a raw Sleeper ID never fails on UUID parsing (uses the REAL resolvePlayerIdentityForRoute, not mocked)', async () => {
    // Deliberately does NOT mock '@/lib/playerIntelligence' — this test
    // exercises the real resolvePlayerIdentityForRoute against a mocked
    // admin client shaped like the real player_mappings table, proving
    // the route survives end-to-end for the real production request
    // shape (a raw Sleeper ID in the URL), not just that some mock
    // returns a canned answer.
    const REAL_UUID = '3a51b1c4-1111-2222-3333-444455556666'
    const isUuidShaped = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient()),
      createAdminClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === 'player_mappings') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((col: string, val: string) => ({
                  maybeSingle: vi.fn(() => {
                    // A real Postgres would reject the id (uuid) column
                    // with 22P02 for a non-UUID value like "4984" —
                    // simulated here so this test fails loudly if the
                    // hotfix regresses and that query is ever sent again.
                    // A UUID-shaped id query (the route's OWN separate
                    // player_mappings lookup, once resolvePlayerIdentityForRoute
                    // has already resolved a canonical id) is legitimate
                    // and must not throw.
                    if (col === 'id' && !isUuidShaped(val)) throw new Error(`invalid input syntax for type uuid: "${val}"`)
                    if (col === 'id' && val === REAL_UUID) return Promise.resolve({ data: { sleeper_id: '4984', espn_id: null, yahoo_id: null }, error: null })
                    if (col === 'sleeper_id' && val === '4984') return Promise.resolve({ data: { id: REAL_UUID }, error: null })
                    return Promise.resolve({ data: null, error: null })
                  }),
                })),
              })),
            }
          }
          return {}
        }),
      })),
    }))
    vi.doMock('@/lib/playerIntelligence', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/playerIntelligence')>()
      return {
        ...actual,
        computePlayerIntelligence: vi.fn(() =>
          Promise.resolve({ identity: { canonicalPlayerId: REAL_UUID, sourcePlatform: null, sourcePlayerId: null }, leagues: [] })
        ),
      }
    })

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never, { params: Promise.resolve({ playerId: '4984' }) })

    expect(res.status).not.toBe(503)
    expect(res.status).not.toBe(500)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.player.canonicalPlayerId).toBe(REAL_UUID)
  })

  it('returns 401 when not authenticated', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } }),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/playerIntelligence', () => ({ resolvePlayerIdentityForRoute: vi.fn(), computePlayerIntelligence: vi.fn() }))

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost') as never, { params: Promise.resolve({ playerId: '4046' }) })
    expect(res.status).toBe(401)
  })
})
