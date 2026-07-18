import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUser = { id: 'user-1', user_metadata: {} }

function mockSSRClient() {
  return { auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) } }
}

describe('GET /api/pulse/sleeper — P3-8: user-facing consumer serves cross-platform items', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: a mixed Sleeper + ESPN user\'s response includes items tagged with both platforms', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient()),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/pulse', () => ({
      buildPulseItemsForUser: vi.fn(() =>
        Promise.resolve({
          items: [
            { fingerprint: 'roster_grade:cl-sleeper', type: 'roster_grade', priority: 'info', headline: 'Sleeper grade', reasoning: 'x', affectedLeagues: [{ leagueId: 'cl-sleeper', leagueName: 'Sleeper League', platform: 'sleeper' }], deadline: null, actionUrl: '/leagues' },
            { fingerprint: 'roster_grade:cl-espn', type: 'roster_grade', priority: 'info', headline: 'ESPN grade', reasoning: 'x', affectedLeagues: [{ leagueId: 'cl-espn', leagueName: 'ESPN League', platform: 'espn', freshness: 'fresh', actionCapability: 'none' }], deadline: null, actionUrl: '/leagues' },
          ],
          leagueCount: 2,
        })
      ),
      builtToPulseItem: vi.fn((b) => ({ id: b.fingerprint, userId: 'user-1', ...b, isDismissed: false, status: 'open', createdAt: 'now' })),
      rowToPulseItem: vi.fn(),
      syncPulseItems: vi.fn(() => Promise.resolve(false)), // not persistent -> serves built items live
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    const platforms = new Set(body.items.map((i: { affectedLeagues: Array<{ platform: string }> }) => i.affectedLeagues[0]?.platform))
    expect(platforms.has('sleeper')).toBe(true)
    expect(platforms.has('espn')).toBe(true)
    expect(body.leagueCount).toBe(2)
  })

  it('PROOF: buildPulseItemsForUser itself failing returns a clean 500, never a half-built crash', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve(mockSSRClient()),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/pulse', () => ({
      buildPulseItemsForUser: vi.fn(() => Promise.reject(new Error('total failure'))),
      builtToPulseItem: vi.fn(),
      rowToPulseItem: vi.fn(),
      syncPulseItems: vi.fn(),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns 401 when not authenticated', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createSSRClient: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: null } }) } }),
      createAdminClient: vi.fn(() => ({})),
    }))
    vi.doMock('@/lib/pulse', () => ({ buildPulseItemsForUser: vi.fn(), builtToPulseItem: vi.fn(), rowToPulseItem: vi.fn(), syncPulseItems: vi.fn() }))

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
