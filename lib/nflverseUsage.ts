// T-87: weekly snap-count/usage ingestion — nflverse's snap_counts release
// has no Sleeper player ID of its own, only a Pro-Football-Reference id
// (pfr_player_id). The join back to our canonical Sleeper player_id is
// verified, not guessed:
//   snap_counts.pfr_player_id -> (nflverse players.csv crosswalk) -> gsis_id
//   -> (Sleeper's own /players/nfl payload, which carries gsis_id per
//      player — confirmed live, e.g. Todd Gurley: "00-0032241") -> sleeper_id
// Resolved once per sync rather than stored as a standing crosswalk table —
// callers only ever need the final sleeper-keyed rows.

import { parseCsvLine } from '@/lib/csv'
import type { SleeperCachePlayer } from '@/lib/sleeper'

const PLAYERS_CROSSWALK_URL = 'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'
const snapCountsUrl = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`

export interface PlayerUsageSnapshot {
  season: number
  week: number
  playerId: string // sleeper player_id — resolved, never pfr/gsis downstream
  position: string | null
  team: string | null
  opponent: string | null
  offenseSnaps: number
  offensePct: number | null
  defenseSnaps: number
  defensePct: number | null
  stSnaps: number
  stPct: number | null
}

interface ParsedCsv {
  header: string[]
  rows: string[][]
}

async function fetchCsv(url: string): Promise<ParsedCsv | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`nflverse fetch failed (${url}): ${res.status}`)
  const text = await res.text()
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null
  return { header: parseCsvLine(lines[0]), rows: lines.slice(1).map(parseCsvLine) }
}

// gsis_id -> sleeper player_id. Built from data the caller already fetched
// today (the daily players cron), not a second Sleeper API call.
function buildGsisToSleeperMap(sleeperPlayers: SleeperCachePlayer[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of sleeperPlayers) {
    if (p.gsisId) map.set(p.gsisId, p.playerId)
  }
  return map
}

// pfr_id -> gsis_id, from nflverse's own player-id crosswalk release.
async function fetchPfrToGsisMap(): Promise<Map<string, string>> {
  const csv = await fetchCsv(PLAYERS_CROSSWALK_URL)
  const map = new Map<string, string>()
  if (!csv) return map
  const idxGsis = csv.header.indexOf('gsis_id')
  const idxPfr = csv.header.indexOf('pfr_id')
  for (const fields of csv.rows) {
    const pfrId = fields[idxPfr]?.trim()
    const gsisId = fields[idxGsis]?.trim()
    if (pfrId && gsisId) map.set(pfrId, gsisId)
  }
  return map
}

const num = (v: string | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOrNull = (v: string | undefined): number | null => {
  if (v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Returns [] on a season with no snap-count file published yet (nflverse
// only publishes once real games start, ~preseason week 1) — same
// backfill-proofing posture as adp_snapshots/injury_snapshots, never throws
// for "season hasn't started."
export async function fetchPlayerUsageSnapshots(
  season: number,
  sleeperPlayers: SleeperCachePlayer[]
): Promise<PlayerUsageSnapshot[]> {
  const [pfrToGsis, snapCsv] = await Promise.all([fetchPfrToGsisMap(), fetchCsv(snapCountsUrl(season))])
  if (!snapCsv) return []

  const gsisToSleeper = buildGsisToSleeperMap(sleeperPlayers)
  const col = (name: string) => snapCsv.header.indexOf(name)
  const idxWeek = col('week')
  const idxPfrId = col('pfr_player_id')
  const idxPosition = col('position')
  const idxTeam = col('team')
  const idxOpponent = col('opponent')
  const idxOffSnaps = col('offense_snaps')
  const idxOffPct = col('offense_pct')
  const idxDefSnaps = col('defense_snaps')
  const idxDefPct = col('defense_pct')
  const idxStSnaps = col('st_snaps')
  const idxStPct = col('st_pct')

  const snapshots: PlayerUsageSnapshot[] = []
  for (const fields of snapCsv.rows) {
    const pfrId = fields[idxPfrId]?.trim()
    if (!pfrId) continue
    const gsisId = pfrToGsis.get(pfrId)
    if (!gsisId) continue
    const sleeperId = gsisToSleeper.get(gsisId)
    if (!sleeperId) continue

    snapshots.push({
      season,
      week: Number(fields[idxWeek]),
      playerId: sleeperId,
      position: fields[idxPosition] || null,
      team: fields[idxTeam] || null,
      opponent: fields[idxOpponent] || null,
      offenseSnaps: num(fields[idxOffSnaps]),
      offensePct: numOrNull(fields[idxOffPct]),
      defenseSnaps: num(fields[idxDefSnaps]),
      defensePct: numOrNull(fields[idxDefPct]),
      stSnaps: num(fields[idxStSnaps]),
      stPct: numOrNull(fields[idxStPct]),
    })
  }
  return snapshots
}
