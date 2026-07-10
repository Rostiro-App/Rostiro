import players from '@/app/demo/fixtures/players.json'
import week from '@/app/demo/fixtures/week.json'
import { DEMO_LEAGUES } from './demoLeagues'

export interface ScenarioGame { id: string; away: string; home: string }
export interface ScenarioPlayer {
  playerId: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null
  finalPoints: number; tdCount: number; eventLabel: string; gameId: string; starting: boolean
}
export interface ScenarioMatchup { leagueName: string; oppFinal: number; oppProjected: number }
export interface LiveScenario {
  featuredLeagueName: string
  games: ScenarioGame[]
  players: ScenarioPlayer[]
  matchups: ScenarioMatchup[]
}

interface P { id: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null }
const POOL = new Map((players as P[]).map((p) => [p.id, p]))
const BOX = (week as { boxScores: Record<string, { playerId: string; points: number; line: string }> }).boxScores

const tdCountFrom = (line: string): number => {
  const m = line.match(/(\d+)\s*TD/)
  return m ? Number(m[1]) : 0
}

/** Real founder-roster players who have a box score this week, top by points. */
export function prefillLiveScenario(): LiveScenario {
  const founder = DEMO_LEAGUES[0]
  const featured = founder.founderRoster
    .map((id) => ({ p: POOL.get(id), box: BOX[id] }))
    .filter((x): x is { p: P; box: { playerId: string; points: number; line: string } } => !!x.p && !!x.box)
    .sort((a, b) => b.box.points - a.box.points)
    .slice(0, 8)

  // Group into 3 games of ~3; each game's teams drawn from its players (deduped, padded).
  const games: ScenarioGame[] = []
  const scPlayers: ScenarioPlayer[] = []
  const per = Math.ceil(featured.length / 3)
  for (let gi = 0; gi * per < featured.length; gi++) {
    const chunk = featured.slice(gi * per, gi * per + per)
    const teams = [...new Set(chunk.map((c) => c.p.nflTeam))]
    const away = teams[0] ?? 'AFC'
    const home = teams[1] ?? (teams[0] === 'NFC' ? 'AFC' : 'NFC')
    const id = `g${gi}`
    games.push({ id, away, home })
    chunk.forEach((c, i) => scPlayers.push({
      playerId: c.p.id, name: c.p.name, pos: c.p.pos, nflTeam: c.p.nflTeam, headshotUrl: c.p.headshotUrl,
      finalPoints: c.box.points, tdCount: tdCountFrom(c.box.line), eventLabel: 'TD', gameId: id,
      starting: gi * per + i < 6, // top 6 start
    }))
  }

  const myProjected = scPlayers.filter((p) => p.starting).reduce((s, p) => s + p.finalPoints, 0)
  const matchups: ScenarioMatchup[] = DEMO_LEAGUES.slice(0, 3).map((lg, i) => ({
    leagueName: lg.name,
    oppFinal: Math.round((myProjected - [3.4, 6.1, 1.8][i]) * 10) / 10, // authored: a close late win
    oppProjected: Math.round((myProjected - [3.4, 6.1, 1.8][i]) * 10) / 10,
  }))

  return { featuredLeagueName: founder.name, games, players: scPlayers, matchups }
}
