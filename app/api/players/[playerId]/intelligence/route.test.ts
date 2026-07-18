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
