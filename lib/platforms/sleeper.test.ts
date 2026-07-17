import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeSleeperLeague } from '@/lib/normalize'
import { toNormalizedSleeperLeague, SLEEPER_CAPABILITIES } from './sleeper'

// Real Sleeper league/roster shape (trimmed to the fields normalizeSleeperLeague
// actually reads) — proves the canonical contract genuinely works against an
// existing platform path, not just Yahoo's not-yet-built one.
const rawSleeperLeague = {
  league: {
    league_id: '918398765123456789',
    name: 'The League',
    total_rosters: 12,
    roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN', 'BN'],
  },
  scoring_settings: {
    rec: 1,
    bonus_rec_te: 0,
    pass_td: 4,
    pass_yd: 25,
    rush_yd: 10,
    rec_yd: 10,
    rush_td: 6,
    rec_td: 6,
    fum_lost: -2,
    pass_int: -2,
  },
  rosters: [
    { roster_id: 3, settings: { wins: 7, losses: 4, ties: 0 }, metadata: { team_name: 'My Team' } },
  ],
}

describe('toNormalizedSleeperLeague', () => {
  it('adapts a real normalizeSleeperLeague() output onto the canonical NormalizedLeague contract', () => {
    const league = normalizeSleeperLeague(rawSleeperLeague, 3)
    const normalized = toNormalizedSleeperLeague(league)

    // Every original League field survives the adaptation.
    expect(normalized.platform).toBe('sleeper')
    expect(normalized.leagueId).toBe('918398765123456789')
    expect(normalized.leagueName).toBe('The League')
    expect(normalized.teamCount).toBe(12)
    expect(normalized.myTeamId).toBe('3')
    expect(normalized.myTeamName).toBe('My Team')
    expect(normalized.scoringSettings.ppr).toBe(1)

    // The new canonical-contract fields are present and honestly reported.
    expect(normalized.leagueStatus).toBe('unknown')
    expect(normalized.draft).toEqual({ status: 'unknown', scheduledAt: null })
    expect(normalized.waiver).toEqual({ type: 'unknown', faabBudget: null, waiverDay: null, waiverHour: null })
    expect(normalized.warnings).toEqual([])
  })

  it('reports Sleeper write capabilities as false, matching that no Sleeper write path is implemented', () => {
    expect(SLEEPER_CAPABILITIES.lineupWrite).toBe(false)
    expect(SLEEPER_CAPABILITIES.waiverWrite).toBe(false)
    expect(SLEEPER_CAPABILITIES.tradeWrite).toBe(false)
    expect(SLEEPER_CAPABILITIES.leagueRead).toBe(true)
  })

  it('never lets a raw Sleeper league_id be silently reinterpreted as a different namespace', () => {
    const league = normalizeSleeperLeague(rawSleeperLeague, 3)
    const normalized = toNormalizedSleeperLeague(league)
    // The raw platform ID is preserved verbatim, not reformatted or merged
    // with any other platform's ID shape.
    expect(normalized.leagueId).toBe(rawSleeperLeague.league.league_id)
  })
})

// ─── Packet 03: intelligence adapter tests ───────────────────────────────────
// Real Sleeper roster/matchup/draft shapes — mirrors the exact fields
// lib/sleeper.ts's own interfaces declare (SleeperRoster/SleeperMatchup/
// SleeperDraft), which carry their own live-verification comments in that
// file (e.g. waiver_budget_used, players_points confirmed live July 2026).

const mockContext = {
  connectedLeagueId: 'cl-1',
  userId: 'user-1',
  platform: 'sleeper' as const,
  externalLeagueId: 'league-abc',
  externalTeamId: '3',
}

const rawRosters = [
  { roster_id: 3, owner_id: 'me', league_id: 'league-abc', players: ['p1', 'p2', 'p3'], starters: ['p1', 'p2'], settings: { wins: 7, losses: 4, ties: 0, fpts: 900, fpts_against: 850 } },
  { roster_id: 5, owner_id: 'opp', league_id: 'league-abc', players: ['p4', 'p5'], starters: ['p4'], settings: { wins: 5, losses: 6, ties: 0, fpts: 800, fpts_against: 820 } },
]

const cacheRows = [
  { player_id: 'p1', name: 'Josh Allen', position: 'QB', nfl_team: 'BUF', adp_sleeper: 5 },
  { player_id: 'p2', name: 'A.J. Brown', position: 'WR', nfl_team: 'PHI', adp_sleeper: 12 },
  // p3 deliberately has no players_cache row — proves the unresolved path.
]

function mockAdmin(playersCacheRows: typeof cacheRows, mappingRows: Array<Record<string, unknown>> = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'players_cache') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: playersCacheRows })),
              not: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: playersCacheRows })),
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'player_mappings') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: mappingRows })) })) }
      }
      return {}
    }),
  }
}

describe('sleeperReadOwnedRoster', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('normalizes the owned roster, marking starters vs bench and resolving identity', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(cacheRows, [
      { id: 'canon-1', name: 'Josh Allen', nfl_team: 'BUF', position: 'QB', espn_id: null, yahoo_id: null, sleeper_id: 'p1' },
    ])) }))
    vi.doMock('@/lib/sleeper', () => ({ getSleeperRosters: vi.fn(() => Promise.resolve(rawRosters)) }))

    const { sleeperReadOwnedRoster } = await import('./sleeper')
    const result = await sleeperReadOwnedRoster(mockContext)

    expect(result.status).toBe('ok')
    expect(result.data?.schemaVersion).toBe(1)
    expect(result.data?.players).toHaveLength(3)
    const p1 = result.data?.players.find((p) => p.sourcePlayerId === 'p1')
    expect(p1?.lineupStatus).toBe('starting')
    expect(p1?.canonicalPlayerId).toBe('canon-1')
    expect(p1?.identityConfidence).toBe('exact')
    const p3 = result.data?.players.find((p) => p.sourcePlayerId === 'p3')
    expect(p3?.lineupStatus).toBe('bench')
    expect(p3?.identityConfidence).toBe('unresolved')
    // Unresolved players are still present, never dropped.
    expect(result.data?.warnings.some((w) => w.field.includes('p3'))).toBe(true)
  })

  it('fails safely (not a fabricated empty roster) when the owned team is not found', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin([], [])) }))
    vi.doMock('@/lib/sleeper', () => ({ getSleeperRosters: vi.fn(() => Promise.resolve(rawRosters)) }))

    const { sleeperReadOwnedRoster } = await import('./sleeper')
    const result = await sleeperReadOwnedRoster({ ...mockContext, externalTeamId: '999' })

    expect(result.status).toBe('failed')
    expect(result.data).toBeNull()
  })

  it('never treats a raw Sleeper player_id as a canonical ID when no mapping exists', async () => {
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(cacheRows, [])) }))
    vi.doMock('@/lib/sleeper', () => ({ getSleeperRosters: vi.fn(() => Promise.resolve(rawRosters)) }))

    const { sleeperReadOwnedRoster } = await import('./sleeper')
    const result = await sleeperReadOwnedRoster(mockContext)
    const p1 = result.data?.players.find((p) => p.sourcePlayerId === 'p1')
    // No exact mapping seeded -> falls through to unresolved, canonicalPlayerId stays null.
    // p1 still has a real cached name/team so it *could* resolve via name+team
    // if a candidate existed; with zero candidates it must stay unresolved.
    expect(p1?.canonicalPlayerId).toBeNull()
  })
})

describe('sleeperReadMatchup', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  const rawMatchups = [
    { roster_id: 3, matchup_id: 1, points: 105.4 },
    { roster_id: 5, matchup_id: 1, points: 98.2 },
  ]

  it('pairs the owned roster with its real opponent by matchup_id', async () => {
    vi.doMock('@/lib/sleeper', () => ({ getSleeperMatchups: vi.fn(() => Promise.resolve(rawMatchups)) }))
    const { sleeperReadMatchup } = await import('./sleeper')
    const result = await sleeperReadMatchup(mockContext, 5)
    expect(result.status).toBe('ok')
    expect(result.data?.myScore).toBe(105.4)
    expect(result.data?.opponentScore).toBe(98.2)
    expect(result.data?.opponentTeamId).toBe('5')
  })

  it('fails safely when no matchup exists for this roster/week, not a fabricated zero score', async () => {
    vi.doMock('@/lib/sleeper', () => ({ getSleeperMatchups: vi.fn(() => Promise.resolve([])) }))
    const { sleeperReadMatchup } = await import('./sleeper')
    const result = await sleeperReadMatchup(mockContext, 5)
    expect(result.status).toBe('failed')
    expect(result.data).toBeNull()
  })
})

describe('sleeperReadAvailablePlayers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('excludes rostered players from anywhere in the league, not just the owned roster', async () => {
    const pool = [
      { player_id: 'p1', name: 'Josh Allen', position: 'QB', nfl_team: 'BUF', adp_sleeper: 5 }, // rostered by me
      { player_id: 'p4', name: 'Someone Else', position: 'RB', nfl_team: 'KC', adp_sleeper: 20 }, // rostered by opponent
      { player_id: 'p9', name: 'Free Agent', position: 'WR', nfl_team: 'DAL', adp_sleeper: 40 }, // truly available
    ]
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(pool, [])) }))
    vi.doMock('@/lib/sleeper', () => ({ getSleeperRosters: vi.fn(() => Promise.resolve(rawRosters)) }))

    const { sleeperReadAvailablePlayers } = await import('./sleeper')
    const result = await sleeperReadAvailablePlayers(mockContext)

    expect(result.status).toBe('ok')
    const ids = (result.data ?? []).map((p) => p.sourcePlayerId)
    expect(ids).toContain('p9')
    expect(ids).not.toContain('p1')
    expect(ids).not.toContain('p4')
    expect(result.data?.[0].availability).toBe('free_agent')
  })
})

describe('sleeperReadDraftMetadata', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('maps a real pre_draft status with a scheduled start time', async () => {
    vi.doMock('@/lib/sleeper', () => ({
      getSleeperDrafts: vi.fn(() => Promise.resolve([{ draft_id: 'd1', league_id: 'league-abc', status: 'pre_draft', type: 'snake', start_time: 1755000000000, settings: {} }])),
    }))
    const { sleeperReadDraftMetadata } = await import('./sleeper')
    const result = await sleeperReadDraftMetadata(mockContext)
    expect(result.data?.status).toBe('not_started')
    expect(result.data?.scheduledAt).toBe(new Date(1755000000000).toISOString())
  })

  it('reports unknown with a warning, never a fabricated status, when no draft exists', async () => {
    vi.doMock('@/lib/sleeper', () => ({ getSleeperDrafts: vi.fn(() => Promise.resolve([])) }))
    const { sleeperReadDraftMetadata } = await import('./sleeper')
    const result = await sleeperReadDraftMetadata(mockContext)
    expect(result.data?.status).toBe('unknown')
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
