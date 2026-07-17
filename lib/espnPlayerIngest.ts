// Packet 03, P3-4B: server-only ESPN player-ingestion service. Populates
// (or, in dry-run, plans) players_cache rows with platform='espn' from
// ESPN's real kona_player_info shape — the same shape lib/platforms/espn.ts
// and P3-3's real captures already confirmed live (Israel Abanikanda,
// Ameer Abdullah, De'Von Achane, Puka Nacua, Jonathan Taylor).
//
// ESPN's player pool is queried through ONE connected league's context
// (there is no league-agnostic global endpoint), but the returned
// ownership%/ADP figures are cross-ESPN aggregates, not scoped to that one
// league — confirmed by the real capture's ownership.percentOwned/
// averageDraftPosition values, which read as global figures, not
// tiny-12-team-league-specific ones.
//
// Pure mapping (mapEspnPlayerEntry) is separated from the network fetch
// (ingestEspnPlayers) so the mapping logic is fully testable against real
// captured fixture shapes without a live ESPN call.

import { getEspnAllPlayers } from '@/lib/espn'
import { espnPosition, espnProTeamAbbrev } from '@/lib/platforms/espnMaps'

export interface EspnPlayerCacheCandidate {
  playerId: string
  platform: 'espn'
  name: string
  firstName: string | null
  lastName: string | null
  position: string | null
  nflTeam: string | null // null = genuinely no current NFL team (proTeamId 0/missing) — never a placeholder string
  injuryStatus: string | null
  adpEspn: number | null
  ownershipPct: number | null
}

interface RawEspnPlayerEntry {
  id?: number
  player?: {
    id?: number
    fullName?: string
    firstName?: string
    lastName?: string
    defaultPositionId?: number
    proTeamId?: number
    injuryStatus?: string
    ownership?: {
      percentOwned?: number
      averageDraftPosition?: number
    }
  }
}

/**
 * Maps one raw kona_player_info entry into a players_cache-shaped
 * candidate. Pure — no network, no DB — testable against real captured
 * fixtures (lib/espnPlayerIngest.test.ts).
 */
export function mapEspnPlayerEntry(entry: RawEspnPlayerEntry): EspnPlayerCacheCandidate | null {
  const player = entry?.player
  if (!player?.id) return null

  return {
    playerId: String(player.id),
    platform: 'espn',
    name: player.fullName ?? '',
    firstName: player.firstName ?? null,
    lastName: player.lastName ?? null,
    position: espnPosition(player.defaultPositionId),
    nflTeam: espnProTeamAbbrev(player.proTeamId),
    injuryStatus: player.injuryStatus ?? null,
    adpEspn: player.ownership?.averageDraftPosition ?? null,
    ownershipPct: player.ownership?.percentOwned ?? null,
  }
}

export interface EspnIngestResult {
  candidates: EspnPlayerCacheCandidate[]
  pagesFetched: number
  hitMaxPages: boolean
  totalRawEntries: number
  skippedNoId: number
}

export async function ingestEspnPlayers(
  leagueId: string,
  credentials: { espnS2: string; swid: string },
  opts?: { pageSize?: number; maxPages?: number }
): Promise<EspnIngestResult> {
  const { players, pagesFetched, hitMaxPages } = await getEspnAllPlayers(leagueId, credentials, opts)

  const candidates: EspnPlayerCacheCandidate[] = []
  let skippedNoId = 0
  for (const raw of players as RawEspnPlayerEntry[]) {
    const mapped = mapEspnPlayerEntry(raw)
    if (!mapped) {
      skippedNoId++
      continue
    }
    candidates.push(mapped)
  }

  return { candidates, pagesFetched, hitMaxPages, totalRawEntries: players.length, skippedNoId }
}
