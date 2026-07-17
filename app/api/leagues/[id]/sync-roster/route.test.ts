import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 'user-1' }

function mockSSRClient(opts: { user?: { id: string } | null; league?: Record<string, unknown> | null }) {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: opts.user ?? null } }) },
    from: vi.fn((table: string) => {
      if (table === 'connected_leagues') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: opts.league ?? null, error: null })),
            })),
          })),
        }
      }
      return {}
    }),
  }
}

describe('POST /api/leagues/[id]/sync-roster — ownership proof', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 when not authenticated — never reaches the RLS-scoped ownership select', async () => {
    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve(mockSSRClient({ user: null })) }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ syncRosterSnapshot: vi.fn() }))

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'league-1' }) })
    expect(res.status).toBe(401)
  })

  it('PROOF: returns 404 for a league that does not belong to the caller — RLS returns no row, never someone else\'s roster', async () => {
    // The RLS-scoped select naturally returns null for a non-owned row —
    // this test proves the route trusts that (never falls back to an
    // admin-client lookup that could bypass ownership).
    vi.doMock('@/lib/supabase', () => ({ createSSRClient: () => Promise.resolve(mockSSRClient({ user: mockUser, league: null })) }))
    const syncSpy = vi.fn()
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ syncRosterSnapshot: syncSpy }))

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'not-mine' }) })
    expect(res.status).toBe(404)
    // Service-role sync work never even started.
    expect(syncSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when the owned league has no team_id yet', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient({ user: mockUser, league: { id: 'league-1', platform: 'sleeper', league_id: 'sl-1', team_id: null } })),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn() }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ syncRosterSnapshot: vi.fn() }))

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'league-1' }) })
    expect(res.status).toBe(400)
  })

  it('calls syncRosterSnapshot with the verified context only after ownership is proven', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient({ user: mockUser, league: { id: 'league-1', platform: 'sleeper', league_id: 'sl-1', team_id: 'team-1' } })),
    }))
    const adapter = { platform: 'sleeper', capabilities: {} }
    const getAdapterSpy = vi.fn(() => adapter)
    const syncSpy = vi.fn(() => Promise.resolve({ outcome: { action: 'saved', reason: 'ok', snapshot: null, hadPreviousSnapshot: false }, freshness: 'fresh', lastSnapshotAt: '2026-07-17T00:00:00Z' }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: getAdapterSpy }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ syncRosterSnapshot: syncSpy }))

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'league-1' }) })
    expect(res.status).toBe(200)
    expect(syncSpy).toHaveBeenCalledWith(
      { connectedLeagueId: 'league-1', userId: 'user-1', platform: 'sleeper', externalLeagueId: 'sl-1', externalTeamId: 'team-1' },
      adapter
    )
  })

  it('reports approval_pending for yahoo without ever calling syncRosterSnapshot', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient({ user: mockUser, league: { id: 'league-1', platform: 'yahoo', league_id: 'yh-1', team_id: 'team-1' } })),
    }))
    const syncSpy = vi.fn()
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))
    vi.doMock('@/lib/rosterSnapshotSync', () => ({ syncRosterSnapshot: syncSpy }))

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ id: 'league-1' }) })
    const body = await res.json()
    expect(body.outcome.action).toBe('approval_pending')
    expect(syncSpy).not.toHaveBeenCalled()
  })
})
