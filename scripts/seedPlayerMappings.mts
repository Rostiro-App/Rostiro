/**
 * Packet 03, P3-4 + P3-4B: player_mappings seed runner.
 *
 * Dry-run by default — reads real players_cache + player_mappings from
 * Supabase, builds a plan via lib/playerMappingSeed.ts's pure
 * buildPlayerMappingSeedPlan, and prints a report. No writes happen unless
 * --write is passed explicitly, and this script should never be run with
 * --write against production without the founder's direct approval for
 * that specific run — this file does not enforce that itself (it can't
 * know who's running it), the approval step is procedural.
 *
 * P3-4B: if players_cache has zero ESPN rows (the real state as of
 * 2026-07-17 — no ESPN ingestion has ever run), this script falls back to
 * a LIVE, read-only ESPN fetch (via scripts/ingestEspnPlayers.mts's dry-run
 * path) so the report genuinely reflects real Sleeper+ESPN candidates
 * rather than silently staying Sleeper-only. That live fetch never writes
 * to players_cache itself — only scripts/ingestEspnPlayers.mts --write
 * does that, as its own separate, explicitly-approved step.
 *
 * Usage:
 *   npx tsx scripts/seedPlayerMappings.mts             # dry run, report only
 *   npx tsx scripts/seedPlayerMappings.mts --write      # apply the plan
 *   npx tsx scripts/seedPlayerMappings.mts --season 2027
 *
 * IMPORTANT for any future consumer of the player_mappings rows this
 * writes: `nfl_team: null` does NOT prove active free-agent status — see
 * lib/playerMappingSeed.ts's `isTeamlessActivityUnverified` flag and its
 * header comment. A row with that flag set must never be surfaced in an
 * active waiver pool, a recommendation, or player search SOLELY because
 * its team is null — that requires a real provider-confirmed signal (e.g.
 * lib/platforms/*.ts's readAvailablePlayers, which asks the provider
 * directly), not an inference from a missing team field here.
 */
import { createAdminClient } from '../lib/supabase'
import { buildPlayerMappingSeedPlan, type ExistingMapping, type PlayerCacheRow, type SeedAction } from '../lib/playerMappingSeed'
import { fetchLiveEspnCandidates } from '../lib/espnIngestRunner'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const seasonArgIdx = args.indexOf('--season')
const SEASON = seasonArgIdx >= 0 ? Number(args[seasonArgIdx + 1]) : 2026

const PAGE_SIZE = 1000

// PostgREST caps a single response at 1000 rows by default — players_cache
// has 1887+ real Sleeper rows, so a single unpaginated select silently
// truncates the seed's input (found and fixed during the first real P3-4
// dry run). Page through explicitly rather than trust a default.
async function loadCacheRows(admin: ReturnType<typeof createAdminClient>, platform: 'sleeper' | 'espn'): Promise<PlayerCacheRow[]> {
  const adpColumn = platform === 'sleeper' ? 'adp_sleeper' : 'adp_espn'
  const rows: PlayerCacheRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('players_cache')
      .select(`player_id, platform, name, position, nfl_team, ownership_pct, ${adpColumn}`)
      .eq('platform', platform)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to load ${platform} players_cache: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(
      ...data.map((r) => ({
        playerId: r.player_id,
        platform,
        name: r.name,
        position: r.position,
        nflTeam: r.nfl_team,
        ownershipPct: r.ownership_pct,
        adp: (r as Record<string, number | null>)[adpColumn],
      }))
    )
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function loadExistingMappings(admin: ReturnType<typeof createAdminClient>, season: number): Promise<ExistingMapping[]> {
  const rows: ExistingMapping[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('player_mappings')
      .select('id, name, nfl_team, position, espn_id, yahoo_id, sleeper_id, season')
      .eq('season', season)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to load player_mappings: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data.map((r) => ({
      id: r.id,
      name: r.name,
      nflTeam: r.nfl_team,
      position: r.position,
      espnId: r.espn_id,
      yahooId: r.yahoo_id,
      sleeperId: r.sleeper_id,
      season: r.season,
    })))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

// P3-11 correction: persists matchBasis/isTeamlessActivityUnverified into
// the mapping_basis/teamless_activity_unverified columns proposed in
// supabase/migration_player_mapping_provenance.sql. That migration is
// PROPOSED ONLY, not yet applied to production — running this script with
// --write against a database that doesn't have those columns yet will fail
// every insert/update with a real Supabase error (surfaced below, not
// swallowed), which is the correct, honest failure mode until the
// migration is separately approved and applied.
async function applyActions(admin: ReturnType<typeof createAdminClient>, actions: SeedAction[]) {
  let inserted = 0
  let updated = 0
  let linked = 0
  for (const action of actions) {
    if (action.type === 'insert') {
      const { error } = await admin.from('player_mappings').insert({
        name: action.name,
        nfl_team: action.nflTeam, // may be null when no team is on record — never a placeholder string
        position: action.position,
        espn_id: action.espnId,
        sleeper_id: action.sleeperId,
        yahoo_id: action.yahooId,
        season: action.season,
        mapping_basis: action.matchBasis,
        teamless_activity_unverified: action.isTeamlessActivityUnverified,
      })
      if (error) {
        console.error(`  INSERT FAILED for ${action.name} (${action.nflTeam ?? 'no team on record'}): ${error.message}`)
        continue
      }
      inserted++
    } else if (action.type === 'update_team') {
      const { error } = await admin
        .from('player_mappings')
        .update({ nfl_team: action.newNflTeam, mapping_basis: action.matchBasis })
        .eq('id', action.mappingId)
      if (error) {
        console.error(`  UPDATE FAILED for mapping ${action.mappingId}: ${error.message}`)
        continue
      }
      updated++
    } else if (action.type === 'link_platform_id') {
      const column = action.platform === 'espn' ? 'espn_id' : 'sleeper_id'
      // The row's mapping_basis is set (not merely left as-is) here — a row
      // previously written as 'single_platform' now has a second
      // platform's ID attached via a name+team heuristic, which is a real,
      // weaker-confidence fact about the WHOLE row going forward (see
      // lib/playerIdentity.ts's resolvePlayerIdentityPure guard, which
      // downgrades 'exact' to 'verified_alias' for any row whose
      // mapping_basis is 'name_team_unambiguous'). This never silently
      // upgrades confidence — it can only ever move a row from
      // 'single_platform' to the more cautious 'name_team_unambiguous'.
      const { error } = await admin
        .from('player_mappings')
        .update({ [column]: action.newId, mapping_basis: action.matchBasis })
        .eq('id', action.mappingId)
      if (error) {
        console.error(`  LINK FAILED for mapping ${action.mappingId}: ${error.message}`)
        continue
      }
      linked++
    }
  }
  return { inserted, updated, linked }
}

async function main() {
  const admin = createAdminClient()

  const [sleeperRows, espnCacheRows, existingMappings] = await Promise.all([
    loadCacheRows(admin, 'sleeper'),
    loadCacheRows(admin, 'espn'),
    loadExistingMappings(admin, SEASON),
  ])

  let espnRows = espnCacheRows
  let espnSource: 'players_cache' | 'live_fetch' | 'none' = espnCacheRows.length > 0 ? 'players_cache' : 'none'

  if (espnCacheRows.length === 0) {
    console.log('players_cache has 0 ESPN rows — attempting a LIVE, read-only ESPN fetch so this report reflects real Sleeper+ESPN candidates (nothing will be written to players_cache from this path).')
    try {
      const candidates = await fetchLiveEspnCandidates(admin)
      if (candidates.length > 0) {
        espnRows = candidates.map((c) => ({
          playerId: c.playerId,
          platform: 'espn' as const,
          name: c.name,
          position: c.position,
          nflTeam: c.nflTeam,
          ownershipPct: c.ownershipPct,
          adp: c.adpEspn,
        }))
        espnSource = 'live_fetch'
      }
    } catch (err) {
      console.log(`Live ESPN fetch failed (${err instanceof Error ? err.message : String(err)}) — continuing with Sleeper-only candidates.`)
    }
  }

  const { actions, report } = buildPlayerMappingSeedPlan(existingMappings, sleeperRows, espnRows, SEASON)

  // Report contains only public NFL player names/teams (players_cache has
  // no user PII) and internal mapping row IDs — safe to print/log.
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nESPN candidate source: ${espnSource}`)
  console.log(`${actions.length} action(s) proposed. Mode: ${WRITE ? 'WRITE' : 'DRY RUN (no changes made)'}`)

  if (espnSource === 'none') {
    console.log('\nNOTE: no ESPN candidates available (no players_cache rows and no connected ESPN league with stored credentials was found for a live fetch). This run only produced single-platform Sleeper mappings.')
  }

  if (!WRITE) {
    console.log('\nDry run complete. Re-run with --write to apply — do NOT do this against production without explicit approval for this specific run.')
    return
  }

  const result = await applyActions(admin, actions)
  console.log(`\nApplied: ${result.inserted} inserted, ${result.updated} team updates, ${result.linked} platform-ID links.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
