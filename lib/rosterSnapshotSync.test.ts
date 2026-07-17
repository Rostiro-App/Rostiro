import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decideSyncAction, computeSnapshotFreshness } from './rosterSnapshotSync'
import type { NormalizedRosterSnapshot, IntelligenceReadResult, NormalizedDraftInfo } from './platforms'

function okRosterResult(players: NormalizedRosterSnapshot['players']): IntelligenceReadResult<NormalizedRosterSnapshot> {
  return {
    status: 'ok',
    data: {
      schemaVersion: 1,
      connectedLeagueId: 'cl-1',
      platform: 'sleeper',
      externalLeagueId: 'league-1',
      externalTeamId: 'team-1',
      capturedAt: new Date().toISOString(),
      providerUpdatedAt: null,
      players,
      warnings: [],
    },
    warnings: [],
  }
}

const realPlayer: NormalizedRosterSnapshot['players'][number] = {
  canonicalPlayerId: 'canon-1',
  sourcePlatform: 'sleeper',
  sourcePlayerId: 'p1',
  displayName: 'Josh Allen',
  nflTeam: 'BUF',
  position: 'QB',
  lineupStatus: 'starting',
  slot: null,
  identityConfidence: 'exact',
  identityReason: 'Matched via stored player_mappings.sleeper_id',
}

function draftResult(status: NormalizedDraftInfo['status'] | null): IntelligenceReadResult<NormalizedDraftInfo> | null {
  if (status === null) return null
  return { status: 'ok', data: { status, scheduledAt: null }, warnings: [] }
}

function draftResultOk(status: NormalizedDraftInfo['status']): IntelligenceReadResult<NormalizedDraftInfo> {
  return { status: 'ok', data: { status, scheduledAt: null }, warnings: [] }
}

describe('decideSyncAction — one shared shape, six proofs', () => {
  it('saves a normal non-empty roster', () => {
    const outcome = decideSyncAction(okRosterResult([realPlayer]), draftResult('in_progress'), true)
    expect(outcome.action).toBe('saved')
    expect(outcome.snapshot?.players).toHaveLength(1)
  })

  it('PROOF: last-known-good — a failed provider read never overwrites, even with a previous snapshot', () => {
    const failed: IntelligenceReadResult<NormalizedRosterSnapshot> = { status: 'failed', data: null, warnings: [], errorReason: 'ESPN 500' }
    const outcome = decideSyncAction(failed, draftResult('in_progress'), true)
    expect(outcome.action).toBe('kept_last_good')
    expect(outcome.snapshot).toBeNull()
    expect(outcome.hadPreviousSnapshot).toBe(true)
  })

  it('PROOF: preseason case — an empty roster IS saved when the draft is confirmed not_started', () => {
    const outcome = decideSyncAction(okRosterResult([]), draftResult('not_started'), false)
    expect(outcome.action).toBe('saved')
    expect(outcome.snapshot?.players).toHaveLength(0)
    expect(outcome.reason).toMatch(/not_started/)
  })

  it('PROOF: an empty roster during an in-progress season is distrusted, not saved as a real empty roster', () => {
    const outcome = decideSyncAction(okRosterResult([]), draftResult('in_progress'), true)
    expect(outcome.action).toBe('kept_last_good')
    expect(outcome.reason).toMatch(/in_progress/)
  })

  it('PROOF: an empty roster with draft status unavailable is ALSO distrusted, not assumed safe', () => {
    const outcome = decideSyncAction(okRosterResult([]), null, true)
    expect(outcome.action).toBe('kept_last_good')
    expect(outcome.reason).toMatch(/unknown\/unavailable/)
  })

  it('PROOF: an empty roster with a completed draft is distrusted (a real active roster should exist by then)', () => {
    const outcome = decideSyncAction(okRosterResult([]), draftResult('complete'), true)
    expect(outcome.action).toBe('kept_last_good')
  })

  it('PROOF: freshness — approval_pending is reported honestly, never silently treated as a failure', () => {
    const outcome = decideSyncAction({ status: 'approval_pending', data: null, warnings: [], errorReason: 'Yahoo access not yet approved' }, null, false)
    expect(outcome.action).toBe('approval_pending')
  })

  it('PROOF: freshness — unsupported is reported honestly, distinct from a failed attempt', () => {
    const outcome = decideSyncAction({ status: 'unsupported', data: null, warnings: [], errorReason: 'No roster read for this platform' }, null, false)
    expect(outcome.action).toBe('unsupported')
  })

  it('PROOF: dual identity survives untouched — canonical id, source id, confidence, and reason are all preserved on the saved snapshot', () => {
    const unresolvedPlayer: NormalizedRosterSnapshot['players'][number] = {
      canonicalPlayerId: null,
      sourcePlatform: 'sleeper',
      sourcePlayerId: 'p2',
      displayName: 'Unknown Guy',
      nflTeam: null,
      position: null,
      lineupStatus: 'bench',
      slot: null,
      identityConfidence: 'unresolved',
      identityReason: 'No stored mapping or name/team match found',
    }
    const outcome = decideSyncAction(okRosterResult([realPlayer, unresolvedPlayer]), draftResult('in_progress'), false)
    expect(outcome.snapshot?.players).toHaveLength(2)
    const saved = outcome.snapshot?.players.find((p) => p.sourcePlayerId === 'p2')
    expect(saved).toMatchObject({
      canonicalPlayerId: null,
      sourcePlayerId: 'p2',
      identityConfidence: 'unresolved',
      identityReason: 'No stored mapping or name/team match found',
    })
  })

  it('PROOF: unresolved-player preservation — an unresolved player is never dropped from the saved snapshot', () => {
    const unresolvedPlayer: NormalizedRosterSnapshot['players'][number] = {
      canonicalPlayerId: null,
      sourcePlatform: 'espn',
      sourcePlayerId: 'e9',
      displayName: 'Some Guy',
      nflTeam: 'DAL',
      position: 'WR',
      lineupStatus: 'starting',
      slot: null,
      identityConfidence: 'unresolved',
      identityReason: 'No stored mapping or name/team match found',
    }
    const outcome = decideSyncAction(okRosterResult([unresolvedPlayer]), draftResult('in_progress'), false)
    expect(outcome.action).toBe('saved')
    expect(outcome.snapshot?.players).toEqual([unresolvedPlayer])
  })
})

describe('computeSnapshotFreshness — five distinguishable states', () => {
  const now = new Date('2026-07-17T12:00:00Z')

  it('fresh: within the stale window', () => {
    const lastSnapshotAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString() // 1h ago
    expect(computeSnapshotFreshness({ lastSnapshotAt, now, capabilitiesSupportRosterRead: true, approvalPending: false })).toBe('fresh')
  })

  it('stale: older than the stale window but still usable', () => {
    const lastSnapshotAt = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString() // 10h ago
    expect(computeSnapshotFreshness({ lastSnapshotAt, now, capabilitiesSupportRosterRead: true, approvalPending: false })).toBe('stale')
  })

  it('unavailable: no snapshot has ever been saved', () => {
    expect(computeSnapshotFreshness({ lastSnapshotAt: null, now, capabilitiesSupportRosterRead: true, approvalPending: false })).toBe('unavailable')
  })

  it('unsupported: the platform has no roster-read capability', () => {
    expect(computeSnapshotFreshness({ lastSnapshotAt: null, now, capabilitiesSupportRosterRead: false, approvalPending: false })).toBe('unsupported')
  })

  it('approval_pending: takes priority even if a stale snapshot somehow exists', () => {
    const lastSnapshotAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    expect(computeSnapshotFreshness({ lastSnapshotAt, now, capabilitiesSupportRosterRead: true, approvalPending: true })).toBe('approval_pending')
  })

  it('a failed sync attempt with a prior good snapshot reports the PRIOR snapshot\'s freshness, never "unavailable"', () => {
    // Simulates last-known-good: the current attempt failed, but a real
    // snapshot from 2 hours ago still exists and should still read fresh.
    const lastSnapshotAt = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    expect(computeSnapshotFreshness({ lastSnapshotAt, now, capabilitiesSupportRosterRead: true, approvalPending: false })).toBe('fresh')
  })
})

describe('syncRosterSnapshot — DB interaction (last-known-good proven against a mock)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  const context = { connectedLeagueId: 'cl-1', userId: 'user-1', platform: 'sleeper' as const, externalLeagueId: 'league-1', externalTeamId: 'team-1' }

  function mockAdmin(previousSnapshotAt: string | null, insertSpy: ReturnType<typeof vi.fn>) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'roster_snapshots') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(() => Promise.resolve({ data: previousSnapshotAt ? { snapped_at: previousSnapshotAt } : null })),
                    })),
                  })),
                })),
              })),
            })),
            insert: insertSpy,
          }
        }
        return {}
      }),
    }
  }

  it('inserts a new snapshot row when the roster read succeeds', async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }))
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin(null, insertSpy)) }))

    const { syncRosterSnapshot } = await import('./rosterSnapshotSync')
    const adapter = {
      platform: 'sleeper' as const,
      capabilities: { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false },
      readOwnedRoster: vi.fn(() => Promise.resolve(okRosterResult([realPlayer]))),
      readDraftMetadata: vi.fn(() => Promise.resolve(draftResultOk('in_progress'))),
    }

    const result = await syncRosterSnapshot(context, adapter)
    expect(result.outcome.action).toBe('saved')
    expect(insertSpy).toHaveBeenCalledTimes(1)
  })

  it('PROOF: never calls insert when the provider read fails — last-known-good means no write at all', async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }))
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin('2026-07-17T06:00:00Z', insertSpy)) }))

    const { syncRosterSnapshot } = await import('./rosterSnapshotSync')
    const adapter = {
      platform: 'sleeper' as const,
      capabilities: { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false },
      readOwnedRoster: vi.fn(() => Promise.resolve({ status: 'failed' as const, data: null, warnings: [], errorReason: 'network error' })),
      readDraftMetadata: vi.fn(() => Promise.resolve(draftResultOk('in_progress'))),
    }

    const result = await syncRosterSnapshot(context, adapter)
    expect(result.outcome.action).toBe('kept_last_good')
    expect(insertSpy).not.toHaveBeenCalled()
    // The previous snapshot's timestamp is still reported, not wiped out.
    expect(result.lastSnapshotAt).toBe('2026-07-17T06:00:00Z')
  })

  it('PROOF: never calls insert for a suspicious empty roster (draft in progress, 0 players)', async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }))
    vi.doMock('@/lib/supabase', () => ({ createAdminClient: vi.fn(() => mockAdmin('2026-07-17T06:00:00Z', insertSpy)) }))

    const { syncRosterSnapshot } = await import('./rosterSnapshotSync')
    const adapter = {
      platform: 'espn' as const,
      capabilities: { leagueRead: true, rosterRead: true, matchupRead: true, draftRead: true, freeAgentRead: true, lineupWrite: false, waiverWrite: false, tradeWrite: false },
      readOwnedRoster: vi.fn(() => Promise.resolve(okRosterResult([]))),
      readDraftMetadata: vi.fn(() => Promise.resolve(draftResultOk('in_progress'))),
    }

    const result = await syncRosterSnapshot(context, adapter)
    expect(result.outcome.action).toBe('kept_last_good')
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
