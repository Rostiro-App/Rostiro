import players from '@/app/demo/fixtures/players.json'
import league from '@/app/demo/fixtures/league.json'
import week from '@/app/demo/fixtures/week.json'
import waivers from '@/app/demo/fixtures/waivers.json'
import chat from '@/app/demo/fixtures/chat.json'
import timeline from '@/app/demo/fixtures/timeline.json'
import type { DemoPlayer, DemoLeague, DemoWeek, TimelineBeat } from './types'

export function loadFixtures() {
  return {
    players: players as DemoPlayer[],
    league: league as DemoLeague,
    week: week as unknown as DemoWeek,
    waivers: waivers as { playerId: string; name: string; pos: string; addPct: number; faabSuggestion: number }[],
    chat: chat as Record<string, string[]>,
    timeline: [...(timeline as TimelineBeat[])].sort((a, b) => a.timeOffset - b.timeOffset),
  }
}
