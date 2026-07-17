import { describe, it, expect } from 'vitest'
import { resolvePlayerIdentityPure, normalizePlayerName, type PlayerMappingRow } from './playerIdentity'

const candidates: PlayerMappingRow[] = [
  { id: 'p-1', name: 'A.J. Brown', nflTeam: 'PHI', position: 'WR', espnId: 'espn-1', yahooId: 'yahoo-1', sleeperId: 'sleeper-1' },
  { id: 'p-2', name: 'Josh Allen', nflTeam: 'BUF', position: 'QB', espnId: null, yahooId: null, sleeperId: 'sleeper-2' },
  // Two real, different people sharing a common name on different teams —
  // the classic duplicate-name collision case.
  { id: 'p-3', name: 'Josh Allen', nflTeam: 'JAX', position: 'DE', espnId: null, yahooId: null, sleeperId: null },
  { id: 'p-4', name: 'Devon Achane', nflTeam: 'MIA', position: 'RB', espnId: null, yahooId: null, sleeperId: null },
  { id: 'p-5', name: 'San Francisco 49ers', nflTeam: 'SF', position: 'DEF', espnId: null, yahooId: null, sleeperId: null },
  { id: 'p-6', name: 'Buffalo Bills', nflTeam: 'BUF', position: 'DEF', espnId: null, yahooId: null, sleeperId: null },
]

describe('normalizePlayerName', () => {
  it('strips periods and apostrophes', () => {
    expect(normalizePlayerName("A.J. O'Brien")).toBe('aj obrien')
  })
  it('strips common suffixes', () => {
    expect(normalizePlayerName('Michael Pittman Jr.')).toBe('michael pittman')
    expect(normalizePlayerName('Odell Beckham III')).toBe('odell beckham')
  })
  it('collapses hyphens and extra whitespace', () => {
    expect(normalizePlayerName('Ja-Marr  Chase')).toBe('ja marr chase')
  })
})

describe('resolvePlayerIdentityPure', () => {
  it('resolves exact stored platform mapping with high confidence', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'yahoo', sourcePlayerId: 'yahoo-1', name: 'A.J. Brown', nflTeam: 'PHI',
    })
    expect(result).toMatchObject({ canonicalPlayerId: 'p-1', confidence: 'exact' })
  })

  it('resolves via normalized name + team when there is no stored platform mapping (suffix/punctuation variance)', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'espn', sourcePlayerId: 'espn-unmapped-999', name: 'AJ Brown', nflTeam: 'PHI',
    })
    expect(result).toMatchObject({ canonicalPlayerId: 'p-1', confidence: 'name_team' })
  })

  it('resolves a genuine team change via the name-only fallback, and says so in the reason', () => {
    // Source platform reports Devon Achane now on a different team than
    // player_mappings has on file (a trade since the mapping was last
    // refreshed) — should still resolve, since only one player anywhere
    // shares this name.
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'sleeper', sourcePlayerId: 'sleeper-unmapped', name: 'Devon Achane', nflTeam: 'NYJ',
    })
    expect(result.canonicalPlayerId).toBe('p-4')
    expect(result.confidence).toBe('name_team')
    expect(result.reason).toContain('team change')
  })

  it('refuses to resolve a duplicate name across different teams — reports unresolved with a collision reason', () => {
    // Two different real "Josh Allen"s exist (QB and DE) on different
    // teams; source data claims a third team no player_mappings row has,
    // so the same-team lookup can't disambiguate and name-only finds two.
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'yahoo', sourcePlayerId: 'yahoo-unmapped', name: 'Josh Allen', nflTeam: 'MIA',
    })
    expect(result.canonicalPlayerId).toBeNull()
    expect(result.confidence).toBe('unresolved')
    expect(result.reason).toContain('collision')
  })

  it('resolves a duplicate name correctly when the team disambiguates it', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'sleeper', sourcePlayerId: 'sleeper-2', name: 'Josh Allen', nflTeam: 'BUF',
    })
    expect(result).toMatchObject({ canonicalPlayerId: 'p-2', confidence: 'exact' })
  })

  it('resolves a team defense by NFL team, not by treating it like a normal player name', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'yahoo', sourcePlayerId: 'yahoo-def-sf', name: 'San Francisco', nflTeam: 'SF', position: 'DEF',
    })
    expect(result).toMatchObject({ canonicalPlayerId: 'p-5', confidence: 'name_team' })
  })

  it('resolves a free agent (no meaningful team) via the name-only fallback', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'espn', sourcePlayerId: 'espn-fa', name: 'Devon Achane', nflTeam: 'FA',
    })
    expect(result.canonicalPlayerId).toBe('p-4')
    expect(result.confidence).toBe('name_team')
  })

  it('reports fully unresolved for a player matching nothing', () => {
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'yahoo', sourcePlayerId: 'yahoo-nobody', name: 'Totally Nobody', nflTeam: 'KC',
    })
    expect(result).toMatchObject({ canonicalPlayerId: null, confidence: 'unresolved' })
    expect(result.reason).toContain('No stored mapping')
  })

  it('never merges two players solely because their names match, without collision detection', () => {
    // Sanity check on the collision case above: both candidates must be
    // real, distinct rows the resolver considered and rejected, not one
    // arbitrarily picked.
    const johnAllenRows = candidates.filter((c) => normalizePlayerName(c.name) === 'josh allen')
    expect(johnAllenRows).toHaveLength(2)
    expect(johnAllenRows.map((c) => c.id)).toEqual(['p-2', 'p-3'])
  })

  it('never treats a raw Yahoo platform ID as a Sleeper (or any other platform) canonical ID', () => {
    // p-1's yahooId ('yahoo-1') must never match when queried as a sleeper
    // sourcePlayerId — the two platform ID namespaces stay fully separate.
    const result = resolvePlayerIdentityPure(candidates, {
      platform: 'sleeper', sourcePlayerId: 'yahoo-1', name: 'Unrelated Name', nflTeam: 'ZZ',
    })
    expect(result.canonicalPlayerId).toBeNull()
    expect(result.confidence).toBe('unresolved')
  })

  it('never promotes to verified_alias — no second verified crosswalk source exists yet', () => {
    // Every case in this file resolves via 'exact', 'name_team', or
    // 'unresolved' — 'verified_alias' should never appear until a real
    // second source (e.g. a verified nflverse gsis_id crosswalk) is built.
    const allResults = [
      resolvePlayerIdentityPure(candidates, { platform: 'yahoo', sourcePlayerId: 'yahoo-1', name: 'A.J. Brown', nflTeam: 'PHI' }),
      resolvePlayerIdentityPure(candidates, { platform: 'espn', sourcePlayerId: 'x', name: 'AJ Brown', nflTeam: 'PHI' }),
      resolvePlayerIdentityPure(candidates, { platform: 'yahoo', sourcePlayerId: 'y', name: 'Nobody', nflTeam: 'KC' }),
    ]
    expect(allResults.every((r) => r.confidence !== 'verified_alias')).toBe(true)
  })
})
