// Packet 03, P3-4B: shared "find a real connected ESPN league + credentials
// and run the ingestion" helper, used by both scripts/ingestEspnPlayers.mts
// (the dedicated ingestion runner) and scripts/seedPlayerMappings.mts (which
// falls back to a live read-only fetch when players_cache has no ESPN rows
// yet). Kept in lib/ as a plain .ts module rather than duplicated across
// the two .mts scripts, or cross-imported between them (which this
// repo's tsconfig moduleResolution doesn't resolve cleanly for .mts-to-.mts).

import { createAdminClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encrypt'
import { ingestEspnPlayers, type EspnPlayerCacheCandidate } from '@/lib/espnPlayerIngest'

export async function findEspnCredentials(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ leagueId: string; credentials: { espnS2: string; swid: string } } | null> {
  const { data: league, error: leagueErr } = await admin
    .from('connected_leagues')
    .select('id, league_id, user_id')
    .eq('platform', 'espn')
    .limit(1)
    .maybeSingle()
  if (leagueErr) throw new Error(`Failed to find a connected ESPN league: ${leagueErr.message}`)
  if (!league) return null

  const { data: creds, error: credErr } = await admin
    .from('espn_credentials')
    .select('espn_s2, swid')
    .eq('user_id', league.user_id)
    .maybeSingle()
  if (credErr) throw new Error(`Failed to load ESPN credentials: ${credErr.message}`)
  if (!creds) return null

  return { leagueId: league.league_id as string, credentials: { espnS2: decrypt(creds.espn_s2), swid: decrypt(creds.swid) } }
}

/**
 * Runs a live, read-only ESPN player fetch using whatever connected league
 * credentials are available. Never writes to players_cache itself — the
 * caller decides whether/how to persist the returned candidates.
 */
export async function fetchLiveEspnCandidates(
  admin: ReturnType<typeof createAdminClient>
): Promise<EspnPlayerCacheCandidate[]> {
  const found = await findEspnCredentials(admin)
  if (!found) return []
  const result = await ingestEspnPlayers(found.leagueId, found.credentials)
  return result.candidates
}
