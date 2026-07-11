// T-163 companion / Studio Push Moment pack: an authorable iOS lock-screen
// push. Generic across push types (touchdown/lineup_lock/scratch). Pure,
// in-memory, route-isolated (no product-code imports).
import { DEMO_LEAGUES } from './demoLeagues'
import players from '@/app/demo/fixtures/players.json'

export interface PushMoment {
  appName: string
  title: string
  body: string
  timeLabel: string
  clockTime: string
  dateLabel: string
}

type DemoPlayerLite = { id: string; name: string; pos: string; nflTeam: string }

export function formatLeagueLine(leagueNames: string[]): string {
  const first = leagueNames[0] ?? ''
  const extra = leagueNames.length - 1
  return extra > 0 ? `${first} +${extra} ${extra === 1 ? 'other' : 'others'}` : first
}

export function defaultPushMoment(): PushMoment {
  return {
    appName: 'Rostiro',
    title: 'Josh Allen — ruled OUT',
    body: "Josh Allen ruled out. Starting in Lawrence's Legends League +2 others.",
    timeLabel: 'now',
    clockTime: '12:47',
    dateLabel: 'Sunday, September 14',
  }
}

// Real-data prefill: a real fixture player + the real demo league names.
export function prefillPushMoment(): PushMoment {
  const pool = players as DemoPlayerLite[]
  const player = pool[0] // deterministic; the author can swap via the form
  const leagueNames = DEMO_LEAGUES.map((l) => l.name)
  return {
    appName: 'Rostiro',
    title: `${player.name} — ruled OUT`,
    body: `${player.name} ruled out. Starting in ${formatLeagueLine(leagueNames)}.`,
    timeLabel: 'now',
    clockTime: '12:47',
    dateLabel: 'Sunday, September 14',
  }
}
