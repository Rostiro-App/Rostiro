// Packet 03, P3-4: builds player_mappings rows from players_cache data.
// Pure — no DB access — so every decision (unambiguous link, collision,
// team-change update, unresolved) is testable in memory
// (lib/playerMappingSeed.test.ts) against real captured shapes, same
// discipline as lib/playerIdentity.ts's resolvePlayerIdentityPure.
//
// The one hard rule this file exists to enforce: a name+team match is
// NEVER written in a way that a future resolvePlayerIdentityPure call
// would treat as 'exact' confidence unless it is genuinely unambiguous at
// seed time (exactly one candidate per platform sharing a normalized
// identity key) — see buildPlayerMappingSeedPlan's docstring. Ambiguous
// matches are reported, never persisted. There is no independently
// verified external crosswalk (e.g. nflverse gsis_id) wired into this
// codebase yet — see lib/playerIdentity.ts's own comment on the same gap
// — so 'name_team_unambiguous' is honestly reported as its own tier,
// never mislabeled as a verified/exact match in this file's output.

import { normalizePlayerName } from '@/lib/playerIdentity'

export type SeedPlatform = 'sleeper' | 'espn'

export interface PlayerCacheRow {
  playerId: string
  platform: SeedPlatform
  name: string
  position: string | null
  nflTeam: string | null
}

export interface ExistingMapping {
  id: string
  name: string
  nflTeam: string
  position: string | null
  espnId: string | null
  yahooId: string | null
  sleeperId: string | null
  season: number
}

export type MatchBasis = 'provider_id_reuse' | 'name_team_unambiguous' | 'single_platform'

export type SeedAction =
  | {
      type: 'insert'
      name: string
      nflTeam: string
      position: string | null
      espnId: string | null
      sleeperId: string | null
      yahooId: null
      season: number
      matchBasis: MatchBasis
    }
  | {
      type: 'update_team'
      mappingId: string
      newNflTeam: string
      matchBasis: 'provider_id_reuse'
    }
  | {
      type: 'link_platform_id'
      mappingId: string
      platform: SeedPlatform
      newId: string
      matchBasis: 'name_team_unambiguous'
    }

export interface UnresolvedEntry {
  platform: SeedPlatform
  sourcePlayerId: string
  name: string
  nflTeam: string | null
  reason: string
}

export interface CollisionEntry {
  key: string
  reason: string
  rows: Array<{ platform: SeedPlatform; sourcePlayerId: string; name: string; nflTeam: string | null }>
}

export interface PlayerMappingSeedReport {
  season: number
  generatedAt: string
  totals: {
    sleeperCacheRows: number
    espnCacheRows: number
    existingMappings: number
  }
  proposed: {
    insertNewCrossPlatform: number
    insertNewSinglePlatform: number
    linkExistingRow: number
    updateTeamChange: number
  }
  unresolved: UnresolvedEntry[]
  collisions: CollisionEntry[]
  byPlatform: Record<SeedPlatform, { total: number; matched: number; unresolved: number }>
  confidence: {
    providerIdReuse: number
    nameTeamUnambiguous: number
    singlePlatformOnly: number
  }
}

export interface PlayerMappingSeedPlan {
  actions: SeedAction[]
  report: PlayerMappingSeedReport
}

function isDefense(position: string | null): boolean {
  return position === 'DEF'
}

// DEF/D-ST is matched by normalized NFL team identity alone (display names
// vary wildly across platforms: "Buffalo Bills" vs "BUF" vs "Bills
// D/ST") — same discipline as resolvePlayerIdentityPure's isDefense
// branch. Regular players are matched by normalized name + team.
function identityKey(row: PlayerCacheRow): string {
  if (isDefense(row.position)) return `DEF|${(row.nflTeam ?? '').toUpperCase()}`
  return `${normalizePlayerName(row.name)}|${(row.nflTeam ?? '').toUpperCase()}`
}

function mappingKey(m: ExistingMapping): string {
  if (isDefense(m.position)) return `DEF|${m.nflTeam.toUpperCase()}`
  return `${normalizePlayerName(m.name)}|${m.nflTeam.toUpperCase()}`
}

function rowIdentity(row: PlayerCacheRow): string {
  return `${row.platform}:${row.playerId}`
}

/**
 * Builds an idempotent, rerun-safe plan for populating player_mappings
 * from real players_cache rows. Never mutates or contacts the database —
 * callers (e.g. scripts/seedPlayerMappings.mts) decide whether/how to
 * apply the returned actions.
 *
 * Matching order per cache row:
 *  1. Provider-ID reuse — if an existing mapping already stores this
 *     platform's ID, that row IS the canonical match regardless of a
 *     since-changed name/team (a real trade). If nflTeam differs from
 *     what's stored, propose an `update_team` action on the SAME row
 *     (preserving its id) so a team change never creates a second
 *     canonical person — unless the new (name, nflTeam) would collide
 *     with a different existing row, in which case it's reported as a
 *     collision and left untouched for a human to resolve.
 *  2. Unambiguous name+team (or team-only, for DEF) bucket match against
 *     an existing mapping missing that platform's ID — proposes
 *     `link_platform_id`, filling in the one missing field. Only when
 *     the bucket has exactly one row for this platform.
 *  3. Unambiguous name+team bucket match against OTHER unlinked cache
 *     rows (no existing mapping at that key yet) — proposes a brand new
 *     `insert`. Cross-platform when exactly one sleeper + one espn row
 *     share the key; single-platform when only one platform has a row at
 *     that key.
 *  4. Anything left ambiguous (2+ rows for a platform sharing a key) is a
 *     collision — reported, never written. A row with no nflTeam on
 *     record can't be safely bucketed at all — reported unresolved,
 *     never dropped.
 */
export function buildPlayerMappingSeedPlan(
  existingMappings: ExistingMapping[],
  sleeperCacheRows: PlayerCacheRow[],
  espnCacheRows: PlayerCacheRow[],
  season: number
): PlayerMappingSeedPlan {
  const actions: SeedAction[] = []
  const unresolved: UnresolvedEntry[] = []
  const collisions: CollisionEntry[] = []
  let insertNewCrossPlatform = 0
  let insertNewSinglePlatform = 0
  let linkExistingRow = 0
  let updateTeamChange = 0

  const allCacheRows = [...sleeperCacheRows, ...espnCacheRows]
  const matchedRowIds = new Set<string>()

  const existingByProviderId: Record<SeedPlatform, Map<string, ExistingMapping>> = {
    sleeper: new Map(existingMappings.filter((m) => m.sleeperId).map((m) => [m.sleeperId as string, m])),
    espn: new Map(existingMappings.filter((m) => m.espnId).map((m) => [m.espnId as string, m])),
  }
  const existingByKey = new Map<string, ExistingMapping>(existingMappings.map((m) => [mappingKey(m), m]))
  // Existing mapping keys already claimed by an update_team proposal this
  // run — guards two provider-id-reuse rows both renaming toward the same
  // colliding (name, team) target within a single pass.
  const claimedNewKeys = new Set<string>()

  const unlinkedRows: PlayerCacheRow[] = []

  for (const row of allCacheRows) {
    if (!row.nflTeam) {
      unresolved.push({ platform: row.platform, sourcePlayerId: row.playerId, name: row.name, nflTeam: row.nflTeam, reason: 'No NFL team on record — cannot safely bucket by identity key' })
      continue
    }

    const existing = existingByProviderId[row.platform].get(row.playerId)
    if (existing) {
      matchedRowIds.add(rowIdentity(row))
      const freshTeam = row.nflTeam.toUpperCase()
      if (freshTeam !== existing.nflTeam.toUpperCase()) {
        const targetKey = isDefense(existing.position) ? `DEF|${freshTeam}` : `${normalizePlayerName(existing.name)}|${freshTeam}`
        const collidesWithOtherRow = existingByKey.has(targetKey) && existingByKey.get(targetKey)!.id !== existing.id
        if (collidesWithOtherRow || claimedNewKeys.has(targetKey)) {
          collisions.push({
            key: targetKey,
            reason: `Provider ID ${row.platform}:${row.playerId} implies a team change to ${freshTeam}, but another existing mapping already occupies that identity — needs manual review, not auto-merged`,
            rows: [{ platform: row.platform, sourcePlayerId: row.playerId, name: row.name, nflTeam: row.nflTeam }],
          })
        } else {
          actions.push({ type: 'update_team', mappingId: existing.id, newNflTeam: freshTeam, matchBasis: 'provider_id_reuse' })
          claimedNewKeys.add(targetKey)
          updateTeamChange++
        }
      }
      continue
    }
    unlinkedRows.push(row)
  }

  // Bucket remaining (not already provider-ID-linked) rows by identity key.
  const buckets = new Map<string, PlayerCacheRow[]>()
  for (const row of unlinkedRows) {
    const key = identityKey(row)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(row)
  }

  for (const [key, rows] of buckets) {
    const byPlat: Record<SeedPlatform, PlayerCacheRow[]> = { sleeper: [], espn: [] }
    for (const r of rows) byPlat[r.platform].push(r)

    const ambiguousPlatforms = (Object.keys(byPlat) as SeedPlatform[]).filter((p) => byPlat[p].length > 1)
    if (ambiguousPlatforms.length > 0) {
      collisions.push({
        key,
        reason: `${rows.length} cache rows share this identity key across ${ambiguousPlatforms.join(', ')} — cannot resolve unambiguously, not written`,
        rows: rows.map((r) => ({ platform: r.platform, sourcePlayerId: r.playerId, name: r.name, nflTeam: r.nflTeam })),
      })
      continue
    }

    const sleeperRow = byPlat.sleeper[0]
    const espnRow = byPlat.espn[0]
    const existing = existingByKey.get(key)

    if (existing) {
      // Existing row at this exact key is missing exactly one platform's
      // ID — fill it in. Never overwrite an ID that's already stored.
      if (sleeperRow && !existing.sleeperId) {
        actions.push({ type: 'link_platform_id', mappingId: existing.id, platform: 'sleeper', newId: sleeperRow.playerId, matchBasis: 'name_team_unambiguous' })
        matchedRowIds.add(rowIdentity(sleeperRow))
        linkExistingRow++
      }
      if (espnRow && !existing.espnId) {
        actions.push({ type: 'link_platform_id', mappingId: existing.id, platform: 'espn', newId: espnRow.playerId, matchBasis: 'name_team_unambiguous' })
        matchedRowIds.add(rowIdentity(espnRow))
        linkExistingRow++
      }
      continue
    }

    // No existing mapping at this key — propose a brand new row.
    const anyRow = sleeperRow ?? espnRow
    if (!anyRow) continue
    const matchBasis: MatchBasis = sleeperRow && espnRow ? 'name_team_unambiguous' : 'single_platform'
    actions.push({
      type: 'insert',
      name: anyRow.name,
      nflTeam: (anyRow.nflTeam ?? '').toUpperCase(),
      position: anyRow.position,
      espnId: espnRow?.playerId ?? null,
      sleeperId: sleeperRow?.playerId ?? null,
      yahooId: null,
      season,
      matchBasis,
    })
    if (sleeperRow) matchedRowIds.add(rowIdentity(sleeperRow))
    if (espnRow) matchedRowIds.add(rowIdentity(espnRow))
    if (sleeperRow && espnRow) insertNewCrossPlatform++
    else insertNewSinglePlatform++
  }

  const byPlatform: Record<SeedPlatform, { total: number; matched: number; unresolved: number }> = {
    sleeper: { total: sleeperCacheRows.length, matched: 0, unresolved: 0 },
    espn: { total: espnCacheRows.length, matched: 0, unresolved: 0 },
  }
  for (const row of allCacheRows) {
    if (matchedRowIds.has(rowIdentity(row))) byPlatform[row.platform].matched++
  }
  for (const p of ['sleeper', 'espn'] as SeedPlatform[]) {
    byPlatform[p].unresolved = byPlatform[p].total - byPlatform[p].matched
  }

  const confidence = {
    providerIdReuse: updateTeamChange + existingMappings.filter((m) => m.espnId || m.sleeperId).length,
    nameTeamUnambiguous: insertNewCrossPlatform + linkExistingRow,
    singlePlatformOnly: insertNewSinglePlatform,
  }

  const report: PlayerMappingSeedReport = {
    season,
    generatedAt: new Date().toISOString(),
    totals: {
      sleeperCacheRows: sleeperCacheRows.length,
      espnCacheRows: espnCacheRows.length,
      existingMappings: existingMappings.length,
    },
    proposed: { insertNewCrossPlatform, insertNewSinglePlatform, linkExistingRow, updateTeamChange },
    unresolved,
    collisions,
    byPlatform,
    confidence,
  }

  return { actions, report }
}
