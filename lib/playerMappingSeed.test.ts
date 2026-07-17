import { describe, it, expect } from 'vitest'
import { buildPlayerMappingSeedPlan, isFantasyRelevantFreeAgent, type ExistingMapping, type PlayerCacheRow } from './playerMappingSeed'

const SEASON = 2026

function sleeperRow(overrides: Partial<PlayerCacheRow> = {}): PlayerCacheRow {
  return { playerId: 's1', platform: 'sleeper', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', ownershipPct: null, adp: null, ...overrides }
}
function espnRow(overrides: Partial<PlayerCacheRow> = {}): PlayerCacheRow {
  return { playerId: 'e1', platform: 'espn', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', ownershipPct: null, adp: null, ...overrides }
}
function mapping(overrides: Partial<ExistingMapping> = {}): ExistingMapping {
  return { id: 'm1', name: 'Josh Allen', nflTeam: 'BUF', position: 'QB', espnId: null, yahooId: null, sleeperId: null, season: SEASON, ...overrides }
}

describe('buildPlayerMappingSeedPlan — new cross-platform link', () => {
  it('inserts one row with both provider IDs when exactly one sleeper + one espn row share name+team', () => {
    const plan = buildPlayerMappingSeedPlan([], [sleeperRow()], [espnRow()], SEASON)
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ type: 'insert', sleeperId: 's1', espnId: 'e1', matchBasis: 'name_team_unambiguous' })
    expect(plan.report.proposed.insertNewCrossPlatform).toBe(1)
    expect(plan.report.byPlatform.sleeper.matched).toBe(1)
    expect(plan.report.byPlatform.espn.matched).toBe(1)
  })

  it('honestly labels this an unambiguous name+team match, never "exact" — no independent crosswalk exists', () => {
    const plan = buildPlayerMappingSeedPlan([], [sleeperRow()], [espnRow()], SEASON)
    const insertAction = plan.actions[0]
    expect(insertAction).toMatchObject({ matchBasis: 'name_team_unambiguous' })
    expect(plan.report.confidence.nameTeamUnambiguous).toBe(1)
    expect(plan.report.confidence.providerIdReuse).toBe(0)
  })

  it('inserts a single-platform row when only one platform has a candidate at that key', () => {
    const plan = buildPlayerMappingSeedPlan([], [sleeperRow()], [], SEASON)
    expect(plan.actions).toEqual([
      expect.objectContaining({ type: 'insert', sleeperId: 's1', espnId: null, matchBasis: 'single_platform' }),
    ])
    expect(plan.report.proposed.insertNewSinglePlatform).toBe(1)
  })
})

describe('buildPlayerMappingSeedPlan — collisions never persisted', () => {
  it('never links two same-platform candidates sharing a key — reports a collision instead', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 's1' }), sleeperRow({ playerId: 's2' })],
      [espnRow()],
      SEASON
    )
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.collisions).toHaveLength(1)
    expect(plan.report.collisions[0].rows.map((r) => r.sourcePlayerId).sort()).toEqual(['e1', 's1', 's2'])
  })

  it('reports a genuinely ambiguous bucket without ever guessing which candidate is right', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 's1' }), sleeperRow({ playerId: 's2' })],
      [],
      SEASON
    )
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.collisions[0].reason).toMatch(/cannot resolve unambiguously/)
  })

  it('never merges two same-platform free agents sharing a name — reports a collision, never guesses which is which', () => {
    // P3-4B: "duplicate names with null teams" regression.
    const plan = buildPlayerMappingSeedPlan(
      [],
      [
        sleeperRow({ playerId: 's1', name: 'Mike Williams', nflTeam: null, ownershipPct: 5 }),
        sleeperRow({ playerId: 's2', name: 'Mike Williams', nflTeam: null, adp: 210 }),
      ],
      [],
      SEASON
    )
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.collisions).toHaveLength(1)
    expect(plan.report.collisions[0].rows.map((r) => r.sourcePlayerId).sort()).toEqual(['s1', 's2'])
  })
})

describe('buildPlayerMappingSeedPlan — active free agents preserved (P3-4B)', () => {
  it('isFantasyRelevantFreeAgent is true when ownership % is above zero', () => {
    expect(isFantasyRelevantFreeAgent({ ownershipPct: 2.5, adp: null })).toBe(true)
  })
  it('isFantasyRelevantFreeAgent is true when an ADP exists, even a very late one', () => {
    expect(isFantasyRelevantFreeAgent({ ownershipPct: null, adp: 480 })).toBe(true)
  })
  it('isFantasyRelevantFreeAgent is false with no signal at all', () => {
    expect(isFantasyRelevantFreeAgent({ ownershipPct: null, adp: null })).toBe(false)
  })
  it('isFantasyRelevantFreeAgent is false when ownership is exactly zero and no ADP', () => {
    expect(isFantasyRelevantFreeAgent({ ownershipPct: 0, adp: null })).toBe(false)
  })

  it('writes a real, currently-relevant unsigned free agent with nflTeam: null — never a placeholder team string', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 's1', name: 'Free Agent Guy', nflTeam: null, ownershipPct: 12.4 })],
      [],
      SEASON
    )
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ type: 'insert', nflTeam: null, isFreeAgent: true })
    expect(plan.report.proposed.freeAgentsWritten).toBe(1)
  })

  it('cross-links a free agent across platforms by name alone when both are genuinely unsigned', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 's1', name: 'Free Agent Guy', nflTeam: null, adp: 300 })],
      [espnRow({ playerId: 'e1', name: 'Free Agent Guy', nflTeam: null, ownershipPct: 0.5 })],
      SEASON
    )
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ type: 'insert', nflTeam: null, sleeperId: 's1', espnId: 'e1', matchBasis: 'name_team_unambiguous', isFreeAgent: true })
  })

  it('a free-agent link stays name_team_unambiguous confidence, never promoted to exact', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 's1', name: 'Free Agent Guy', nflTeam: null, adp: 300 })],
      [espnRow({ playerId: 'e1', name: 'Free Agent Guy', nflTeam: null, ownershipPct: 0.5 })],
      SEASON
    )
    expect(plan.actions[0]).toMatchObject({ matchBasis: 'name_team_unambiguous' })
    expect(plan.actions.some((a) => (a as { matchBasis?: string }).matchBasis === 'provider_id_reuse')).toBe(false)
  })
})

describe('buildPlayerMappingSeedPlan — retired/irrelevant players separated (P3-4B)', () => {
  it('reports a player with no team and no relevance signal as retiredOrIrrelevant, not unresolved, and never writes it', () => {
    const plan = buildPlayerMappingSeedPlan([], [sleeperRow({ nflTeam: null, ownershipPct: null, adp: null })], [], SEASON)
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.unresolved).toHaveLength(0)
    expect(plan.report.retiredOrIrrelevant).toHaveLength(1)
    expect(plan.report.retiredOrIrrelevant[0]).toMatchObject({ sourcePlayerId: 's1', reason: expect.stringContaining('retired') })
    expect(plan.report.byPlatform.sleeper.retiredOrIrrelevant).toBe(1)
  })

  it('a DEF row with no team is unresolved (data-quality gap), never treated as a free agent', () => {
    const plan = buildPlayerMappingSeedPlan([], [sleeperRow({ name: 'Some Defense', position: 'DEF', nflTeam: null })], [], SEASON)
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.retiredOrIrrelevant).toHaveLength(0)
    expect(plan.report.unresolved).toHaveLength(1)
    expect(plan.report.unresolved[0].reason).toMatch(/DEF\/D-ST/)
  })
})

describe('buildPlayerMappingSeedPlan — provider-ID reuse (exact confidence)', () => {
  it('never touches a row whose provider ID and team already match — idempotent, no spurious action', () => {
    const existing = mapping({ sleeperId: 's1' })
    const plan = buildPlayerMappingSeedPlan([existing], [sleeperRow()], [], SEASON)
    expect(plan.actions).toHaveLength(0)
    expect(plan.report.byPlatform.sleeper.matched).toBe(1)
  })

  it('links a missing platform ID onto an existing row via an unambiguous name+team match, not a fresh insert', () => {
    const existing = mapping({ sleeperId: 's1', espnId: null })
    const plan = buildPlayerMappingSeedPlan([existing], [sleeperRow()], [espnRow()], SEASON)
    expect(plan.actions).toEqual([
      { type: 'link_platform_id', mappingId: 'm1', platform: 'espn', newId: 'e1', matchBasis: 'name_team_unambiguous' },
    ])
    expect(plan.report.proposed.linkExistingRow).toBe(1)
  })
})

describe('buildPlayerMappingSeedPlan — team changes never create a second canonical person', () => {
  it('updates nflTeam on the SAME existing row when a stored provider ID resurfaces with a new team', () => {
    const existing = mapping({ sleeperId: 's1', nflTeam: 'BUF' })
    const traded = sleeperRow({ nflTeam: 'KC' })
    const plan = buildPlayerMappingSeedPlan([existing], [traded], [], SEASON)
    expect(plan.actions).toEqual([
      { type: 'update_team', mappingId: 'm1', newNflTeam: 'KC', matchBasis: 'provider_id_reuse' },
    ])
    expect(plan.report.proposed.updateTeamChange).toBe(1)
    // No second row was proposed for the same person.
    expect(plan.actions.filter((a) => a.type === 'insert')).toHaveLength(0)
  })

  it('updates an existing player to nflTeam: null (never a placeholder) when released to free agency', () => {
    const existing = mapping({ sleeperId: 's1', nflTeam: 'BUF' })
    const released = sleeperRow({ nflTeam: null, ownershipPct: 3 })
    const plan = buildPlayerMappingSeedPlan([existing], [released], [], SEASON)
    expect(plan.actions).toEqual([
      { type: 'update_team', mappingId: 'm1', newNflTeam: null, matchBasis: 'provider_id_reuse' },
    ])
  })

  it('an exact provider-ID match already stores nflTeam: null for a signed-then-still-unsigned player — retained, not re-guessed', () => {
    const existing = mapping({ sleeperId: 's1', nflTeam: null })
    const stillFreeAgent = sleeperRow({ nflTeam: null, ownershipPct: 3 })
    const plan = buildPlayerMappingSeedPlan([existing], [stillFreeAgent], [], SEASON)
    expect(plan.actions).toHaveLength(0)
  })

  it('blocks a team-change update that would collide with a different existing canonical row, reporting instead', () => {
    const movingPlayer = mapping({ id: 'm1', sleeperId: 's1', name: 'Josh Allen', nflTeam: 'BUF' })
    const alreadyThere = mapping({ id: 'm2', sleeperId: null, name: 'Josh Allen', nflTeam: 'KC' })
    const traded = sleeperRow({ nflTeam: 'KC' })
    const plan = buildPlayerMappingSeedPlan([movingPlayer, alreadyThere], [traded], [], SEASON)
    expect(plan.actions.filter((a) => a.type === 'update_team')).toHaveLength(0)
    expect(plan.report.collisions).toHaveLength(1)
    expect(plan.report.collisions[0].reason).toMatch(/team change/)
  })
})

describe('buildPlayerMappingSeedPlan — DEF matched by team identity, not display name', () => {
  it('links a Sleeper "Buffalo Bills" DEF row with an ESPN "BUF" DEF row purely by team', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 'def-s', name: 'Buffalo Bills', position: 'DEF', nflTeam: 'BUF' })],
      [espnRow({ playerId: 'def-e', name: 'Bills D/ST', position: 'DEF', nflTeam: 'BUF' })],
      SEASON
    )
    expect(plan.actions).toEqual([
      expect.objectContaining({ type: 'insert', sleeperId: 'def-s', espnId: 'def-e', position: 'DEF' }),
    ])
  })

  it('never merges two different teams\' defenses even if display names happen to be similar', () => {
    const plan = buildPlayerMappingSeedPlan(
      [],
      [sleeperRow({ playerId: 'def-s', name: 'Bills', position: 'DEF', nflTeam: 'BUF' })],
      [espnRow({ playerId: 'def-e', name: 'Bills', position: 'DEF', nflTeam: 'KC' })],
      SEASON
    )
    // Two separate single-platform rows, never one merged row.
    expect(plan.actions).toHaveLength(2)
    expect(plan.actions.every((a) => a.type === 'insert' && a.matchBasis === 'single_platform')).toBe(true)
  })
})

describe('buildPlayerMappingSeedPlan — idempotent rerun', () => {
  it('produces zero actions on a second run once the first run\'s inserts are reflected as existing mappings', () => {
    const first = buildPlayerMappingSeedPlan([], [sleeperRow()], [espnRow()], SEASON)
    expect(first.actions).toHaveLength(1)

    // Simulate the first run's insert having been applied.
    const insertedAction = first.actions[0]
    if (insertedAction.type !== 'insert') throw new Error('expected insert')
    const nowExisting: ExistingMapping = {
      id: 'new-1',
      name: insertedAction.name,
      nflTeam: insertedAction.nflTeam,
      position: insertedAction.position,
      espnId: insertedAction.espnId,
      sleeperId: insertedAction.sleeperId,
      yahooId: insertedAction.yahooId,
      season: insertedAction.season,
    }

    const second = buildPlayerMappingSeedPlan([nowExisting], [sleeperRow()], [espnRow()], SEASON)
    expect(second.actions).toHaveLength(0)
    expect(second.report.byPlatform.sleeper.matched).toBe(1)
    expect(second.report.byPlatform.espn.matched).toBe(1)
  })

  it('is idempotent for a written free agent too — rerun produces zero actions', () => {
    const first = buildPlayerMappingSeedPlan([], [sleeperRow({ nflTeam: null, ownershipPct: 8 })], [], SEASON)
    const insertedAction = first.actions[0]
    if (insertedAction.type !== 'insert') throw new Error('expected insert')
    const nowExisting: ExistingMapping = {
      id: 'new-1',
      name: insertedAction.name,
      nflTeam: insertedAction.nflTeam,
      position: insertedAction.position,
      espnId: insertedAction.espnId,
      sleeperId: insertedAction.sleeperId,
      yahooId: insertedAction.yahooId,
      season: insertedAction.season,
    }
    const second = buildPlayerMappingSeedPlan([nowExisting], [sleeperRow({ nflTeam: null, ownershipPct: 8 })], [], SEASON)
    expect(second.actions).toHaveLength(0)
  })
})
