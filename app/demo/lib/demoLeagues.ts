import players from '@/app/demo/fixtures/players.json'

export interface DemoLeagueMatchup {
  myScore: number
  oppScore: number
  secondsRemaining: number   // game-seconds left across active starters (0..3600+)
  projMargin: number         // expected final margin given remaining projections
}
export interface DemoLeagueEntry {
  id: string
  name: string
  founderRoster: string[]    // real players.json ids
  matchup: DemoLeagueMatchup
}

// Top real players by season points form the cross-league CORE — on the
// founder's roster in ALL three leagues, so a star injection prefills 3 rows.
const ranked = (players as { id: string }[]).map((p) => p.id)
export const CORE_ROSTER_IDS: string[] = ranked.slice(0, 8)
// League-specific role players (disjoint slices) so mid/low picks hit 1 league.
const roleA = ranked.slice(8, 16)
const roleB = ranked.slice(16, 24)
const roleC = ranked.slice(24, 32)

// Tight, authored live matchups → an injected TD produces a big, real win-prob
// swing. Illustrative demo scores, not real-game live data.
export const DEMO_LEAGUES: DemoLeagueEntry[] = [
  { id: 'll', name: "Lawrence's Legends League", founderRoster: [...CORE_ROSTER_IDS, ...roleA],
    matchup: { myScore: 96.4, oppScore: 98.1, secondsRemaining: 900, projMargin: -1.5 } },
  { id: 'sm', name: 'Sunday Money', founderRoster: [...CORE_ROSTER_IDS, ...roleB],
    matchup: { myScore: 101.2, oppScore: 104.0, secondsRemaining: 720, projMargin: -2.0 } },
  { id: 'bit', name: 'The Bit League', founderRoster: [...CORE_ROSTER_IDS, ...roleC],
    matchup: { myScore: 88.7, oppScore: 90.0, secondsRemaining: 1200, projMargin: 1.0 } },
]
