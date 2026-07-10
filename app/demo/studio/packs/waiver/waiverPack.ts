import waivers from '@/app/demo/fixtures/waivers.json'
import type { StatePack } from '@/app/demo/lib/studioPacks'
import { WaiverBriefing } from './WaiverBriefing'
import { WaiverFocalCard } from './WaiverFocalCard'
import { WaiverAuthorForm } from './WaiverAuthorForm'

export interface WaiverTarget { name: string; pos: string; addPct: number; faabSuggestion: number }
export interface WaiverContent { leagueName: string; targets: WaiverTarget[] }

const RAW = waivers as { name: string; pos: string; addPct: number; faabSuggestion: number }[]

export const waiverPack: StatePack<WaiverContent> = {
  state: 'waiver_day', label: 'Waiver Day',
  defaultContent: () => ({ leagueName: "Lawrence's Legends League", targets: [] }),
  prefill: () => ({
    leagueName: "Lawrence's Legends League",
    targets: RAW.slice(0, 4).map((w) => ({ name: w.name, pos: w.pos, addPct: w.addPct, faabSuggestion: w.faabSuggestion })),
  }),
  AuthorForm: WaiverAuthorForm, FullSurface: WaiverBriefing, FocalCard: WaiverFocalCard,
}
