import type { RostiroState } from '@/types'

export interface DemoPlayer {
  id: string            // nflverse gsis_id / player id
  name: string
  pos: string
  nflTeam: string
  headshotUrl: string | null
  adp: number | null
  season: { points: number; games: number }
}

export interface PlayerStatline {
  playerId: string
  points: number
  line: string          // e.g. "22 car, 118 yds, 2 TD"
}

export interface DemoManager {
  managerId: string
  teamName: string
  handle: string
  archetype: 'founder' | 'sweat' | 'casual' | 'flavor'
  roster: string[]      // DemoPlayer.id[]
  record: { w: number; l: number }
  seasonPoints: number
}

export interface DemoLeague { name: string; managers: DemoManager[] }

export interface DemoWeek {
  week: number
  matchups: { home: string; away: string }[]   // managerId pairs
  boxScores: Record<string, PlayerStatline>     // playerId → statline
}

export interface ScriptedAlert {
  id: string
  kind: 'touchdown' | 'injury' | 'trade' | 'waiver' | 'info'
  title: string
  body: string
}

export interface FixturePatch {
  boxScore?: PlayerStatline   // upsert a live scoring delta
}

export interface TimelineBeat {
  timeOffset: number          // seconds from tour start
  state?: RostiroState
  activeAlert?: ScriptedAlert
  patch?: FixturePatch
  label?: string
}

export interface DemoState {
  virtualClock: number
  currentState: RostiroState
  activeAlert: ScriptedAlert | null
}
