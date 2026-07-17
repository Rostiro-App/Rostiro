// Packet 03: shared ESPN numeric-ID maps — extracted from lib/platforms/espn.ts
// so both the intelligence adapter and lib/espnPlayerIngest.ts (P3-4B) read
// the exact same table, never two copies that could silently drift apart.
//
// ESPN's defaultPositionId/proTeamId numeric enum is unofficial — ESPN
// publishes no schema for it. Both tables below are now FULLY verified
// live (2026-07-17, P3-4B) against real ESPN kona_player_info data: every
// position ID was confirmed via a real, >50%-owned player at that
// position (Josh Allen=QB/1, Jahmyr Gibbs=RB/2, Puka Nacua=WR/3, Brock
// Bowers=TE/4, Brandon Aubrey=K/5, Texans D/ST=DEF/16), and every team ID
// was confirmed via all 32 real team-defense entries' exact, unambiguous
// display names (e.g. "Chiefs D/ST" -> proTeamId 12, "Jaguars D/ST" ->
// proTeamId 30) — team names are ground truth in a way an individual
// skill player's current team never fully is (trades happen).
//
// This table REPLACES an earlier, incorrect P3-3 version that had two
// real bugs (proTeamId 12 and 34 both mapped to 'HOU'; 13 and 30 both
// mapped to 'LV') — caught by P3-4B's dry-run collision report when two
// different real team defenses ("Chiefs D/ST", "Jaguars D/ST") landed in
// the same identity bucket as a different team's defense. P3-3's original
// comment claimed proTeamId 6 was live-confirmed as NYJ (via Israel
// Abanikanda) — that was wrong; 6 is DAL. Confirming a skill player's
// team from a map that hadn't itself been independently verified was
// circular, not a real confirmation — a mistake worth naming so it isn't
// repeated. See docs/espn-verification-checklist.md.

import type { NFLPosition } from '@/types'

export const ESPN_POSITION_MAP: Record<number, NFLPosition> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
}

// proTeamId 0: ESPN's convention for "no current NFL team" (unsigned free
// agent) — not directly captured this session (no real player in any
// fetch had proTeamId 0), so this specific value is still an inference,
// not a live confirmation, and is treated as null (no placeholder
// abbreviation) rather than asserted with confidence.
export const ESPN_PRO_TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI',
  23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR',
  30: 'JAX', 33: 'BAL', 34: 'HOU',
}

export function espnProTeamAbbrev(proTeamId: number | undefined | null): string | null {
  if (proTeamId == null || proTeamId === 0) return null
  return ESPN_PRO_TEAM_MAP[proTeamId] ?? null
}

export function espnPosition(defaultPositionId: number | undefined | null): NFLPosition | null {
  if (defaultPositionId == null) return null
  return ESPN_POSITION_MAP[defaultPositionId] ?? null
}
