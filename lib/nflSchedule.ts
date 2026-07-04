// T-79 prerequisite: NFL schedule / kickoff time source for Rostiro States
// (PRD 6.10). Source is nflverse/nfldata's games.csv — open, free, no API
// key, community-maintained. Confirmed live July 3, 2026 with the full 2026
// season already published, including Week 1's Wednesday-night Australia
// game (gametime is always Eastern time per nflverse's own docs, regardless
// of where the game is actually played — see migration_nfl_schedule.sql).

import { parseCsvLine } from '@/lib/csv'

const GAMES_CSV_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'

export interface ScheduledGame {
  gameId: string
  season: number
  gameType: string
  week: number
  gameDate: string // YYYY-MM-DD
  gameTimeEt: string // HH:MM (24h, Eastern) — nflverse convention
  homeTeam: string
  awayTeam: string
}

export async function fetchNflSchedule(season: number): Promise<ScheduledGame[]> {
  const res = await fetch(GAMES_CSV_URL)
  if (!res.ok) throw new Error(`nflverse games.csv fetch failed: ${res.status}`)
  const text = await res.text()

  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  const header = parseCsvLine(lines[0])
  const col = (name: string) => header.indexOf(name)

  const idxGameId = col('game_id')
  const idxSeason = col('season')
  const idxGameType = col('game_type')
  const idxWeek = col('week')
  const idxGameday = col('gameday')
  const idxGametime = col('gametime')
  const idxHome = col('home_team')
  const idxAway = col('away_team')

  const games: ScheduledGame[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    const rowSeason = Number(fields[idxSeason])
    if (rowSeason !== season) continue

    const gameTimeEt = fields[idxGametime]?.trim()
    // Future playoff slots (TBD matchups) have no kickoff time yet — skip
    // until nflverse fills them in on a later sync.
    if (!gameTimeEt) continue

    games.push({
      gameId: fields[idxGameId],
      season: rowSeason,
      gameType: fields[idxGameType],
      week: Number(fields[idxWeek]),
      gameDate: fields[idxGameday],
      gameTimeEt: gameTimeEt.length === 5 ? `${gameTimeEt}:00` : gameTimeEt,
      homeTeam: fields[idxHome],
      awayTeam: fields[idxAway],
    })
  }
  return games
}
