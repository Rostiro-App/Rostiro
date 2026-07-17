/**
 * Packet 03, P3-4B: ESPN player-ingestion runner.
 *
 * Dry-run by default — finds a real connected ESPN league + credentials in
 * Supabase, paginates ESPN's real kona_player_info endpoint via
 * lib/espnPlayerIngest.ts, and prints a report. No players_cache writes
 * happen unless --write is passed explicitly, and this script should never
 * be run with --write against production without the founder's direct
 * approval for that specific run.
 *
 * Usage:
 *   npx tsx scripts/ingestEspnPlayers.mts             # dry run, report only
 *   npx tsx scripts/ingestEspnPlayers.mts --write      # upsert into players_cache
 */
import { createAdminClient } from '../lib/supabase'
import { ingestEspnPlayers, type EspnPlayerCacheCandidate } from '../lib/espnPlayerIngest'
import { findEspnCredentials } from '../lib/espnIngestRunner'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')

export async function runDryOrWriteIngest(): Promise<{ candidates: EspnPlayerCacheCandidate[]; wrote: boolean }> {
  const admin = createAdminClient()
  const found = await findEspnCredentials(admin)
  if (!found) {
    console.log('No connected ESPN league with stored credentials found — cannot ingest. Nothing to do.')
    return { candidates: [], wrote: false }
  }

  const result = await ingestEspnPlayers(found.leagueId, found.credentials)

  console.log(`Fetched ${result.totalRawEntries} raw entries across ${result.pagesFetched} page(s) (hitMaxPages: ${result.hitMaxPages}).`)
  console.log(`Mapped ${result.candidates.length} candidates, skipped ${result.skippedNoId} with no player id.`)
  const noTeam = result.candidates.filter((c) => c.nflTeam === null).length
  console.log(`${noTeam} candidate(s) have no NFL team on record (proTeamId 0/unmapped) — reported as null, never a placeholder.`)
  console.log('Sample (first 5):', JSON.stringify(result.candidates.slice(0, 5), null, 2))

  if (!WRITE) {
    console.log('\nDry run complete. Re-run with --write to upsert into players_cache — do NOT do this against production without explicit approval for this specific run.')
    return { candidates: result.candidates, wrote: false }
  }

  const rows = result.candidates.map((c) => ({
    player_id: c.playerId,
    platform: 'espn',
    name: c.name,
    first_name: c.firstName,
    last_name: c.lastName,
    position: c.position,
    nfl_team: c.nflTeam,
    injury_status: c.injuryStatus,
    adp_espn: c.adpEspn,
    ownership_pct: c.ownershipPct,
    last_updated: new Date().toISOString(),
  }))
  const CHUNK = 500
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await admin.from('players_cache').upsert(chunk, { onConflict: 'player_id,platform' })
    if (error) {
      console.error(`  UPSERT FAILED for chunk starting at ${i}: ${error.message}`)
      continue
    }
    written += chunk.length
  }
  console.log(`\nWrote ${written} ESPN players_cache rows.`)
  return { candidates: result.candidates, wrote: true }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDryOrWriteIngest().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
