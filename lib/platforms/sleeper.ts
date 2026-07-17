// Packet 02: proves the canonical platform contract (lib/platforms/types.ts)
// is genuinely cross-platform, not a dormant abstraction built only for
// Yahoo — adapts lib/normalize.ts's existing normalizeSleeperLeague()
// output onto NormalizedLeague. Deliberately not a rewrite of Sleeper's
// normalization logic itself (out of scope for this packet); this only
// adds the fields NormalizedLeague requires that League doesn't carry.

import type { League } from '@/types'
import type { NormalizedLeague, PlatformCapabilities } from './types'

// lib/sleeper.ts has no lineup/waiver/trade write functions implemented
// today — Draft Kit and league sync are read-only in this codebase — so
// these mirror actual shipped code, not Sleeper's API's theoretical
// capability. Update this if/when a real Sleeper write path ships.
export const SLEEPER_CAPABILITIES: PlatformCapabilities = {
  leagueRead: true,
  rosterRead: true,
  matchupRead: true,
  draftRead: true,
  freeAgentRead: true,
  lineupWrite: false,
  waiverWrite: false,
  tradeWrite: false,
}

// Sleeper's raw settings/scoring_settings response doesn't carry draft
// scheduling or waiver-type metadata through the existing normalizer, so
// those are honestly reported unknown/empty here rather than guessed —
// same "don't invent a value you can't verify" discipline as the rest of
// lib/normalize.ts.
export function toNormalizedSleeperLeague(league: League): NormalizedLeague {
  return {
    ...league,
    leagueStatus: 'unknown',
    draft: { status: 'unknown', scheduledAt: null },
    waiver: { type: 'unknown', faabBudget: null, waiverDay: null, waiverHour: null },
    capabilities: SLEEPER_CAPABILITIES,
    warnings: [],
  }
}
