import { describe, it, expect } from 'vitest'
import {
  computeCrossPlatformExposure,
  buildHealthInputFromSnapshot,
  computeCrossPlatformLeagueHealth,
  type LeagueSnapshotEntry,
  type PlayerAdpRow,
} from './crossPlatformPortfolio'
import type { NormalizedRosterSnapshot, NormalizedRosterPlayer } from './platforms'

function player(overrides: Partial<NormalizedRosterPlayer> = {}): NormalizedRosterPlayer {
  return {
    canonicalPlayerId: null,
    sourcePlatform: 'sleeper',
    sourcePlayerId: 'p1',
    displayName: 'Josh Allen',
    nflTeam: 'BUF',
    position: 'QB',
    lineupStatus: 'starting',
    slot: null,
    identityConfidence: 'unresolved',
    identityReason: 'No stored mapping or name/team match found',
    ...overrides,
  }
}

function snapshot(overrides: Partial<NormalizedRosterSnapshot> = {}): NormalizedRosterSnapshot {
  return {
    schemaVersion: 1,
    connectedLeagueId: 'cl-1',
    platform: 'sleeper',
    externalLeagueId: 'league-1',
    externalTeamId: 'team-1',
    capturedAt: '2026-07-17T12:00:00Z',
    providerUpdatedAt: null,
    players: [],
    warnings: [],
    ...overrides,
  }
}

function entry(overrides: Partial<LeagueSnapshotEntry> = {}): LeagueSnapshotEntry {
  return {
    connectedLeagueId: 'cl-1',
    leagueName: 'My League',
    platform: 'sleeper',
    freshness: 'fresh',
    snapshot: snapshot(),
    ...overrides,
  }
}

describe('computeCrossPlatformExposure — cross-platform dedup by canonical ID', () => {
  it('the SAME canonical player in a Sleeper league and an ESPN league produces exposureCount 2, one result', () => {
    const sleeperEntry = entry({
      connectedLeagueId: 'cl-sleeper',
      leagueName: 'Sleeper League',
      platform: 'sleeper',
      snapshot: snapshot({
        connectedLeagueId: 'cl-sleeper',
        platform: 'sleeper',
        players: [player({ canonicalPlayerId: 'canon-1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', lineupStatus: 'starting' })],
      }),
    })
    const espnEntry = entry({
      connectedLeagueId: 'cl-espn',
      leagueName: 'ESPN League',
      platform: 'espn',
      snapshot: snapshot({
        connectedLeagueId: 'cl-espn',
        platform: 'espn',
        players: [player({ canonicalPlayerId: 'canon-1', sourcePlatform: 'espn', sourcePlayerId: 'e1', lineupStatus: 'bench' })],
      }),
    })

    const result = computeCrossPlatformExposure([sleeperEntry, espnEntry])
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0]).toMatchObject({ canonicalPlayerId: 'canon-1', exposureCount: 2, starterCount: 1, benchCount: 1 })
    expect(result.resolved[0].leagues).toHaveLength(2)
    expect(result.resolved[0].leagues.map((l) => l.platform).sort()).toEqual(['espn', 'sleeper'])
  })

  it('PROOF: starter vs bench exposure — starterCount is 0-2 as appropriate, never assumed', () => {
    const bothBench = computeCrossPlatformExposure([
      entry({ connectedLeagueId: 'a', snapshot: snapshot({ connectedLeagueId: 'a', players: [player({ canonicalPlayerId: 'c1', lineupStatus: 'bench' })] }) }),
      entry({ connectedLeagueId: 'b', snapshot: snapshot({ connectedLeagueId: 'b', players: [player({ canonicalPlayerId: 'c1', lineupStatus: 'bench' })] }) }),
    ])
    expect(bothBench.resolved[0]).toMatchObject({ exposureCount: 2, starterCount: 0, benchCount: 2 })

    const bothStarting = computeCrossPlatformExposure([
      entry({ connectedLeagueId: 'a', snapshot: snapshot({ connectedLeagueId: 'a', players: [player({ canonicalPlayerId: 'c2', lineupStatus: 'starting' })] }) }),
      entry({ connectedLeagueId: 'b', snapshot: snapshot({ connectedLeagueId: 'b', players: [player({ canonicalPlayerId: 'c2', lineupStatus: 'starting' })] }) }),
    ])
    expect(bothStarting.resolved[0]).toMatchObject({ exposureCount: 2, starterCount: 2, benchCount: 0 })
  })

  it('PROOF: unresolved players stay in a separate section keyed by platform+sourcePlayerId', () => {
    const result = computeCrossPlatformExposure([
      entry({
        snapshot: snapshot({ players: [player({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 'p99', displayName: 'Unknown Guy' })] }),
      }),
    ])
    expect(result.resolved).toHaveLength(0)
    expect(result.unresolved).toHaveLength(1)
    expect(result.unresolved[0]).toMatchObject({ key: 'sleeper:p99', platform: 'sleeper', sourcePlayerId: 'p99' })
  })

  it('PROOF: duplicate display names are never merged — two different real players sharing a name stay separate', () => {
    const result = computeCrossPlatformExposure([
      entry({
        connectedLeagueId: 'a',
        snapshot: snapshot({
          connectedLeagueId: 'a',
          players: [
            player({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 'p1', displayName: 'Mike Williams' }),
          ],
        }),
      }),
      entry({
        connectedLeagueId: 'b',
        platform: 'espn',
        snapshot: snapshot({
          connectedLeagueId: 'b',
          platform: 'espn',
          players: [
            player({ canonicalPlayerId: null, sourcePlatform: 'espn', sourcePlayerId: 'e1', displayName: 'Mike Williams' }),
          ],
        }),
      }),
    ])
    // Same display name, different platform+sourceId — two DISTINCT
    // unresolved entries, never merged into one "Mike Williams".
    expect(result.unresolved).toHaveLength(2)
    expect(result.unresolved.map((u) => u.key).sort()).toEqual(['espn:e1', 'sleeper:p1'])
  })

  it('PROOF: two DIFFERENT resolved (canonical) players sharing a display name never merge either — dedup is strictly by canonicalPlayerId', () => {
    const result = computeCrossPlatformExposure([
      entry({ connectedLeagueId: 'a', snapshot: snapshot({ connectedLeagueId: 'a', players: [player({ canonicalPlayerId: 'canon-real-1', displayName: 'Josh Johnson', sourcePlayerId: 's1' })] }) }),
      entry({ connectedLeagueId: 'b', snapshot: snapshot({ connectedLeagueId: 'b', players: [player({ canonicalPlayerId: 'canon-real-2', displayName: 'Josh Johnson', sourcePlayerId: 's2' })] }) }),
    ])
    expect(result.resolved).toHaveLength(2)
    expect(result.resolved.map((r) => r.canonicalPlayerId).sort()).toEqual(['canon-real-1', 'canon-real-2'])
    expect(result.resolved.every((r) => r.exposureCount === 1)).toBe(true)
  })

  it('an unresolved player seen twice in the SAME identity (repeat league on same platform) still merges correctly by key, not by name', () => {
    const result = computeCrossPlatformExposure([
      entry({ connectedLeagueId: 'a', snapshot: snapshot({ connectedLeagueId: 'a', players: [player({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 'p1', displayName: 'Unknown Guy' })] }) }),
      entry({ connectedLeagueId: 'b', snapshot: snapshot({ connectedLeagueId: 'b', players: [player({ canonicalPlayerId: null, sourcePlatform: 'sleeper', sourcePlayerId: 'p1', displayName: 'Unknown Guy' })] }) }),
    ])
    expect(result.unresolved).toHaveLength(1)
    expect(result.unresolved[0].leagues).toHaveLength(2)
  })

  it('PROOF: a stale snapshot IS included with its real capturedAt, never silently dropped', () => {
    const result = computeCrossPlatformExposure([
      entry({
        freshness: 'stale',
        snapshot: snapshot({ capturedAt: '2026-07-10T00:00:00Z', players: [player({ canonicalPlayerId: 'c1' })] }),
      }),
    ])
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0].leagues[0]).toMatchObject({ freshness: 'stale', capturedAt: '2026-07-10T00:00:00Z' })
  })

  it('PROOF: unavailable/unsupported/approval_pending leagues are excluded from exposure entirely', () => {
    const result = computeCrossPlatformExposure([
      entry({ freshness: 'unavailable', snapshot: null }),
      entry({ freshness: 'unsupported', snapshot: null }),
      entry({ freshness: 'approval_pending', snapshot: null }),
      entry({ freshness: 'fresh', snapshot: snapshot({ players: [player({ canonicalPlayerId: 'c1' })] }) }),
    ])
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0].leagues).toHaveLength(1)
  })
})

describe('buildHealthInputFromSnapshot + computeCrossPlatformLeagueHealth — same function, disclosed ADP source', () => {
  it('PROOF: equivalent Sleeper and ESPN inputs produce IDENTICAL health scores via the same computeLeagueHealth', () => {
    const sleeperSnapshot = snapshot({
      platform: 'sleeper',
      players: [
        player({ canonicalPlayerId: 'c1', sourcePlatform: 'sleeper', sourcePlayerId: 's1', lineupStatus: 'starting' }),
        player({ canonicalPlayerId: 'c2', sourcePlatform: 'sleeper', sourcePlayerId: 's2', lineupStatus: 'bench', displayName: 'Bench Guy' }),
      ],
    })
    const espnSnapshot = snapshot({
      platform: 'espn',
      players: [
        player({ canonicalPlayerId: 'c1', sourcePlatform: 'espn', sourcePlayerId: 'e1', lineupStatus: 'starting' }),
        player({ canonicalPlayerId: 'c2', sourcePlatform: 'espn', sourcePlayerId: 'e2', lineupStatus: 'bench', displayName: 'Bench Guy' }),
      ],
    })

    const sleeperAdp = new Map<string, PlayerAdpRow>([
      ['c1', { key: 'c1', adpConsensus: null, adpPlatformSpecific: 5, injuryStatus: null }],
      ['c2', { key: 'c2', adpConsensus: null, adpPlatformSpecific: 80, injuryStatus: null }],
    ])
    const espnAdp = new Map<string, PlayerAdpRow>([
      ['c1', { key: 'c1', adpConsensus: null, adpPlatformSpecific: 5, injuryStatus: null }],
      ['c2', { key: 'c2', adpConsensus: null, adpPlatformSpecific: 80, injuryStatus: null }],
    ])

    const sleeperResult = computeCrossPlatformLeagueHealth(sleeperSnapshot, sleeperAdp, null, null)
    const espnResult = computeCrossPlatformLeagueHealth(espnSnapshot, espnAdp, null, null)

    expect(sleeperResult.health.score).toBe(espnResult.health.score)
    expect(sleeperResult.health.status).toBe(espnResult.health.status)
    expect(sleeperResult.adpSource).toBe('sleeper')
    expect(espnResult.adpSource).toBe('espn')
  })

  it('PROOF: partial factor coverage is reported honestly — bye/matchup are always null today, never fabricated', () => {
    const s = snapshot({ players: [player({ canonicalPlayerId: 'c1' })] })
    const adp = new Map<string, PlayerAdpRow>([['c1', { key: 'c1', adpConsensus: 100, adpPlatformSpecific: null, injuryStatus: null }]])
    const result = computeCrossPlatformLeagueHealth(s, adp, null, null)
    expect(result.factorCoverage.total).toBe(5)
    expect(result.factorCoverage.available).toBeLessThan(5)
    expect(result.health.factors.find((f) => f.key === 'bye')?.score).toBeNull()
    expect(result.health.factors.find((f) => f.key === 'matchup')?.score).toBeNull()
  })

  it('prefers adp_consensus over a platform-specific ADP when both are present', () => {
    const s = snapshot({ players: [player({ canonicalPlayerId: 'c1' })] })
    const adp = new Map<string, PlayerAdpRow>([['c1', { key: 'c1', adpConsensus: 10, adpPlatformSpecific: 999, injuryStatus: null }]])
    const built = buildHealthInputFromSnapshot(s, adp, null, null)
    expect(built.input.myPlayers[0].adp).toBe(10)
    expect(built.adpSource).toBe('consensus')
  })

  it('discloses "mixed" when some players resolved via consensus and others via platform-specific fallback', () => {
    const s = snapshot({
      players: [
        player({ canonicalPlayerId: 'c1' }),
        player({ canonicalPlayerId: 'c2', displayName: 'Other Guy' }),
      ],
    })
    const adp = new Map<string, PlayerAdpRow>([
      ['c1', { key: 'c1', adpConsensus: 10, adpPlatformSpecific: null, injuryStatus: null }],
      ['c2', { key: 'c2', adpConsensus: null, adpPlatformSpecific: 50, injuryStatus: null }],
    ])
    const built = buildHealthInputFromSnapshot(s, adp, null, null)
    expect(built.adpSource).toBe('mixed')
  })

  it('reports "unknown" ADP source when no player has any ADP data at all', () => {
    const s = snapshot({ players: [player({ canonicalPlayerId: 'c1' })] })
    const built = buildHealthInputFromSnapshot(s, new Map(), null, null)
    expect(built.adpSource).toBe('unknown')
    expect(built.playersWithAdp).toBe(0)
  })

  it('never treats nflTeam: null as free-agent evidence — bestFreeAgentAdp/Name pass through untouched, not derived from player nflTeam', () => {
    const s = snapshot({ players: [player({ canonicalPlayerId: 'c1', nflTeam: null })] })
    const built = buildHealthInputFromSnapshot(s, new Map(), 42, 'Real Free Agent')
    // bestFreeAgentAdp/Name come only from the explicit params (which the
    // orchestrator sources from a provider-confirmed readAvailablePlayers
    // call, never from this snapshot's own nflTeam fields).
    expect(built.input.bestFreeAgentAdp).toBe(42)
    expect(built.input.bestFreeAgentName).toBe('Real Free Agent')
  })
})
