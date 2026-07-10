import type { LiveScenario, ScenarioPlayer } from './liveScenario'

export interface LivePlayerFrame {
  playerId: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null
  points: number; projected: number; event: string | null
  leagueChips: { leagueName: string; starting: boolean }[]
}
export interface LiveMatchupFrame { leagueName: string; myScore: number; oppScore: number; myProjected: number; oppProjected: number }
export interface LiveGameFrame { away: string; home: string; awayScore: number; homeScore: number; period: number; clock: string; players: LivePlayerFrame[] }
export interface LiveSimFrame { games: LiveGameFrame[]; matchups: LiveMatchupFrame[] }

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const round1 = (n: number) => Math.round(n * 10) / 10
const EVENT_HALF_WINDOW = 0.02 // ± around each event moment

function activeEvent(p: ScenarioPlayer, t: number): string | null {
  if (p.tdCount <= 0) return null
  for (let k = 1; k <= p.tdCount; k++) {
    const moment = k / (p.tdCount + 1)
    if (Math.abs(t - moment) <= EVENT_HALF_WINDOW) return p.eventLabel
  }
  return null
}

/** Pure: the live frame at clock fraction t (0..1), reading ONLY the scenario. */
export function liveSimAt(t: number, scenario: LiveScenario): LiveSimFrame {
  const tt = clamp01(t)
  const framePlayer = (p: ScenarioPlayer): LivePlayerFrame => ({
    playerId: p.playerId, name: p.name, pos: p.pos, nflTeam: p.nflTeam, headshotUrl: p.headshotUrl,
    points: round1(p.finalPoints * tt), projected: p.finalPoints, event: activeEvent(p, tt),
    leagueChips: [{ leagueName: scenario.featuredLeagueName, starting: p.starting }],
  })

  const games: LiveGameFrame[] = scenario.games.map((g, gi) => {
    const gp = scenario.players.filter((p) => p.gameId === g.id)
    return {
      away: g.away, home: g.home,
      awayScore: Math.round((7 + gi * 3) * tt), homeScore: Math.round((10 + gi * 2) * tt),
      period: Math.min(4, Math.floor(tt * 4) + 1),
      clock: `${14 - Math.floor((tt * 4 % 1) * 14)}:00`,
      players: gp.map(framePlayer),
    }
  })

  const starters = scenario.players.filter((p) => p.starting)
  const myScore = round1(starters.reduce((s, p) => s + p.finalPoints * tt, 0))
  const myProjected = round1(starters.reduce((s, p) => s + p.finalPoints, 0))
  const matchups: LiveMatchupFrame[] = scenario.matchups.map((m) => ({
    leagueName: m.leagueName, myScore, myProjected,
    oppScore: round1(m.oppFinal * tt), oppProjected: m.oppProjected,
  }))

  return { games, matchups }
}
