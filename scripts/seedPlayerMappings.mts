/**
 * Packet 03, P3-4: player_mappings seed runner.
 *
 * Dry-run by default — reads real players_cache + player_mappings from
 * Supabase, builds a plan via lib/playerMappingSeed.ts's pure
 * buildPlayerMappingSeedPlan, and prints a report. No writes happen unless
 * --write is passed explicitly, and this script should never be run with
 * --write against production without the founder's direct approval for
 * that specific run — this file does not enforce that itself (it can't
 * know who's running it), the approval step is procedural.
 *
 * Usage:
 *   npx tsx scripts/seedPlayerMappings.mts             # dry run, report only
 *   npx tsx scripts/seedPlayerMappings.mts --write      # apply the plan
 *   npx tsx scripts/seedPlayerMappings.mts --season 2027
 */
import { createAdminClient } from '../lib/supabase'
import { buildPlayerMappingSeedPlan, type ExistingMapping, type PlayerCacheRow, type SeedAction } from '../lib/playerMappingSeed'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const seasonArgIdx = args.indexOf('--season')
const SEASON = seasonArgIdx >= 0 ? Number(args[seasonArgIdx + 1]) : 2026

const PAGE_SIZE = 1000

// PostgREST caps a single response at 1000 rows by default — players_cache
// has 1887+ real rows, so a single unpaginated select silently truncates
// the seed's input. Page through explicitly rather than trust a default.
async function loadCacheRows(admin: ReturnType<typeof createAdminClient>, platform: 'sleeper' | 'espn'): Promise<PlayerCacheRow[]> {
  const rows: PlayerCacheRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('players_cache')
      .select('player_id, platform, name, position, nfl_team')
      .eq('platform', platform)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to load ${platform} players_cache: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data.map((r) => ({ playerId: r.player_id, platform, name: r.name, position: r.position, nflTeam: r.nfl_team })))
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

async function applyActions(admin: ReturnType<typeof createAdminClient>, actions: SeedAction[]) {
  let inserted = 0
  let updated = 0
  let linked = 0
  for (const action of actions) {
    if (action.type === 'insert') {
      const { error } = await admin.from('player_mappings').insert({
        name: action.name,
        nfl_team: action.nflTeam,
        position: action.position,
        espn_id: action.espnId,
        sleeper_id: action.sleeperId,
        yahoo_id: action.yahooId,
        season: action.season,
      })
      if (error) {
        console.error(`  INSERT FAILED for ${action.name} (${action.nflTeam}): ${error.message}`)
        continue
      }
      inserted++
    } else if (action.type === 'update_team') {
      const { error } = await admin.from('player_mappings').update({ nfl_team: action.newNflTeam }).eq('id', action.mappingId)
      if (error) {
        console.error(`  UPDATE FAILED for mapping ${action.mappingId}: ${error.message}`)
        continue
      }
      updated++
    } else if (action.type === 'link_platform_id') {
      const column = action.platform === 'espn' ? 'espn_id' : 'sleeper_id'
      const { error } = await admin.from('player_mappings').update({ [column]: action.newId }).eq('id', action.mappingId)
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

  const [sleeperRows, espnRows, existingMappings] = await Promise.all([
    loadCacheRows(admin, 'sleeper'),
    loadCacheRows(admin, 'espn'),
    loadExistingMappings(admin, SEASON),
  ])

  const { actions, report } = buildPlayerMappingSeedPlan(existingMappings, sleeperRows, espnRows, SEASON)

  // Report contains only public NFL player names/teams (players_cache has
  // no user PII) and internal mapping row IDs — safe to print/log.
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n${actions.length} action(s) proposed. Mode: ${WRITE ? 'WRITE' : 'DRY RUN (no changes made)'}`)

  if (report.totals.espnCacheRows === 0) {
    console.log('\nNOTE: 0 ESPN players_cache rows found — no ESPN player-cache sync route exists in this codebase yet (app/api/cron/players/route.ts only syncs Sleeper). This run will only ever produce single-platform Sleeper mappings until that gap is closed.')
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
