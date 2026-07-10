import type { StatePack } from '@/app/demo/lib/studioPacks'
import { DEMO_LEAGUES } from '@/app/demo/lib/demoLeagues'
import players from '@/app/demo/fixtures/players.json'
import { FilmRecap } from './FilmRecap'
import { FilmFocalCard } from './FilmFocalCard'
import { FilmAuthorForm } from './FilmAuthorForm'

export interface FilmUsage { name: string; position: string; direction: 'buy_low' | 'sell_high'; deltaPct: number }
export interface FilmContent { leagueName: string; won: boolean | null; myScore: number; oppScore: number; recap: string; usage: FilmUsage | null }

const P = players as { name: string; pos: string }[]

export const filmPack: StatePack<FilmContent> = {
  state: 'film_room', label: 'Film Room',
  defaultContent: () => ({ leagueName: "Lawrence's Legends League", won: true, myScore: 0, oppScore: 0, recap: '', usage: null }),
  prefill: () => {
    const lg = DEMO_LEAGUES[0]
    const p = P[20] // a real mid-tier player as the buy-low signal
    return {
      leagueName: lg.name,
      won: lg.matchup.myScore > lg.matchup.oppScore,
      myScore: lg.matchup.myScore,
      oppScore: lg.matchup.oppScore,
      recap: 'Came down to the last flex. Your RB core carried it.',
      usage: { name: p.name, position: p.pos, direction: 'buy_low', deltaPct: 15 },
    }
  },
  AuthorForm: FilmAuthorForm, FullSurface: FilmRecap, FocalCard: FilmFocalCard,
}
