import { describe, it, expect, vi, beforeEach } from 'vitest'
import { summarizeCrossPlatformWeek, type LeagueMatchupEntry } from './crossPlatformMatchup'
import type { NormalizedMatchup } from './platforms'

function matchup(overrides: Partial<NormalizedMatchup> = {}): NormalizedMatchup {
  return {
    connectedLeagueId: 'cl-1',
    platform: 'sleeper',
    week: 5,
    myTeamId: 'team-1',
    opponentTeamId: 'team-2',
    myScore: 100,
    opponentScore: 90,
    myProjectedScore: null,
    opponentProjectedScore: null,
    status: 'unknown',
    capturedAt: new Date().toISOString(),
    warnings: [],
    ...overrides,
  }
}

function entry(overrides: Partial<LeagueMatchupEntry> = {}): LeagueMatchupEntry {
  return {
    connectedLeagueId: 'cl-1',
    leagueName: 'My League',
    platform: 'sleeper',
    week: 5,
    status: 'ok',
    matchup: matchup(),
    reason: null,
    ...overrides,
  }
}

describe('summarizeCrossPlatformWeek — honest outcomes, never a guessed one', () => {
  it('counts a real win/loss/tie correctly', () => {
    const summary = summarizeCrossPlatformWeek([
      entry({ matchup: matchup({ myScore: 100, opponentScore: 90 }) }), // winning
      entry({ matchup: matchup({ myScore: 80, opponentScore: 95 }) }), // losing
      entry({ matchup: matchup({ myScore: 70, opponentScore: 70 }) }), // tied
    ])
    expect(summary).toEqual({ totalLeagues: 3, winning: 1, losing: 1, tied: 1, unknown: 0 })
  })

  it('PROOF: a real "ok" read with a null score counts as unknown, never guessed as tied/losing', () => {
    const summary = summarizeCrossPlatformWeek([entry({ matchup: matchup({ myScore: null, opponentScore: 88 }) })])
    expect(summary.unknown).toBe(1)
    expect(summary.tied).toBe(0)
    expect(summary.losing).toBe(0)
  })

  it('PROOF: a failed/unsupported/approval_pending league counts as unknown, not silently dropped from the total', () => {
    const summary = summarizeCrossPlatformWeek([
      entry({ status: 'failed', matchup: null }),
      entry({ status: 'unsupported', matchup: null }),
      entry({ status: 'approval_pending', matchup: null }),
    ])
    expect(summary.totalLeagues).toBe(3)
    expect(summary.unknown).toBe(3)
  })
})

const CAPS_WITH_MATCHUP = { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false }

function mockAdmin(leagues: unknown[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'connected_leagues') return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: leagues })) })) }
      return {}
    }),
  }
}

describe('computeUserCrossPlatformMatchups — PROOF: parity + failure isolation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('PROOF: Sleeper and ESPN leagues produce the SAME NormalizedMatchup shape through the same aggregation path', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() =>
        mockAdmin([
          { id: 'cl-sleeper', platform: 'sleeper', league_id: 'sl-1', league_name: 'Sleeper League', team_id: 'team-1' },
          { id: 'cl-espn', platform: 'espn', league_id: 'es-1', league_name: 'ESPN League', team_id: 'team-1' },
        ])
      ),
    }))
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn((platform: string) => ({
        platform,
        capabilities: CAPS_WITH_MATCHUP,
        readMatchup: vi.fn(() =>
          Promise.resolve({
            status: 'ok',
            data: matchup({ platform: platform as 'sleeper' | 'espn', connectedLeagueId: platform === 'espn' ? 'cl-espn' : 'cl-sleeper' }),
            warnings: [],
          })
        ),
      })),
    }))

    const { computeUserCrossPlatformMatchups } = await import('./crossPlatformMatchup')
    const result = await computeUserCrossPlatformMatchups('user-1', 5)

    expect(result.entries).toHaveLength(2)
    const sleeperEntry = result.entries.find((e) => e.platform === 'sleeper')
    const espnEntry = result.entries.find((e) => e.platform === 'espn')
    expect(sleeperEntry?.status).toBe('ok')
    expect(espnEntry?.status).toBe('ok')
    // Same fields present on both — proving one shared aggregation path,
    // not platform-specific special-casing.
    expect(Object.keys(sleeperEntry!.matchup!).sort()).toEqual(Object.keys(espnEntry!.matchup!).sort())
  })

  it('PROOF: one league throwing does not remove another league\'s real matchup', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() =>
        mockAdmin([
          { id: 'cl-broken', platform: 'espn', league_id: 'l1', league_name: 'Broken', team_id: 'team-1' },
          { id: 'cl-healthy', platform: 'sleeper', league_id: 'l2', league_name: 'Healthy', team_id: 'team-1' },
        ])
      ),
    }))
    vi.doMock('@/lib/platforms', () => ({
      getIntelligenceAdapter: vi.fn((platform: string) => ({
        platform,
        capabilities: CAPS_WITH_MATCHUP,
        readMatchup: vi.fn(() => {
          if (platform === 'espn') throw new Error('ESPN down')
          return Promise.resolve({ status: 'ok', data: matchup({ platform: 'sleeper', connectedLeagueId: 'cl-healthy' }), warnings: [] })
        }),
      })),
    }))

    const { computeUserCrossPlatformMatchups } = await import('./crossPlatformMatchup')
    const result = await computeUserCrossPlatformMatchups('user-1', 5)

    const broken = result.entries.find((e) => e.connectedLeagueId === 'cl-broken')
    const healthy = result.entries.find((e) => e.connectedLeagueId === 'cl-healthy')
    expect(broken?.status).toBe('failed')
    expect(broken?.reason).toMatch(/ESPN down/)
    expect(healthy?.status).toBe('ok')
    expect(healthy?.matchup?.myScore).toBe(100)
  })

  it('reports approval_pending for Yahoo (no adapter), never fabricating a matchup', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => mockAdmin([{ id: 'cl-yahoo', platform: 'yahoo', league_id: 'y1', league_name: 'Yahoo League', team_id: 'team-1' }])),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => null) }))

    const { computeUserCrossPlatformMatchups } = await import('./crossPlatformMatchup')
    const result = await computeUserCrossPlatformMatchups('user-1', 5)
    expect(result.entries[0]).toMatchObject({ status: 'approval_pending', matchup: null })
  })

  it('reports unsupported when an adapter exists but does not implement readMatchup', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createAdminClient: vi.fn(() => mockAdmin([{ id: 'cl-1', platform: 'sleeper', league_id: 'l1', league_name: 'L', team_id: 'team-1' }])),
    }))
    vi.doMock('@/lib/platforms', () => ({ getIntelligenceAdapter: vi.fn(() => ({ platform: 'sleeper', capabilities: CAPS_WITH_MATCHUP })) }))

    const { computeUserCrossPlatformMatchups } = await import('./crossPlatformMatchup')
    const result = await computeUserCrossPlatformMatchups('user-1', 5)
    expect(result.entries[0].status).toBe('unsupported')
  })
})
