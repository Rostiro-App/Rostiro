import { describe, it, expect } from 'vitest'
import { YAHOO_CAPABILITIES, toNormalizedYahooLeague } from './yahoo'
import type { League } from '@/types'

const baseLeague: League = {
  id: '',
  platform: 'yahoo',
  leagueId: '449.l.12345',
  leagueName: 'Test League',
  season: 2026,
  teamCount: 10,
  myTeamId: '449.l.12345.t.1',
  myTeamName: 'My Team',
  record: { wins: 0, losses: 0, ties: 0 },
  scoringSettings: {
    ppr: 1, tePremium: 0, qbTouchdownPoints: 4, passingYardsPerPoint: 0.04,
    rushingYardsPerPoint: 0.1, receivingYardsPerPoint: 0.1, isSuperFlex: false, isHalfPpr: false,
    rushTouchdownPoints: 6, receivingTouchdownPoints: 6, fumbleLostPoints: -2, interceptionThrownPoints: -2,
  },
  rosterSlots: [],
  currentMatchup: null,
  lastSyncedAt: new Date().toISOString(),
  syncStatus: 'ok',
}

describe('YAHOO_CAPABILITIES', () => {
  it('declares all three write capabilities false — Yahoo has approved read access only', () => {
    expect(YAHOO_CAPABILITIES.lineupWrite).toBe(false)
    expect(YAHOO_CAPABILITIES.waiverWrite).toBe(false)
    expect(YAHOO_CAPABILITIES.tradeWrite).toBe(false)
  })

  it('declares the read capabilities Rostiro actually uses today', () => {
    expect(YAHOO_CAPABILITIES.leagueRead).toBe(true)
    expect(YAHOO_CAPABILITIES.rosterRead).toBe(true)
    expect(YAHOO_CAPABILITIES.matchupRead).toBe(true)
    expect(YAHOO_CAPABILITIES.draftRead).toBe(true)
    expect(YAHOO_CAPABILITIES.freeAgentRead).toBe(true)
  })
})

describe('toNormalizedYahooLeague — leagueStatus is never derived from draft status', () => {
  it('reports leagueStatus unknown (with a warning) even when the draft is complete — a finished draft does not mean the season is over', () => {
    const result = toNormalizedYahooLeague(baseLeague, { draft_status: 'postdraft' })
    expect(result.draft.status).toBe('complete')
    expect(result.leagueStatus).toBe('unknown')
    expect(result.warnings.some((w) => w.field === 'leagueStatus')).toBe(true)
  })

  it('reports leagueStatus unknown when the draft has not started yet', () => {
    const result = toNormalizedYahooLeague(baseLeague, { draft_status: 'predraft' })
    expect(result.draft.status).toBe('not_started')
    expect(result.leagueStatus).toBe('unknown')
  })

  it('reports leagueStatus unknown regardless of draft status — always, until real league-status data is verified', () => {
    for (const draftStatus of ['predraft', 'drafting', 'postdraft', 'something_unrecognized', undefined]) {
      const result = toNormalizedYahooLeague(baseLeague, { draft_status: draftStatus })
      expect(result.leagueStatus).toBe('unknown')
    }
  })
})
