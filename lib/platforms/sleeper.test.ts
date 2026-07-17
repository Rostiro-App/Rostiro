import { describe, it, expect } from 'vitest'
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
