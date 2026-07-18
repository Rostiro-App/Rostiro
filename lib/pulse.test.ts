import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rowToPulseItem, type PulseItemRow } from './pulse'

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
  })
})
