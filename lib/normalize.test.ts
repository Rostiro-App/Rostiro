import { describe, it, expect } from 'vitest'
import {
  extractYahooLeagueKeys,
  extractYahooOwnedTeam,
  parseYahooDraftInfo,
  parseYahooWaiverSettings,
} from './normalize'

// IMPORTANT: these fixtures are built from Yahoo's own PUBLICLY DOCUMENTED
// field names and collection-nesting pattern (developer.yahoo.com's
// fantasysports guide + widely-mirrored community docs for the exact
// field names below), cross-checked against the same count-keyed
// collection shape already confirmed live elsewhere in this file
// (normalizeYahooPlayers, normalizeYahooDraftResults). They are NOT a
// substitute for a real sanitized capture from a live-authorized OAuth
// session — no Yahoo account has completed OAuth successfully yet (Yahoo
// has not approved read access for this app as of Packet 02). Treat these
// as shape-structure tests only. See the Packet 02 completion report for
// the full list of responses still pending real verification.

describe('extractYahooLeagueKeys (UNVERIFIED against live data — see file header)', () => {
  it('extracts league_key from the documented users/games/leagues collection shape', () => {
    const raw = {
      fantasy_content: {
        users: {
          '0': {
            user: [
              { guid: 'test' },
              {
                games: {
                  '0': {
                    game: [
                      { game_key: '449', code: 'nfl', season: '2026' },
                      {
                        leagues: {
                          '0': { league: [{ league_key: '449.l.12345', name: 'Test League' }] },
                          count: 1,
                        },
                      },
                    ],
                  },
                  count: 1,
                },
              },
            ],
          },
          count: 1,
        },
      },
    }
    expect(extractYahooLeagueKeys(raw)).toEqual(['449.l.12345'])
  })

  it('extracts multiple league_keys across multiple leagues', () => {
    const raw = {
      fantasy_content: {
        users: {
          '0': {
            user: [{}, {
              games: {
                '0': {
                  game: [{}, {
                    leagues: {
                      '0': { league: [{ league_key: '449.l.1' }] },
                      '1': { league: [{ league_key: '449.l.2' }] },
                      count: 2,
                    },
                  }],
                },
                count: 1,
              },
            }],
          },
          count: 1,
        },
      },
    }
    expect(extractYahooLeagueKeys(raw)).toEqual(['449.l.1', '449.l.2'])
  })

  it('returns an empty array for a malformed or unexpected shape rather than throwing', () => {
    expect(extractYahooLeagueKeys({})).toEqual([])
    expect(extractYahooLeagueKeys(null)).toEqual([])
    expect(extractYahooLeagueKeys({ fantasy_content: {} })).toEqual([])
  })
})

describe('extractYahooOwnedTeam (UNVERIFIED against live data — see file header)', () => {
  it('finds the team with is_owned_by_current_login, not just the first team', () => {
    const raw = {
      fantasy_content: {
        league: [
          {},
          {
            teams: {
              '0': { team: [[{ team_key: '449.l.1.t.1' }, { name: 'Other Team' }]] },
              '1': { team: [[{ team_key: '449.l.1.t.2' }, { name: 'My Team' }, { is_owned_by_current_login: 1 }]] },
              count: 2,
            },
          },
        ],
      },
    }
    expect(extractYahooOwnedTeam(raw)).toEqual({ teamKey: '449.l.1.t.2', teamName: 'My Team' })
  })

  it('returns null when no team is marked as owned by the current login', () => {
    const raw = {
      fantasy_content: {
        league: [{}, { teams: { '0': { team: [[{ team_key: '449.l.1.t.1' }, { name: 'Other Team' }]] }, count: 1 } }],
      },
    }
    expect(extractYahooOwnedTeam(raw)).toBeNull()
  })
})

describe('parseYahooDraftInfo (UNVERIFIED against live data — see file header)', () => {
  it('maps predraft to not_started', () => {
    expect(parseYahooDraftInfo({ draft_status: 'predraft' }).status).toBe('not_started')
  })
  it('maps postdraft to complete', () => {
    expect(parseYahooDraftInfo({ draft_status: 'postdraft' }).status).toBe('complete')
  })
  it('maps drafting to in_progress', () => {
    expect(parseYahooDraftInfo({ draft_status: 'drafting' }).status).toBe('in_progress')
  })
  it('reports unknown for an unrecognized or missing draft_status, never guesses', () => {
    expect(parseYahooDraftInfo({}).status).toBe('unknown')
    expect(parseYahooDraftInfo({ draft_status: 'something_new' }).status).toBe('unknown')
  })
  it('converts a unix-seconds draft_time to an ISO timestamp', () => {
    const result = parseYahooDraftInfo({ draft_time: '1395361800' })
    expect(result.scheduledAt).toBe(new Date(1395361800 * 1000).toISOString())
  })
  it('reports scheduledAt as null when draft_time is absent or zero', () => {
    expect(parseYahooDraftInfo({}).scheduledAt).toBeNull()
    expect(parseYahooDraftInfo({ draft_time: '0' }).scheduledAt).toBeNull()
  })
})

describe('parseYahooWaiverSettings (UNVERIFIED against live data — see file header)', () => {
  it('reports faab type with budget when uses_faab is set', () => {
    const result = parseYahooWaiverSettings({ uses_faab: '1', faab_balance: '100' })
    expect(result).toEqual({ type: 'faab', faabBudget: 100 })
  })
  it('reports rolling type for waiver_type R', () => {
    expect(parseYahooWaiverSettings({ uses_faab: '0', waiver_type: 'R' })).toEqual({ type: 'rolling', faabBudget: null })
  })
  it('reports unknown for an unrecognized waiver_type, never guesses', () => {
    expect(parseYahooWaiverSettings({}).type).toBe('unknown')
    expect(parseYahooWaiverSettings({ uses_faab: '0', waiver_type: 'X' }).type).toBe('unknown')
  })
})
